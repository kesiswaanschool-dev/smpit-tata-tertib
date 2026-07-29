// ================================================================
// AUTHENTICATION MODULE
// ================================================================

// ================================================================
// CREDENTIAL STORAGE (Encrypted - decode at runtime)
// ================================================================

function _dK() {
    const p = ['S','M','P','I','T','_','N','u','r','u','l','_','M','u','h','a','j','i','r','i','n'];
    return p.join('');
}

function _dV(enc, key) {
    let r = '';
    for (let i = 0; i < enc.length; i++) {
        r += String.fromCharCode(enc[i] ^ key.charCodeAt(i % key.length));
    }
    return r;
}

const _U = [18,33,35,40,48,62];
const _P = [5,36,60,37,53,44,47,24,2,0,30,49,44,71,75];

function _adminCred() {
    const k = _dK();
    return {
        username: _dV(_U, k),
        password: _dV(_P, k),
        name: 'Administrator',
        role: 'admin'
    };
}

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
    const admin = _adminCred();
    if (username.trim() === admin.username && password === admin.password) {
        setSession({ username: admin.username, name: admin.name, role: 'admin' });
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
