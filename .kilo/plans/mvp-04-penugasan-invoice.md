# MVP 4: Penugasan Dan Invoice

Status: rencana, belum disetujui untuk implementasi. Prasyarat: MVP 3 diterima. Acuan: PRD FR-05, FR-11; FEATURES F-06, F-10 dan matriks akses.

## Dua Fase
- Fase 1: buat UI yang dapat diklik untuk penugasan, akses pekerja dan invoice, termasuk navigasi dan data simulasi yang ditandai jelas. Jangan ubah backend atau database; berhenti untuk review dan persetujuan UI/UX pengguna.
- Fase 2: setelah persetujuan eksplisit, implementasikan backend, database dan integrasi serta jalankan pengujian di bawah. Selesaikan keputusan berdampak terlebih dahulu.

## Hasil Yang Bisa Dicoba
- Admin Finance menugaskan minimal satu pekerja aktif pada SPK/PO dan menerbitkan invoice terkait.
- Pekerja dapat membaca pekerjaan yang ditugaskan kepadanya; invoice memiliki nomor, nominal, jatuh tempo dan status `UNPAID → PAID`.

## Alur Dan Dampak
- Penugasan mengubah `SPK_ISSUED → ASSIGNED`. Invoice ganda pada SPK/PO yang sama ditolak; pekerja nonaktif tidak dapat ditugaskan.
- Tinjau relasi pengguna, penugasan, pekerjaan, SPK/PO, invoice dan audit di skema aktual. Tentukan constraint unik dan batas transaksi berdasarkan keputusan yang disetujui; nominal tidak menggunakan floating point.
- Batasi akses pekerja pada pekerjaan sendiri dan pertahankan data serta audit dari MVP terdahulu. Pencatatan progres belum termasuk.

## Keputusan Sebelum Implementasi
- Default `dueDate` masih TBD; tentukan apakah wajib diisi manual atau kebijakan lain. Tentukan aktor dan proses perubahan invoice menjadi `PAID`, yang belum dijelaskan rinci.
- Tentukan apakah penugasan dan pembuatan invoice harus atomik atau dapat dilakukan terpisah, serta aturan perubahan penugasan. Tinjau batas tabel/endpoint.
- Untuk keputusan berdampak, sajikan tiga opsi layak beserta rekomendasi, dampak pendek/panjang dan effort; tunggu pilihan pengguna.

## Verifikasi Dan Gerbang
- Coba menugaskan pekerja aktif, menolak pekerja nonaktif, akses pekerja sendiri versus lainnya, penerbitan dan perubahan status invoice.
- Uji invoice ganda termasuk permintaan bersamaan, status ilegal, audit yang relevan, ketepatan nominal, migrasi dan data lama. Pengguna menerima hasil sebelum MVP 5.
