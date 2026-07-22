// ================================================================
// ACHIEVEMENT MANAGEMENT
// ================================================================

let allStudents = [];
let allAchievements = [];
let filteredAchievements = [];
let histPage = 1;
const HIST_SIZE = 15;

const categoryColors = {
    'Akademik': 'badge-blue',
    'Keagamaan / Tahfidz': 'badge-green',
    'Minat & Bakat (Olahraga / Seni)': 'badge-purple',
    'Lain-lain': 'badge-amber'
};

document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();
    renderNav('prestasi');
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

    let achievementTypes = [];

    showLoading('Memuat data...');
    try {
        await Promise.all([loadStudents(), loadAchievementTypes()]);
        setupListeners();
        listenAchievements();
        listenRecentAchievements();
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

async function loadAchievementTypes() {
    try {
        const snap = await db.collection('achievement_types').orderBy('order').get();
        achievementTypes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        populateAchievementDropdown();
        populateCategoryFilter();
    } catch(e) {
        console.error("Gagal memuat jenis prestasi:", e);
    }
}

function populateAchievementDropdown() {
    const sel = document.getElementById('f-type');
    if (achievementTypes.length === 0) {
        sel.innerHTML = '<option value="">-- Belum ada jenis prestasi (tambahkan di Pengaturan) --</option>';
        return;
    }
    const groups = {};
    achievementTypes.forEach(at => {
        if (!groups[at.category]) groups[at.category] = [];
        groups[at.category].push(at);
    });

    sel.innerHTML = '<option value="">-- Pilih Jenis Prestasi --</option>';
    Object.entries(groups).forEach(([cat, items]) => {
        const optGroup = document.createElement('optgroup');
        optGroup.label = cat;
        items.forEach(at => {
            const opt = document.createElement('option');
            opt.value = at.id;
            opt.dataset.score = at.score;
            opt.dataset.category = at.category;
            opt.dataset.name = at.name;
            opt.textContent = `${at.name} (${at.score} poin)`;
            optGroup.appendChild(opt);
        });
        sel.appendChild(optGroup);
    });
}

function populateCategoryFilter() {
    const cats = [...new Set(achievementTypes.map(v => v.category))];
    const sel = document.getElementById('hist-cat');
    if (sel) {
        sel.innerHTML = '<option value="">Semua Kategori</option>' +
            cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

function onAchTypeChange() {
    const sel = document.getElementById('f-type');
    const opt = sel.options[sel.selectedIndex];
    const scoreInp = document.getElementById('f-score');

    if (opt && opt.value) {
        scoreInp.value = opt.dataset.score || '';
        document.getElementById('f-category').value = opt.dataset.category || '';

        // Only allow score editing for "Lain-lain" category
        if (opt.dataset.category === 'Lain-lain') {
            scoreInp.readOnly = false;
            scoreInp.style.background = 'transparent';
        } else {
            scoreInp.readOnly = true;
            scoreInp.style.background = 'rgba(255,255,255,0.02)';
        }
    } else {
        scoreInp.value = '';
        document.getElementById('f-category').value = '';
        scoreInp.readOnly = true;
        scoreInp.style.background = 'rgba(255,255,255,0.02)';
    }
}


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

    document.getElementById('hist-search').addEventListener('input', debounce(() => { histPage=1; applyHistFilters(); }, 300));
    document.getElementById('hist-kelas').addEventListener('change', () => { histPage=1; applyHistFilters(); });
    document.getElementById('hist-cat').addEventListener('change', () => { histPage=1; applyHistFilters(); });
    document.getElementById('hist-date-from').addEventListener('change', () => { histPage=1; applyHistFilters(); });
    document.getElementById('hist-date-to').addEventListener('change', () => { histPage=1; applyHistFilters(); });

    document.getElementById('ach-form').addEventListener('submit', saveAchievement);
}

function selectStudent(id) {
    const s = allStudents.find(x => x.id === id);
    if (!s) return;
    document.getElementById('student-search').value = s.nama;
    document.getElementById('student-id').value = s.id;
    document.getElementById('f-kelas').value = s.kelas || '';
    document.getElementById('f-wali').value = s.waliKelas || '';
    document.getElementById('student-dropdown').classList.remove('show');
    document.getElementById('student-preview').style.display = 'block';
    document.getElementById('preview-name').textContent = s.nama;
    document.getElementById('preview-class').textContent = `Kelas: ${s.kelas || '-'} · Wali Kelas: ${s.waliKelas || '-'}`;
}

async function saveAchievement(e) {
    e.preventDefault();
    const session = getSession();

    const studentId = document.getElementById('student-id').value;
    const typeSel = document.getElementById('f-type');
    const typeOpt = typeSel.options[typeSel.selectedIndex];
    const score = parseInt(document.getElementById('f-score').value) || 0;
    const date = document.getElementById('f-date').value;
    const notes = document.getElementById('f-notes').value.trim();

    if (!studentId) { showToast('Harap pilih murid terlebih dahulu', 'warning'); return; }
    if (!typeOpt || !typeOpt.value) { showToast('Harap pilih jenis prestasi', 'warning'); return; }
    if (!score || score < 1) { showToast('Poin prestasi harus diisi', 'warning'); return; }
    if (!date) { showToast('Harap pilih tanggal', 'warning'); return; }

    const student = allStudents.find(s => s.id === studentId);
    const btn = document.getElementById('btn-submit');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:6px"></span>Menyimpan...';

    try {
        await db.collection('achievements').add({
            studentId,
            studentName: student?.nama || '',
            kelas: student?.kelas || '',
            waliKelas: student?.waliKelas || '',
            achievementTypeId: typeOpt.value,
            achievementType: typeOpt.dataset.name || '',
            category: typeOpt.dataset.category || '',
            score,
            date,
            notes,
            recordedBy: session?.name || 'Unknown',
            recordedByRole: session?.role || 'guru',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(`✅ Prestasi berhasil dicatat · +${score} poin`, 'success');

        // Reset selectively
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

function listenRecentAchievements() {
    const todayStr = today();
    db.collection('achievements').orderBy('createdAt', 'desc').limit(20).onSnapshot(snap => {
        const items = snap.docs.map(d => d.data());
        const todayCount = items.filter(a => a.date === todayStr).length;
        document.getElementById('today-count').textContent = `${todayCount} hari ini`;
        renderRecentList(items.slice(0, 8));
    });
}

function renderRecentList(items) {
    const container = document.getElementById('recent-list');
    if (items.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding:24px">
            <div class="empty-icon" style="font-size:32px">🏆</div>
            <p>Belum ada prestasi dicatat</p>
        </div>`;
        return;
    }

    container.innerHTML = items.map(a => `
        <div style="display:flex;align-items:center;justify-content:space-between;
            padding:10px 0;border-bottom:1px solid var(--border)">
            <div>
                <div style="font-size:13px;font-weight:600">${a.studentName || '-'}</div>
                <div style="font-size:11px;color:var(--text-muted)">${a.achievementType || '-'}</div>
                <div style="margin-top:3px"><span class="badge ${categoryColors[a.category] || 'badge-blue'}" style="font-size:10px">${a.category || '-'}</span></div>
            </div>
            <span class="badge badge-green">−${a.score || 0}</span>
        </div>`).join('');
}

function listenAchievements() {
    db.collection('achievements').orderBy('date', 'desc').onSnapshot(snap => {
        allAchievements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateHistKelasFilter();
        applyHistFilters();
    });
}

function updateHistKelasFilter() {
    const classes = [...new Set(allAchievements.map(a => a.kelas).filter(Boolean))].sort();
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

    filteredAchievements = allAchievements.filter(a => {
        const matchSearch = !search || (a.studentName||'').toLowerCase().includes(search);
        const matchKelas = !kelas || a.kelas === kelas;
        const matchCat = !cat || a.category === cat;
        const matchFrom = !from || a.date >= from;
        const matchTo = !to || a.date <= to;
        return matchSearch && matchKelas && matchCat && matchFrom && matchTo;
    });

    renderHistTable();
    renderHistPagination();
}

function renderHistTable() {
    const tbody = document.getElementById('history-tbody');
    const start = (histPage-1) * HIST_SIZE;
    const page = filteredAchievements.slice(start, start + HIST_SIZE);
    const admin = isAdmin();

    if (page.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${admin ? 10 : 9}"><div class="empty-state">
            <div class="empty-icon">🏆</div>
            <h3>Belum ada data prestasi</h3>
            <p>Catatan prestasi akan muncul di sini</p>
        </div></td></tr>`;
        return;
    }

    tbody.innerHTML = page.map((a, i) => `
        <tr>
            <td class="td-muted">${start+i+1}</td>
            <td class="td-muted">${formatDateShort(a.date)}</td>
            <td style="font-weight:600">${a.studentName || '-'}</td>
            <td><span class="badge badge-blue">${a.kelas || '-'}</span></td>
            <td style="max-width:200px;white-space:normal;font-size:12px">${a.achievementType || '-'}</td>
            <td><span class="badge ${categoryColors[a.category] || 'badge-blue'}">${a.category || '-'}</span></td>
            <td><span class="badge badge-green" style="font-size:13px;font-weight:800">−${a.score || 0}</span></td>
            <td class="td-muted" style="font-size:12px">${a.notes || '—'}</td>
            <td class="td-muted">${a.recordedBy || '-'}</td>
            ${admin ? `<td><button class="btn btn-xs btn-danger" onclick="deleteAchievement('${a.id}')">🗑️</button></td>` : ''}
        </tr>`).join('');
}

function renderHistPagination() {
    const total = filteredAchievements.length;
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
    const totalPages = Math.ceil(filteredAchievements.length / HIST_SIZE);
    if (p < 1 || p > totalPages) return;
    histPage = p;
    renderHistTable();
    renderHistPagination();
}

async function deleteAchievement(id) {
    if (!isAdmin()) {
        showToast('Anda tidak memiliki akses untuk menghapus data.', 'error');
        return;
    }
    const ok = await confirmAction('Hapus catatan prestasi ini?');
    if (!ok) return;
    try {
        await db.collection('achievements').doc(id).delete();
        showToast('Catatan prestasi dihapus', 'success');
    } catch (e) {
        showToast('Gagal menghapus: ' + e.message, 'error');
    }
}

function exportAchievements() {
    if (!isAdmin()) {
        showToast('Anda tidak memiliki akses untuk meng-export data.', 'error');
        return;
    }
    const data = filteredAchievements.map((a, i) => ({
        'No': i+1,
        'Tanggal': a.date,
        'Nama Murid': a.studentName,
        'Kelas': a.kelas,
        'Wali Kelas': a.waliKelas,
        'Jenis Prestasi': a.achievementType,
        'Kategori': a.category || '',
        'Poin': a.score,
        'Keterangan': a.notes || '',
        'Dicatat Oleh': a.recordedBy || ''
    }));
    downloadExcel(data, `prestasi_${today()}.xlsx`, 'Prestasi');
    showToast(`${data.length} data berhasil diexport`, 'success');
}
