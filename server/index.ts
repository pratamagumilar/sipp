import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { getToken } from 'next-auth/jwt';
import { chmod, mkdir, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { Prisma, Status } from '@prisma/client';
import { db } from './db';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
const dir = path.resolve(process.env.UPLOAD_DIR || './private-uploads');
const publicDir = path.resolve('./public');
if (dir === publicDir || dir.startsWith(publicDir + path.sep)) throw new Error('UPLOAD_DIR tidak boleh berada di public');
const upload = multer({ dest: dir, limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1, fieldSize: 64, parts: 2 } });
const money = z.string().regex(/^(?:|(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?)$/);
const fields = z.object({
  title: z.string().trim().max(200), description: z.string().trim().max(10000), estimatedCost: money,
  agenda: z.string().trim().max(200).optional(), applicant: z.string().trim().max(200).optional(),
  installationOwner: z.string().trim().max(200).optional(),
  installationTypeCode: z.enum(['', 'IPTL TM', 'PLTD', 'PLTS', 'PLTMH', 'DISTEM', 'DISTER']).optional(),
  capacity: z.string().regex(/^(?:|(?:0|[1-9]\d{0,17})(?:\.\d{1,6})?)$/).optional(),
  capacityUnit: z.string().trim().max(50).optional(), location: z.string().trim().max(1000).optional(),
  offerValue: money.optional(), version: z.number().int().min(0).optional(),
}).strict();
type Actor = { id: string; role: 'ADMIN_PENGAJUAN' | 'STAKEHOLDER' };
declare global { namespace Express { interface Request { actor: Actor } } }

app.use(async (req, res, next) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method) && req.get('origin') !== process.env.AUTH_URL) return res.status(403).json({ error: 'Origin tidak diizinkan' });
    const secure = process.env.AUTH_URL?.startsWith('https://') || false;
    const token = await getToken({ req: req as never, secret: process.env.AUTH_SECRET!, secureCookie: secure });
    if (!token?.sub) return res.status(401).json({ error: 'Silakan masuk' });
    const user = await db.user.findUnique({ where: { id: token.sub }, select: { id: true, role: true } });
    if (!user) return res.status(401).json({ error: 'Sesi tidak valid' });
    req.actor = user;
    next();
  } catch (error) { next(error); }
});

const accessible = (actor: Actor) => actor.role === 'STAKEHOLDER' ? {} : { ownerId: actor.id };
const details = { attachments: { select: { id: true, filename: true, size: true, createdAt: true } }, audits: { orderBy: { createdAt: 'asc' as const }, include: { actor: { select: { name: true } } } }, owner: { select: { name: true } } };
const rabJob = { id: true, title: true, agenda: true, applicant: true, installationOwner: true, installationTypeCode: true, capacity: true, capacityUnit: true, location: true, offerValue: true, createdAt: true } as const;
const rabInclude = { job: { select: rabJob }, items: { select: { fixCost: true, sppjTransport: true, nidi: true, izinEsdm: true, lhpp: true, pnbp: true, verifikator: true, sewaAlat: true, variabelCost: true, ppn: true, jumlahNilaiPekerjaan: true, biayaOperasional: true, rencanaMargin: true } }, audits: { orderBy: { createdAt: 'asc' as const }, select: { fromStatus: true, toStatus: true, reason: true, createdAt: true, actor: { select: { name: true } } } } };
const amount = money.nullable().transform(value => value || null);
const rabItems = z.object({ fixCost: amount, sppjTransport: amount, nidi: amount, izinEsdm: amount, lhpp: amount, pnbp: amount, verifikator: amount, sewaAlat: amount, variabelCost: amount, ppn: amount, jumlahNilaiPekerjaan: amount, biayaOperasional: amount, rencanaMargin: amount }).strict();
const rabVersion = z.number().int().min(0).max(2147483646);
const emptyRabError = new Error('Minimal satu kolom biaya harus diisi sebelum dikirim');
app.get('/rabs/jobs', async (_req, res) => {
  res.json(await db.job.findMany({ where: { status: 'APPROVED' }, orderBy: { updatedAt: 'desc' }, select: { ...rabJob, rab: { select: { status: true, version: true } } } }));
});
app.get('/jobs/:id/rab', async (req, res) => {
  const rab = await db.rab.findFirst({ where: { jobId: String(req.params.id), job: { status: 'APPROVED' } }, include: rabInclude });
  if (!rab) return res.status(404).json({ error: 'RAB tidak ditemukan' });
  res.json(rab);
});
app.post('/jobs/:id/rab', async (req, res) => {
  if (req.actor.role !== 'ADMIN_PENGAJUAN') return res.sendStatus(403);
  if (!z.object({}).strict().safeParse(req.body).success) return res.status(422).json({ error: 'Data RAB tidak valid' });
  const jobId = String(req.params.id);
  try {
    const rab = await db.$transaction(async tx => {
      const job = await tx.job.findFirst({ where: { id: jobId, status: 'APPROVED' }, select: { id: true } });
      if (!job) return null;
      return tx.rab.create({ data: { jobId, items: { create: {} }, audits: { create: { actorId: req.actor.id, toStatus: 'RAB_DRAFT' } } }, include: rabInclude });
    });
    if (!rab) return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
    res.status(201).json(rab);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: 'RAB sudah ada' });
    throw error;
  }
});
app.put('/jobs/:id/rab', async (req, res) => {
  if (req.actor.role !== 'ADMIN_PENGAJUAN') return res.sendStatus(403);
  const parsed = z.object({ version: rabVersion, items: rabItems, notes: z.string().max(2000) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Data RAB tidak valid' });
  const jobId = String(req.params.id);
  const result = await db.$transaction(async tx => {
    const job = await tx.job.findFirst({ where: { id: jobId, status: 'APPROVED' }, select: { id: true } });
    if (!job) return 'missing' as const;
    const changed = await tx.rab.updateMany({ where: { jobId, status: 'RAB_DRAFT', version: parsed.data.version }, data: { notes: parsed.data.notes, version: { increment: 1 } } });
    if (!changed.count) return 'conflict' as const;
    const rab = await tx.rab.findUniqueOrThrow({ where: { jobId }, select: { id: true } });
    await tx.rabItem.update({ where: { rabId: rab.id }, data: parsed.data.items });
    return tx.rab.findUniqueOrThrow({ where: { jobId }, include: rabInclude });
  });
  if (result === 'missing') return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
  if (result === 'conflict') return res.status(409).json({ error: 'Status atau versi berubah. Muat ulang.' });
  res.json(result);
});
app.post('/jobs/:id/rab/transitions', async (req, res) => {
  const parsed = z.object({ action: z.enum(['submit', 'approve', 'revise']), version: rabVersion, reason: z.string().trim().max(2000).optional() }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Data transisi tidak valid' });
  const { action, version, reason } = parsed.data;
  if (action === 'revise' && (!reason || reason.length < 10)) return res.status(422).json({ error: 'Alasan revisi minimal 10 karakter' });
  if (req.actor.role !== (action === 'submit' ? 'ADMIN_PENGAJUAN' : 'STAKEHOLDER')) return res.sendStatus(403);
  const from = action === 'submit' ? 'RAB_DRAFT' : 'RAB_REVIEW';
  const to = action === 'submit' ? 'RAB_REVIEW' : action === 'approve' ? 'RAB_APPROVED' : 'RAB_DRAFT';
  const jobId = String(req.params.id);
  const result = await db.$transaction(async tx => {
    const job = await tx.job.findFirst({ where: { id: jobId, status: 'APPROVED' }, select: { id: true } });
    if (!job) return 'missing' as const;
    const changed = await tx.rab.updateMany({ where: { jobId, status: from, version }, data: { status: to, version: { increment: 1 } } });
    if (!changed.count) return 'conflict' as const;
    const rab = await tx.rab.findUniqueOrThrow({ where: { jobId }, select: { id: true, items: { select: rabInclude.items.select } } });
    if (action === 'submit' && (!rab.items || Object.values(rab.items).every(value => value === null))) throw emptyRabError;
    await tx.rabAudit.create({ data: { rabId: rab.id, actorId: req.actor.id, fromStatus: from, toStatus: to, reason: action === 'revise' ? reason : null } });
    return tx.rab.findUniqueOrThrow({ where: { jobId }, include: rabInclude });
  }).catch(error => { if (error === emptyRabError) return 'required' as const; throw error; });
  if (result === 'missing') return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
  if (result === 'conflict') return res.status(409).json({ error: 'Status atau versi berubah. Muat ulang.' });
  if (result === 'required') return res.status(422).json({ error: emptyRabError.message });
  res.json(result);
});
app.get('/installation-types', async (_req, res) => { res.json(await db.installationType.findMany({ orderBy: { code: 'asc' } })); });
app.get('/jobs', async (req, res) => { res.json(await db.job.findMany({ where: accessible(req.actor), orderBy: { updatedAt: 'desc' }, include: { owner: { select: { name: true } } } })); });
app.get('/jobs/:id', async (req, res) => {
  const job = await db.job.findFirst({ where: { id: req.params.id, ...accessible(req.actor) }, include: details });
  if (!job) return res.status(404).json({ error: 'Pengajuan tidak ditemukan' });
  res.json(job);
});
app.post('/jobs', async (req, res) => {
  if (req.actor.role !== 'ADMIN_PENGAJUAN') return res.sendStatus(403);
  const parsed = fields.safeParse(req.body); if (!parsed.success) return res.status(422).json({ error: 'Periksa judul, deskripsi, dan estimasi (maksimum 16 digit dan 2 desimal).' });
  const { version: _version, ...input } = parsed.data;
  const data = { ...input, estimatedCost: input.estimatedCost || null, installationTypeCode: input.installationTypeCode === undefined ? undefined : input.installationTypeCode || null, capacity: input.capacity === undefined ? undefined : input.capacity || null, offerValue: input.offerValue === undefined ? undefined : input.offerValue || null };
  const job = await db.$transaction(async tx => {
    const created = await tx.job.create({ data: { ...data, ownerId: req.actor.id } });
    await tx.auditLog.create({ data: { jobId: created.id, actorId: req.actor.id, toStatus: 'DRAFT' } });
    return created;
  });
  res.status(201).json(job);
});
app.put('/jobs/:id', async (req, res) => {
  if (req.actor.role !== 'ADMIN_PENGAJUAN') return res.sendStatus(403);
  const parsed = fields.safeParse(req.body); if (!parsed.success || parsed.data.version === undefined) return res.status(422).json({ error: 'Data pengajuan tidak valid' });
  const { version, ...input } = parsed.data;
  const result = await db.$transaction(async tx => {
    const updated = await tx.job.updateMany({ where: { id: req.params.id, ownerId: req.actor.id, status: 'DRAFT', version }, data: { ...input, estimatedCost: input.estimatedCost || null, installationTypeCode: input.installationTypeCode === undefined ? undefined : input.installationTypeCode || null, capacity: input.capacity === undefined ? undefined : input.capacity || null, offerValue: input.offerValue === undefined ? undefined : input.offerValue || null, version: { increment: 1 } } });
    return updated.count ? tx.job.findUnique({ where: { id: String(req.params.id) } }) : null;
  });
  if (!result) return res.status(409).json({ error: 'Status atau versi berubah. Muat ulang.' });
  res.json(result);
});
app.post('/jobs/:id/transitions', async (req, res) => {
  const parsed = z.object({ action: z.enum(['submit', 'approve', 'reject', 'revise']), version: z.number().int().min(0), reason: z.string().trim().max(2000).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Data transisi tidak valid' });
  const { action, version, reason } = parsed.data;
  if (action === 'reject' && (!reason || reason.length < 10)) return res.status(422).json({ error: 'Alasan penolakan minimal 10 karakter' });
  const stakeholder = action === 'approve' || action === 'reject';
  if (req.actor.role !== (stakeholder ? 'STAKEHOLDER' : 'ADMIN_PENGAJUAN')) return res.sendStatus(403);
  const from: Status = action === 'submit' ? 'DRAFT' : action === 'revise' ? 'REJECTED' : 'SUBMITTED';
  const to: Status = action === 'submit' ? 'SUBMITTED' : action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'DRAFT';
  const result = await db.$transaction(async tx => {
    const job = await tx.job.findFirst({ where: { id: req.params.id, ...accessible(req.actor) } });
    if (!job || job.status !== from || job.version !== version) return 'conflict';
    if (action === 'submit' && (!job.title.trim() || !job.description.trim() || !job.estimatedCost || job.estimatedCost.lte(0))) return 'required';
    const changed = await tx.job.updateMany({ where: { id: job.id, status: from, version }, data: { status: to, version: { increment: 1 }, rejectionReason: action === 'reject' ? reason : action === 'submit' ? null : undefined } });
    if (!changed.count) return 'conflict';
    await tx.auditLog.create({ data: { jobId: job.id, actorId: req.actor.id, fromStatus: from, toStatus: to, reason: action === 'reject' ? reason : null } });
    return 'ok';
  });
  if (result !== 'ok') return res.status(result === 'required' ? 422 : 409).json({ error: result === 'required' ? 'Judul, deskripsi, dan estimasi lebih dari 0 wajib diisi saat submit' : 'Status atau versi berubah. Muat ulang.' });
  res.json({ ok: true });
});
app.post('/jobs/:id/attachments', async (req, res, next) => {
  if (req.actor.role !== 'ADMIN_PENGAJUAN') return res.sendStatus(403);
  const job = await db.job.findFirst({ where: { id: String(req.params.id), ownerId: req.actor.id, status: 'DRAFT' }, select: { id: true } });
  if (!job) return res.status(409).json({ error: 'Status atau versi berubah. Muat ulang.' });
  next();
}, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(422).json({ error: 'Pilih lampiran' });
  let cleanup = true;
  try {
    if (req.actor.role !== 'ADMIN_PENGAJUAN') return res.sendStatus(403);
    const versionText = req.body.version;
    const version = Number(versionText);
    const jobId = String(req.params.id);
    if (typeof versionText !== 'string' || !/^(0|[1-9]\d*)$/.test(versionText) || !Number.isSafeInteger(version) || version > 2147483647) return res.status(422).json({ error: 'Versi tidak valid' });
    // ponytail: preserve possible orphans on ambiguous commit; add reconciliation when storage operations are managed.
    cleanup = false;
    const attachment = await db.$transaction(async tx => {
      const updated = await tx.job.updateMany({ where: { id: jobId, ownerId: req.actor.id, status: 'DRAFT', version }, data: { version: { increment: 1 } } });
      if (!updated.count) return null;
      return tx.attachment.create({ data: { jobId, filename: path.basename(file.originalname).slice(0, 255), storageId: file.filename, mimeType: 'application/octet-stream', size: file.size } });
    });
    if (!attachment) { cleanup = true; return res.status(409).json({ error: 'Status atau versi berubah. Muat ulang.' }); }
    res.status(201).json({ id: attachment.id });
  } finally { if (cleanup) await unlink(file.path).catch(() => {}); }
});
app.get('/attachments/:id', async (req, res) => {
  const attachment = await db.attachment.findFirst({ where: { id: req.params.id, job: accessible(req.actor) } });
  if (!attachment) return res.sendStatus(404);
  res.set({ 'Content-Type': 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
  res.download(path.join(dir, attachment.storageId), attachment.filename);
});
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err instanceof multer.MulterError) return res.status(422).json({ error: 'Lampiran gagal diunggah (maksimal 10 MB)' });
  if (err instanceof Prisma.PrismaClientKnownRequestError) return res.status(500).json({ error: 'Terjadi kesalahan database' });
  res.status(500).json({ error: 'Terjadi kesalahan server' });
});
if (!process.env.AUTH_SECRET || !process.env.AUTH_URL) throw new Error('AUTH_SECRET dan AUTH_URL wajib diatur');
await mkdir(dir, { recursive: true, mode: 0o700 });
const realDir = await realpath(dir);
const realPublicDir = await realpath(publicDir).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return publicDir; throw error; });
if (realDir === realPublicDir || realDir.startsWith(realPublicDir + path.sep)) throw new Error('UPLOAD_DIR tidak boleh berada di public');
await chmod(realDir, 0o700);
app.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log('API mendengarkan pada localhost'));
