// ================================================================
// AUTHENTICATION MODULE
// ================================================================

const ADMIN = {
    username: 'Alsada',
    password: 'Villasampurna2#',
    name: 'Administrator',
    role: 'admin'
};

const SESSION_KEY = 'smpit_nmb_session';

function getSession() {
    try {
        const d = localStorage.getItem(SESSION_KEY);
        return d ? JSON.parse(d) : null;
    } catch { return null; }
}

function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function requireAuth(redirectUrl = 'index.html') {
    const session = getSession();
    if (!session) {
        window.location.replace(redirectUrl);
        return null;
    }
    return session;
}

function requireAdmin() {
    const session = requireAuth();
    if (!session) return null;
    if (session.role !== 'admin') {
        window.location.replace('dashboard.html');
        return null;
    }
    return session;
}

function logout() {
    clearSession();
    window.location.replace('index.html');
}

async function doLogin(username, password) {
    // Admin check (hardcoded, highest priority)
    if (username.trim() === ADMIN.username && password === ADMIN.password) {
        setSession({ username: ADMIN.username, name: ADMIN.name, role: 'admin' });
        return { success: true, role: 'admin' };
    }

    // Teacher check (Firestore)
    try {
        const snap = await db.collection('users')
            .where('username', '==', username.trim())
            .limit(1)
            .get();

        if (!snap.empty) {
            const user = snap.docs[0].data();
            if (user.password === password) {
                setSession({
                    id: snap.docs[0].id,
                    username: user.username,
                    name: user.name || user.username,
                    role: user.role || 'guru'
                });
                return { success: true, role: user.role || 'guru' };
            }
        }
    } catch (e) {
        console.error('Login error:', e);
        return { success: false, error: 'Koneksi ke server gagal. Periksa konfigurasi Firebase.' };
    }

    return { success: false, error: 'Username atau password salah.' };
}

// Init topbar user info on authenticated pages
function initUserDisplay() {
    const session = getSession();
    if (!session) return;

    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-display-role');
    const avatarEl = document.getElementById('user-avatar');
    const sidebarNameEl = document.getElementById('sidebar-user-name');
    const sidebarRoleEl = document.getElementById('sidebar-user-role');
    const sidebarAvatarEl = document.getElementById('sidebar-user-avatar');

    const initial = session.name.charAt(0).toUpperCase();
    const roleLabel = session.role === 'admin' ? 'Administrator' : 'Guru';

    if (nameEl) nameEl.textContent = session.name;
    if (roleEl) roleEl.textContent = roleLabel;
    if (avatarEl) avatarEl.textContent = initial;
    if (sidebarNameEl) sidebarNameEl.textContent = session.name;
    if (sidebarRoleEl) sidebarRoleEl.textContent = roleLabel;
    if (sidebarAvatarEl) sidebarAvatarEl.textContent = initial;
}

function isAdmin() {
    const s = getSession();
    return s && s.role === 'admin';
}
