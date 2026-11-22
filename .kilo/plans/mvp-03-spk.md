# MVP 3: SPK/PO Dan ACK

Status: rencana, belum disetujui untuk implementasi. Prasyarat: MVP 2 diterima. Acuan: PRD FR-04, FR-07, FR-09, FR-11; FEATURES F-04, F-05, F-09, F-10.

## Dua Fase
- Fase 1: buat UI yang dapat diklik untuk pengaturan pemicu, penerbitan SPK/PO dan ACK, dengan navigasi dan data simulasi yang ditandai jelas. Jangan ubah backend atau database; berhenti untuk review dan persetujuan UI/UX pengguna.
- Fase 2: setelah persetujuan eksplisit, implementasikan backend, database dan integrasi serta jalankan pengujian di bawah. Selesaikan keputusan berdampak terlebih dahulu.

## Hasil Yang Bisa Dicoba
- Pemicu tersimpan dan dapat dikonfigurasi: penerbitan otomatis setelah RAB disetujui atau penerbitan manual oleh Finance.
- Stakeholder melakukan ACK atas SPK/PO yang diterbitkan; ACK berulang tidak membuat record baru.

## Alur Dan Dampak
- Penerbitan memindahkan `RAB_APPROVED → SPK_ISSUED`; perubahan pengaturan tidak berlaku retroaktif pada job lama, sesuai F-04.
- Tinjau relasi pekerjaan, RAB, SPK/PO, pengaturan dan audit dalam skema aktual. Rancang transaksi dan constraint untuk mencegah SPK/PO ganda saat retry atau aksi bersamaan; catat aktor sistem untuk transisi otomatis dengan mekanisme yang disepakati.
- Penugasan dan invoice belum termasuk; data MVP sebelumnya harus tetap terbaca setelah migrasi.

## Keputusan Sebelum Implementasi
- FEATURES F-09 menyebut hanya Admin, tetapi matriks dan PRD FR-09 mengarah ke Admin Finance; selesaikan konflik peran sebelum membuat kontrol akses.
- Perjelas arti job lama/job baru pada perubahan pemicu dan penanganan kegagalan penerbitan otomatis. Pertimbangkan dampak batas tabel/endpoint dan kebutuhan audit.
- Sajikan tiga opsi layak untuk setiap keputusan berdampak, rekomendasi serta dampak pendek/panjang dan effort; tunggu pilihan pengguna.

## Verifikasi Dan Gerbang
- Coba kedua mode, perubahan pengaturan tanpa efek retroaktif, penerbitan bersamaan atau ulang, serta ACK berulang dan tanpa izin.
- Periksa audit, pemulihan kegagalan, status ilegal, migrasi aman dan kompatibilitas data MVP 1–2. Pengguna menerima hasil sebelum MVP 4.
