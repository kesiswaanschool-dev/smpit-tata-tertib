// ================================================================
// SETTINGS PAGE (ADMIN ONLY)
// ================================================================

let allViolationTypes = [];
let allGuruAccounts = [];
let allAchievementTypes = [];

document.addEventListener('DOMContentLoaded', async () => {
    requireAdmin();
    renderNav('pengaturan');
    initUserDisplay();

    showLoading('Memuat pengaturan...');
    try {
        await Promise.all([listenGuruAccounts(), listenViolationTypes(), listenAchievementTypes()]);
        initDbTabConfig();
    } finally {
        hideLoading();
    }

    document.getElementById('guru-form').addEventListener('submit', addGuruAccount);
    document.getElementById('vtype-form').addEventListener('submit', addViolationType);
    document.getElementById('vt-filter-cat').addEventListener('change', renderVTypeTable);

    document.getElementById('atype-form').addEventListener('submit', addAchievementType);
    document.getElementById('at-filter-cat').addEventListener('change', renderATypeTable);
});

function switchTab(tab) {
    document.getElementById('content-guru').style.display = tab === 'guru' ? 'block' : 'none';
    document.getElementById('content-vtype').style.display = tab === 'vtype' ? 'block' : 'none';
    document.getElementById('content-atype').style.display = tab === 'atype' ? 'block' : 'none';
    document.getElementById('content-theme').style.display = tab === 'theme' ? 'block' : 'none';
    document.getElementById('content-db').style.display = tab === 'db' ? 'block' : 'none';
    
    document.getElementById('tab-guru').classList.toggle('active', tab === 'guru');
    document.getElementById('tab-vtype').classList.toggle('active', tab === 'vtype');
    document.getElementById('tab-atype').classList.toggle('active', tab === 'atype');
    document.getElementById('tab-theme').classList.toggle('active', tab === 'theme');
    document.getElementById('tab-db').classList.toggle('active', tab === 'db');
}


// ---- GURU ACCOUNTS ----
function listenGuruAccounts() {
    db.collection('users').orderBy('name').onSnapshot(snap => {
        allGuruAccounts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderGuruTable();
    }, err => {
        showToast('Gagal memuat akun guru: ' + err.message, 'error');
    });
}

function renderGuruTable() {
    const tbody = document.getElementById('guru-tbody');
    if (allGuruAccounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="padding:24px">
            <div class="empty-icon">👩‍🏫</div>
            <h3>Belum ada akun guru</h3>
            <p>Tambahkan akun guru menggunakan form di atas</p>
        </div></td></tr>`;
        return;
    }

    tbody.innerHTML = allGuruAccounts.map((g, i) => `
        <tr>
            <td class="td-muted">${i+1}</td>
            <td style="font-weight:600">${g.name || '-'}</td>
            <td class="td-muted">${g.username || '-'}</td>
            <td>
                <span class="badge ${g.role === 'admin' ? 'badge-amber' : 'badge-blue'}">
                    ${g.role === 'admin' ? '👑 Admin' : '👩‍🏫 Guru'}
                </span>
            </td>
            <td>
                <button class="btn btn-xs btn-danger" onclick="deleteGuru('${g.id}')">🗑️ Hapus</button>
            </td>
        </tr>`).join('');
}

async function addGuruAccount(e) {
    e.preventDefault();
    const name = document.getElementById('g-name').value.trim();
    const username = document.getElementById('g-username').value.trim();
    const password = document.getElementById('g-password').value.trim();
    const role = document.getElementById('g-role').value;

    if (!name || !username || !password) {
        showToast('Harap isi semua field yang wajib', 'warning');
        return;
    }

    // Check username uniqueness
    const existing = allGuruAccounts.find(g => g.username.toLowerCase() === username.toLowerCase());
    if (existing) {
        showToast('Username sudah digunakan', 'warning');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:6px"></span>Membuat akun...';

    try {
        await db.collection('users').add({
            name, username, password, role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast(`✅ Akun "${name}" berhasil dibuat`, 'success');
        document.getElementById('guru-form').reset();
    } catch (err) {
        showToast('❌ Gagal membuat akun: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
}

async function deleteGuru(id) {
    const guru = allGuruAccounts.find(g => g.id === id);
    const name = guru ? guru.name : 'guru ini';
    const ok = await confirmAction(`Hapus akun guru <strong>${escHtml(name)}</strong>?`);
    if (!ok) return;
    try {
        await db.collection('users').doc(id).delete();
        showToast('Akun berhasil dihapus', 'success');
    } catch (e) {
        showToast('Gagal menghapus: ' + e.message, 'error');
    }
}

// ---- VIOLATION TYPES ----
function listenViolationTypes() {
    db.collection('violation_types').orderBy('category').onSnapshot(snap => {
        allViolationTypes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateCategoryDatalist();
        updateCategoryFilter();
        renderVTypeTable();
    }, err => {
        showToast('Gagal memuat jenis pelanggaran: ' + err.message, 'error');
    });
}

function updateCategoryDatalist() {
    const cats = [...new Set(allViolationTypes.map(v => v.category))];
    document.getElementById('cat-list').innerHTML = cats.map(c => `<option value="${c}">`).join('');
}

function updateCategoryFilter() {
    const cats = [...new Set(allViolationTypes.map(v => v.category))];
    const sel = document.getElementById('vt-filter-cat');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Semua Kategori</option>' +
        cats.map(c => `<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
}

function renderVTypeTable() {
    const filterCat = document.getElementById('vt-filter-cat').value;
    const filtered = filterCat
        ? allViolationTypes.filter(v => v.category === filterCat)
        : allViolationTypes;

    const tbody = document.getElementById('vtype-tbody');
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="padding:24px">
            <div class="empty-icon">📝</div>
            <h3>Belum ada jenis pelanggaran</h3>
        </div></td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((v, i) => `
        <tr>
            <td class="td-muted">${i+1}</td>
            <td><span class="badge badge-amber">${v.category || '-'}</span></td>
            <td>${v.name || '-'}</td>
            <td><span class="badge badge-red" style="font-weight:700">${v.score || 0} poin</span></td>
            <td>
                <button class="btn btn-xs btn-danger" onclick="deleteVType('${v.id}','${(v.name||'').replace(/'/g,"\\'")}')">🗑️</button>
            </td>
        </tr>`).join('');
}

async function addViolationType(e) {
    e.preventDefault();
    const category = document.getElementById('vt-cat').value.trim();
    const name = document.getElementById('vt-name').value.trim();
    const score = parseInt(document.getElementById('vt-score').value) || 0;

    if (!category || !name || !score) {
        showToast('Harap isi semua field', 'warning');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:6px"></span>Menambahkan...';

    try {
        const maxOrder = Math.max(0, ...allViolationTypes.map(v => v.order || 0));
        await db.collection('violation_types').add({
            category, name, score,
            order: maxOrder + 1,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('✅ Jenis pelanggaran berhasil ditambahkan', 'success');
        document.getElementById('vtype-form').reset();
    } catch (err) {
        showToast('❌ Gagal menambahkan: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
}

async function deleteVType(id, name) {
    const ok = await confirmAction(`Hapus jenis pelanggaran "<strong>${name}</strong>"?`);
    if (!ok) return;
    try {
        await db.collection('violation_types').doc(id).delete();
        showToast('Jenis pelanggaran dihapus', 'success');
    } catch (e) {
        showToast('Gagal menghapus: ' + e.message, 'error');
    }
}

async function resetViolationTypes() {
    const ok = await confirmAction('Reset semua jenis pelanggaran ke data default? Data yang ada akan dihapus.', 'Reset');
    if (!ok) return;

    showLoading('Mereset jenis pelanggaran...');
    try {
        const snap = await db.collection('violation_types').get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        const batch2 = db.batch();
        DEFAULT_VIOLATION_TYPES.forEach(vt => {
            const ref = db.collection('violation_types').doc();
            batch2.set(ref, { ...vt, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        await batch2.commit();
        showToast('Jenis pelanggaran berhasil direset ke default', 'success');
    } catch (e) {
        showToast('Gagal reset: ' + e.message, 'error');
    } finally {
        hideLoading();
    }
}

// ---- VIOLATION EXCEL IMPORT/EXPORT ----
function downloadVTypeTemplate() {
    if (typeof XLSX === 'undefined') { showToast('SheetJS tidak tersedia', 'error'); return; }
    const headers = ['Kategori', 'Nama Pelanggaran', 'Poin'];
    const examples = [
        ['Aspek Kelakuan', 'Membully teman', 200],
        ['Aspek Kerapian', 'Baju tidak dimasukkan (laki-laki)', 20],
        ['Aspek Kebersihan', 'Tidak melaksanakan tugas piket', 70]
    ];
    const wsData = [headers, ...examples];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pelanggaran');
    XLSX.writeFile(wb, 'template_jenis_pelanggaran.xlsx');
    showToast('Template Excel Jenis Pelanggaran diunduh', 'success');
}

async function importVTypeExcel(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    showLoading('Mengimpor jenis pelanggaran...');

    try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) {
            showToast('File Excel kosong', 'warning');
            hideLoading();
            input.value = '';
            return;
        }

        const batch = db.batch();
        let count = 0;
        rows.forEach((row, i) => {
            const category = (row['Kategori'] || '').toString().trim();
            const name = (row['Nama Pelanggaran'] || '').toString().trim();
            const score = parseInt(row['Poin']) || 0;

            if (!category || !name || score <= 0) return;

            const ref = db.collection('violation_types').doc();
            batch.set(ref, {
                category,
                name,
                score,
                order: i + 1,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            count++;
        });

        if (count === 0) {
            showToast('Tidak ada data pelanggaran valid ditemukan', 'warning');
            hideLoading();
            input.value = '';
            return;
        }

        await batch.commit();
        showToast(`✅ Berhasil mengimpor ${count} jenis pelanggaran`, 'success');
    } catch (e) {
        showToast('Gagal mengimpor: ' + e.message, 'error');
    } finally {
        hideLoading();
        input.value = '';
    }
}

// ---- ACHIEVEMENT TYPES ----
function listenAchievementTypes() {
    db.collection('achievement_types').orderBy('category').onSnapshot(snap => {
        allAchievementTypes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateATypeCategoryDatalist();
        updateATypeCategoryFilter();
        renderATypeTable();
    }, err => {
        showToast('Gagal memuat jenis prestasi: ' + err.message, 'error');
    });
}

function updateATypeCategoryDatalist() {
    const cats = [...new Set(allAchievementTypes.map(v => v.category))];
    document.getElementById('at-cat-list').innerHTML = cats.map(c => `<option value="${c}">`).join('');
}

function updateATypeCategoryFilter() {
    const cats = [...new Set(allAchievementTypes.map(v => v.category))];
    const sel = document.getElementById('at-filter-cat');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Semua Kategori</option>' +
        cats.map(c => `<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
}

function renderATypeTable() {
    const filterCat = document.getElementById('at-filter-cat').value;
    const filtered = filterCat
        ? allAchievementTypes.filter(v => v.category === filterCat)
        : allAchievementTypes;

    const tbody = document.getElementById('atype-tbody');
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="padding:24px">
            <div class="empty-icon">🏆</div>
            <h3>Belum ada jenis prestasi</h3>
        </div></td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((v, i) => `
        <tr>
            <td class="td-muted">${i+1}</td>
            <td><span class="badge badge-green">${v.category || '-'}</span></td>
            <td>${v.name || '-'}</td>
            <td><span class="badge badge-blue" style="font-weight:700">${v.score || 0} poin</span></td>
            <td>
                <button class="btn btn-xs btn-danger" onclick="deleteAType('${v.id}','${(v.name||'').replace(/'/g,"\\'")}')">🗑️</button>
            </td>
        </tr>`).join('');
}

async function addAchievementType(e) {
    e.preventDefault();
    const category = document.getElementById('at-cat').value.trim();
    const name = document.getElementById('at-name').value.trim();
    const score = parseInt(document.getElementById('at-score').value) || 0;

    if (!category || !name || !score) {
        showToast('Harap isi semua field', 'warning');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:6px"></span>Menambahkan...';

    try {
        const maxOrder = Math.max(0, ...allAchievementTypes.map(v => v.order || 0));
        await db.collection('achievement_types').add({
            category, name, score,
            order: maxOrder + 1,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('✅ Jenis prestasi berhasil ditambahkan', 'success');
        document.getElementById('atype-form').reset();
    } catch (err) {
        showToast('❌ Gagal menambahkan: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
}

async function deleteAType(id, name) {
    const ok = await confirmAction(`Hapus jenis prestasi "<strong>${name}</strong>"?`);
    if (!ok) return;
    try {
        await db.collection('achievement_types').doc(id).delete();
        showToast('Jenis prestasi dihapus', 'success');
    } catch (e) {
        showToast('Gagal menghapus: ' + e.message, 'error');
    }
}

async function resetAchievementTypes() {
    const ok = await confirmAction('Reset semua jenis prestasi ke data default? Data yang ada akan dihapus.', 'Reset');
    if (!ok) return;

    showLoading('Mereset jenis prestasi...');
    try {
        const snap = await db.collection('achievement_types').get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        const batch2 = db.batch();
        DEFAULT_ACHIEVEMENT_TYPES.forEach(at => {
            const ref = db.collection('achievement_types').doc();
            batch2.set(ref, { ...at, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        await batch2.commit();
        showToast('Jenis prestasi berhasil direset ke default', 'success');
    } catch (e) {
        showToast('Gagal reset: ' + e.message, 'error');
    } finally {
        hideLoading();
    }
}

// ---- ACHIEVEMENT EXCEL IMPORT/EXPORT ----
function downloadATypeTemplate() {
    if (typeof XLSX === 'undefined') { showToast('SheetJS tidak tersedia', 'error'); return; }
    const headers = ['Kategori', 'Nama Prestasi', 'Poin'];
    const examples = [
        ['Akademik', 'Juara Lomba Cerdas Cermat', 50],
        ['Keagamaan / Tahfidz', 'Hafal Juz 30 (Juz Amma)', 100],
        ['Minat & Bakat (Olahraga / Seni)', 'Juara Lomba Olahraga/Seni Tingkat Kota', 60]
    ];
    const wsData = [headers, ...examples];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Prestasi');
    XLSX.writeFile(wb, 'template_jenis_prestasi.xlsx');
    showToast('Template Excel Jenis Prestasi diunduh', 'success');
}

async function importATypeExcel(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    showLoading('Mengimpor jenis prestasi...');

    try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) {
            showToast('File Excel kosong', 'warning');
            hideLoading();
            input.value = '';
            return;
        }

        const batch = db.batch();
        let count = 0;
        rows.forEach((row, i) => {
            const category = (row['Kategori'] || '').toString().trim();
            const name = (row['Nama Prestasi'] || '').toString().trim();
            const score = parseInt(row['Poin']) || 0;

            if (!category || !name || score <= 0) return;

            const ref = db.collection('achievement_types').doc();
            batch.set(ref, {
                category,
                name,
                score,
                order: i + 1,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            count++;
        });

        if (count === 0) {
            showToast('Tidak ada data prestasi valid ditemukan', 'warning');
            hideLoading();
            input.value = '';
            return;
        }

        await batch.commit();
        showToast(`✅ Berhasil mengimpor ${count} jenis prestasi`, 'success');
    } catch (e) {
        showToast('Gagal mengimpor: ' + e.message, 'error');
    } finally {
        hideLoading();
        input.value = '';
    }
}

// ---- DATABASE CONFIG & MIGRATION ----
function initDbTabConfig() {
    const statusText = document.getElementById('db-status-text');
    const statusIcon = document.getElementById('db-status-icon');
    const resetBtn = document.getElementById('btn-reset-db');
    const migrationCard = document.getElementById('migration-card');

    if (isLocalDb) {
        statusIcon.textContent = '📴';
        statusText.innerHTML = 'Database Lokal (Offline) <span class="badge badge-blue">Local Storage Mode</span>';
        resetBtn.style.display = 'none';
        migrationCard.style.display = 'none';
    } else {
        statusIcon.textContent = '🌐';
        statusText.innerHTML = 'Database Cloud (Online) <span class="badge badge-green">Firebase Cloud Mode</span>';
        resetBtn.style.display = 'inline-block';
        
        // Show migration card only if there is local data to migrate
        const hasLocalData = localStorage.getItem('smpit_students') || 
                             localStorage.getItem('smpit_violations') || 
                             localStorage.getItem('smpit_achievements') ||
                             localStorage.getItem('smpit_users');
        if (hasLocalData) {
            migrationCard.style.display = 'block';
        } else {
            migrationCard.style.display = 'none';
        }
    }

    // Populate configuration field if saved
    const saved = localStorage.getItem('smpit_custom_firebase_config');
    if (saved) {
        try {
            const cfg = JSON.parse(saved);
            // Format back to formatted display for convenience
            document.getElementById('db-config-paste').value = JSON.stringify(cfg, null, 2);
        } catch(e) {}
    }

    document.getElementById('db-config-form').addEventListener('submit', saveDbConfig);
}

async function saveDbConfig(e) {
    e.preventDefault();

    const rawVal = document.getElementById('db-config-paste').value.trim();
    if (!rawVal) {
        showToast('⚠️ Kolom konfigurasi tidak boleh kosong', 'warning');
        return;
    }

    // Helper to extract keys using regex
    const extractKey = (keyName) => {
        const regex = new RegExp(`['"]?${keyName}['"]?\\s*:\\s*['"]([^'"]+)['"]`);
        const match = rawVal.match(regex);
        return match ? match[1] : '';
    };

    const apiKey = extractKey('apiKey');
    const projectId = extractKey('projectId');
    const authDomain = extractKey('authDomain') || (projectId ? `${projectId}.firebaseapp.com` : '');
    const storageBucket = extractKey('storageBucket') || (projectId ? `${projectId}.appspot.com` : '');
    const appId = extractKey('appId');
    const messagingSenderId = extractKey('messagingSenderId');

    if (!apiKey || !projectId || !appId) {
        showToast('❌ Gagal mendeteksi konfigurasi. Pastikan Anda menempelkan seluruh kode konfigurasi Firebase dengan benar.', 'error', 6000);
        return;
    }

    const config = {
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        appId,
        messagingSenderId
    };

    try {
        localStorage.setItem('smpit_custom_firebase_config', JSON.stringify(config));
        showToast('✅ Kredensial Firebase disimpan! Menghubungkan database...', 'success');
        
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch(err) {
        showToast('Gagal menyimpan: ' + err.message, 'error');
    }
}


function resetDbConfig() {
    confirmAction('Kembali menggunakan database lokal browser? Kredensial Firebase Anda akan dihapus dari browser ini.', 'Hapus Kredensial').then(ok => {
        if (!ok) return;
        localStorage.removeItem('smpit_custom_firebase_config');
        showToast('🔌 Kredensial Firebase dihapus. Menghubungkan ke database lokal...', 'success');
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    });
}

async function startDataMigration() {
    const ok = await confirmAction('Mulai migrasi semua data lokal ke database Firebase Cloud? Data di cloud tidak akan terhapus, tetapi data lokal akan diunggah.');
    if (!ok) return;

    const btn = document.getElementById('btn-migrate');
    btn.disabled = true;
    btn.textContent = 'Sedang memindahkan data...';
    showLoading('Memigrasikan data ke Firebase Cloud...');

    try {
        const collections = ['students', 'violations', 'achievements', 'users'];
        let migratedCount = 0;

        for (let col of collections) {
            const localData = JSON.parse(localStorage.getItem('smpit_' + col) || '[]');
            if (localData.length === 0) continue;

            const batch = db.batch();
            localData.forEach(item => {
                const dataToUpload = { ...item };
                delete dataToUpload.id; // Let Firestore generate new/keep old
                
                // Convert timestamps back to server timestamps if needed
                for (let k in dataToUpload) {
                    if (dataToUpload[k] && dataToUpload[k]._seconds) {
                        dataToUpload[k] = firebase.firestore.Timestamp.fromMillis(dataToUpload[k]._seconds * 1000);
                    }
                }

                // Use the exact same ID for migration
                const docRef = db.collection(col).doc(item.id);
                batch.set(docRef, dataToUpload);
                migratedCount++;
            });
            
            await batch.commit();
            // Clear migrated local data to avoid double migration next time
            localStorage.removeItem('smpit_' + col);
        }

        showToast(`🎉 Migrasi berhasil! ${migratedCount} data telah diunggah ke Cloud.`, 'success', 5000);
        
        // Refresh settings UI
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    } catch(err) {
        showToast('❌ Gagal melakukan migrasi: ' + err.message, 'error', 6000);
        btn.disabled = false;
        btn.textContent = '🚀 Mulai Migrasi Data ke Cloud';
    } finally {
        hideLoading();
    }
}

