// ================================================================
// UTILITY FUNCTIONS
// ================================================================

// --- Theme Manager ---
function initTheme() {
    const savedTheme = localStorage.getItem('smpit_theme') || 'orange';
    setTheme(savedTheme, false);
}

function setTheme(theme, notify = true) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('smpit_theme', theme);

    const icons = { orange: '🍊 Orange', dark: '🌙 Dark', light: '☀️ Light' };
    const btnText = document.getElementById('theme-btn-text');
    if (btnText) btnText.textContent = icons[theme] || '🎨 Tema';

    const themeCards = document.querySelectorAll('.theme-card-option');
    themeCards.forEach(c => {
        if (c.dataset.theme === theme) c.classList.add('active');
        else c.classList.remove('active');
    });

    if (notify) showToast(`Warna tampilan diubah ke ${icons[theme] || theme}`, 'success');
}

function cycleTheme() {
    const current = localStorage.getItem('smpit_theme') || 'orange';
    const themes = ['orange', 'dark', 'light'];
    const nextIndex = (themes.indexOf(current) + 1) % themes.length;
    setTheme(themes[nextIndex]);
}

// Apply theme on script load
initTheme();

// --- Toast Notifications ---
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// --- Loading Overlay ---
function showLoading(text = 'Memuat...') {
    const el = document.getElementById('loading-overlay');
    if (el) {
        el.style.display = 'flex';
        const textEl = el.querySelector('.loading-text');
        if (textEl) textEl.textContent = text;
    }
}

function hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'none';
}

// --- Date Utilities ---
function today() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const opts = { day: '2-digit', month: 'long', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('id-ID', opts);
}

function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const opts = { day: '2-digit', month: 'short', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('id-ID', opts);
}

function getWeekRange(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
        start: monday.toISOString().split('T')[0],
        end: sunday.toISOString().split('T')[0]
    };
}

function getMonthRange(year, month) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
}

function getYearRange(year) {
    return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function getWeekNumber(dateStr) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getMonthName(month) {
    const names = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return names[month - 1] || '';
}

// --- Confirm Dialog ---
function confirmAction(message, dangerLabel = 'Hapus') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" style="max-width:400px;text-align:center">
                <div style="font-size:52px;margin-bottom:12px">⚠️</div>
                <h3 style="font-size:18px;margin-bottom:10px">Konfirmasi</h3>
                <p style="color:var(--text-muted);margin-bottom:24px;font-size:14px">${message}</p>
                <div style="display:flex;gap:10px;justify-content:center">
                    <button class="btn btn-outline" id="conf-cancel">Batal</button>
                    <button class="btn btn-danger" id="conf-ok">${dangerLabel}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));

        document.getElementById('conf-ok').onclick = () => { overlay.remove(); resolve(true); };
        document.getElementById('conf-cancel').onclick = () => { overlay.remove(); resolve(false); };
        overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    });
}

// --- Point Helpers ---
function getPointStatus(netPoints) {
    if (netPoints <= 0) return { text: 'Bersih', class: 'badge-green', color: '#34d399' };
    if (netPoints <= 20) return { text: 'Baik', class: 'badge-green', color: '#34d399' };
    if (netPoints <= 50) return { text: 'Perhatian', class: 'badge-amber', color: '#fbbf24' };
    if (netPoints <= 100) return { text: 'Serius', class: 'badge-orange', color: '#fb923c' };
    return { text: 'Kritis', class: 'badge-red', color: '#f87171' };
}

// --- Excel Utilities (requires SheetJS) ---
function downloadExcel(data, filename, sheetName = 'Data') {
    if (typeof XLSX === 'undefined') { showToast('SheetJS tidak tersedia', 'error'); return; }
    // Enforce .xls extension
    const finalFilename = filename.replace(/\.xlsx$/i, '.xls').replace(/\.csv$/i, '.xls');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, finalFilename, { bookType: 'biff8' });
}

function downloadStudentTemplate() {
    if (typeof XLSX === 'undefined') { showToast('SheetJS tidak tersedia', 'error'); return; }

    // Header row
    const headers = ['No', 'Nama Murid', 'NIS', 'Kelas', 'Wali Kelas', 'Jenis Kelamin (L/P)'];

    // Example data rows
    const examples = [
        [1, 'Ahmad Fauzi bin Abdullah', '2024001', '7A', 'Bapak Hendra Saputra, S.Pd', 'L'],
        [2, 'Siti Aisyah binti Rahman', '2024002', '7A', 'Bapak Hendra Saputra, S.Pd', 'P'],
        [3, 'Muhammad Rizki Pratama', '2024003', '7B', 'Ibu Dewi Rahayu, S.Pd', 'L'],
        ['', '(Isi data murid di bawah baris contoh ini)', '', '', '', ''],
    ];

    // Build worksheet
    const wsData = [headers, ...examples];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = [
        { wch: 5 },   // No
        { wch: 35 },  // Nama Murid
        { wch: 12 },  // NIS
        { wch: 8 },   // Kelas
        { wch: 30 },  // Wali Kelas
        { wch: 18 },  // Jenis Kelamin
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');

    // Add instruction sheet
    const instrData = [
        ['PETUNJUK PENGISIAN TEMPLATE DATA SISWA'],
        ['SMPIT Nurul Muhajirin Batam'],
        [''],
        ['Kolom', 'Keterangan', 'Contoh'],
        ['No', 'Nomor urut (opsional, bisa dikosongkan)', '1'],
        ['Nama Murid', 'Nama lengkap murid (WAJIB DIISI)', 'Ahmad Fauzi bin Abdullah'],
        ['NIS', 'Nomor Induk Siswa (opsional)', '2024001'],
        ['Kelas', 'Kelas murid, contoh: 7A, 8B, 9C (WAJIB DIISI)', '7A'],
        ['Wali Kelas', 'Nama wali kelas (WAJIB DIISI)', 'Bapak Hendra Saputra, S.Pd'],
        ['Jenis Kelamin (L/P)', 'Isi dengan huruf L (Laki-laki) atau P (Perempuan)', 'L'],
        [''],
        ['CATATAN:'],
        ['- Baris 1 (header) jangan dihapus atau diubah judulnya'],
        ['- Data diisi mulai dari baris ke-2'],
        ['- Simpan file dalam format .xls atau .xlsx sebelum diimport (bukan .csv)'],
        ['- Hapus baris contoh sebelum diimport (baris 2-4)'],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
    wsInstr['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Petunjuk');

    XLSX.writeFile(wb, 'template_data_siswa_SMPIT_Nurul_Muhajirin.xls', { bookType: 'biff8' });
    showToast('Template Excel (.xls) berhasil diunduh! Buka sheet "Petunjuk" untuk panduan.', 'success', 5000);
}

// --- Debounce ---
function debounce(fn, delay = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// --- Number Helpers ---
function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

// --- String Helpers ---
function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
}

function truncate(str, max = 40) {
    return str && str.length > max ? str.slice(0, max) + '…' : str;
}

// --- Generate unique class list from students array ---
function getClassList(students) {
    const classes = [...new Set(students.map(s => s.kelas).filter(Boolean))];
    return classes.sort((a, b) => a.localeCompare(b, 'id'));
}

// --- PDF export (requires jsPDF + autoTable) ---
function exportReportPDF(title, columns, rows) {
    if (typeof window.jspdf === 'undefined') { showToast('jsPDF tidak tersedia', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(title, 14, 14);
    doc.setFontSize(10);
    doc.text(`Dicetak: ${formatDate(today())}`, 14, 22);
    doc.autoTable({
        startY: 28,
        head: [columns.map(c => c.header)],
        body: rows.map(row => columns.map(c => row[c.key] ?? '')),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`${title.replace(/\s+/g, '_')}_${today()}.pdf`);
}

// --- Automatic Wali Kelas Name Update Migration ---
async function fixWaliKelasName() {
    if (typeof db === 'undefined' || !db) return;
    const oldName = 'Umi Huzaimah, S.Pd';
    const newName = 'Umi Huzaimah, S.Pd, Gr';
    try {
        const snap = await db.collection('students').where('waliKelas', '==', oldName).get();
        snap.forEach(doc => {
            db.collection('students').doc(doc.id).update({ waliKelas: newName });
        });

        const vSnap = await db.collection('violations').where('waliKelas', '==', oldName).get();
        vSnap.forEach(doc => {
            db.collection('violations').doc(doc.id).update({ waliKelas: newName });
        });

        const aSnap = await db.collection('achievements').where('waliKelas', '==', oldName).get();
        aSnap.forEach(doc => {
            db.collection('achievements').doc(doc.id).update({ waliKelas: newName });
        });

        const uSnap = await db.collection('users').where('name', '==', oldName).get();
        uSnap.forEach(doc => {
            db.collection('users').doc(doc.id).update({ name: newName });
        });
    } catch (e) {
        // Silent catch
    }
}
setTimeout(fixWaliKelasName, 1200);
