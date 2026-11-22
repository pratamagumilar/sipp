# MVP 5: Progres Dan Arsip

Status: rencana, belum disetujui untuk implementasi. Prasyarat: MVP 4 diterima. Acuan: PRD FR-06, FR-11 dan retensi; FEATURES F-07, F-10 dan state machine.

## Dua Fase
- Fase 1: buat UI yang dapat diklik untuk progres, penyelesaian dan arsip, termasuk navigasi dan data simulasi yang ditandai jelas. Jangan ubah backend atau database; berhenti untuk review dan persetujuan UI/UX pengguna.
- Fase 2: setelah persetujuan eksplisit, implementasikan backend, database dan integrasi serta jalankan pengujian di bawah. Selesaikan keputusan berdampak terlebih dahulu.

## Hasil Yang Bisa Dicoba
- Pekerja yang ditugaskan memperbarui progres 0–100 dan catatan. Pengeditan memperbarui record yang sama, bukan membuat riwayat progres baru.
- Pekerjaan mencapai selesai dan dapat diarsipkan sebagai read-only sesuai kebijakan yang disepakati.

## Alur Dan Dampak
- Alur terdokumentasi `ASSIGNED → IN_PROGRESS → COMPLETED → ARCHIVED`; transisi dicatat terpisah dari record progres. FEATURES menyebut last-write-wins dengan `updatedAt` untuk update bersamaan.
- Periksa relasi penugasan, progres, pekerjaan dan audit pada skema aktual; pertahankan akses hanya untuk pekerja terkait dan proteksi arsip pada server, bukan hanya UI.
- Migrasi tidak boleh menghapus data dan audit sebelumnya. Nilai progres di luar rentang ditolak pada batas server.

## Keputusan Sebelum Implementasi
- Tentukan bagaimana progres langsung 100% dari `ASSIGNED` berpindah status dan bagaimana audit mencatatnya.
- FEATURES mengizinkan beberapa pekerja tetapi tidak menjelaskan apakah progres per pekerjaan atau per pekerja maupun agregasinya. Putuskan relasi dan aturan penyelesaian sebelum membuat skema.
- Progres turun dari 100 masih TBD meskipun fitur menyebut default diizinkan; tentukan juga dampaknya setelah arsip. Tentukan aktor dan syarat pengarsipan yang belum didefinisikan.
- Berikan tiga opsi layak dengan rekomendasi, dampak pendek/panjang dan effort untuk keputusan berdampak; tunggu pilihan pengguna.

## Verifikasi Dan Gerbang
- Coba update, edit ulang, batas 0/100, akses pekerja lain, kasus beberapa pekerja, update bersamaan, penyelesaian dan arsip read-only sesuai keputusan.
- Periksa audit status dan pelestarian data setelah migrasi. Pengguna menerima hasil sebelum MVP 6.
