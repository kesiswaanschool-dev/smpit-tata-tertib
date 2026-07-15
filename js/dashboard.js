// ================================================================
// DASHBOARD LOGIC
// ================================================================

let trendChart = null;
let categoryChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    const session = requireAuth();
    if (!session) return;

    renderNav('dashboard');
    initUserDisplay();

    // Date display
    const now = new Date();
    document.getElementById('dashboard-date').textContent =
        now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    showLoading('Memuat dashboard...');

    try {
        await seedViolationTypes();
        await loadDashboard();
    } catch (e) {
        console.error(e);
        showToast('Gagal memuat data. Periksa koneksi dan konfigurasi Firebase.', 'error', 6000);
    } finally {
        hideLoading();
    }
});

async function loadDashboard() {
    const todayStr = today();
    const now = new Date();
    const monthRange = getMonthRange(now.getFullYear(), now.getMonth() + 1);

    // Parallel fetch
    const [studentsSnap, violationsSnap, achievementsSnap, todayViolSnap] = await Promise.all([
        db.collection('students').get(),
        db.collection('violations')
            .where('date', '>=', monthRange.start)
            .where('date', '<=', monthRange.end)
            .get(),
        db.collection('achievements')
            .where('date', '>=', monthRange.start)
            .where('date', '<=', monthRange.end)
            .get(),
        db.collection('violations')
            .where('date', '==', todayStr)
            .get()
    ]);

    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const violations = violationsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const achievements = achievementsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const todayViolations = todayViolSnap.docs.map(d => d.data());

    // Update stat cards
    document.getElementById('stat-siswa').textContent = students.length;
    document.getElementById('stat-pelanggaran-bulan').textContent = violations.length;
    document.getElementById('stat-prestasi-bulan').textContent = achievements.length;
    document.getElementById('stat-pelanggaran-hari').textContent = todayViolations.length;

    // Load charts
    await loadTrendChart();
    loadCategoryChart(violations);

    // Top 5 violations
    renderTopViolations(violations);

    // Top 5 achievements
    renderTopAchievements(achievements);

    // Recent activity
    await loadRecentActivity();
}

async function loadTrendChart() {
    const labels = [];
    const dates = [];
    const counts = {};

    // Generate dates for last 7 days
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dates.push(dateStr);
        labels.push(d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
        counts[dateStr] = 0;
    }

    const startDateStr = dates[0];

    // Single query for the 7-day range instead of 7 queries in a loop
    const snap = await db.collection('violations')
        .where('date', '>=', startDateStr)
        .get();

    snap.docs.forEach(doc => {
        const vDate = doc.data().date;
        if (counts[vDate] !== undefined) {
            counts[vDate]++;
        }
    });

    const data = dates.map(dateStr => counts[dateStr]);

    const ctx = document.getElementById('chart-trend').getContext('2d');
    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Pelanggaran',
                data,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239,68,68,0.1)',
                borderWidth: 2.5,
                pointBackgroundColor: '#ef4444',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y} pelanggaran`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748b', font: { size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1 },
                    beginAtZero: true
                }
            }
        }
    });
}

function loadCategoryChart(violations) {
    const catMap = {};
    violations.forEach(v => {
        const cat = v.category || 'Lainnya';
        catMap[cat] = (catMap[cat] || 0) + 1;
    });

    const labels = Object.keys(catMap);
    const data = Object.values(catMap);
    const COLORS = ['#ef4444','#f97316','#f59e0b','#10b981','#2563eb','#7c3aed','#ec4899','#06b6d4'];

    if (labels.length === 0) {
        document.getElementById('chart-category').parentElement.innerHTML =
            '<div class="empty-state" style="padding:24px"><div class="empty-icon">📊</div><p>Belum ada data bulan ini</p></div>';
        return;
    }

    const ctx = document.getElementById('chart-category').getContext('2d');
    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: COLORS.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#0a0f1e',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.parsed} kasus`
                    }
                }
            },
            cutout: '65%'
        }
    });

    // Legend
    const legend = document.getElementById('category-legend');
    legend.innerHTML = labels.map((l, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px">
            <div style="display:flex;align-items:center;gap:8px">
                <span style="width:10px;height:10px;border-radius:50%;background:${COLORS[i]};flex-shrink:0;display:inline-block"></span>
                <span style="color:#94a3b8">${l}</span>
            </div>
            <span style="font-weight:700;color:#f1f5f9">${data[i]}</span>
        </div>
    `).join('');
}

function renderTopViolations(violations) {
    const studentMap = {};
    violations.forEach(v => {
        const key = v.studentId || v.studentName;
        if (!studentMap[key]) {
            studentMap[key] = { name: v.studentName, kelas: v.kelas, totalPoin: 0, count: 0 };
        }
        studentMap[key].totalPoin += (v.score || 0);
        studentMap[key].count++;
    });

    const sorted = Object.values(studentMap).sort((a, b) => b.totalPoin - a.totalPoin).slice(0, 5);
    const maxPoin = sorted[0]?.totalPoin || 1;

    const container = document.getElementById('top-violations-list');
    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-icon">✅</div><p>Tidak ada pelanggaran bulan ini</p></div>';
        return;
    }

    container.innerHTML = sorted.map((s, i) => {
        const status = getPointStatus(s.totalPoin);
        const pct = (s.totalPoin / maxPoin * 100).toFixed(0);
        return `
            <div style="padding:10px 0;border-bottom:1px solid var(--border);${i === sorted.length-1 ? 'border:none' : ''}">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                    <div style="display:flex;align-items:center;gap:10px">
                        <span style="font-size:11px;font-weight:700;color:var(--text-muted);width:16px">#${i+1}</span>
                        <div>
                            <div style="font-size:13px;font-weight:600">${s.name}</div>
                            <div style="font-size:11px;color:var(--text-muted)">${s.kelas || '-'}</div>
                        </div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:15px;font-weight:800;color:#f87171">${s.totalPoin}</div>
                        <div style="font-size:10px;color:var(--text-muted)">${s.count} catatan</div>
                    </div>
                </div>
                <div class="point-bar">
                    <div class="point-bar-fill" style="width:${pct}%;background:${status.color}"></div>
                </div>
            </div>`;
    }).join('');
}

function renderTopAchievements(achievements) {
    const studentMap = {};
    achievements.forEach(a => {
        const key = a.studentId || a.studentName;
        if (!studentMap[key]) {
            studentMap[key] = { name: a.studentName, kelas: a.kelas, totalPoin: 0, count: 0 };
        }
        studentMap[key].totalPoin += (a.score || 0);
        studentMap[key].count++;
    });

    const sorted = Object.values(studentMap).sort((a, b) => b.totalPoin - a.totalPoin).slice(0, 5);
    const maxPoin = sorted[0]?.totalPoin || 1;

    const container = document.getElementById('top-achievements-list');
    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-icon">🏆</div><p>Belum ada prestasi bulan ini</p></div>';
        return;
    }

    container.innerHTML = sorted.map((s, i) => {
        const pct = (s.totalPoin / maxPoin * 100).toFixed(0);
        return `
            <div style="padding:10px 0;border-bottom:1px solid var(--border);${i === sorted.length-1 ? 'border:none' : ''}">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                    <div style="display:flex;align-items:center;gap:10px">
                        <span style="font-size:11px;font-weight:700;color:var(--text-muted);width:16px">#${i+1}</span>
                        <div>
                            <div style="font-size:13px;font-weight:600">${s.name}</div>
                            <div style="font-size:11px;color:var(--text-muted)">${s.kelas || '-'}</div>
                        </div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:15px;font-weight:800;color:#34d399">${s.totalPoin}</div>
                        <div style="font-size:10px;color:var(--text-muted)">${s.count} prestasi</div>
                    </div>
                </div>
                <div class="point-bar">
                    <div class="point-bar-fill" style="width:${pct}%;background:#10b981"></div>
                </div>
            </div>`;
    }).join('');
}

async function loadRecentActivity() {
    const tbody = document.getElementById('recent-tbody');

    try {
        const [vSnap, aSnap] = await Promise.all([
            db.collection('violations').orderBy('createdAt', 'desc').limit(10).get(),
            db.collection('achievements').orderBy('createdAt', 'desc').limit(5).get()
        ]);

        const items = [];
        vSnap.docs.forEach(d => {
            const data = d.data();
            items.push({ ...data, type: 'pelanggaran', ts: data.createdAt?.toDate() || new Date(data.date) });
        });
        aSnap.docs.forEach(d => {
            const data = d.data();
            items.push({ ...data, type: 'prestasi', ts: data.createdAt?.toDate() || new Date(data.date) });
        });

        items.sort((a, b) => b.ts - a.ts);
        const recent = items.slice(0, 12);

        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:32px">Belum ada aktivitas</td></tr>';
            return;
        }

        tbody.innerHTML = recent.map(item => {
            const isV = item.type === 'pelanggaran';
            const badge = isV
                ? `<span class="badge badge-red">Pelanggaran</span>`
                : `<span class="badge badge-green">Prestasi</span>`;
            const poin = isV
                ? `<span style="color:#f87171;font-weight:700">+${item.score || 0}</span>`
                : `<span style="color:#34d399;font-weight:700">-${item.score || 0}</span>`;
            const timeStr = item.ts ? item.ts.toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '-';

            return `<tr>
                <td class="td-muted">${timeStr}</td>
                <td style="font-weight:600">${item.studentName || '-'}</td>
                <td class="td-muted">${item.kelas || '-'}</td>
                <td>${isV ? (item.violationType || item.type) : (item.achievementType || '-')}</td>
                <td>${poin}</td>
                <td>${badge}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:32px">Gagal memuat aktivitas</td></tr>';
    }
}
