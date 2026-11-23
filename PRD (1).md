# PRD: KerjaNyata

## 1. Executive Summary & Product Vision
KerjaNyata adalah sistem manajemen pekerjaan & dokumentasi proyek berbasis web yang menjadi **single source of truth** untuk siklus hidup pekerjaan: pengajuan → persetujuan → RAB → SPK/PO → penugasan pekerja → invoice → pelaporan progres → arsip terdokumentasi. Visi: menggantikan spreadsheet ad-hoc dengan database konkret lintas tahun yang dapat diaudit, dimonitor, dan dilaporkan oleh stakeholder.

## 2. Problem Statement & Target Users
- **Masalah:** Data pekerjaan tersebar di spreadsheet tanpa kontrol akses, tanpa jejak audit, sulit dilacak lintas tahun, dan tidak ada mekanisme progres terpusat.
- **Target Users:** Admin Pengajuan & RAB, Stakeholder, Pekerja, Admin Finance.

## 3. System Scope & User Roles
| Role | Pengajuan | RAB | SPK/PO | Assign & Invoice | Update Progres | Monitoring | Pengaturan |
|:---|:---|:---|:---|:---|:---|:---|:---|
| Admin Pengajuan & RAB | Create/Edit sendiri; akses sebelum `APPROVED` hanya milik sendiri | Create/Edit untuk semua pengajuan `APPROVED` | Read | Read | Read | Read | Configure trigger |
| Stakeholder | Approve/Reject | Review/Approve | ACK | Read | Read | Full | Read |
| Pekerja | Read own | Read own | Read own | — | Update own | Read own | — |
| Admin Finance | Read | Read | Issue | Assign & Invoice | Read | Read | — |

Matriks ini adalah target hak akses, bukan klaim implementasi. Admin Pengajuan & RAB dapat menyusun RAB untuk pengajuan `APPROVED` yang dibuat admin lain; sebelum `APPROVED`, akses pengajuan bagi admin gabungan tetap terbatas pada miliknya sendiri. Admin Finance tidak menyusun RAB. Identitas role database yang ada tetap `ADMIN_PENGAJUAN`; perluasan akses backend dan backend RAB fase 2 belum disetujui atau diterapkan.

## 4. Functional Requirements

### User-Facing
- **FR-01** (DEC-001): Admin Pengajuan & RAB membuat pengajuan pekerjaan (judul, deskripsi, estimasi biaya, lampiran S3). Status: `DRAFT → SUBMITTED`.
- **FR-02** (DEC-001): Stakeholder menyetujui/menolak pengajuan satu tingkat; penolakan wajib alasan. Status: `SUBMITTED → APPROVED | REJECTED`.
- **FR-03** (DEC-002): Admin Pengajuan & RAB membuat draf RAB untuk semua pengajuan `APPROVED`, termasuk buatan admin lain; Stakeholder me-review dan menyetujui (`RAB_DRAFT → RAB_REVIEW → RAB_APPROVED`).
- **FR-04** (DEC-003/004): Mode SPK/PO ditentukan dari pengaturan saat RAB disetujui: `AFTER_RAB_APPROVED` menyiapkan SPK/PO otomatis untuk dilengkapi Finance, sedangkan `MANUAL_FINANCE` diproses Finance. Finance mengisi nomor dan nominal sebelum penerbitan. RAB lama masuk antrean manual; jika persiapan otomatis gagal, RAB tetap disetujui dan Finance dapat memulihkannya.
- **FR-05**: Admin Finance meng-assign pekerja ke SPK/PO dan menerbitkan invoice terkait.
- **FR-06** (DEC-005): Pekerja meng-update progres (persentase 0–100 + field `notes`). Submit tidak mengunci; edit berikutnya meng-update record yang sama (bukan history baru).
- **FR-07**: Stakeholder meng-ACK penerbitan SPK/PO.
- **FR-08**: Stakeholder melihat dashboard monitoring: ringkasan status pengajuan, RAB, SPK/PO, invoice, dan progres pekerja.

### Admin-Facing
- **FR-09**: Admin Pengajuan & RAB mengelola pengaturan pemicu SPK/PO (DEC-004) tanpa deploy ulang; penerbitan manual tetap oleh Admin Finance.
- **FR-10**: Admin mengelola user & role (4 role).
- **FR-11**: Semua transisi status tercatat di audit log (actor, timestamp, dari→ke).

## 5. Non-Functional Requirements
| Aspek | Target |
|:---|:---|
| Latensi API (p95) | < 500 ms |
| Dashboard load | < 2 s (LCP) |
| Ketersediaan | 99.5% bulanan |
| Keamanan | RBAC per role, password hash (bcrypt), HTTPS, audit log immutable, file privat S3 (signed URL) |
| Skalabilitas | 10k pekerjaan/tahun, 500 user aktif |
| Retensi data | Lintas tahun, arsip read-only setelah proyek selesai |

## 6. Technology Stack & Rationale
| Component | Technology | Why |
|:---|:---|:---|
| Frontend | Next.js 15+ (App Router), React 19 | SSR dashboard, routing role-based |
| Backend | Node.js 22 LTS + Express 5 | API terpisah untuk mobile/integrasi |
| Database | PostgreSQL 16 + Prisma v6 | Relasi transaksional + type-safety |
| Auth | NextAuth.js v5 | Session + RBAC 4 role |
| Hosting | Vercel | Deploy cepat, edge caching |
| Storage | AWS S3 | Lampiran & dokumen privat |
| Styling | Tailwind v4 + shadcn/ui | UI cepat & konsisten |

## 7. Success Metrics & KPIs
| Metrik | Target |
|:---|:---|
| Pengajuan tercatat di sistem | 100% (vs spreadsheet) |
| Waktu approval pengajuan | < 2 hari kerja |
| Progres pekerja ter-update | ≥ 90% pekerjaan aktif |
| Kelengkapan arsip tahunan | 100% proyek tertutup terdokumentasi |
| Adopsi stakeholder dashboard | ≥ 80% stakeholder aktif/minggu |

## 8. Risk Analysis & Mitigation
| Risk | Impact | Mitigation |
|:---|:---|:---|
| Migrasi data spreadsheet tidak konsisten | Tinggi | Validasi & mapping sebelum import; staging review |
| Perubahan alur SPK/PO | Sedang | Pemicu dikonfigurasi (DEC-004), terisolasi |
| Pekerja lupa update progres | Sedang | Reminder + dashboard gap monitoring |
| Kebocoran dokumen S3 | Tinggi | Signed URL, bucket privat, ACL role |
| Konflik edit progres | Rendah | Update record sama + timestamp (DEC-005) |

## 9. Constraints & Assumptions
- Free tier: maksimum 5 tabel inti, 5 endpoint esensial.
- Nilai nominal, deadline, dan SLA approval = `TBD` (belum ditentukan).
- Spreadsheet existing menjadi acuan migrasi (struktur final `TBD`).
- Satu tingkat approval (DEC-001); tidak ada multi-level.

## 10. Out of Scope
- Approval berjenjang / multi-signer.
- Mobile native app.
- Integrasi akuntansi/ERP eksternal.
- Multi-tenant / multi-organisasi.
- Notifikasi push real-time (v1 hanya email/in-app `TBD`).
- Manajemen kontrak vendor pihak ketiga.
