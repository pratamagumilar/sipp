# Aturan Proyek KerjaNyata

Aturan ini berlaku untuk pekerjaan dan command dalam konteks proyek ini.

## Pemahaman Sebelum Bekerja

- Sebelum membuat rencana atau mengerjakan perubahan, pahami alur bisnis dan teknis yang relevan secara mendalam, termasuk aktor, status, transisi, validasi, dan proses sebelum serta sesudah bagian yang diubah.
- Baca bagian yang relevan dari `PRD (1).md`, `FEATURES.md`, dan `DESIGN (1).md`, serta kode, konfigurasi, dan dokumen terkait yang tersedia. Sesuaikan kedalaman pemeriksaan dengan dampak tugas.
- Telusuri dampak terhadap entitas, relasi database, constraint, transaksi, perubahan data, migrasi, hak akses, integrasi, audit, dan fitur lain yang terkait. Jelaskan dampak dan ketidakpastian yang material sebelum mengambil keputusan.
- Periksa keberadaan dokumen database dan API serta skema atau implementasi aktual sebelum merujuknya. Jika belum tersedia, nyatakan keterbatasannya; jangan mengarang relasi atau perilaku. Minta klarifikasi jika keputusan tidak aman diambil sendiri.

## Keputusan Berdampak

- Untuk keputusan produk atau teknis yang berdampak, sajikan tepat tiga opsi yang benar-benar berbeda beserta satu rekomendasi. Bandingkan dampak jangka pendek, dampak jangka panjang, dan estimasi effort relatif setiap opsi.
- Tunggu pilihan pengguna sebelum menerapkan keputusan berdampak. Jika kurang dari tiga opsi yang layak, jelaskan keterbatasannya tanpa mengarang opsi dan minta keputusan pengguna.
- Tugas sederhana yang tidak membutuhkan keputusan berdampak, seperti perbaikan typo, dapat langsung dikerjakan.
- Jika PRD, fitur, desain, atau implementasi saling bertentangan, jelaskan konflik dan dampaknya; berikan tiga opsi jika keputusannya berdampak, lalu tunggu keputusan pengguna sebelum mengubah perilaku.

## Pelaksanaan

- Untuk setiap MVP, gunakan dua fase berurutan. Fase 1: buat UI/UX yang dapat diklik, termasuk navigasi dan simulasi interaksi sesuai fungsi, dengan data sementara yang jelas bukan data nyata; jangan membuat atau mengubah backend, skema database, migrasi, atau data persisten pada fase ini.
- Berhenti setelah fase 1 untuk pengguna mencoba dan menyetujui UI/UX. Fase 2 baru boleh dimulai setelah persetujuan eksplisit: implementasikan backend, database, integrasi, keamanan, dan pengujian sesuai kebutuhan. Jika hasil review mengubah keputusan produk atau data yang berdampak, ikuti aturan Keputusan Berdampak sebelum implementasi.
- Untuk MVP yang telah memiliki backend atau database sebelum aturan ini, jangan menghapus atau mengubahnya hanya untuk menerapkan fase 1; catat status aktual dan gunakan aturan dua fase untuk pekerjaan berikutnya.
- Gunakan skill yang tersedia dan relevan sesuai deskripsinya; tidak semua skill perlu digunakan pada setiap tugas.
- Ikuti kebutuhan dan stack yang disepakati dalam dokumen proyek; jangan menambah dependensi, abstraksi, atau cakupan tanpa kebutuhan nyata.
- Jaga validasi input dan otorisasi pada batas kepercayaan, keamanan, aksesibilitas, integritas data, dan pencegahan kehilangan data. Pertimbangkan konsekuensi perubahan database dan data yang sudah ada.
- Jalankan pemeriksaan atau pengujian yang sesuai dengan perubahan dan dampaknya. Laporkan hasil, keterbatasan, serta pemeriksaan yang tidak dapat dijalankan.
