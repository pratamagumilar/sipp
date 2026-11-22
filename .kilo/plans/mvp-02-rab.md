# MVP 2: RAB

Status: fase 2 diimplementasikan dan migrasi lokal diterapkan; review pengguna masih diperlukan. Acuan: PRD FR-03; FEATURES F-03, F-10; desain form dan split-pane. Keputusan pengguna di bawah menggantikan rancangan item dan rumus sebelumnya untuk MVP ini.

## Dua Fase
- UI RAB mengikuti kolom sheet RAB & SPK, dengan nilai biaya diisi manual tanpa rumus otomatis. Nilai Penawaran dibaca dari pengajuan; Nilai SPK/PO belum tersedia sampai MVP 3.
- Saat diajukan untuk review, minimal satu kolom biaya harus terisi; nol yang dimasukkan secara eksplisit termasuk nilai terisi. Draf boleh kosong, dan Nilai Penawaran bukan kolom biaya untuk validasi ini.
- Acuan review dan prompt desain: `BRIEF-DESAIN.md`; role produk adalah Admin Pengajuan & RAB. Pengguna menyetujui tabel RAB terpisah meski jumlah tabel melampaui target awal lima tabel.
- Fase 1: buat UI RAB yang dapat diklik, termasuk navigasi, rincian item dan simulasi review/revisi dengan data sementara yang ditandai jelas. Jangan ubah backend atau database; berhenti untuk review dan persetujuan UI/UX pengguna.
- Fase 2: setelah persetujuan eksplisit, implementasikan backend, database dan integrasi serta jalankan pengujian di bawah. Selesaikan keputusan berdampak terlebih dahulu.

## Hasil Yang Bisa Dicoba
- Admin Pengajuan & RAB mengisi kolom biaya spreadsheet secara manual untuk semua pengajuan `APPROVED`, termasuk buatan admin lain. Finance tidak dapat menyusun RAB; perhitungan otomatis ditunda.
- Stakeholder meninjau dan menyetujui RAB atau mengembalikannya untuk revisi.

## Alur Dan Dampak
- `APPROVED → RAB_DRAFT → RAB_REVIEW → RAB_APPROVED`, atau `RAB_REVIEW → RAB_DRAFT`. Edit saat review ditolak; tiap transisi dicatat.
- Sebelum `APPROVED`, akses pengajuan oleh admin gabungan tetap milik sendiri. Setelah `APPROVED`, akses lintas admin diperlukan untuk penyusunan RAB; Stakeholder tetap melakukan review dan approval. Ini target, belum diterapkan: backend saat ini membatasi admin pada pengajuan miliknya, dan identitas database existing tetap `ADMIN_PENGAJUAN`.
- Periksa relasi pengajuan, RAB, item dan audit terhadap skema aktual hasil MVP 1; tetapkan constraint dan transaksi setelah skema tersedia. Gunakan penyimpanan nominal yang presisi, validasi server dan otorisasi peran.
- RAB belum menerbitkan SPK/PO dalam MVP ini. Pertahankan data pengajuan dan audit yang telah ada melalui migrasi aman.

## Keputusan Sebelum Implementasi
- Pemetaan kategori spreadsheet, rumus dan kebijakan perbandingan total dengan estimasi ditunda; jangan menghitung atau menyamakan nilai-nilai tersebut pada MVP ini.
- Audit saat ini mencatat transisi status, aktor dan alasan; perubahan nilai RAB ditimpa dan riwayat nominal sebelum revisi belum dapat direkonstruksi.
- Sajikan tiga opsi layak dan rekomendasi untuk keputusan berdampak, dengan dampak pendek/panjang dan effort; tunggu pilihan pengguna.

## Verifikasi Dan Gerbang
- Pada fase 2, uji admin gabungan menyusun RAB atas pengajuan `APPROVED` sendiri dan milik admin lain, menolak akses admin ke pengajuan admin lain sebelum `APPROVED`, menolak penyusunan RAB oleh Finance, serta review/approval oleh Stakeholder. Coba menambah/mengubah item, mengirim review dan merevisi.
- Uji nilai manual dan presisi, status ilegal, akses tanpa hak, perubahan bersamaan dan audit. Uji migrasi pada salinan data yang mewakili MVP 1.
- Pengguna mencoba dan menerima MVP 2 sebelum MVP 3.
