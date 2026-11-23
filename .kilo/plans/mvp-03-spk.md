# MVP 3: SPK/PO Dan ACK

Status: fase 2 diimplementasikan dan migrasi lokal diterapkan; review pengguna masih diperlukan. Acuan: PRD FR-04, FR-07, FR-09, FR-11; FEATURES F-04, F-05, F-09, F-10. Keputusan berikut menggantikan ketentuan sebelumnya yang bertentangan.

## Dua Fase
- Fase 1: buat UI yang dapat diklik untuk pengaturan pemicu, penerbitan SPK/PO dan ACK, dengan navigasi dan data simulasi yang ditandai jelas. Jangan ubah backend atau database; berhenti untuk review dan persetujuan UI/UX pengguna.
- Pengguna memilih Admin Pengajuan & RAB sebagai pengelola pengaturan pemicu. Role Finance belum ada; akun admin dapat mencoba layar penerbitan Finance sebagai pratinjau yang diberi label jelas, bukan perubahan hak akses final.
- Fase 2: setelah persetujuan eksplisit, implementasikan backend, database dan integrasi serta jalankan pengujian di bawah. Selesaikan keputusan berdampak terlebih dahulu.

## Hasil Yang Bisa Dicoba
- Pemicu tersimpan dan dapat dikonfigurasi: penerbitan otomatis setelah RAB disetujui atau penerbitan manual oleh Finance.
- Stakeholder melakukan ACK atas SPK/PO yang diterbitkan; ACK berulang tidak membuat record baru.

## Alur Dan Dampak
- Mode dipilih berdasarkan pengaturan yang aktif saat RAB disetujui; perubahan pengaturan dapat memengaruhi pengajuan yang sudah dibuat tetapi RAB-nya belum disetujui. Ini menggantikan aturan sebelumnya tentang job baru.
- Mode otomatis menyiapkan SPK untuk dilengkapi Finance; nomor dan nominal diisi Finance sebelum penerbitan. Mode manual diproses Finance. RAB yang sudah disetujui sebelum fitur aktif masuk antrean manual Finance.
- Jika persiapan otomatis gagal, RAB tetap disetujui; kegagalan atau persiapan yang belum tersedia harus terlihat dan dapat dipulihkan Finance secara idempotent.
- SPK diterbitkan setelah nomor dan nominal dilengkapi; status SPK harus tercatat tanpa membuat data RAB yang sudah ada tidak dapat diakses.
- Tinjau relasi pekerjaan, RAB, SPK/PO, pengaturan dan audit dalam skema aktual. Cegah SPK/PO ganda saat retry atau aksi bersamaan; audit persiapan otomatis mencatat bahwa aksi dipicu oleh persetujuan stakeholder, bukan penerbitan manual.
- Penugasan dan invoice belum termasuk; data MVP sebelumnya harus tetap terbaca setelah migrasi.

## Keputusan Sebelum Implementasi
- Pengguna memilih Admin Pengajuan & RAB mengubah pengaturan pemicu; ini menggantikan ketentuan Admin Finance dalam matriks dan PRD FR-09. Hak penerbitan manual tetap Finance.
- Tetapkan detail nomor, pencatatan kegagalan dan pemulihan yang belum ditentukan; pertimbangkan batas tabel/endpoint dan audit sebelum perubahan berdampak.
- Sajikan tiga opsi layak untuk setiap keputusan berdampak, rekomendasi serta dampak pendek/panjang dan effort; tunggu pilihan pengguna.

## Verifikasi Dan Gerbang
- Coba kedua mode, perubahan pengaturan sebelum persetujuan RAB, antrean manual data lama, penerbitan bersamaan atau ulang, serta ACK berulang dan tanpa izin.
- Periksa audit, pemulihan kegagalan, status ilegal, migrasi aman dan kompatibilitas data MVP 1–2. Pengguna menerima hasil sebelum MVP 4.
