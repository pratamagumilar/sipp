# MVP 1: Pengajuan dan Persetujuan

Status: fase 2 dimulai atas permintaan pengguna; MVP belum selesai diverifikasi. Acuan: `PRD (1).md` FR-01, FR-02, FR-10, FR-11; `FEATURES.md` F-01, F-02, F-10; `DESIGN (1).md`.

## Fase Dan Status Aktual
- Acuan review dan prompt desain: `BRIEF-DESAIN.md`. Pengguna meminta implementasi database MVP 1 untuk seluruh field pengajuan; nilai penawaran terpisah dari estimasi biaya dan tidak ada tarif otomatis. RAB tetap di luar integrasi MVP 1.
- Fase 1, review UI/UX: coba layar, navigasi dan interaksi pengajuan, login, persetujuan dan revisi; kumpulkan perubahan sebelum menyetujui desain. Untuk perubahan UI berikutnya, gunakan data simulasi yang ditandai jelas dan jangan mengubah backend atau database selama review.
- Fase 2, backend dan database: implementasi awal sudah dibuat sebelum aturan dua fase ditetapkan. Jangan hapus atau ubah data yang sudah ada hanya untuk memisahkan fase; perubahan backend/database selanjutnya menunggu persetujuan eksplisit hasil review UI dan keputusan berdampak yang relevan.

## Hasil Yang Bisa Dicoba
- Admin Pengajuan & RAB masuk, membuat dan menyimpan draf, lalu mengirimnya untuk persetujuan. Lampiran opsional disimpan pada disk privat dan diakses melalui endpoint terotorisasi, sesuai pilihan pengguna sebagai pengganti S3/signed URL di PRD.
- Stakeholder meninjau, menyetujui, atau menolak dengan alasan minimal 10 karakter. Pengajuan ditolak dapat direvisi dan dikirim kembali.
- Pengguna hanya dapat menjalankan aksi sesuai peran; setiap transisi dicatat untuk audit.

## Alur Dan Batas
- Alur: `DRAFT → SUBMITTED → APPROVED` atau `REJECTED → DRAFT → SUBMITTED`. Pengajuan terkirim tidak dapat diedit sampai ditolak; aksi pada status salah ditolak.
- RAB, SPK/PO, invoice, progres dan dashboard lengkap belum termasuk. Sediakan hanya kemampuan akun dan peran yang diperlukan untuk mencoba alur; pengelolaan pengguna lengkap direncanakan di MVP 6.
- Ikuti desain form halaman penuh, daftar/detail yang responsif, keadaan loading/error/kosong, dan aksesibilitas dokumen desain.

## Dampak Data Dan Keamanan
- Skema aktual Prisma sudah mencakup pengguna, pengajuan, lampiran dan audit; perubahan harus mempertahankan data yang ada. Dokumen `DATABASE.md` dan `API.md` belum tersedia.
- Identitas database existing tetap `ADMIN_PENGAJUAN`. Backend saat ini membatasi akses admin pada pengajuan miliknya; target akses semua pengajuan `APPROVED` untuk penyusunan RAB belum diterapkan dan backend RAB fase 2 belum disetujui. Sebelum `APPROVED`, akses admin gabungan tetap milik sendiri.
- Tentukan transaksi perubahan status dan pencatatan audit, pencegahan persetujuan bersamaan dengan optimistic locking, validasi server, otorisasi dan akses lampiran privat. Jangan mengubah atau membuang data tanpa strategi migrasi.
- Nilai uang harus akurat (`Decimal(18,2)` menurut fitur); mata uang IDR masih asumsi TBD. Validasi `estimatedCost > 0` dan penanganan kegagalan upload sesuai F-01.

## Keputusan Sebelum Implementasi
- Pengguna memilih menaikkan batas endpoint dan menggunakan lima tabel inti sebagai target untuk ditinjau; hitung ulang saat skema dan fitur bertambah.
- Draf boleh kosong; judul, deskripsi dan estimasi lebih dari nol wajib saat submit. Enam jenis instalasi yang diamati di spreadsheet menjadi seed awal tanpa harga, belum dianggap daftar resmi lengkap.
- Akun awal memakai seed lokal; lampiran menggunakan disk privat dan endpoint terotorisasi. Seed ulang tidak boleh mereset kredensial yang sudah ada.
- Untuk setiap keputusan berdampak, bandingkan tiga opsi layak beserta dampak jangka pendek, panjang, dan effort; tunggu pilihan pengguna. Jangan memaksakan opsi yang tidak layak.

## Verifikasi Dan Gerbang
- Uji simpan/edit draf, submit, approve, reject tanpa/dengan alasan, revisi dan submit ulang; pastikan transisi ilegal dan aksi tanpa izin ditolak.
- Uji persetujuan bersamaan, audit setiap transisi, akses lampiran tanpa izin, kegagalan upload, nominal dan tampilan desktop/mobile.
- Pengguna mencoba MVP dan menyetujui hasil atau revisi sebelum MVP 2 dimulai. Target performa PRD diverifikasi ketika lingkungan pengujian memadai.
