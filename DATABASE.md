# Database KerjaNyata

Sumber skema: `prisma/schema.prisma`; constraint dan trigger: `prisma/migrations`. PostgreSQL + Prisma 6, bukan Prisma 7. Terdapat 15 model aktual; batas awal PRD lima tabel tidak lagi menggambarkan implementasi existing.

## Alur dan relasi

User → Job (pengajuan) → Rab (unik per Job) → Spk (unik per Rab) → Assignment (unik per Spk) → AssignmentMember. Member mengacu User, bukan nama bebas. Job.status tetap status pengajuan (DRAFT/SUBMITTED/REJECTED/APPROVED). Rab dan Spk punya status masing-masing. Status proses setelah SPK berada pada Assignment (ASSIGNED/IN_PROGRESS/COMPLETED). Arsip belum diimplementasikan.

## Perubahan penugasan

Migrasi `20261125000000_assignments` menambah enum Role.PEKERJA, kolom User.active (default true) dan User.occupation (default kosong), serta tiga tabel. Pengajuan, RAB, SPK dan audit existing tidak ditulis ulang atau dihapus.

- Assignment: identitas/nomor surat unik, FK SPK unik, semua field isi surat, tiga tanggal bertipe DATE, versi surat, status/progres/catatan serta pelaku/waktu update terakhir. Nilai progres dan status wajib konsisten (0/ASSIGNED, 1–99/IN_PROGRESS, 100/COMPLETED), versi nonnegatif, tanggal akhir tidak sebelum awal. Progres disimpan pada baris ini, bukan history baru.
- AssignmentMember: FK Assignment + User dengan onDelete Restrict, nama snapshot dari akun, okupasi dalam konteks surat, peran Ketua/Anggota dan urutan. Unik per assignment-user dan assignment-position; index userId untuk akses. Partial unique index satu Ketua; deferred constraint trigger memeriksa 1–50 anggota dan tepat satu Ketua pada commit. Menyimpan ulang tim tidak mengubah User.
- AssignmentAudit: FK Assignment + actor User, event CREATED/UPDATED/STATUS_CHANGED, status asal/tujuan, timestamp, snapshot surat/tim untuk penyimpanan admin. Tidak menyimpan password atau history catatan progres. Trigger menolak update/delete audit.

Semua FK baru memakai Restrict sehingga referensi dan jejak audit tidak terhapus diam-diam. Validasi field serta akun pekerja aktif dilakukan di server. Akun yang dinonaktifkan ditolak saat login dan request sesi berikutnya. Menghapus anggota tim mencabut aksesnya pada permintaan berikutnya; dokumen yang sebelumnya sudah diunduh tentu tetap berada pada penerima.

Simpan surat mengambil row lock Spk, memeriksa versi dan eligibility SPK/RAB/pengajuan, membaca akun PEKERJA aktif dengan shared lock, lalu menulis surat/tim/audit secara atomik. Update progres mengambil lock Spk yang sama dan memeriksa keanggotaan ulang setelah lock. Progres tidak menaikkan versi surat; penyimpanan surat tidak mereset progres. Jika dua pekerja memperbarui progres, pembaruan terakhir berlaku.

## Model existing

User, Job, Rab, RabItem, Spk, Setting, InstallationType, Attachment dan audit masing-masing: AuditLog (pengajuan), RabAudit, SpkAudit, SettingAudit. Nominal memakai Decimal; audit existing juga dilindungi trigger immutable. Lampiran masih filesystem privat lokal, belum S3; deployment Vercel menolak upload sampai storage persisten tersedia. Invoice dan arsip belum punya model.

## Operasi

`npm run db:migrate` menerapkan migrasi tanpa reset; `npm run db:seed` hanya menambah akun development yang belum ada serta master instalasi. Seed tidak mereset password existing. Akun pekerja dibuat melalui UI penugasan oleh admin, tidak memakai password seed bawaan. Tes integrasi harus memakai database terisolasi bernama *_test* dan ALLOW_ISOLATED_INTEGRATION_TESTS=yes; jangan diarahkan ke database aplikasi.
