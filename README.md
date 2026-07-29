# 🕌 SMPIT Nurul Muhajirin Batam
## Sistem Catatan Pelanggaran & Prestasi Murid

Aplikasi web dashboard untuk mencatat dan merekap pelanggaran serta prestasi murid SMPIT Nurul Muhajirin Batam. Dapat diakses banyak pengguna secara bersamaan melalui internet.

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|---|---|
| 🔐 Login Multi-User | Admin & guru dengan hak akses berbeda |
| 👥 Data Murid | CRUD + Import Excel + Download template |
| ⚠️ Catatan Pelanggaran | Dropdown 28+ jenis pelanggaran dengan poin otomatis |
| 🏆 Catatan Prestasi | Input manual jenis & tingkat prestasi |
| 📋 Laporan Admin | Per minggu/bulan/tahun + grafik + export Excel |
| 📊 Dashboard | Statistik real-time, grafik tren, top murid |
| ⚙️ Pengaturan | Kelola akun guru & jenis pelanggaran |

---

## 🚀 Cara Setup (Selesai!)

Aplikasi ini **sudah dikonfigurasi sepenuhnya** menggunakan kredensial Firebase Anda:
* Project ID: `smpit-nurul-muhajirin`

Anda **tidak perlu melakukan langkah konfigurasi file** lagi! Aplikasi sudah terhubung secara otomatis ke database online Firebase Anda.

> ℹ️ Jika sewaktu-waktu ingin mengubah kredensial, Anda dapat mengedit file `js/firebase-config.js` atau memasukkannya secara dinamis melalui menu **Pengaturan → Database / Firebase** di dalam aplikasi.


### Langkah 5: Setup Firestore Rules (Keamanan)

Di Firebase Console → Firestore → **Rules**, ganti isinya dengan:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ Untuk keamanan lebih, gunakan rules yang lebih ketat setelah aplikasi berjalan.

---

## 🌐 Cara Deploy ke GitHub Pages

### Langkah 1: Buat Repository GitHub

1. Buka [github.com](https://github.com) dan login
2. Klik **New repository**
3. Nama repository: `smpit-tata-tertib`
4. Set ke **Public**
5. Klik **Create repository**

### Langkah 2: Upload Files

**Cara A - Drag & Drop (Mudah):**
1. Buka repository yang baru dibuat
2. Klik **"uploading an existing file"**
3. Drag & drop SEMUA file dari folder `pelanggaran/` ke browser
4. Klik **Commit changes**

**Cara B - Git (Lebih Cepat):**
```bash
cd pelanggaran/
git init
git add .
git commit -m "Initial commit: Sistem Tata Tertib SMPIT"
git remote add origin https://github.com/USERNAME/smpit-tata-tertib.git
git push -u origin main
```

### Langkah 3: Aktifkan GitHub Pages

1. Di repository GitHub, klik **Settings**
2. Scroll ke **"Pages"** di sidebar kiri
3. Source: pilih **"Deploy from a branch"**
4. Branch: **main** → folder: **/ (root)**
5. Klik **Save**
6. Tunggu 2-3 menit, lalu akses di:
   `https://USERNAME.github.io/smpit-tata-tertib/`

---

## 🔑 Kredensial Default

| Role | Username | Password |
|---|---|---|
| **Admin** | `admin` | `Ganti di Pengaturan → Akun Guru` |
| **Guru** | Buat di menu Pengaturan → Akun Guru | — |

---

## 📱 Cara Penggunaan

### Sebagai Admin
1. Login → Dashboard (statistik dan grafik)
2. **Data Murid** → Import Excel atau tambah manual
3. **Catatan Pelanggaran** → Catat pelanggaran murid
4. **Catatan Prestasi** → Catat prestasi murid
5. **Laporan** → Lihat rekap per minggu/bulan/tahun
6. **Pengaturan** → Buat akun guru, kelola jenis pelanggaran

### Sebagai Guru
1. Login dengan akun yang dibuat admin
2. **Catatan Pelanggaran** → Catat pelanggaran
3. **Catatan Prestasi** → Catat prestasi
4. Dashboard tersedia, **Laporan & Pengaturan tidak terlihat**

---

## 📊 Template Excel Import Murid

Download template dari halaman **Data Murid** → **Download Template Excel**

Format kolom:
| Nama Murid | Kelas | Wali Kelas | Jenis Kelamin | NIS |
|---|---|---|---|---|
| Ahmad Fauzi | 7A | Bapak Hendra | L | 12345 |

---

## 🧮 Sistem Poin

| Saldo Poin | Status | Keterangan |
|---|---|---|
| ≤ 0 | 🟢 Bersih | Prestasi menutupi pelanggaran |
| 1 – 20 | 🟢 Baik | Pelanggaran ringan |
| 21 – 50 | 🟡 Perhatian | Perlu pembinaan |
| 51 – 100 | 🟠 Serius | Perlu penanganan |
| > 100 | 🔴 Kritis | Segera ditangani |

**Rumus:** `Saldo = Total Poin Pelanggaran - Total Poin Prestasi`

---

## 🛠️ Teknologi

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Database:** Firebase Firestore (gratis, real-time)
- **Charts:** Chart.js
- **Excel:** SheetJS (XLSX)
- **Hosting:** GitHub Pages (gratis)

---

## ❓ Troubleshooting

**"Koneksi ke server gagal"** → Periksa konfigurasi Firebase di `js/firebase-config.js`

**Data tidak muncul** → Pastikan Firestore rules sudah diset ke allow read/write

**Login gagal** → Pastikan username dan password benar (case-sensitive)

**Excel tidak bisa diimport** → Pastikan menggunakan format .xlsx dan kolom sesuai template

---

*© 2024 SMPIT Nurul Muhajirin Batam*
