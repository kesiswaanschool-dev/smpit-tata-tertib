// ================================================================
// LAPORAN (ADMIN ONLY)
// ================================================================

let allStudents = [];
let allViolations = [];
let allAchievements = [];
let reportData = [];
let filteredReport = [];
let reportPage = 1;
const RPT_SIZE = 20;
let topChart = null;
let classChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    requireAdmin();
    renderNav('laporan');
    initUserDisplay();

    populateYears();
    setCurrentMonthYear();
    onPeriodChange();

    showLoading('Memuat data...');
    try {
        await Promise.all([loadStudents(), loadAllViolations(), loadAllAchievements()]);
        populateKelasFilter();
        await generateReport();
        setupTableFilters();
    } catch (e) {
        showToast('Gagal memuat data: ' + e.message, 'error');
    } finally {
        hideLoading();
    }
});

function populateYears() {
    const yearSel = document.getElementById('f-year');
    const now = new Date().getFullYear();
    yearSel.innerHTML = '';
    for (let y = now; y >= now - 4; y--) {
        yearSel.innerHTML += `<option value="${y}" ${y===now?'selected':''}>${y}</option>`;
    }
}

function setCurrentMonthYear() {
    const now = new Date();
    document.getElementById('f-month').value = now.getMonth() + 1;
    document.getElementById('f-year').value = now.getFullYear();

    // Set week
    const wk = getWeekNumber(today());
    document.getElementById('f-week').value = wk;
}

function onPeriodChange() {
    const period = document.getElementById('f-period').value;
    document.getElementById('f-month-wrap').style.display = period === 'month' ? 'flex' : 'none';
    document.getElementById('f-week-wrap').style.display = period === 'week' ? 'flex' : 'none';
    document.getElementById('f-year-wrap').style.display = period === 'custom' ? 'none' : 'flex';
    document.getElementById('f-custom-wrap').style.display = period === 'custom' ? 'flex' : 'none';
    document.getElementById('f-custom-wrap2').style.display = period === 'custom' ? 'flex' : 'none';

    if (period === 'custom') {
        document.getElementById('f-date-from').value = today();
        document.getElementById('f-date-to').value = today();
    }
}

async function loadStudents() {
    const snap = await db.collection('students').orderBy('nama').get();
    allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllViolations() {
    const snap = await db.collection('violations').get();
    allViolations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadAllAchievements() {
    const snap = await db.collection('achievements').get();
    allAchievements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function populateKelasFilter() {
    const classes = getClassList(allStudents);
    const sel = document.getElementById('f-kelas');
    sel.innerHTML = '<option value="">Semua Kelas</option>' +
        classes.map(c => `<option value="${c}">${c}</option>`).join('');
}

function getDateRange() {
    const period = document.getElementById('f-period').value;
    const year = parseInt(document.getElementById('f-year')?.value || new Date().getFullYear());
    const month = parseInt(document.getElementById('f-month')?.value || (new Date().getMonth()+1));

    if (period === 'month') return getMonthRange(year, month);
    if (period === 'year') return getYearRange(year);
    if (period === 'week') {
        const wk = parseInt(document.getElementById('f-week').value);
        // Get first day of given week in given year
        const d = new Date(year, 0, 1 + (wk - 1) * 7);
        const day = d.getDay();
        d.setDate(d.getDate() - (day || 7) + 1); // Monday
        const end = new Date(d);
        end.setDate(d.getDate() + 6);
        return {
            start: d.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    }
    if (period === 'custom') {
        return {
            start: document.getElementById('f-date-from').value,
            end: document.getElementById('f-date-to').value
        };
    }
}

function getPeriodLabel(range) {
    const period = document.getElementById('f-period').value;
    if (period === 'week') return `Minggu ke-${document.getElementById('f-week').value} (${formatDateShort(range.start)} – ${formatDateShort(range.end)})`;
    if (period === 'month') return `${getMonthName(parseInt(document.getElementById('f-month').value))} ${document.getElementById('f-year').value}`;
    if (period === 'year') return `Tahun ${document.getElementById('f-year').value}`;
    return `${formatDateShort(range.start)} – ${formatDateShort(range.end)}`;
}

async function generateReport() {
    showLoading('Membuat laporan...');
    // Reload fresh data
    await Promise.all([loadStudents(), loadAllViolations(), loadAllAchievements()]);

    const range = getDateRange();
    const kelasFilter = document.getElementById('f-kelas').value;

    if (!range || !range.start || !range.end) {
        showToast('Harap lengkapi filter periode', 'warning');
        hideLoading();
        return;
    }

    document.getElementById('report-period-label').textContent =
        `📅 Periode: ${getPeriodLabel(range)}`;

    // Filter violations & achievements by date range
    const violInRange = allViolations.filter(v => v.date >= range.start && v.date <= range.end);
    const achInRange = allAchievements.filter(a => a.date >= range.start && a.date <= range.end);

    // Filter students by class
    const students = kelasFilter
        ? allStudents.filter(s => s.kelas === kelasFilter)
        : allStudents;

    // Build report per student
    reportData = students.map(s => {
        const sViol = violInRange.filter(v => v.studentId === s.id || v.studentName === s.nama);
        const sAch = achInRange.filter(a => a.studentId === s.id || a.studentName === s.nama);

        const totalViolPoin = sViol.reduce((sum, v) => sum + (v.score || 0), 0);
        const totalAchPoin = sAch.reduce((sum, a) => sum + (a.score || 0), 0);
        const netPoin = Math.max(0, totalViolPoin - totalAchPoin);

        return {
            id: s.id,
            nama: s.nama,
            kelas: s.kelas || '-',
            waliKelas: s.waliKelas || '-',
            violCount: sViol.length,
            violPoin: totalViolPoin,
            achPoin: totalAchPoin,
            netPoin,
            status: getPointStatus(netPoin)
        };
    });

    // Update summary cards
    const totalViol = violInRange.length;
    const totalAch = achInRange.length;
    const avgNet = reportData.length > 0
        ? Math.round(reportData.reduce((s, r) => s + r.netPoin, 0) / reportData.length)
        : 0;

    document.getElementById('rs-total').textContent = students.length;
    document.getElementById('rs-viol').textContent = totalViol;
    document.getElementById('rs-ach').textContent = totalAch;
    document.getElementById('rs-avg').textContent = avgNet;

    // Apply filters and render
    applyReportFilters();
    renderTopViolationsChart();
    renderClassChart();
    hideLoading();
    showToast('Laporan berhasil dibuat', 'success');
}

function applyReportFilters() {
    const search = document.getElementById('report-search').value.toLowerCase();
    const status = document.getElementById('report-status').value;
    const sort = document.getElementById('report-sort').value;

    filteredReport = reportData.filter(r => {
        const matchSearch = !search || r.nama.toLowerCase().includes(search);
        const matchStatus = !status || r.status.text === status;
        return matchSearch && matchStatus;
    });

    // Sort
    filteredReport.sort((a, b) => {
        if (sort === 'poin-desc') return b.netPoin - a.netPoin;
        if (sort === 'poin-asc') return a.netPoin - b.netPoin;
        if (sort === 'nama-asc') return a.nama.localeCompare(b.nama, 'id');
        if (sort === 'kelas-asc') return a.kelas.localeCompare(b.kelas, 'id');
        return 0;
    });

    reportPage = 1;
    renderReportTable();
    renderReportPagination();
}

function setupTableFilters() {
    document.getElementById('report-search').addEventListener('input', debounce(applyReportFilters, 300));
    document.getElementById('report-status').addEventListener('change', applyReportFilters);
    document.getElementById('report-sort').addEventListener('change', applyReportFilters);
}

function renderReportTable() {
    const tbody = document.getElementById('report-tbody');
    const start = (reportPage-1)*RPT_SIZE;
    const page = filteredReport.slice(start, start+RPT_SIZE);

    if (page.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
            <div class="empty-icon">📋</div>
            <h3>Tidak ada data</h3>
            <p>Tidak ada murid yang cocok dengan filter</p>
        </div></td></tr>`;
        return;
    }

    tbody.innerHTML = page.map((r, i) => {
        const violColor = r.violPoin > 0 ? '#f87171' : '#94a3b8';
        const achColor = r.achPoin > 0 ? '#34d399' : '#94a3b8';
        const netColor = r.status.color;
        const barPct = Math.min(100, (r.netPoin / 150) * 100);
        const isCleanWithAch = (r.violPoin === 0 && r.achPoin > 0);

        return `<tr>
            <td class="td-muted">${start+i+1}</td>
            <td style="font-weight:600">${r.nama}</td>
            <td><span class="badge badge-blue">${r.kelas}</span></td>
            <td class="td-muted" style="font-size:12px">${r.waliKelas}</td>
            <td class="text-center td-muted">${r.violCount} kali</td>
            <td class="text-center">
                <span style="font-weight:700;color:${violColor};font-size:14px">${r.violPoin}</span>
            </td>
            <td class="text-center">
                <span style="font-weight:700;color:${achColor};font-size:14px">${r.achPoin}</span>
            </td>
            <td>
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-weight:800;font-size:15px;color:${netColor};min-width:30px">${r.netPoin}</span>
                    <div class="point-bar" style="flex:1">
                        <div class="point-bar-fill" style="width:${barPct}%;background:${netColor}"></div>
                    </div>
                </div>
                ${isCleanWithAch ? `<div style="font-size:11px;color:#34d399;font-weight:600;margin-top:3px">⭐ Simpanan Prestasi: ${r.achPoin} poin</div>` : ''}
            </td>
            <td><span class="badge ${r.status.class}">${r.status.text}</span></td>
        </tr>`;
    }).join('');
}

function renderReportPagination() {
    const total = filteredReport.length;
    const totalPages = Math.ceil(total / RPT_SIZE);
    const start = (reportPage-1)*RPT_SIZE+1;
    const end = Math.min(reportPage*RPT_SIZE, total);

    document.getElementById('report-info').textContent =
        total === 0 ? 'Tidak ada data' : `Menampilkan ${start}–${end} dari ${total} murid`;

    const btns = document.getElementById('report-btns');
    if (totalPages <= 1) { btns.innerHTML = ''; return; }
    let html = `<button class="page-btn" onclick="goReportPage(${reportPage-1})" ${reportPage===1?'disabled':''}>‹</button>`;
    for (let i=1; i<=totalPages; i++) {
        if (i===1||i===totalPages||(i>=reportPage-1&&i<=reportPage+1)) {
            html += `<button class="page-btn ${i===reportPage?'active':''}" onclick="goReportPage(${i})">${i}</button>`;
        } else if (i===reportPage-2||i===reportPage+2) {
            html += `<button class="page-btn" disabled>…</button>`;
        }
    }
    html += `<button class="page-btn" onclick="goReportPage(${reportPage+1})" ${reportPage===totalPages?'disabled':''}>›</button>`;
    btns.innerHTML = html;
}

function goReportPage(p) {
    const totalPages = Math.ceil(filteredReport.length / RPT_SIZE);
    if (p < 1 || p > totalPages) return;
    reportPage = p;
    renderReportTable();
    renderReportPagination();
}

function renderTopViolationsChart() {
    const sorted = [...reportData].sort((a, b) => b.netPoin - a.netPoin).slice(0, 10);
    const ctx = document.getElementById('chart-top-violations').getContext('2d');
    if (topChart) topChart.destroy();

    const colors = sorted.map(r => r.status.color);

    topChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(r => r.nama.split(' ')[0] + (r.nama.split(' ').length > 1 ? ' ' + r.nama.split(' ')[1] : '')),
            datasets: [{
                label: 'Saldo Poin',
                data: sorted.map(r => r.netPoin),
                backgroundColor: colors.map(c => c + '33'),
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` Saldo: ${ctx.parsed.y} poin`
                    }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' }, beginAtZero: true }
            }
        }
    });
}

function renderClassChart() {
    const classMap = {};
    reportData.forEach(r => {
        if (!classMap[r.kelas]) classMap[r.kelas] = { total: 0, count: 0 };
        classMap[r.kelas].total += r.netPoin;
        classMap[r.kelas].count++;
    });

    const labels = Object.keys(classMap).sort();
    const avgs = labels.map(k => Math.round(classMap[k].total / classMap[k].count));
    const ctx = document.getElementById('chart-by-class').getContext('2d');
    if (classChart) classChart.destroy();

    classChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Avg Saldo Poin',
                    data: avgs,
                    backgroundColor: 'rgba(239,68,68,0.2)',
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderRadius: 6,
                },
                {
                    label: 'Jumlah Murid',
                    data: labels.map(k => classMap[k].count),
                    backgroundColor: 'rgba(37,99,235,0.2)',
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    borderRadius: 6,
                    yAxisID: 'y2'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { size: 11 } } }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748b' },
                    beginAtZero: true,
                    title: { display: true, text: 'Avg Poin', color: '#64748b', font: { size: 10 } }
                },
                y2: {
                    position: 'right',
                    grid: { display: false },
                    ticks: { color: '#64748b' },
                    beginAtZero: true,
                    title: { display: true, text: 'Jumlah Murid', color: '#64748b', font: { size: 10 } }
                }
            }
        }
    });
}

function exportReport() {
    const range = getDateRange();
    const periodLabel = getPeriodLabel(range);
    const data = filteredReport.map((r, i) => ({
        'No': i+1,
        'Nama Murid': r.nama,
        'Kelas': r.kelas,
        'Wali Kelas': r.waliKelas,
        'Jumlah Pelanggaran': r.violCount,
        'Poin Pelanggaran': r.violPoin,
        'Poin Prestasi': r.achPoin,
        'Saldo Poin': (r.violPoin === 0 && r.achPoin > 0)
            ? `0 (Simpanan Prestasi: ${r.achPoin} poin)`
            : r.netPoin,
        'Status': r.status.text
    }));
    downloadExcel(data, `laporan_${periodLabel.replace(/\s+/g,'_')}_${today()}.xls`, 'Laporan');
    showToast(`Laporan ${data.length} murid berhasil diexport (.xls)`, 'success');
}

function printReport() {
    window.print();
}
