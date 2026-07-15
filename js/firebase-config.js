// ================================================================
// FIREBASE CONFIGURATION
// ================================================================
// Ganti nilai di bawah dengan konfigurasi Firebase project Anda.
// Lihat SETUP.md untuk panduan cara mendapatkan konfigurasi ini.
// ================================================================

let firebaseConfig = {
    apiKey: "AIzaSyAke6egaAspAzliXYWIIIXv4aYLaLXRhWM",
    authDomain: "smpit-nurul-muhajirin.firebaseapp.com",
    projectId: "smpit-nurul-muhajirin",
    storageBucket: "smpit-nurul-muhajirin.firebasestorage.app",
    messagingSenderId: "589443893297",
    appId: "1:589443893297:web:0909c3862d8591a9202d10"
};

// Load custom firebase credentials from Settings if saved in LocalStorage
const savedCustomConfig = localStorage.getItem('smpit_custom_firebase_config');
if (savedCustomConfig) {
    try {
        firebaseConfig = JSON.parse(savedCustomConfig);
        console.log("ℹ️ Loaded custom Firebase configuration from local Settings.");
    } catch (e) {
        console.error("Failed to parse custom Firebase config:", e);
    }
}


let db;
let isLocalDb = false;

// Mock database storage helper
const mockStorage = {
    get: (key) => {
        try {
            return JSON.parse(localStorage.getItem('smpit_' + key) || '[]');
        } catch {
            return [];
        }
    },
    set: (key, val) => {
        try {
            localStorage.setItem('smpit_' + key, JSON.stringify(val));
        } catch (e) {
            console.error("LocalStorage save failed:", e);
        }
    }
};

function deserializeData(data) {
    if (!data) return data;
    const copy = { ...data };
    for (let key in copy) {
        if (copy[key] && typeof copy[key] === 'object' && copy[key]._seconds !== undefined) {
            const sec = copy[key]._seconds;
            copy[key] = {
                _seconds: sec,
                toDate: () => new Date(sec * 1000)
            };
        }
    }
    return copy;
}

class MockCollection {
    constructor(colName, queryFilters = [], sortField = null, sortDir = 'asc', limitVal = null) {
        this.colName = colName;
        this.filters = queryFilters;
        this.sortField = sortField;
        this.sortDir = sortDir;
        this.limitVal = limitVal;
    }

    where(field, op, val) {
        return new MockCollection(
            this.colName,
            [...this.filters, { field, op, val }],
            this.sortField,
            this.sortDir,
            this.limitVal
        );
    }

    orderBy(field, dir = 'asc') {
        return new MockCollection(
            this.colName,
            this.filters,
            field,
            dir,
            this.limitVal
        );
    }

    limit(val) {
        return new MockCollection(
            this.colName,
            this.filters,
            this.sortField,
            this.sortDir,
            val
        );
    }

    _getData() {
        let items = mockStorage.get(this.colName);
        
        this.filters.forEach(f => {
            items = items.filter(item => {
                const itemVal = item[f.field];
                if (f.op === '==') return itemVal === f.val;
                if (f.op === '>=') return itemVal >= f.val;
                if (f.op === '<=') return itemVal <= f.val;
                return true;
            });
        });

        if (this.sortField) {
            items.sort((a, b) => {
                let valA = a[this.sortField];
                let valB = b[this.sortField];
                if (valA && valA._seconds) valA = valA._seconds;
                if (valB && valB._seconds) valB = valB._seconds;
                if (valA < valB) return this.sortDir === 'asc' ? -1 : 1;
                if (valA > valB) return this.sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }

        if (this.limitVal !== null) {
            items = items.slice(0, this.limitVal);
        }

        return items;
    }

    async get() {
        const items = this._getData();
        const docs = items.map(item => ({
            id: item.id,
            data: () => deserializeData(item),
            ref: {
                delete: async () => {
                    let all = mockStorage.get(this.colName);
                    all = all.filter(x => x.id !== item.id);
                    mockStorage.set(this.colName, all);
                    this._triggerListeners();
                }
            }
        }));
        return {
            docs,
            empty: docs.length === 0,
            size: docs.length
        };
    }

    async add(data) {
        let all = mockStorage.get(this.colName);
        const id = 'local_' + Math.random().toString(36).substr(2, 9);
        const resolvedData = { ...data };
        for (let key in resolvedData) {
            if (resolvedData[key] && resolvedData[key]._serverTimestamp) {
                resolvedData[key] = { _seconds: Date.now() / 1000 };
            }
        }
        const newItem = { id, ...resolvedData };
        all.push(newItem);
        mockStorage.set(this.colName, all);
        this._triggerListeners();
        return { id };
    }

    doc(id) {
        const self = this;
        const finalId = id || 'local_' + Math.random().toString(36).substr(2, 9);
        return {
            id: finalId,
            colName: self.colName,
            set: async (data) => {
                let all = mockStorage.get(self.colName);
                const idx = all.findIndex(x => x.id === finalId);
                const resolvedData = { ...data };
                for (let key in resolvedData) {
                    if (resolvedData[key] && resolvedData[key]._serverTimestamp) {
                        resolvedData[key] = { _seconds: Date.now() / 1000 };
                    }
                }
                if (idx > -1) {
                    all[idx] = { id: finalId, ...resolvedData };
                } else {
                    all.push({ id: finalId, ...resolvedData });
                }
                mockStorage.set(self.colName, all);
                self._triggerListeners();
            },
            update: async (data) => {
                let all = mockStorage.get(self.colName);
                let item = all.find(x => x.id === finalId);
                if (item) {
                    Object.assign(item, data);
                    for (let key in item) {
                        if (item[key] && item[key]._serverTimestamp) {
                            item[key] = { _seconds: Date.now() / 1000 };
                        }
                    }
                    mockStorage.set(self.colName, all);
                    self._triggerListeners();
                }
            },
            delete: async () => {
                let all = mockStorage.get(self.colName);
                all = all.filter(x => x.id !== finalId);
                mockStorage.set(self.colName, all);
                self._triggerListeners();
            }
        };
    }

    onSnapshot(onNext, onError) {
        const listenerId = Math.random().toString(36).substr(2, 9);
        if (!window._mockListeners) window._mockListeners = {};
        if (!window._mockListeners[this.colName]) window._mockListeners[this.colName] = [];
        
        const trigger = async () => {
            const snap = await this.get();
            onNext(snap);
        };
        window._mockListeners[this.colName].push({ id: listenerId, trigger });
        setTimeout(trigger, 50);
        return () => {
            if (window._mockListeners && window._mockListeners[this.colName]) {
                window._mockListeners[this.colName] = window._mockListeners[this.colName].filter(x => x.id !== listenerId);
            }
        };
    }

    _triggerListeners() {
        if (window._mockListeners && window._mockListeners[this.colName]) {
            window._mockListeners[this.colName].forEach(lis => lis.trigger());
        }
    }
}

class MockBatch {
    constructor() {
        this.operations = [];
    }
    set(ref, data) {
        this.operations.push({ ref, data });
    }
    delete(ref) {
        this.operations.push({ ref, action: 'delete' });
    }
    async commit() {
        for (let op of this.operations) {
            if (op.action === 'delete') {
                await op.ref.delete();
            } else {
                if (op.ref.set) {
                    await op.ref.set(op.data);
                } else {
                    let all = mockStorage.get(op.ref.colName);
                    const newItem = { id: op.ref.id, ...op.data };
                    for (let key in newItem) {
                        if (newItem[key] && newItem[key]._serverTimestamp) {
                            newItem[key] = { _seconds: Date.now() / 1000 };
                        }
                    }
                    all.push(newItem);
                    mockStorage.set(op.ref.colName, all);
                }
            }
        }
        const cols = [...new Set(this.operations.map(op => op.ref.colName))];
        cols.forEach(col => {
            if (window._mockListeners && window._mockListeners[col]) {
                window._mockListeners[col].forEach(lis => lis.trigger());
            }
        });
    }
}

if (firebaseConfig.apiKey === "YOUR_API_KEY" || !firebaseConfig.apiKey) {
    isLocalDb = true;
    window.firebase = window.firebase || {};
    window.firebase.firestore = window.firebase.firestore || {};
    window.firebase.firestore.FieldValue = window.firebase.firestore.FieldValue || {
        serverTimestamp: () => ({ _serverTimestamp: true })
    };
    db = {
        collection: (colName) => new MockCollection(colName),
        batch: () => new MockBatch()
    };
    console.log("ℹ️ Running in Local Storage database mode (No config required).");
} else {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        db.enablePersistence({ synchronizeTabs: true }).catch(err => {
            console.warn('Persistence warning:', err.code);
        });
    } catch (e) {
        isLocalDb = true;
        window.firebase = window.firebase || {};
        window.firebase.firestore = window.firebase.firestore || {};
        window.firebase.firestore.FieldValue = window.firebase.firestore.FieldValue || {
            serverTimestamp: () => ({ _serverTimestamp: true })
        };
        db = {
            collection: (colName) => new MockCollection(colName),
            batch: () => new MockBatch()
        };
        console.warn("Firebase failed to initialize. Fell back to Local Database.", e);
    }
}


// Data Pelanggaran Resmi SMPIT Nurul Muhajirin Batam
const DEFAULT_VIOLATION_TYPES = [

    // ── ASPEK KELAKUAN ──────────────────────────────────────────
    { category: "Aspek Kelakuan", name: "Mencemarkan nama baik sekolah, guru, karyawan, dan teman sekolah baik secara langsung dan di media sosial", score: 300, order: 1 },
    { category: "Aspek Kelakuan", name: "Tidak sopan kepada guru, karyawan, dan teman dalam perbuatan dan kata-kata", score: 50, order: 2 },
    { category: "Aspek Kelakuan", name: "Membully teman", score: 200, order: 3 },
    { category: "Aspek Kelakuan", name: "Berkata kotor/jorok di lingkungan sekolah", score: 50, order: 4 },
    { category: "Aspek Kelakuan", name: "Merusak barang milik orang lain / fasilitas sekolah", score: 60, order: 5 },
    { category: "Aspek Kelakuan", name: "Menyimpan atau membawa rokok dan sejenisnya ke sekolah", score: 100, order: 6 },
    { category: "Aspek Kelakuan", name: "Merokok di lingkungan sekolah dan di luar lingkungan sekolah", score: 150, order: 7 },
    { category: "Aspek Kelakuan", name: "Berpacaran atau memiliki hubungan yang bukan makhram", score: 250, order: 8 },
    { category: "Aspek Kelakuan", name: "Memposting foto dan atau kata-kata yang tidak sesuai norma di media sosial", score: 200, order: 9 },
    { category: "Aspek Kelakuan", name: "Membawa minuman keras, obat terlarang dan sejenisnya", score: 300, order: 10 },
    { category: "Aspek Kelakuan", name: "Meminum atau menghisap (mabuk)", score: 500, order: 11 },
    { category: "Aspek Kelakuan", name: "Membawa dan mengoperasikan HP di lingkungan sekolah", score: 150, order: 12 },
    { category: "Aspek Kelakuan", name: "Menonton dan atau menyebarkan video yang tidak sewajarnya (menyalahi norma-norma agama)", score: 300, order: 13 },
    { category: "Aspek Kelakuan", name: "Mengedarkan atau memperjualbelikan obat terlarang", score: 1000, order: 14 },
    { category: "Aspek Kelakuan", name: "Membawa atau menggunakan senjata tajam atau sejenisnya yang tidak ada hubungannya dengan kegiatan sekolah", score: 50, order: 15 },
    { category: "Aspek Kelakuan", name: "Memalsukan surat izin dan tanda tangan orang tua/guru/kepala sekolah", score: 150, order: 16 },
    { category: "Aspek Kelakuan", name: "Berbohong dalam segala hal", score: 100, order: 17 },
    { category: "Aspek Kelakuan", name: "Keluar perkarangan sekolah pada jam sekolah", score: 50, order: 18 },
    { category: "Aspek Kelakuan", name: "Berkelahi di sekolah / lingkungannya", score: 150, order: 19 },
    { category: "Aspek Kelakuan", name: "Meminta barang/uang milik orang lain dengan paksa atau mengancam teman", score: 150, order: 20 },
    { category: "Aspek Kelakuan", name: "Mengambil barang milik orang lain / mencuri", score: 300, order: 21 },
    { category: "Aspek Kelakuan", name: "Pelecehan seksual / bertindak asusila seperti bersentuhan yang tidak makhram", score: 400, order: 22 },
    { category: "Aspek Kelakuan", name: "Melakukan tindakan melawan hukum dan menjadi narapidana", score: 1000, order: 23 },
    { category: "Aspek Kelakuan", name: "Menikah dan menghamili atau hamil di luar nikah (berzina)", score: 1000, order: 24 },
    { category: "Aspek Kelakuan", name: "Melakukan aktivitas olahraga pada bukan jam olahraga", score: 50, order: 25 },
    { category: "Aspek Kelakuan", name: "Tidak berpuasa sunah Kamis selama 1 bulan", score: 50, order: 26 },

    // ── ASPEK KERAJINAN / KEDISIPLINAN ──────────────────────────
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Terlambat masuk kelas (kurang dari 10 menit)", score: 10, order: 27 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Terlambat masuk kelas (lebih dari 10 menit)", score: 20, order: 28 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Terlambat masuk kelas (lebih dari 15 menit, diberi sanksi/hukuman)", score: 30, order: 29 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Meninggalkan kelas tanpa izin", score: 30, order: 30 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Meninggalkan kelas lebih dari 15 menit", score: 30, order: 31 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Tidak masuk sekolah tanpa keterangan (Alpha)", score: 50, order: 32 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Tidak ikut upacara tanpa izin", score: 30, order: 33 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Tidak mengerjakan tugas/PR dari guru", score: 30, order: 34 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Tidak menjalankan sholat dhuha", score: 50, order: 35 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Tidak menjalankan sholat dhuhur dan ashar berjamaah", score: 150, order: 36 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Tidak membawa Al-Qur'an, Al-Matsurat, mukena (putri)", score: 50, order: 37 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Tidur ketika pelajaran berlangsung", score: 30, order: 38 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Duduk tidak pada tempatnya (di atas meja guru/siswa, di tangga)", score: 20, order: 39 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Bermain / ribut ketika belajar", score: 30, order: 40 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Membuat suasana ribut / kegaduhan di Masjid", score: 100, order: 41 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Tidak membawa perlengkapan belajar", score: 20, order: 42 },
    { category: "Aspek Kerajinan/Kedisiplinan", name: "Keluar kelas saat pergantian jam pelajaran tanpa meminta izin kepada guru", score: 30, order: 43 },

    // ── ASPEK KERAPIAN ───────────────────────────────────────────
    { category: "Aspek Kerapian", name: "Tidak berpakaian seragam lengkap beserta atribut (sesuai ketentuan sekolah)", score: 50, order: 44 },
    { category: "Aspek Kerapian", name: "Baju tidak dimasukkan (laki-laki)", score: 20, order: 45 },
    { category: "Aspek Kerapian", name: "Baju atau jilbab pendek dan jilbab segi empat (perempuan)", score: 20, order: 46 },
    { category: "Aspek Kerapian", name: "Rambut tidak rapi (gondrong, dicat, di-skin, dsb) Putra dan Putri", score: 30, order: 47 },
    { category: "Aspek Kerapian", name: "Memanjangkan kuku / mencatnya (kutex dan berinai)", score: 30, order: 48 },
    { category: "Aspek Kerapian", name: "Murid putra memakai anting, gelang, cincin, aksesoris lainnya", score: 50, order: 49 },
    { category: "Aspek Kerapian", name: "Murid putri memakai aksesoris dan make up yang berlebihan", score: 30, order: 50 },
    { category: "Aspek Kerapian", name: "Memakai atribut yang bukan identitas sekolah", score: 20, order: 51 },
    { category: "Aspek Kerapian", name: "Tidak memakai kaos kaki panjang sampai betis (sesuai ketentuan)", score: 20, order: 52 },
    { category: "Aspek Kerapian", name: "Tidak memakai sepatu standar sekolah (hitam / paduan hitam-putih)", score: 50, order: 53 },
    { category: "Aspek Kerapian", name: "Tidak memakai sepatu bertali (sepatu standar sekolah)", score: 50, order: 54 },

    // ── ASPEK KEBERSIHAN ─────────────────────────────────────────
    { category: "Aspek Kebersihan", name: "Membuat kotor kelas / membuang sampah sembarangan di lingkungan sekolah / masjid", score: 70, order: 55 },
    { category: "Aspek Kebersihan", name: "Tidak menggunakan alas kaki ketika akan memasuki masjid", score: 100, order: 56 },
    { category: "Aspek Kebersihan", name: "Tidak melaksanakan tugas piket", score: 70, order: 57 },
    { category: "Aspek Kebersihan", name: "Coret-coret bukan pada tempatnya", score: 70, order: 58 },
];

// Seed violation types if collection is empty
async function seedViolationTypes() {
    // Avoid redundant checking if already seeded in this browser
    if (localStorage.getItem('smpit_seeded') === 'true' && localStorage.getItem('smpit_ach_seeded') === 'true') {
        return;
    }
    try {
        // Seed Violations
        if (localStorage.getItem('smpit_seeded') !== 'true') {
            const snap = await db.collection('violation_types').limit(1).get();
            if (snap.empty) {
                const batch = db.batch();
                DEFAULT_VIOLATION_TYPES.forEach(vt => {
                    const ref = db.collection('violation_types').doc();
                    batch.set(ref, { ...vt, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                });
                await batch.commit();
                console.log('Violation types seeded.');
            }
            localStorage.setItem('smpit_seeded', 'true');
        }

        // Seed Achievements
        if (localStorage.getItem('smpit_ach_seeded') !== 'true') {
            const snap2 = await db.collection('achievement_types').limit(1).get();
            if (snap2.empty) {
                const batch2 = db.batch();
                DEFAULT_ACHIEVEMENT_TYPES.forEach(at => {
                    const ref = db.collection('achievement_types').doc();
                    batch2.set(ref, { ...at, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                });
                await batch2.commit();
                console.log('Achievement types seeded.');
            }
            localStorage.setItem('smpit_ach_seeded', 'true');
        }
    } catch (e) {
        console.warn('Could not seed data types:', e);
    }
}

// Data Prestasi Resmi (Default) - Kosongkan agar hanya bisa diisi dari menu Pengaturan
const DEFAULT_ACHIEVEMENT_TYPES = [];

