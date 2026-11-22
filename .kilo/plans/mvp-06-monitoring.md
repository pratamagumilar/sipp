# MVP 6: Monitoring Dan Penyempurnaan

Status: rencana, belum disetujui untuk implementasi. Prasyarat: MVP 5 diterima. Acuan: PRD FR-08, FR-10, FR-11 dan NFR; FEATURES F-08, F-10; DESIGN bagian dashboard, responsive dan aksesibilitas.

## Dua Fase
- Fase 1: buat UI monitoring dan pengelolaan pengguna yang dapat diklik, termasuk navigasi, filter dan data simulasi yang ditandai jelas. Jangan ubah backend atau database; berhenti untuk review dan persetujuan UI/UX pengguna.
- Fase 2: setelah persetujuan eksplisit, implementasikan backend, database dan integrasi serta jalankan pengujian di bawah. Selesaikan keputusan berdampak terlebih dahulu.

## Hasil Yang Bisa Dicoba
- Stakeholder melihat ringkasan berdasarkan data aktual dan tabel pekerjaan aktif dengan filter status dan tahun; peran lain hanya melihat data sesuai haknya.
- Lengkapi pengelolaan pengguna dan role yang belum tersedia, serta kebutuhan operasional yang diperlukan untuk menggunakan fitur terdahulu.

## Alur Dan Dampak
- Dashboard membaca status pengajuan, RAB, SPK/PO, invoice dan progres dari skema aktual tanpa membuat angka fiktif. Periksa filter akses sebelum agregasi agar data tidak bocor.
- Tinjau query, indeks, relasi dan perubahan data/role terhadap seluruh MVP; setiap migrasi harus mempertahankan data dan audit. Pengaturan yang sudah dibuat di MVP 3 tidak dibuat ulang.
- Ikuti desain tabel padat data yang responsif, status berlabel teks, kondisi loading/kosong/error dan aksesibilitas.

## Keputusan Sebelum Implementasi
- Tentukan rincian pengelolaan akun, penonaktifan dan perubahan role yang belum dijabarkan PRD, termasuk dampak pada penugasan aktif dan audit.
- Tentukan metrik dashboard dan definisi filter jika dokumen tidak cukup spesifik; evaluasi kembali batas lima tabel/endpoint dengan implementasi aktual.
- Untuk keputusan berdampak, sajikan tiga opsi layak, rekomendasi, dampak pendek/panjang dan effort; tunggu pilihan pengguna.

## Verifikasi Dan Gerbang
- Cocokkan agregat dan filter dengan data nyata lintas tahun dan peran; uji akses tidak sah, keadaan tanpa data, layar mobile dan navigasi keyboard.
- Jalankan pengujian alur ujung ke ujung, audit, akses file privat dan keamanan peran. Ukur LCP dashboard terhadap target < 2 detik dan p95 API terhadap target < 500 ms pada lingkungan dan beban yang dicatat; laporkan keterbatasan.
- Pengguna mencoba dan menerima MVP 6 setelah hasil pengujian dan masalah tersisa dijelaskan.
