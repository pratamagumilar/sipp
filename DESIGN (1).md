# DESIGN.md: KerjaNyata

## 1. Design Read (Evidence-Based)

- **Product:** KerjaNyata — sistem manajemen pekerjaan & dokumentasi proyek sebagai single source of truth lintas tahun.
- **Target Audience:** Admin Pengajuan & RAB, Stakeholder, Pekerja, Admin Finance (PRD §3).
- **Product Type:** Dashboard / SaaS Application (internal operations).
- **Primary User Goal:** Menelusuri siklus `pengajuan → approval → RAB → SPK/PO → assign → invoice → progres` dengan jejak audit yang jelas (PRD FR-01..FR-11).
- **User Roles & Workflows:**
  - *Admin Pengajuan & RAB:* form pengajuan + upload lampiran S3; sebelum `APPROVED`, akses pengajuan hanya milik sendiri. Editor draf RAB per item untuk semua pengajuan `APPROVED`, termasuk buatan admin lain, dan submit ke review stakeholder (DEC-002).
  - *Stakeholder:* inbox approval (DEC-001), review RAB, ACK SPK/PO, dashboard monitoring.
  - *Admin Finance:* terbitkan SPK/PO (DEC-003/004), lihat penugasan, terbitkan invoice; tidak menyusun RAB.
  - *Pekerja:* daftar tugas sendiri, form progres 0–100% + `notes` yang **dapat diedit ulang tanpa membuat history baru** (DEC-005).
- **Brand / Aesthetic Direction:** *Institutional-utilitarian ledger.* Netral, tenang, padat data, dengan tipografi tegas dan garis hairline. Referensi rasa: buku besar akuntansi + arsip dokumen. Bukan startup marketing.
- **Key Personality Traits:** *Tertib, Dapat diaudit, Tenang.*

Backend RAB dan akses RAB lintas admin sudah tersedia. Identitas admin database tetap `ADMIN_PENGAJUAN`. Penugasan diisi Admin Pengajuan & RAB: daftar SPK terbit → ikon edit → tab Penugasan (surat dan pemilihan akun pekerja) / Preview surat (download PDF dan cetak). Akun PEKERJA melihat pekerjaan yang ditugaskan kepadanya dan mengisi progres 0–100 serta catatan. UI fase 1 penugasan telah disetujui pengguna untuk dilanjutkan ke backend.

## 2. Design Dials

| Dial | Value | Rationale |
|:---|:---|:---|
| DESIGN_VARIANCE | **2** | Konsistensi tata letak antar-role krusial; pengguna harus mengenali pola tabel/form yang sama di setiap modul (PRD NFR auditability). |
| MOTION_INTENSITY | **2** | Fokus workspace tinggi; animasi hanya untuk feedback transisi status (mis. `SUBMITTED → APPROVED`). |
| VISUAL_DENSITY | **8** | Dashboard stakeholder & tabel lintas tahun butuh banyak baris terlihat sekaligus (PRD FR-08, retensi lintas tahun). |

## 3. Visual Identity & Product-Type Adaptation

Karena ini dashboard operasional, prioritasnya **scanability & hierarchy**, bukan dekorasi. Identitas dibangun dari: (a) grid 12-kolom ketat, (b) tipografi dengan kontras ukuran besar antara label status dan isi, (c) hairline border 1px sebagai pemisah utama, (d) status pill monospace. Dilarang: gradient dekoratif, frosted glass, rounded box berlebihan. Sudut `border-radius` maksimum `4px` (kecuali pill status `9999px`).

## 4. Semantic Color System

```css
:root {
  --color-primary:   #1F3A5F; /* navy institusional - header, link */
  --color-secondary: #4A5568; /* slate - aksi sekunder */
  --color-accent:    #B45309; /* amber gelap - CTA utama & state aktif */
  --color-success:   #15803D;
  --color-warning:   #B45309;
  --color-danger:    #B91C1C;
  --color-bg:        #FAFAF7; /* off-white hangat, bukan #FFFFFF */
  --color-surface:   #FFFFFF;
  --color-fg:        #111827;
  --color-muted:     #6B7280;
  --color-border:    #E5E7EB;
}
```

**Usage rules:** Neutral (`bg/surface/fg/muted/border`) wajib ≥90% area. `--color-accent` hanya untuk satu CTA utama per viewport + status `SUBMITTED`/`RAB_REVIEW`. `--color-success` = `APPROVED`/`RAB_APPROVED`/`COMPLETED`. `--color-danger` = `REJECTED`/`OVERDUE`. Dilarang gradient biru/ungu neon.

## 5. Typography & Type Scale

- **Primary:** `IBM Plex Sans` — netral, x-height tinggi, ramah angka & tabel; menghindari Inter agar tidak generik.
- **Mono:** `IBM Plex Mono` — untuk ID pengajuan, nominal RAB, timestamp audit.
- Google Fonts: `family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500`

| Level | Size | Weight | LH | Tracking | Rationale |
|:---|:---|:---|:---|:---|:---|
| h1 | 1.75rem | 600 | 1.2 | -0.01em | Judul halaman modul |
| h2 | 1.375rem | 600 | 1.3 | 0 | Judul seksi |
| h3 | 1.125rem | 600 | 1.4 | 0 | Judul panel |
| body | 0.875rem | 400 | 1.5 | 0 | Tabel & form |
| label | 0.75rem | 500 | 1.4 | 0.02em | Field label, uppercase |
| caption | 0.75rem | 400 | 1.4 | 0 | Timestamp, hint |
| mono | 0.8125rem | 500 | 1.4 | 0 | ID, nominal, audit |

## 6. Layout Strategy & Anti-Repetition Rules

- **Master/Detail split-pane** untuk Pengajuan, RAB, SPK/PO: list kiri (min 320px), detail kanan.
- **Data table** untuk monitoring lintas tahun (Stakeholder dashboard) — bukan card grid.
- **Form halaman penuh** (bukan modal) untuk pengajuan & RAB karena banyak field + lampiran.
- **Timeline vertikal** untuk audit log per entitas.
- **Dilarang:** pola "Hero → 3 Cards" di mana pun. Setiap halaman modul punya struktur berbeda sesuai konten.
- **Grid & spacing:** 12 kolom, gutter `24px`, margin halaman `32px` desktop / `16px` mobile. Skala spacing: `4, 8, 12, 16, 24, 32, 48, 64px`.

## 7. Anti-AI-Slop Rules

- **Avoid:** 3-card feature grid → **Prefer:** tabel atau split-pane sesuai data.
- **Avoid:** setiap seksi dibungkus rounded card → **Prefer:** hairline divider + whitespace.
- **Avoid:** gradient ungu/biru, mesh blob → **Prefer:** flat neutral, aksen amber tunggal.
- **Avoid:** ikon dekoratif tanpa fungsi → **Prefer:** label status teks + mono.
- **Avoid:** animasi layout-heavy → **Prefer:** transisi `opacity`/`transform` 150ms hanya untuk feedback.

## 8. Card & Container Discipline

**Diizinkan:** widget KPI dashboard stakeholder, item list draggable (assign pekerja), modal konfirmasi approval. **Dilarang:** membungkus paragraf teks/form field dalam card, dan **card di dalam card** (maksimum 1 level). Pemisah utama = hairline `1px solid var(--color-border)`.

## 9. Component Rules & Action Hierarchy

- **Primary:** solid `--color-accent`, teks putih — maksimum 1 per viewport (mis. "Setujui Pengajuan").
- **Secondary:** outline `--color-primary` — aksi pendukung ("Simpan Draf").
- **Tertiary:** teks link `--color-primary` — navigasi ("Lihat Audit Log").
- **States:** hover = `opacity 0.9`; focus = ring 2px `--color-accent` offset 2px; disabled = `opacity 0.4` + `cursor: not-allowed`; selected row = `background: #F3F4F6` + border kiri 3px accent. Semua kontras ≥ 4.5:1.

## 10. Behavioral Responsive Design

| Breakpoint | Behavior |
|:---|:---|
| `< 768px` | Split-pane → stack (list dulu, detail jadi halaman terpisah); tabel monitoring sembunyikan kolom non-kritis (ID, timestamp); nav atas → bottom bar 5 ikon role. |
| `768–1024px` | Split-pane 40/60; tabel tampilkan kolom ID + status + nominal. |
| `≥ 1024px` | Split-pane 320px + fluid; tabel penuh. |

## 11. States (Loading, Empty, Error)

- **Loading:** skeleton baris tabel (5 baris) & skeleton form field — bukan spinner global.
- **Empty:** "Belum ada pengajuan untuk tahun ini." + tombol primer "Buat Pengajuan" (hanya untuk Admin Pengajuan & RAB).
- **Error:** alert inline di atas container dengan pesan spesifik + tombol "Coba lagi"; error validasi di bawah field terkait.

## 12. Accessibility (WCAG 2.1 AA)

Focus ring 2px offset 2px wajib di semua elemen interaktif. Touch target ≥ 44×44px. Status **selalu** disertai teks (mis. `APPROVED`), bukan warna saja. Tabel pakai `<th scope>`. Form pakai `<label for>` eksplisit. Kontras teks muted ≥ 4.5:1.

## 13. Design Rationale

Density tinggi + variance rendah mencerminkan kebutuhan audit lintas tahun (PRD §4, FR-11): pengguna harus melihat banyak record sekaligus dengan pola yang konsisten. Amber tunggal sebagai aksen memisahkan aksi keputusan (approve/issue) dari navigasi, selaras dengan alur satu tingkat persetujuan (DEC-001) dan pemicu SPK/PO yang dapat dikonfigurasi (DEC-004). Form progres pekerja memakai editor inline tanpa membuat history baru (DEC-005) — desain form yang sama untuk create & update, bukan dua tampilan.

## 14. NO Invented Design Content Rule

Dilarang membuat testimoni, logo klien, screenshot palsu, atau statistik fiktif. Semua angka dashboard berasal dari query database nyata; nilai `TBD` (nominal, deadline, SLA) ditampilkan sebagai `—` atau "Belum ditentukan", bukan angka karangan.

## 15. Design Pre-Flight Checklist

- [ ] Design is derived from PRD/project context.
- [ ] Design Read is specific.
- [ ] Design dials are intentional.
- [ ] Visual direction is justified.
- [ ] Color hierarchy is intentional.
- [ ] Typography is intentional.
- [ ] Cards are not overused.
- [ ] Layouts are not repetitive.
- [ ] No generic AI aesthetic was introduced without justification.
- [ ] Motion has a purpose.
- [ ] Responsive behavior is defined.
- [ ] Loading states are defined where relevant.
- [ ] Empty states are defined where relevant.
- [ ] Error states are defined where relevant.
- [ ] Accessibility is defined.
- [ ] No fake content was invented.
- [ ] Design feels specific to the product.
- [ ] A coding agent can implement the design without inventing major visual decisions.
- [ ] Design System is cohesive and reusable.
