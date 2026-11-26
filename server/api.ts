import path from 'node:path';
import { getToken } from 'next-auth/jwt';
import { z } from 'zod';
import { Prisma, Status } from '@prisma/client';
import { db } from './db';
import { handleAssignmentApi } from './assignment-api';
import { deleteObject, getObject, putObject } from './storage';

const maxUpload = 10 * 1024 * 1024;
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
export type Actor = { id: string; role: 'ADMIN_PENGAJUAN' | 'STAKEHOLDER' | 'FINANCE' | 'PEKERJA' };
type Ctx = { actor: Actor; params: Record<string, string>; request: Request };
type Route = { method: string; path: string; run: (ctx: Ctx) => Promise<Response> };

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const fail = (message: string, status: number) => json({ error: message }, status);
const forbid = () => new Response(null, { status: 403 });
const workerJobs = (actor: Actor): Prisma.JobWhereInput => actor.role === 'PEKERJA' ? { rab: { spk: { assignment: { members: { some: { userId: actor.id } } } } } } : {};
const accessible = (actor: Actor): Prisma.JobWhereInput => actor.role === 'PEKERJA' ? workerJobs(actor) : actor.role === 'STAKEHOLDER' ? {} : { ownerId: actor.id };
export const listJobs = (actor: Actor) => db.job.findMany({ where: accessible(actor), orderBy: { updatedAt: 'desc' as const }, include: { owner: { select: { name: true } } } });
export const listInstallationTypes = () => db.installationType.findMany({ orderBy: { code: 'asc' as const } });
const details = { attachments: { select: { id: true, filename: true, size: true, createdAt: true } }, audits: { orderBy: { createdAt: 'asc' as const }, include: { actor: { select: { name: true } } } }, owner: { select: { name: true } } };
const rabJob = { id: true, title: true, agenda: true, applicant: true, installationOwner: true, installationTypeCode: true, capacity: true, capacityUnit: true, location: true, offerValue: true, createdAt: true } as const;
const rabInclude = { job: { select: rabJob }, items: { select: { fixCost: true, sppjTransport: true, nidi: true, izinEsdm: true, lhpp: true, pnbp: true, verifikator: true, sewaAlat: true, variabelCost: true, ppn: true, jumlahNilaiPekerjaan: true, biayaOperasional: true, rencanaMargin: true } }, audits: { orderBy: { createdAt: 'asc' as const }, select: { fromStatus: true, toStatus: true, reason: true, createdAt: true, actor: { select: { name: true } } } } };
const amount = money.nullable().transform(value => value || null);
const rabItems = z.object({ fixCost: amount, sppjTransport: amount, nidi: amount, izinEsdm: amount, lhpp: amount, pnbp: amount, verifikator: amount, sewaAlat: amount, variabelCost: amount, ppn: amount, jumlahNilaiPekerjaan: amount, biayaOperasional: amount, rencanaMargin: amount }).strict();
const rabVersion = z.number().int().min(0).max(2147483646);
const emptyRabError = new Error('Minimal satu kolom biaya harus diisi sebelum dikirim');
const spkInclude = { job: { select: rabJob }, spk: { include: { audits: { orderBy: { createdAt: 'asc' as const }, select: { event: true, createdAt: true, actor: { select: { name: true } } } }, acknowledgedBy: { select: { name: true } } } } };
const spkView = (rab: Prisma.RabGetPayload<{ include: typeof spkInclude }>) => ({ job: rab.job, trigger: rab.spkTrigger, preparationStatus: rab.spk?.status ?? 'UNPREPARED', spk: rab.spk });

async function body(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

async function prepareSpk(jobId: string, actorId: string, event: string) {
  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT r."id" FROM "Rab" r JOIN "Job" j ON j."id" = r."jobId" WHERE r."jobId" = ${jobId} AND r."status" = 'RAB_APPROVED' AND j."status" = 'APPROVED' FOR UPDATE OF r`;
    if (!rows.length) return null;
    const existing = await tx.spk.findUnique({ where: { rabId: rows[0].id } });
    if (!existing) await tx.spk.create({ data: { rabId: rows[0].id, audits: { create: { actorId, event } } } });
    return spkView(await tx.rab.findUniqueOrThrow({ where: { id: rows[0].id }, include: spkInclude }));
  });
}

const routes: Route[] = [
  { method: 'GET', path: 'settings/spk-trigger', run: async () => {
    const setting = await db.setting.findUniqueOrThrow({ where: { id: 'spk' } });
    return json({ trigger: setting.spkTrigger, version: setting.version });
  } },
  { method: 'PUT', path: 'settings/spk-trigger', run: async ctx => {
    if (ctx.actor.role !== 'ADMIN_PENGAJUAN') return forbid();
    const parsed = z.object({ trigger: z.enum(['AFTER_RAB_APPROVED', 'MANUAL_FINANCE']), version: rabVersion }).strict().safeParse(await body(ctx.request));
    if (!parsed.success) return fail('Pemicu tidak valid', 422);
    const setting = await db.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ spkTrigger: 'AFTER_RAB_APPROVED' | 'MANUAL_FINANCE'; version: number }[]>`SELECT "spkTrigger", "version" FROM "Setting" WHERE "id" = 'spk' FOR UPDATE`;
      if (!rows.length) throw new Error('Pengaturan SPK tidak ditemukan');
      if (rows[0].version !== parsed.data.version) return null;
      if (rows[0].spkTrigger === parsed.data.trigger) return rows[0];
      const updated = await tx.setting.update({ where: { id: 'spk' }, data: { spkTrigger: parsed.data.trigger, version: { increment: 1 } } });
      await tx.settingAudit.create({ data: { settingId: 'spk', actorId: ctx.actor.id, fromTrigger: rows[0].spkTrigger, toTrigger: updated.spkTrigger } });
      return updated;
    });
    if (!setting) return fail('Pengaturan berubah. Muat ulang.', 409);
    return json({ trigger: setting.spkTrigger, version: setting.version });
  } },
  { method: 'GET', path: 'spks', run: async ctx => {
    const rabs = await db.rab.findMany({ where: { status: 'RAB_APPROVED', job: { status: 'APPROVED', ...workerJobs(ctx.actor) } }, orderBy: { updatedAt: 'desc' }, include: spkInclude });
    return json(rabs.map(spkView));
  } },
  { method: 'GET', path: 'jobs/:id/spk', run: async ctx => {
    const rab = await db.rab.findFirst({ where: { jobId: ctx.params.id, status: 'RAB_APPROVED', job: { status: 'APPROVED', ...workerJobs(ctx.actor) } }, include: spkInclude });
    if (!rab) return fail('SPK tidak ditemukan', 404);
    return json(spkView(rab));
  } },
  { method: 'POST', path: 'jobs/:id/spk/prepare', run: async ctx => {
    if (ctx.actor.role !== 'FINANCE') return forbid();
    if (!z.object({}).strict().safeParse(await body(ctx.request)).success) return fail('Data tidak valid', 422);
    const result = await prepareSpk(ctx.params.id, ctx.actor.id, 'MANUAL_PREPARED');
    if (!result) return fail('RAB disetujui tidak ditemukan', 404);
    return json(result);
  } },
  { method: 'POST', path: 'jobs/:id/spk/issue', run: async ctx => {
    if (ctx.actor.role !== 'FINANCE') return forbid();
    const parsed = z.object({ number: z.string().trim().min(1).max(200), amount: money.refine(value => value !== '') }).strict().safeParse(await body(ctx.request));
    if (!parsed.success) return fail('Nomor atau nominal tidak valid', 422);
    try {
      const result = await db.$transaction(async tx => {
        const rows = await tx.$queryRaw<{ id: string }[]>`SELECT r."id" FROM "Rab" r JOIN "Job" j ON j."id" = r."jobId" WHERE r."jobId" = ${ctx.params.id} AND r."status" = 'RAB_APPROVED' AND j."status" = 'APPROVED' FOR UPDATE OF r`;
        if (!rows.length) return 'missing' as const;
        const spk = await tx.spk.findUnique({ where: { rabId: rows[0].id } });
        if (!spk) return 'unprepared' as const;
        if (spk.status === 'ISSUED') {
          if (spk.number !== parsed.data.number || !spk.amount?.equals(parsed.data.amount)) return 'conflict' as const;
        } else {
          await tx.spk.update({ where: { id: spk.id }, data: { status: 'ISSUED', number: parsed.data.number, amount: parsed.data.amount, audits: { create: { actorId: ctx.actor.id, event: 'ISSUED' } } } });
        }
        return spkView(await tx.rab.findUniqueOrThrow({ where: { id: rows[0].id }, include: spkInclude }));
      });
      if (result === 'missing') return fail('RAB disetujui tidak ditemukan', 404);
      if (result === 'unprepared' || result === 'conflict') return fail('SPK belum disiapkan atau sudah diterbitkan dengan data berbeda', 409);
      return json(result);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return fail('Nomor SPK sudah digunakan', 409);
      throw error;
    }
  } },
  { method: 'POST', path: 'jobs/:id/spk/ack', run: async ctx => {
    if (ctx.actor.role !== 'STAKEHOLDER') return forbid();
    if (!z.object({}).strict().safeParse(await body(ctx.request)).success) return fail('Data tidak valid', 422);
    const result = await db.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT r."id" FROM "Rab" r JOIN "Job" j ON j."id" = r."jobId" WHERE r."jobId" = ${ctx.params.id} AND r."status" = 'RAB_APPROVED' AND j."status" = 'APPROVED' FOR UPDATE OF r`;
      if (!rows.length) return 'missing' as const;
      const spk = await tx.spk.findUnique({ where: { rabId: rows[0].id } });
      if (!spk || spk.status !== 'ISSUED') return 'conflict' as const;
      if (!spk.acknowledgedAt) await tx.spk.update({ where: { id: spk.id }, data: { acknowledgedAt: new Date(), acknowledgedById: ctx.actor.id, audits: { create: { actorId: ctx.actor.id, event: 'ACKNOWLEDGED' } } } });
      return spkView(await tx.rab.findUniqueOrThrow({ where: { id: rows[0].id }, include: spkInclude }));
    });
    if (result === 'missing') return fail('RAB disetujui tidak ditemukan', 404);
    if (result === 'conflict') return fail('SPK belum diterbitkan', 409);
    return json(result);
  } },
  { method: 'GET', path: 'rabs/jobs', run: async ctx => {
    return json(await db.job.findMany({ where: { status: 'APPROVED', ...workerJobs(ctx.actor) }, orderBy: { updatedAt: 'desc' }, select: { ...rabJob, rab: { select: { status: true, version: true } } } }));
  } },
  { method: 'GET', path: 'jobs/:id/rab', run: async ctx => {
    const rab = await db.rab.findFirst({ where: { jobId: ctx.params.id, job: { status: 'APPROVED', ...workerJobs(ctx.actor) } }, include: rabInclude });
    if (!rab) return fail('RAB tidak ditemukan', 404);
    return json(rab);
  } },
  { method: 'POST', path: 'jobs/:id/rab', run: async ctx => {
    if (ctx.actor.role !== 'ADMIN_PENGAJUAN') return forbid();
    if (!z.object({}).strict().safeParse(await body(ctx.request)).success) return fail('Data RAB tidak valid', 422);
    const jobId = ctx.params.id;
    try {
      const rab = await db.$transaction(async tx => {
        const job = await tx.job.findFirst({ where: { id: jobId, status: 'APPROVED' }, select: { id: true } });
        if (!job) return null;
        return tx.rab.create({ data: { jobId, items: { create: {} }, audits: { create: { actorId: ctx.actor.id, toStatus: 'RAB_DRAFT' } } }, include: rabInclude });
      });
      if (!rab) return fail('Pengajuan tidak ditemukan', 404);
      return json(rab, 201);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return fail('RAB sudah ada', 409);
      throw error;
    }
  } },
  { method: 'PUT', path: 'jobs/:id/rab', run: async ctx => {
    if (ctx.actor.role !== 'ADMIN_PENGAJUAN') return forbid();
    const parsed = z.object({ version: rabVersion, items: rabItems, notes: z.string().max(2000) }).strict().safeParse(await body(ctx.request));
    if (!parsed.success) return fail('Data RAB tidak valid', 422);
    const jobId = ctx.params.id;
    const result = await db.$transaction(async tx => {
      const job = await tx.job.findFirst({ where: { id: jobId, status: 'APPROVED' }, select: { id: true } });
      if (!job) return 'missing' as const;
      const changed = await tx.rab.updateMany({ where: { jobId, status: 'RAB_DRAFT', version: parsed.data.version }, data: { notes: parsed.data.notes, version: { increment: 1 } } });
      if (!changed.count) return 'conflict' as const;
      const rab = await tx.rab.findUniqueOrThrow({ where: { jobId }, select: { id: true } });
      await tx.rabItem.update({ where: { rabId: rab.id }, data: parsed.data.items });
      return tx.rab.findUniqueOrThrow({ where: { jobId }, include: rabInclude });
    });
    if (result === 'missing') return fail('Pengajuan tidak ditemukan', 404);
    if (result === 'conflict') return fail('Status atau versi berubah. Muat ulang.', 409);
    return json(result);
  } },
  { method: 'POST', path: 'jobs/:id/rab/transitions', run: async ctx => {
    const parsed = z.object({ action: z.enum(['submit', 'approve', 'revise']), version: rabVersion, reason: z.string().trim().max(2000).optional() }).strict().safeParse(await body(ctx.request));
    if (!parsed.success) return fail('Data transisi tidak valid', 422);
    const { action, version, reason } = parsed.data;
    if (action === 'revise' && (!reason || reason.length < 10)) return fail('Alasan revisi minimal 10 karakter', 422);
    if (ctx.actor.role !== (action === 'submit' ? 'ADMIN_PENGAJUAN' : 'STAKEHOLDER')) return forbid();
    const from = action === 'submit' ? 'RAB_DRAFT' : 'RAB_REVIEW';
    const to = action === 'submit' ? 'RAB_REVIEW' : action === 'approve' ? 'RAB_APPROVED' : 'RAB_DRAFT';
    const jobId = ctx.params.id;
    const result = await db.$transaction(async tx => {
      const job = await tx.job.findFirst({ where: { id: jobId, status: 'APPROVED' }, select: { id: true } });
      if (!job) return 'missing' as const;
      const settings = action === 'approve' ? await tx.$queryRaw<{ spkTrigger: 'AFTER_RAB_APPROVED' | 'MANUAL_FINANCE' }[]>`SELECT "spkTrigger" FROM "Setting" WHERE "id" = 'spk' FOR SHARE` : [];
      if (action === 'approve' && !settings.length) throw new Error('Pengaturan SPK tidak ditemukan');
      const changed = await tx.rab.updateMany({ where: { jobId, status: from, version }, data: { status: to, version: { increment: 1 }, ...(action === 'approve' ? { spkTrigger: settings[0].spkTrigger } : {}) } });
      if (!changed.count) return 'conflict' as const;
      const rab = await tx.rab.findUniqueOrThrow({ where: { jobId }, select: { id: true, items: { select: rabInclude.items.select } } });
      if (action === 'submit' && (!rab.items || Object.values(rab.items).every(value => value === null))) throw emptyRabError;
      await tx.rabAudit.create({ data: { rabId: rab.id, actorId: ctx.actor.id, fromStatus: from, toStatus: to, reason: action === 'revise' ? reason : null } });
      return tx.rab.findUniqueOrThrow({ where: { jobId }, include: rabInclude });
    }).catch(error => { if (error === emptyRabError) return 'required' as const; throw error; });
    if (result === 'missing') return fail('Pengajuan tidak ditemukan', 404);
    if (result === 'conflict') return fail('Status atau versi berubah. Muat ulang.', 409);
    if (result === 'required') return fail(emptyRabError.message, 422);
    if (action === 'approve' && result.spkTrigger === 'AFTER_RAB_APPROVED') {
      try { await prepareSpk(jobId, ctx.actor.id, 'AUTO_PREPARED'); }
      catch (error) { console.error('Persiapan otomatis SPK gagal; Finance dapat memulihkan', error); }
    }
    return json(result);
  } },
  { method: 'GET', path: 'installation-types', run: async () => json(await listInstallationTypes()) },
  { method: 'GET', path: 'jobs', run: async ctx => json(await listJobs(ctx.actor)) },
  { method: 'GET', path: 'jobs/:id', run: async ctx => {
    const job = await db.job.findFirst({ where: { id: ctx.params.id, ...accessible(ctx.actor) }, include: details });
    if (!job) return fail('Pengajuan tidak ditemukan', 404);
    return json(job);
  } },
  { method: 'POST', path: 'jobs', run: async ctx => {
    if (ctx.actor.role !== 'ADMIN_PENGAJUAN') return forbid();
    const parsed = fields.safeParse(await body(ctx.request));
    if (!parsed.success) return fail('Periksa judul, deskripsi, dan estimasi (maksimum 16 digit dan 2 desimal).', 422);
    const { version: _version, ...input } = parsed.data;
    const data = { ...input, estimatedCost: input.estimatedCost || null, installationTypeCode: input.installationTypeCode === undefined ? undefined : input.installationTypeCode || null, capacity: input.capacity === undefined ? undefined : input.capacity || null, offerValue: input.offerValue === undefined ? undefined : input.offerValue || null };
    const job = await db.$transaction(async tx => {
      const created = await tx.job.create({ data: { ...data, ownerId: ctx.actor.id } });
      await tx.auditLog.create({ data: { jobId: created.id, actorId: ctx.actor.id, toStatus: 'DRAFT' } });
      return created;
    });
    return json(job, 201);
  } },
  { method: 'PUT', path: 'jobs/:id', run: async ctx => {
    if (ctx.actor.role !== 'ADMIN_PENGAJUAN') return forbid();
    const parsed = fields.safeParse(await body(ctx.request));
    if (!parsed.success || parsed.data.version === undefined) return fail('Data pengajuan tidak valid', 422);
    const { version, ...input } = parsed.data;
    const result = await db.$transaction(async tx => {
      const updated = await tx.job.updateMany({ where: { id: ctx.params.id, ownerId: ctx.actor.id, status: 'DRAFT', version }, data: { ...input, estimatedCost: input.estimatedCost || null, installationTypeCode: input.installationTypeCode === undefined ? undefined : input.installationTypeCode || null, capacity: input.capacity === undefined ? undefined : input.capacity || null, offerValue: input.offerValue === undefined ? undefined : input.offerValue || null, version: { increment: 1 } } });
      return updated.count ? tx.job.findUnique({ where: { id: ctx.params.id } }) : null;
    });
    if (!result) return fail('Status atau versi berubah. Muat ulang.', 409);
    return json(result);
  } },
  { method: 'POST', path: 'jobs/:id/transitions', run: async ctx => {
    const parsed = z.object({ action: z.enum(['submit', 'approve', 'reject', 'revise']), version: z.number().int().min(0), reason: z.string().trim().max(2000).optional() }).safeParse(await body(ctx.request));
    if (!parsed.success) return fail('Data transisi tidak valid', 422);
    const { action, version, reason } = parsed.data;
    if (action === 'reject' && (!reason || reason.length < 10)) return fail('Alasan penolakan minimal 10 karakter', 422);
    const stakeholder = action === 'approve' || action === 'reject';
    if (ctx.actor.role !== (stakeholder ? 'STAKEHOLDER' : 'ADMIN_PENGAJUAN')) return forbid();
    const from: Status = action === 'submit' ? 'DRAFT' : action === 'revise' ? 'REJECTED' : 'SUBMITTED';
    const to: Status = action === 'submit' ? 'SUBMITTED' : action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'DRAFT';
    const result = await db.$transaction(async tx => {
      const job = await tx.job.findFirst({ where: { id: ctx.params.id, ...accessible(ctx.actor) } });
      if (!job || job.status !== from || job.version !== version) return 'conflict';
      if (action === 'submit' && (!job.title.trim() || !job.description.trim() || !job.estimatedCost || job.estimatedCost.lte(0))) return 'required';
      const changed = await tx.job.updateMany({ where: { id: job.id, status: from, version }, data: { status: to, version: { increment: 1 }, rejectionReason: action === 'reject' ? reason : action === 'submit' ? null : undefined } });
      if (!changed.count) return 'conflict';
      await tx.auditLog.create({ data: { jobId: job.id, actorId: ctx.actor.id, fromStatus: from, toStatus: to, reason: action === 'reject' ? reason : null } });
      return 'ok';
    });
    if (result !== 'ok') return fail(result === 'required' ? 'Judul, deskripsi, dan estimasi lebih dari 0 wajib diisi saat submit' : 'Status atau versi berubah. Muat ulang.', result === 'required' ? 422 : 409);
    return json({ ok: true });
  } },
  { method: 'POST', path: 'jobs/:id/attachments', run: async ctx => {
    if (ctx.actor.role !== 'ADMIN_PENGAJUAN') return forbid();
    // ponytail: Vercel has no persistent local storage; enable uploads after configuring durable storage.
    if (process.env.VERCEL) return fail('Unggah lampiran belum tersedia pada deployment ini', 503);
    const job = await db.job.findFirst({ where: { id: ctx.params.id, ownerId: ctx.actor.id, status: 'DRAFT' }, select: { id: true } });
    if (!job) return fail('Status atau versi berubah. Muat ulang.', 409);
    const form = await ctx.request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return fail('Pilih lampiran', 422);
    if (file.size > maxUpload) return fail('Lampiran gagal diunggah (maksimal 10 MB)', 422);
    const versionText = form.get('version');
    if (typeof versionText !== 'string' || !/^(0|[1-9]\d*)$/.test(versionText)) return fail('Versi tidak valid', 422);
    const version = Number(versionText);
    if (!Number.isSafeInteger(version) || version > 2147483647) return fail('Versi tidak valid', 422);
    const storageId = await putObject(await file.arrayBuffer());
    let cleanup = false;
    try {
      const attachment = await db.$transaction(async tx => {
        const updated = await tx.job.updateMany({ where: { id: ctx.params.id, ownerId: ctx.actor.id, status: 'DRAFT', version }, data: { version: { increment: 1 } } });
        if (!updated.count) return null;
        return tx.attachment.create({ data: { jobId: ctx.params.id, filename: path.basename(file.name).slice(0, 255), storageId, mimeType: 'application/octet-stream', size: file.size } });
      });
      if (!attachment) { cleanup = true; return fail('Status atau versi berubah. Muat ulang.', 409); }
      return json({ id: attachment.id }, 201);
    } finally {
      if (cleanup) await deleteObject(storageId).catch(() => {});
    }
  } },
  { method: 'GET', path: 'attachments/:id', run: async ctx => {
    const attachment = await db.attachment.findFirst({ where: { id: ctx.params.id, job: accessible(ctx.actor) } });
    if (!attachment) return new Response(null, { status: 404 });
    const stream = await getObject(attachment.storageId);
    if (!stream) return new Response(null, { status: 404 });
    return new Response(stream, { headers: { 'Content-Type': 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.filename)}"` } });
  } },
];

function match(route: Route, method: string, segments: string[]): Record<string, string> | null {
  if (route.method !== method) return null;
  const pattern = route.path.split('/');
  if (pattern.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern[index].startsWith(':')) params[pattern[index].slice(1)] = segments[index];
    else if (pattern[index] !== segments[index]) return null;
  }
  return params;
}

export async function handleApi(request: Request, segments: string[]): Promise<Response> {
  try {
    const method = request.method.toUpperCase();
    const path = '/' + segments.join('/');
    if (!['GET', 'HEAD'].includes(method) && request.headers.get('origin') !== process.env.AUTH_URL) return fail('Origin tidak diizinkan', 403);
    const secure = process.env.AUTH_URL?.startsWith('https://') || false;
    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET!, secureCookie: secure });
    if (!token?.sub) return fail('Silakan masuk', 401);
    const user = await db.user.findUnique({ where: { id: token.sub }, select: { id: true, role: true, active: true } });
    if (!user || !user.active) return fail('Sesi tidak valid', 401);
    const actor: Actor = { id: user.id, role: user.role as Actor['role'] };
    const assignment = await handleAssignmentApi(request, segments, actor);
    if (assignment) return assignment;
    if (actor.role === 'PEKERJA' && (method !== 'GET' || !(/^\/jobs(?:\/[^/]+(?:\/rab|\/spk)?)?$/.test(path) || /^\/attachments\/[^/]+$/.test(path) || path === '/spks' || path === '/rabs/jobs' || path === '/installation-types'))) return forbid();
    if (actor.role === 'FINANCE' && !(/^\/spks\/?$/.test(path) || /^\/jobs\/[^/]+\/spk(?:\/(?:prepare|issue|ack))?\/?$/.test(path) || (method === 'GET' && path === '/settings/spk-trigger'))) return forbid();
    for (const route of routes) {
      const params = match(route, method, segments);
      if (params) return await route.run({ actor, params, request });
    }
    return new Response(null, { status: 404 });
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) return fail('Terjadi kesalahan database', 500);
    return fail('Terjadi kesalahan server', 500);
  }
}
