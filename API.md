# API KerjaNyata

Implementasi berada di `server/api.ts` dan `server/assignment-api.ts`, melalui `/backend`. Sesi NextAuth wajib; role dan status aktif dibaca ulang dari database setiap request. Mutasi memerlukan header Origin yang sesuai AUTH_URL. Respons penugasan/pekerja memakai cache private/no-store. Field yang tidak dikenal ditolak pada payload baru di bawah.

## Akun pekerja

- `GET /backend/workers`: Admin Pengajuan & RAB saja. Daftar akun PEKERJA aktif: id, nama, email, okupasi. Password/hash tidak dikembalikan.
- `POST /backend/workers`: Admin Pengajuan & RAB saja. Body `{name,email,occupation,password}`. Nama/okupasi 1–200 karakter, email valid/unik (dinormalisasi ke huruf kecil), password 12–72 byte dan di-hash bcrypt. Role ditetapkan PEKERJA di server; akun aktif. Email ganda 409, input tidak valid 422. Pembuatan akun tidak otomatis memberi akses ke pekerjaan.

## Penugasan

- `GET /backend/assignments`: daftar SPK ISSUED dari RAB_APPROVED dan pengajuan APPROVED, termasuk SPK yang belum memiliki surat. Admin/Stakeholder/Finance dapat membaca; pekerja hanya mendapat entri yang saat ini menugaskannya. Ringkasan mencakup nomor SPK/surat, judul, jumlah anggota, status, persentase.
- `GET /backend/assignments/:spkId`: konteks SPK/pekerjaan serta surat (null jika belum dibuat), tim, progres terkini dan audit. Pekerja tanpa keanggotaan mendapat 404.
- `PUT /backend/assignments/:spkId`: Admin Pengajuan & RAB saja. Body semua field surat: `number, consideration, basis, purpose, installationType, start, end, owner, location, capacity, issuePlace, issueDate, signatory, signatoryTitle`; ditambah `version` (null untuk pembuatan pertama, integer versi sebelumnya untuk edit) dan `roster: [{userId,occupation,role}]` (role Ketua/Anggota). Nama tim dibaca dari akun di server. Seluruh field surat wajib; nomor maksimal 200, teks lain maksimal 2000; tanggal YYYY-MM-DD valid; end >= start. Tim 1–50 akun PEKERJA aktif, unik dan tepat satu Ketua. Surat per SPK dan nomor surat unik. Bentrok versi atau nomor 409; SPK belum terbit/tidak ada 404; data tidak valid 422; role lain 403. Edit dan progres diserialisasi pada lock SPK. Surat/tim serta audit snapshot disimpan dalam satu transaksi.
- `PUT /backend/assignments/:spkId/progress`: hanya PEKERJA aktif yang masih menjadi anggota. Body `{progressPercent,notes}`: integer 0–100, catatan maksimal 2000 karakter. Memperbarui record yang sama: 0 ASSIGNED, 1–99 IN_PROGRESS, 100 COMPLETED; boleh turun kembali. Pelaku/waktu terakhir dicatat. Anggota tim berbagi progres pekerjaan, pembaruan terakhir berlaku. Tidak mengubah versi surat; hanya transisi status menghasilkan audit. Akses yang dicabut 404, role lain 403, input tidak valid 422.

## Akses baca pekerja

GET jobs, jobs/:id, jobs/:id/rab, rabs/jobs, spks, jobs/:id/spk, dan attachments/:id dibatasi pada keanggotaan penugasan saat ini. Pengaturan, daftar akun, pembuatan/edit pengajuan/RAB/SPK, dan mutasi lain tidak dapat diakses pekerja. Akun nonaktif ditolak 401 termasuk pada sesi yang sudah ada.

PDF dibuat di browser dari surat yang tersimpan; sebelum download, akses dan versi diverifikasi lagi melalui GET penugasan. Tidak ada endpoint server untuk menyimpan file PDF atau tanda tangan digital. API invoice, arsip, monitoring menyeluruh, dan pengelolaan umum role belum tersedia. Untuk endpoint pengajuan/RAB/SPK existing, kode `server/api.ts` merupakan referensi payload lengkap.
