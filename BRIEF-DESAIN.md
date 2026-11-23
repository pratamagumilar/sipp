# Brief Desain KerjaNyata

## Produk
KerjaNyata adalah aplikasi web internal untuk mencatat dan memantau siklus pekerjaan lintas tahun: pengajuan, persetujuan, RAB, SPK/PO, penugasan, invoice, progres dan arsip. Tujuannya menggantikan pencatatan spreadsheet yang tersebar dengan alur yang jelas, akses berdasarkan peran dan jejak audit.

Dokumen ini adalah brief untuk eksplorasi Stitch atau Figma Make, bukan persetujuan perubahan sistem. Gunakan bahasa Indonesia dan data contoh yang jelas fiktif. Identitas visual baru boleh dieksplorasi; `DESIGN (1).md` tetap berlaku sampai desain penggantinya disetujui.

## Aktor Dan Alur
- Admin Pengajuan & RAB membuat draf, mengirim pengajuan, merevisi setelah ditolak, menyusun dan mengajukan RAB untuk review atas semua pengajuan `APPROVED`, serta mengatur pemicu SPK/PO. Sebelum `APPROVED`, akses pengajuan bagi admin gabungan hanya milik sendiri.
- Stakeholder menyetujui atau menolak pengajuan, meninjau RAB, mengakui SPK/PO dan memantau pekerjaan.
- Admin Finance menerbitkan SPK/PO sesuai pemicu, menugaskan pekerja dan menerbitkan invoice; tidak menyusun RAB.
- Pekerja melihat pekerjaan yang ditugaskan dan memperbarui progresnya.

Alur utama: draf pengajuan → dikirim → disetujui/ditolak → RAB → SPK/PO → penugasan → progres → selesai → arsip. Status dan akses yang tersedia harus terlihat jelas; jangan menyimulasikan aksi role yang tidak berwenang.

Ini adalah target desain, bukan hak backend yang sudah diterapkan. Preview RAB saat ini memakai data fiktif sementara terpisah per akun dan masih menyebut akses editor admin sementara. Identitas database existing tetap `ADMIN_PENGAJUAN`; akses lintas admin dan backend RAB fase 2 belum disetujui atau diterapkan.

## Sumber Dan Ketidakpastian
- Acuan produk: `PRD (1).md` dan `FEATURES.md`. Acuan visual saat ini: `DESIGN (1).md`.
- [Spreadsheet RAB/SPK](https://docs.google.com/spreadsheets/d/1C2B7krjQcIMODf0XHo3_j3ATEtIIEUeF/edit?gid=1277792486#gid=1277792486): kolom yang teramati mencakup nomor agenda, pemohon, pemilik instalasi, jenis, kapasitas, lokasi, nilai penawaran, nilai SPK/PO, kategori biaya, pajak dan margin. Ekspor yang diperiksa terpotong; rumus dan daftar tarif resmi belum terverifikasi.
- `IPTL TM`, `PLTD`, `PLTS`, `PLTMH`, `DISTEM`, dan `DISTER` adalah contoh jenis yang terlihat, bukan daftar master yang telah disetujui. Nilai SPK/PO historis bukan bukti tarif tetap per jenis.
- Satuan yang ditemukan meliputi `VA`, `kVA`, `kW`, `kWp`, `ms`, dan `kms`. Arti dan konversi satuan belum diputuskan.
- Estimasi biaya PRD belum terbukti identik dengan nilai penawaran spreadsheet. Jangan samakan nilai penawaran, SPK/PO, RAB, pajak, biaya dan margin atau mengarang rumus.

## Prinsip Desain
- Dashboard operasional yang mudah dipindai, bukan landing page pemasaran. Eksplorasi warna, tipografi dan tata letak diperbolehkan, namun visual baru harus disetujui pengguna.
- Responsif desktop dan mobile; sediakan state kosong, loading, error, sukses, disabled dan konfirmasi kehilangan perubahan.
- Gunakan label form eksplisit, urutan keyboard logis, fokus terlihat, target sentuh memadai dan status berbentuk teks selain warna. Pertahankan kontras yang memenuhi WCAG AA.
- Semua interaksi dalam fase desain berupa simulasi yang ditandai jelas, tanpa data pelanggan nyata, autentikasi operasional atau penyimpanan permanen.

## Prompt Bersama
Rancang aplikasi web operasional berbahasa Indonesia bernama KerjaNyata untuk manajemen pekerjaan instalasi dan dokumentasi lintas tahun. Tampilkan navigasi berdasarkan peran, status yang jelas, tabel yang mudah dipindai, detail pekerjaan dan riwayat aktivitas. Buat prototipe yang bisa diklik, responsif desktop/mobile, dapat dinavigasi dengan keyboard, dan gunakan hanya data fiktif yang diberi label simulasi. Eksplorasi identitas visual baru tanpa mengorbankan keterbacaan data. Jangan membuat angka statistik palsu atau menyimpulkan tarif otomatis.

## Prompt Pengajuan
Buat layar daftar dan detail pengajuan, form halaman penuh, login/logout simulasi dan aktivitas audit. Admin Pengajuan & RAB dapat membuat dan menyimpan draf, mengirim, serta merevisi pengajuan miliknya yang ditolak; sebelum `APPROVED` akses admin hanya milik sendiri. Stakeholder dapat menyetujui atau menolak dengan alasan minimal 10 karakter. Status dan aksi yang tidak tersedia harus jelas.

Sertakan judul, deskripsi, estimasi biaya, lampiran simulasi dan kandidat field nomor agenda, pemohon, pemilik instalasi, jenis instalasi, kapasitas dan satuan, kota, provinsi serta nilai penawaran manual. Field kandidat selain aturan yang disepakati belum ditetapkan wajib. Estimasi boleh kosong dalam draf, tetapi harus lebih dari nol saat pengajuan dikirim. Pilihan jenis merupakan simulasi master; jangan menerapkan tarif otomatis. Sertakan pesan validasi, konfirmasi meninggalkan perubahan, serta state kosong dan error.

## Prompt RAB
Buat layar draf RAB bagi Admin Pengajuan & RAB untuk semua pengajuan `APPROVED`, termasuk buatan admin lain, editor rincian, daftar dan detail untuk review Stakeholder, aksi minta revisi dan setujui, serta jejak aktivitas simulasi. Finance tidak menyusun RAB. Tampilkan konsep line item PRD: uraian, kuantitas, satuan, harga satuan dan subtotal; total RAB dihitung server dalam implementasi final sesuai FEATURES.

Tampilkan komponen spreadsheet sebagai kandidat diskusi: fix cost, SPPJ dan transport, NIDI, izin ESDM, LHPP, PNBP, verifikator, sewa alat, variable cost, PPN, biaya operasional dan margin. Pemetaan kategori terhadap item, rumus pajak/margin, pembulatan dan hubungannya dengan nilai SPK/PO belum disepakati; jangan mengarang aturan atau tarif. Nilai simulasi harus jelas bukan data nyata.

## Layar Berikutnya
- MVP 3: pengaturan pemicu, penerbitan SPK/PO dan ACK.
- MVP 4: penugasan pekerja dan invoice.
- MVP 5: progres pekerjaan dan arsip read-only.
- MVP 6: monitoring lintas tahun, filter, ringkasan dan pengelolaan pengguna.

Rincikan setiap tahap setelah tahap sebelumnya diterima. Fase 1 berakhir dengan review UI/UX; backend, skema dan integrasi hanya dilanjutkan setelah persetujuan eksplisit dan keputusan berdampak diselesaikan.
