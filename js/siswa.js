// ================================================================
// STUDENT DATA MANAGEMENT
// ================================================================

let allStudents = [];
let filteredStudents = [];
let currentPage = 1;
const PAGE_SIZE = 15;
let unsubscribe = null;

document.addEventListener('DOMContentLoaded', () => {
    requireAdmin(); // Only admin can manage students
    renderNav('siswa');
    initUserDisplay();
    setupListeners();
    listenStudents();
});

function listenStudents() {
    showLoading('Memuat data murid...');
    unsubscribe = db.collection('students').orderBy('nama').onSnapshot(snap => {
        allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        applyFilters();
        updateClassFilter();
        updateWaliFilter();
        updateCounters();
        hideLoading();
    }, err => {
        hideLoading();
        showToast('Gagal memuat data murid: ' + err.message, 'error');
    });
}

function setupListeners() {
    document.getElementById('search-input').addEventListener('input',
        debounce(() => { currentPage = 1; applyFilters(); }, 300));
    document.getElementById('filter-kelas').addEventListener('change', onKelasFilterChange);
    document.getElementById('filter-wali').addEventListener('change', onWaliFilterChange);
    document.getElementById('filter-gender').addEventListener('change', () => { currentPage = 1; applyFilters(); });
    document.getElementById('student-form').addEventListener('submit', saveStudent);
}

function onKelasFilterChange() {
    const kelas = document.getElementById('filter-kelas').value;
    const waliSel = document.getElementById('filter-wali');
    const genderSel = document.getElementById('filter-gender');

    if (kelas) {
        const classStudents = allStudents.filter(s => s.kelas === kelas);
        const walis = [...new Set(classStudents.map(s => s.waliKelas).filter(Boolean))];
        if (walis.length > 0) {
            waliSel.value = walis[0];
        }

        const genders = [...new Set(classStudents.map(s => s.gender).filter(Boolean))];
        if (genders.length === 1) {
            genderSel.value = genders[0];
        }
    } else {
        if (waliSel) waliSel.value = '';
        if (genderSel) genderSel.value = '';
    }

    currentPage = 1;
    applyFilters();
}

function onWaliFilterChange() {
    const wali = document.getElementById('filter-wali').value;
    const kelasSel = document.getElementById('filter-kelas');

    if (wali) {
        const waliStudents = allStudents.filter(s => s.waliKelas === wali);
        const classes = [...new Set(waliStudents.map(s => s.kelas).filter(Boolean))];
        if (classes.length > 0) {
            kelasSel.value = classes[0];
        }
    }

    currentPage = 1;
    applyFilters();
}

function applyFilters() {
    const search = document.getElementById('search-input').value.toLowerCase().trim();
    const kelas = document.getElementById('filter-kelas').value;
    const wali = document.getElementById('filter-wali').value;
    const gender = document.getElementById('filter-gender').value;

    filteredStudents = allStudents.filter(s => {
        const matchSearch = !search ||
            (s.nama || '').toLowerCase().includes(search) ||
            (s.nis || '').toLowerCase().includes(search) ||
            (s.waliKelas || '').toLowerCase().includes(search);
        const matchKelas = !kelas || s.kelas === kelas;
        const matchWali = !wali || s.waliKelas === wali;
        const matchGender = !gender || s.gender === gender;
        return matchSearch && matchKelas && matchWali && matchGender;
    });

    updateCounters();
    renderTable();
    renderPagination();
}

function updateClassFilter() {
    const classes = getClassList(allStudents);
    const sel = document.getElementById('filter-kelas');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Semua Kelas</option>' +
        classes.map(c => `<option value="${c}" ${c === cur ? 'selected' : ''}>${c}</option>`).join('');
}

function updateWaliFilter() {
    const walis = [...new Set(allStudents.map(s => s.waliKelas).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
    const sel = document.getElementById('filter-wali');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Semua Wali Kelas</option>' +
        walis.map(w => `<option value="${w}" ${w === cur ? 'selected' : ''}>${w}</option>`).join('');
}

function updateCounters() {
    const list = filteredStudents || allStudents;
    const l = list.filter(s => s.gender === 'L').length;
    const p = list.filter(s => s.gender === 'P').length;
    document.getElementById('count-total').textContent = `Total: ${list.length}`;
    document.getElementById('count-l').textContent = `Laki-laki: ${l}`;
    document.getElementById('count-p').textContent = `Perempuan: ${p}`;
}

function renderTable() {
    const tbody = document.getElementById('students-tbody');
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageData = filteredStudents.slice(start, start + PAGE_SIZE);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>Belum ada data murid</h3>
                <p>${allStudents.length ? 'Tidak ada yang cocok dengan filter' : 'Tambahkan murid atau import dari Excel'}</p>
            </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = pageData.map((s, i) => {
        const num = start + i + 1;
        const genderBadge = s.gender === 'L'
            ? '<span class="badge badge-blue">L</span>'
            : s.gender === 'P'
            ? '<span class="badge badge-purple">P</span>'
            : '<span class="td-muted">—</span>';

        return `<tr>
            <td class="td-muted">${num}</td>
            <td><div style="font-weight:600">${escHtml(s.nama || '-')}</div></td>
            <td class="td-muted">${escHtml(s.nis || '-')}</td>
            <td><span class="badge badge-blue">${escHtml(s.kelas || '-')}</span></td>
            <td class="td-muted">${escHtml(s.waliKelas || '-')}</td>
            <td>${genderBadge}</td>
            <td>
                <div style="display:flex;gap:6px">
                    <button class="btn btn-sm btn-outline" onclick="openEditModal('${s.id}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteStudent('${s.id}')">🗑️</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderPagination() {
    const total = filteredStudents.length;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);

    document.getElementById('pagination-info').textContent =
        total === 0 ? 'Tidak ada data' : `Menampilkan ${start}–${end} dari ${total} murid`;

    const btns = document.getElementById('pagination-btns');
    if (totalPages <= 1) { btns.innerHTML = ''; return; }

    let html = `<button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage===1 ? 'disabled' : ''}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage-1 && i <= currentPage+1)) {
            html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
        } else if (i === currentPage-2 || i === currentPage+2) {
            html += `<button class="page-btn" disabled>…</button>`;
        }
    }
    html += `<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage===totalPages ? 'disabled' : ''}>›</button>`;
    btns.innerHTML = html;
}

function goPage(p) {
    const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE);
    if (p < 1 || p > totalPages) return;
    currentPage = p;
    renderTable();
    renderPagination();
}

// --- CRUD ---
function openAddModal() {
    document.getElementById('modal-title').textContent = 'Tambah Murid Baru';
    document.getElementById('student-form').reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('btn-save').textContent = '💾 Simpan';
    document.getElementById('modal-student').classList.add('show');
}

function openEditModal(id) {
    const s = allStudents.find(x => x.id === id);
    if (!s) return;

    document.getElementById('modal-title').textContent = 'Edit Data Murid';
    document.getElementById('edit-id').value = id;
    document.getElementById('f-nama').value = s.nama || '';
    document.getElementById('f-nis').value = s.nis || '';
    document.getElementById('f-kelas').value = s.kelas || '';
    document.getElementById('f-gender').value = s.gender || '';
    document.getElementById('f-wali').value = s.waliKelas || '';
    document.getElementById('btn-save').textContent = '💾 Update';
    document.getElementById('modal-student').classList.add('show');
}

function closeModal() {
    document.getElementById('modal-student').classList.remove('show');
}

async function saveStudent(e) {
    e.preventDefault();
    const nama = document.getElementById('f-nama').value.trim();
    const nis = document.getElementById('f-nis').value.trim();
    const kelas = document.getElementById('f-kelas').value.trim();
    const gender = document.getElementById('f-gender').value;
    const waliKelas = document.getElementById('f-wali').value.trim();
    const editId = document.getElementById('edit-id').value;

    if (!nama || !kelas || !waliKelas) {
        showToast('Harap isi semua field yang wajib diisi', 'warning');
        return;
    }

    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const data = {
        nama, nis, kelas, gender, waliKelas,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (editId) {
            await db.collection('students').doc(editId).update(data);
            showToast('Data murid berhasil diperbarui', 'success');
        } else {
            // Cek duplikat berdasarkan NIS
            if (nis && allStudents.some(s => s.nis === nis)) {
                showToast(`NIS "${nis}" sudah terdaftar untuk murid lain`, 'error');
                btn.disabled = false;
                btn.textContent = '💾 Simpan';
                return;
            }
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('students').add(data);
            showToast('Murid berhasil ditambahkan', 'success');
        }
        closeModal();
    } catch (err) {
        showToast('Gagal menyimpan: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = editId ? '💾 Update' : '💾 Simpan';
    }
}

async function deleteStudent(id) {
    const student = allStudents.find(s => s.id === id);
    const nama = student ? student.nama : 'murid ini';
    const ok = await confirmAction(`Hapus murid <strong>${escHtml(nama)}</strong>? Data pelanggaran dan prestasi akan tetap tersimpan.`);
    if (!ok) return;

    try {
        await db.collection('students').doc(id).delete();
        showToast('Murid berhasil dihapus', 'success');
    } catch (err) {
        showToast('Gagal menghapus: ' + err.message, 'error');
    }
}

// --- Excel Import ---
async function importExcel(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    showLoading('Mengimpor data Excel...');

    try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) {
            showToast('File Excel kosong atau format tidak sesuai', 'warning');
            hideLoading();
            input.value = '';
            return;
        }

        // Build lookup map for existing students by NIS
        const existingByNis = new Map();
        const existingByNamaKelas = new Map();
        allStudents.forEach(s => {
            if (s.nis) existingByNis.set(s.nis.toString().trim(), s);
            const key = (s.nama || '').trim() + '|' + (s.kelas || '').trim();
            existingByNamaKelas.set(key, s);
        });

        const batch = db.batch();
        let added = 0;
        let skipped = 0;

        rows.forEach(row => {
            const nama = (row['Nama Murid'] || '').toString().trim();
            const kelas = (row['Kelas'] || '').toString().trim();
            const waliKelas = (row['Wali Kelas'] || '').toString().trim();
            const nis = (row['NIS'] || '').toString().trim();
            const genderRaw = (row['Jenis Kelamin (L/P)'] || row['Jenis Kelamin'] || '').toString().trim().toUpperCase();
            const gender = (genderRaw === 'L' || genderRaw === 'LAKI-LAKI' || genderRaw === 'L.') ? 'L'
                         : (genderRaw === 'P' || genderRaw === 'PEREMPUAN' || genderRaw === 'P.') ? 'P' : '';

            // Skip empty rows or instruction rows
            if (!nama || nama.startsWith('(') || nama === 'Nama Murid') return;
            if (!kelas) return;

            // Check for duplicates
            const duplicate = nis
                ? existingByNis.has(nis)
                : existingByNamaKelas.has(nama + '|' + kelas);

            if (duplicate) {
                skipped++;
                return;
            }

            const ref = db.collection('students').doc();
            batch.set(ref, {
                nama,
                nis,
                kelas,
                waliKelas,
                gender,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            added++;
        });

        if (added === 0) {
            showToast(`Tidak ada data baru — ${skipped} data sudah terdaftar`, 'warning');
            hideLoading();
            input.value = '';
            return;
        }

        await batch.commit();
        const msg = `${added} murid berhasil diimport` + (skipped > 0 ? `, ${skipped} dilewati (sudah terdaftar)` : '');
        showToast(msg, 'success');
    } catch (err) {
        showToast('Gagal import: ' + err.message, 'error');
    } finally {
        hideLoading();
        input.value = '';
    }
}

// --- Excel Export Students ---
function exportStudents() {
    if (filteredStudents.length === 0) {
        showToast('Tidak ada data murid untuk diexport', 'warning');
        return;
    }
    const data = filteredStudents.map((s, i) => ({
        'No': i + 1,
        'Nama Murid': s.nama || '',
        'NIS': s.nis || '',
        'Kelas': s.kelas || '',
        'Wali Kelas': s.waliKelas || '',
        'Jenis Kelamin': s.gender === 'L' ? 'Laki-laki' : (s.gender === 'P' ? 'Perempuan' : '')
    }));
    downloadExcel(data, `data_siswa_${today()}.xls`, 'Data Siswa');
    showToast(`${data.length} data murid berhasil diexport (.xls)`, 'success');
}

// --- Hapus Semua Data ---
async function deleteAllStudents() {
    const total = allStudents.length;
    if (total === 0) {
        showToast('Tidak ada data murid untuk dihapus', 'warning');
        return;
    }

    const ok = await confirmAction(
        `Hapus <strong>semua ${total} murid</strong>?<br><br>` +
        `Tindakan ini akan menghapus seluruh data murid dari database. ` +
        `Data pelanggaran dan prestasi tidak ikut terhapus.`
    );
    if (!ok) return;

    showLoading('Menghapus semua data murid...');

    try {
        const batch = db.batch();
        const students = [...allStudents];
        let deleted = 0;

        for (const s of students) {
            batch.delete(db.collection('students').doc(s.id));
            deleted++;
            if (deleted % 400 === 0) {
                await batch.commit();
            }
        }
        if (deleted % 400 !== 0) {
            await batch.commit();
        }

        showToast(`${deleted} murid berhasil dihapus`, 'success');
    } catch (err) {
        showToast('Gagal menghapus: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

// --- Hapus Data Duplikat ---
async function deduplicateStudents() {
    const seen = new Map();
    const duplicates = [];

    for (const s of allStudents) {
        const key = s.nis ? s.nis.toString().trim() : (s.nama || '').trim() + '|' + (s.kelas || '').trim();
        if (seen.has(key)) {
            duplicates.push(s.id);
        } else {
            seen.set(key, s);
        }
    }

    if (duplicates.length === 0) {
        showToast('Tidak ditemukan data duplikat', 'success');
        return;
    }

    const ok = await confirmAction(
        `Ditemukan <strong>${duplicates.length} data duplikat</strong>.<br><br>` +
        `Hapus semua duplikat? Data dengan NIS/Nama yang sama hanya akan menyisakan 1 data.`
    );
    if (!ok) return;

    showLoading('Menghapus data duplikat...');

    try {
        let deleted = 0;
        for (let i = 0; i < duplicates.length; i += 400) {
            const batch = db.batch();
            const chunk = duplicates.slice(i, i + 400);
            chunk.forEach(id => batch.delete(db.collection('students').doc(id)));
            await batch.commit();
            deleted += chunk.length;
        }
        showToast(`${deleted} data duplikat berhasil dihapus`, 'success');
    } catch (err) {
        showToast('Gagal menghapus duplikat: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

// --- Helpers ---
function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Close modal on outside click
document.getElementById('modal-student').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});
