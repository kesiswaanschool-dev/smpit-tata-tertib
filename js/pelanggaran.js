// ================================================================
// VIOLATION MANAGEMENT
// ================================================================

let allStudents = [];
let violationTypes = [];
let allViolations = [];
let filteredViolations = [];
let histPage = 1;
const HIST_SIZE = 15;
let selectedStudent = null;

document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();
    renderNav('pelanggaran');
    initUserDisplay();

    if (!isAdmin()) {
        const btnExport = document.getElementById('btn-export');
        if (btnExport) btnExport.style.display = 'none';
        const thAksi = document.getElementById('th-aksi');
        if (thAksi) thAksi.style.display = 'none';
    }

    document.getElementById('f-date').value = today();

    // Show recorder info
    const session = getSession();
    if (session) {
        document.getElementById('recorder-name').textContent = session.name;
        const now = new Date();
        document.getElementById('recorder-date').textContent =
            now.toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    }
    showLoading('Memuat data...');
    try {
        await Promise.all([loadStudents(), loadViolationTypes()]);
        setupListeners();
        listenViolations();
        listenTodayViolations();
    } catch (e) {
        showToast('Gagal memuat data: ' + e.message, 'error');
    } finally {
        hideLoading();
    }
});

async function loadStudents() {
    const snap = await db.collection('students').orderBy('nama').get();
    allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadViolationTypes() {
    const snap = await db.collection('violation_types').orderBy('order').get();
    violationTypes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    populateViolationDropdown();
    populateCategoryFilter();
}

function populateViolationDropdown() {
    const sel = document.getElementById('f-type');
    const groups = {};
    violationTypes.forEach(vt => {
        if (!groups[vt.category]) groups[vt.category] = [];
        groups[vt.category].push(vt);
    });

    sel.innerHTML = '<option value="">-- Pilih Jenis Pelanggaran --</option>';
    Object.entries(groups).forEach(([cat, items]) => {
        const optGroup = document.createElement('optgroup');
        optGroup.label = cat;
        items.forEach(vt => {
            const opt = document.createElement('option');
            opt.value = vt.id;
            opt.dataset.score = vt.score;
            opt.dataset.category = vt.category;
            opt.dataset.name = vt.name;
            opt.textContent = `${vt.name} (${vt.score} poin)`;
            optGroup.appendChild(opt);
        });
        sel.appendChild(optGroup);
    });
}

function populateCategoryFilter() {
    const cats = [...new Set(violationTypes.map(v => v.category))];
    const sel = document.getElementById('hist-cat');
    sel.innerHTML = '<option value="">Semua Kategori</option>' +
        cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

function onViolTypeChange() {
    const sel = document.getElementById('f-type');
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.value) {
        document.getElementById('f-score').value = opt.dataset.score || '';
        document.getElementById('f-category').value = opt.dataset.category || '';
    } else {
        document.getElementById('f-score').value = '';
        document.getElementById('f-category').value = '';
    }
}

// --- Student Autocomplete ---
function setupListeners() {
    const searchInp = document.getElementById('student-search');
    const dropdown = document.getElementById('student-dropdown');

    searchInp.addEventListener('input', debounce(() => {
        const q = searchInp.value.toLowerCase().trim();
        if (!q) { dropdown.classList.remove('show'); return; }

        const matches = allStudents.filter(s =>
            (s.nama || '').toLowerCase().includes(q) ||
            (s.nis || '').toLowerCase().includes(q)
        ).slice(0, 8);

        if (matches.length === 0) {
            dropdown.innerHTML = '<div class="autocomplete-item"><span class="item-name">Tidak ditemukan</span></div>';
        } else {
            dropdown.innerHTML = matches.map(s => `
                <div class="autocomplete-item" onclick="selectStudent('${s.id}')">
                    <span class="item-name">${s.nama}</span>
                    <span class="item-sub">${s.kelas || ''} • ${s.nis || ''}</span>
                </div>`).join('');
        }
        dropdown.classList.add('show');
    }, 200));

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrap')) {
            dropdown.classList.remove('show');
        }
    });

    // History filters
    document.getElementById('hist-search').addEventListener('input', debounce(() => { histPage=1; applyHistFilters(); }, 300));
    document.getElementById('hist-kelas').addEventListener('change', () => { histPage=1; applyHistFilters(); });
    document.getElementById('hist-cat').addEventListener('change', () => { histPage=1; applyHistFilters(); });
    document.getElementById('hist-date-from').addEventListener('change', () => { histPage=1; applyHistFilters(); });
    document.getElementById('hist-date-to').addEventListener('change', () => { histPage=1; applyHistFilters(); });

    // Form submit
    document.getElementById('viol-form').addEventListener('submit', saveViolation);
}

function selectStudent(id) {
    const s = allStudents.find(x => x.id === id);
    if (!s) return;
    selectedStudent = s;
    document.getElementById('student-search').value = s.nama;
    document.getElementById('student-id').value = s.id;
    document.getElementById('f-kelas').value = s.kelas || '';
    document.getElementById('f-wali').value = s.waliKelas || '';
    document.getElementById('student-dropdown').classList.remove('show');
    document.getElementById('student-preview').style.display = 'block';
    document.getElementById('preview-name').textContent = s.nama;
    document.getElementById('preview-class').textContent = `Kelas: ${s.kelas || '-'} · Wali Kelas: ${s.waliKelas || '-'}`;
}

// --- Form Submit ---
async function saveViolation(e) {
    e.preventDefault();
    const session = getSession();

    const studentId = document.getElementById('student-id').value;
    const typeId = document.getElementById('f-type').value;
    const score = parseInt(document.getElementById('f-score').value) || 0;
    const date = document.getElementById('f-date').value;
    const notes = document.getElementById('f-notes').value.trim();

    if (!studentId) { showToast('Harap pilih murid terlebih dahulu', 'warning'); return; }
    if (!typeId) { showToast('Harap pilih jenis pelanggaran', 'warning'); return; }
    if (!score || score < 1) { showToast('Poin pelanggaran harus diisi', 'warning'); return; }
    if (!date) { showToast('Harap pilih tanggal', 'warning'); return; }

    const vt = violationTypes.find(v => v.id === typeId);
    const student = allStudents.find(s => s.id === studentId);

    const btn = document.getElementById('btn-submit');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:6px"></span>Menyimpan...';

    try {
        await db.collection('violations').add({
            studentId,
            studentName: student?.nama || '',
            kelas: student?.kelas || '',
            waliKelas: student?.waliKelas || '',
            violationTypeId: typeId,
            violationType: vt?.name || '',
            category: vt?.category || '',
            score,
            date,
            notes,
            recordedBy: session?.name || 'Unknown',
            recordedByRole: session?.role || 'guru',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(`✅ Pelanggaran berhasil dicatat · ${score} poin`, 'success');

        // Reset form (keep student & date)
        document.getElementById('f-type').value = '';
        document.getElementById('f-category').value = '';
        document.getElementById('f-score').value = '';
        document.getElementById('f-notes').value = '';
    } catch (err) {
        showToast('❌ Gagal menyimpan: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
}

// --- Today violations ---
function listenTodayViolations() {
    db.collection('violations').where('date', '==', today())
        .orderBy('createdAt', 'desc')
        .onSnapshot(snap => {
            const items = snap.docs.map(d => d.data());
            document.getElementById('today-count').textContent = items.length;
            renderTodayList(items);
        });
}

function renderTodayList(items) {
    const container = document.getElementById('today-list');
    if (items.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding:24px">
            <div class="empty-icon" style="font-size:32px">✅</div>
            <p>Belum ada pelanggaran hari ini</p>
        </div>`;
        return;
    }
    container.innerHTML = items.slice(0, 8).map(v => `
        <div style="display:flex;align-items:center;justify-content:space-between;
            padding:10px 0;border-bottom:1px solid var(--border)">
            <div>
                <div style="font-size:13px;font-weight:600">${v.studentName || '-'}</div>
                <div style="font-size:11px;color:var(--text-muted)">${v.violationType || '-'} · Kelas ${v.kelas || '-'}</div>
            </div>
            <span class="badge badge-red">${v.score || 0}</span>
        </div>`).join('') + (items.length > 8 ? `<div class="text-center text-muted" style="padding:8px;font-size:12px">+${items.length-8} lainnya</div>` : '');
}

// --- History ---
function listenViolations() {
    db.collection('violations').orderBy('date', 'desc').onSnapshot(snap => {
        allViolations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateHistKelasFilter();
        applyHistFilters();
    });
}

function updateHistKelasFilter() {
    const classes = [...new Set(allViolations.map(v => v.kelas).filter(Boolean))].sort();
    const sel = document.getElementById('hist-kelas');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Semua Kelas</option>' +
        classes.map(c => `<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
}

function applyHistFilters() {
    const search = document.getElementById('hist-search').value.toLowerCase();
    const kelas = document.getElementById('hist-kelas').value;
    const cat = document.getElementById('hist-cat').value;
    const from = document.getElementById('hist-date-from').value;
    const to = document.getElementById('hist-date-to').value;

    filteredViolations = allViolations.filter(v => {
        const matchSearch = !search || (v.studentName||'').toLowerCase().includes(search);
        const matchKelas = !kelas || v.kelas === kelas;
        const matchCat = !cat || v.category === cat;
        const matchFrom = !from || v.date >= from;
        const matchTo = !to || v.date <= to;
        return matchSearch && matchKelas && matchCat && matchFrom && matchTo;
    });

    renderHistTable();
    renderHistPagination();
}

function renderHistTable() {
    const tbody = document.getElementById('history-tbody');
    const start = (histPage - 1) * HIST_SIZE;
    const page = filteredViolations.slice(start, start + HIST_SIZE);
    const admin = isAdmin();

    if (page.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${admin ? 10 : 9}"><div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3>Belum ada data</h3>
            <p>Catatan pelanggaran akan muncul di sini</p>
        </div></td></tr>`;
        return;
    }

    tbody.innerHTML = page.map((v, i) => `
        <tr>
            <td class="td-muted">${start+i+1}</td>
            <td class="td-muted">${formatDateShort(v.date)}</td>
            <td style="font-weight:600">${v.studentName || '-'}</td>
            <td><span class="badge badge-blue">${v.kelas || '-'}</span></td>
            <td style="max-width:200px;white-space:normal;font-size:12px">${v.violationType || '-'}</td>
            <td><span class="badge badge-amber">${v.category || '-'}</span></td>
            <td><span class="badge badge-red" style="font-size:13px;font-weight:800">${v.score || 0}</span></td>
            <td class="td-muted" style="max-width:150px;font-size:12px">${v.notes || '—'}</td>
            <td class="td-muted">${v.recordedBy || '-'}</td>
            ${admin ? `<td><button class="btn btn-xs btn-danger" onclick="deleteViolation('${v.id}')">🗑️</button></td>` : ''}
        </tr>`).join('');
}

function renderHistPagination() {
    const total = filteredViolations.length;
    const totalPages = Math.ceil(total / HIST_SIZE);
    const start = (histPage-1)*HIST_SIZE+1;
    const end = Math.min(histPage*HIST_SIZE, total);

    document.getElementById('hist-info').textContent = total === 0 ? 'Tidak ada data' : `Menampilkan ${start}–${end} dari ${total}`;

    const btns = document.getElementById('hist-btns');
    if (totalPages <= 1) { btns.innerHTML = ''; return; }
    let html = `<button class="page-btn" onclick="goHistPage(${histPage-1})" ${histPage===1?'disabled':''}>‹</button>`;
    for (let i=1; i<=totalPages; i++) {
        if (i===1||i===totalPages||(i>=histPage-1&&i<=histPage+1)) {
            html += `<button class="page-btn ${i===histPage?'active':''}" onclick="goHistPage(${i})">${i}</button>`;
        } else if (i===histPage-2||i===histPage+2) {
            html += `<button class="page-btn" disabled>…</button>`;
        }
    }
    html += `<button class="page-btn" onclick="goHistPage(${histPage+1})" ${histPage===totalPages?'disabled':''}>›</button>`;
    btns.innerHTML = html;
}

function goHistPage(p) {
    const totalPages = Math.ceil(filteredViolations.length / HIST_SIZE);
    if (p < 1 || p > totalPages) return;
    histPage = p;
    renderHistTable();
    renderHistPagination();
}

async function deleteViolation(id) {
    if (!isAdmin()) {
        showToast('Anda tidak memiliki akses untuk menghapus data.', 'error');
        return;
    }
    const ok = await confirmAction('Hapus catatan pelanggaran ini?');
    if (!ok) return;
    try {
        await db.collection('violations').doc(id).delete();
        showToast('Catatan pelanggaran dihapus', 'success');
    } catch (e) {
        showToast('Gagal menghapus: ' + e.message, 'error');
    }
}

function exportViolations() {
    if (!isAdmin()) {
        showToast('Anda tidak memiliki akses untuk meng-export data.', 'error');
        return;
    }
    const data = filteredViolations.map((v, i) => ({
        'No': i+1,
        'Tanggal': v.date,
        'Nama Murid': v.studentName,
        'Kelas': v.kelas,
        'Wali Kelas': v.waliKelas,
        'Jenis Pelanggaran': v.violationType,
        'Kategori': v.category,
        'Poin': v.score,
        'Keterangan': v.notes || '',
        'Dicatat Oleh': v.recordedBy || ''
    }));
    downloadExcel(data, `pelanggaran_${today()}.xls`, 'Pelanggaran');
    showToast(`${data.length} data berhasil diexport (.xls)`, 'success');
}
