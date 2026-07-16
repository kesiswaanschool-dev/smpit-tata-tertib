// ================================================================
// NAVIGATION / SIDEBAR COMPONENT
// ================================================================

function renderNav(activePage) {
    const session = getSession();
    if (!session) return;

    const admin = session.role === 'admin';
    const initial = session.name.charAt(0).toUpperCase();
    const roleLabel = admin ? 'Administrator' : 'Guru';

    const navItems = [
        { page: 'dashboard', href: 'dashboard.html', icon: '📊', label: 'Dashboard', adminOnly: false },
        { page: 'siswa', href: 'siswa.html', icon: '👥', label: 'Data Murid', adminOnly: true },
    ];

    const recordItems = [
        { page: 'pelanggaran', href: 'pelanggaran.html', icon: '⚠️', label: 'Catatan Pelanggaran', adminOnly: false },
        { page: 'prestasi', href: 'prestasi.html', icon: '🏆', label: 'Catatan Prestasi', adminOnly: false },
    ];

    const adminItems = [
        { page: 'laporan', href: 'laporan.html', icon: '📋', label: 'Laporan', adminOnly: true },
        { page: 'pengaturan', href: 'pengaturan.html', icon: '⚙️', label: 'Pengaturan', adminOnly: true },
    ];

    function buildItem(item) {
        if (item.adminOnly && !admin) return '';
        const active = activePage === item.page ? 'active' : '';
        return `
            <a href="${item.href}" class="nav-item ${active}">
                <span class="nav-icon">${item.icon}</span>
                <span>${item.label}</span>
            </a>`;
    }

    const html = `
        <div class="sidebar" id="sidebar">
            <div class="sidebar-brand">
                <div class="school-logo">
                    <img src="logo.png" alt="Logo SMP IT Nurul Muhajirin">
                </div>
                <h2>APLIKASI KESISWAAN</h2>
                <p>Sistem Tata Tertib Murid</p>
            </div>

            <nav class="sidebar-nav">
                <div class="nav-section-label">Utama</div>
                ${navItems.map(buildItem).join('')}

                <div class="nav-section-label">Pencatatan</div>
                ${recordItems.map(buildItem).join('')}

                ${admin ? `
                <div class="nav-section-label">Administrasi</div>
                ${adminItems.map(buildItem).join('')}
                ` : ''}
            </nav>

            <div class="sidebar-footer">
                <div class="user-info-sidebar">
                    <div class="user-avatar-sm" id="sidebar-user-avatar">${initial}</div>
                    <div class="user-info-sm">
                        <h4 id="sidebar-user-name">${session.name}</h4>
                        <p id="sidebar-user-role">${roleLabel}</p>
                    </div>
                </div>
                <button class="btn-logout" onclick="logout()">
                    <span>🚪</span> Keluar
                </button>
            </div>
        </div>

        <div id="sidebar-overlay"
            style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:999;backdrop-filter:blur(2px)"
            onclick="closeSidebar()">
        </div>
    `;

    const container = document.getElementById('sidebar-container');
    if (container) container.innerHTML = html;
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('open');
    if (overlay) overlay.style.display = isOpen ? 'block' : 'none';
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
}
