import { Prisma, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from './db';
import { assignmentErrors, assignmentFields, type AssignmentField } from '../app/assignment-data';

type Actor = { id: string; role: Role };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
const fail = (error: string, status: number) => json({ error }, status);
const memberFields = { userId: true, name: true, occupation: true, role: true } as const;
const include = {
  rab: { select: { job: { select: { id: true, title: true, agenda: true, installationOwner: true, installationTypeCode: true, capacity: true, capacityUnit: true, location: true } } } },
  assignment: { include: { members: { orderBy: { position: 'asc' as const }, select: memberFields }, progressUpdatedBy: { select: { name: true } }, audits: { orderBy: { createdAt: 'asc' as const }, select: { event: true, fromStatus: true, toStatus: true, createdAt: true, actor: { select: { name: true } } } } } },
};
const eligible: Prisma.SpkWhereInput = { status: 'ISSUED', rab: { status: 'RAB_APPROVED', job: { status: 'APPROVED' } } };
function access(actor: Actor): Prisma.SpkWhereInput {
  return { ...eligible, ...(actor.role === 'PEKERJA' ? { assignment: { members: { some: { userId: actor.id } } } } : {}) };
}
function view(spk: Prisma.SpkGetPayload<{ include: typeof include }>) {
  const a = spk.assignment;
  return { spk: { id: spk.id, number: spk.number, job: spk.rab.job }, assignment: a ? {
    ...Object.fromEntries(assignmentFields.map(([key]) => [key, a[key] instanceof Date ? (a[key] as Date).toISOString().slice(0, 10) : a[key]])),
    id: a.id, version: a.version, status: a.status, roster: a.members, progressPercent: a.progressPercent, progressNotes: a.progressNotes,
    progressUpdatedAt: a.progressUpdatedAt, progressUpdatedBy: a.progressUpdatedBy, updatedAt: a.updatedAt, audits: a.audits,
  } : null };
}
const strings = Object.fromEntries(assignmentFields.map(([key]) => [key, z.string().trim().min(1).max(key === 'number' ? 200 : 2000)])) as Record<AssignmentField, z.ZodString>;
const schema = z.object({ ...strings, version: z.number().int().min(0).max(2147483646).nullable(), roster: z.array(z.object({ userId: z.string().min(1).max(100), occupation: z.string().trim().min(1).max(200), role: z.enum(['Ketua', 'Anggota']) }).strict()).min(1).max(50) }).strict();
async function body(request: Request) { try { return await request.json(); } catch { return null; } }

export async function handleAssignmentApi(request: Request, segments: string[], actor: Actor): Promise<Response | null> {
  const method = request.method;
  if (segments.length === 1 && segments[0] === 'workers') {
    if (actor.role !== 'ADMIN_PENGAJUAN') return fail('Akses ditolak', 403);
    if (method === 'GET') return json(await db.user.findMany({ where: { role: 'PEKERJA', active: true }, select: { id: true, name: true, email: true, occupation: true }, orderBy: { name: 'asc' } }));
    if (method === 'POST') {
      const parsed = z.object({ name: z.string().trim().min(1).max(200), email: z.email().max(254).transform(value => value.trim().toLowerCase()), occupation: z.string().trim().min(1).max(200), password: z.string().refine(value => Buffer.byteLength(value, 'utf8') >= 12 && Buffer.byteLength(value, 'utf8') <= 72) }).strict().safeParse(await body(request));
      if (!parsed.success) return fail('Isi nama, email, okupasi, dan password sepanjang 12–72 byte.', 422);
      const { password, ...data } = parsed.data;
      try {
        return json(await db.user.create({ data: { ...data, role: 'PEKERJA', passwordHash: await bcrypt.hash(password, 12) }, select: { id: true, name: true, email: true, occupation: true } }), 201);
      } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return fail('Email sudah digunakan.', 409); throw error; }
    }
    return fail('Metode tidak tersedia', 405);
  }
  if (segments[0] !== 'assignments') return null;
  if (segments.length === 1 && method === 'GET') {
    const records = await db.spk.findMany({ where: access(actor), orderBy: { updatedAt: 'desc' }, select: { id: true, number: true, rab: { select: { job: { select: { title: true, agenda: true } } } }, assignment: { select: { number: true, status: true, progressPercent: true, _count: { select: { members: true } } } } } });
    return json(records.map(record => ({ spkId: record.id, spkNumber: record.number, title: record.rab.job.title, agenda: record.rab.job.agenda, assignment: record.assignment })));
  }
  const id = segments[1];
  if (!id || segments.length > 3) return fail('Tidak ditemukan', 404);
  if (segments.length === 2 && method === 'GET') {
    const record = await db.spk.findFirst({ where: { id, ...access(actor) }, include });
    return record ? json(view(record)) : fail('Penugasan tidak ditemukan', 404);
  }
  if (segments.length === 2 && method === 'PUT') {
    if (actor.role !== 'ADMIN_PENGAJUAN') return fail('Hanya Admin Pengajuan & RAB dapat menyimpan penugasan.', 403);
    const parsed = schema.safeParse(await body(request));
    if (!parsed.success) return fail('Periksa seluruh kolom surat, versi, dan tim (1–50 pekerja).', 422);
    const { version, roster, ...letter } = parsed.data;
    if (new Set(roster.map(row => row.userId)).size !== roster.length || roster.filter(row => row.role === 'Ketua').length !== 1) return fail('Pekerja tidak boleh duplikat dan harus ada tepat satu Ketua.', 422);
    try {
      return await db.$transaction(async tx => {
        // All letter edits and progress updates take the same SPK lock, including first creation.
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Spk" WHERE "id" = ${id} FOR UPDATE`;
        if (!locked.length || !await tx.spk.findFirst({ where: { id, ...eligible } })) return fail('SPK terbit tidak ditemukan.', 404);
        const existing = await tx.assignment.findUnique({ where: { spkId: id } });
        if ((existing?.version ?? null) !== version) return fail('Versi penugasan berubah. Periksa data terbaru sebelum menyimpan.', 409);
        const ids = roster.map(row => row.userId);
        const users = await tx.$queryRaw<{ id: string; name: string }[]>`SELECT "id", "name" FROM "User" WHERE "id" IN (${Prisma.join(ids)}) AND "role"::text = 'PEKERJA' AND "active" = true FOR SHARE`;
        if (users.length !== ids.length) return fail('Pilih akun pekerja aktif.', 422);
        const members = roster.map((row, position) => ({ ...row, name: users.find(user => user.id === row.userId)!.name, position }));
        const issues = assignmentErrors({ ...letter, roster: members });
        if (issues.length) return fail(issues.join(' '), 422);
        const data = { ...letter, start: new Date(letter.start + 'T00:00:00Z'), end: new Date(letter.end + 'T00:00:00Z'), issueDate: new Date(letter.issueDate + 'T00:00:00Z') };
        const saved = existing
          ? await tx.assignment.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } })
          : await tx.assignment.create({ data: { ...data, spkId: id } });
        if (existing) await tx.assignmentMember.deleteMany({ where: { assignmentId: saved.id } });
        await tx.assignmentMember.createMany({ data: members.map(row => ({ ...row, assignmentId: saved.id })) });
        await tx.assignmentAudit.create({ data: { assignmentId: saved.id, actorId: actor.id, event: existing ? 'UPDATED' : 'CREATED', fromStatus: existing?.status, toStatus: saved.status, snapshot: { ...letter, roster: members } } });
        return json(view(await tx.spk.findUniqueOrThrow({ where: { id }, include })));
      });
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return fail('Nomor surat sudah digunakan atau penugasan sudah dibuat. Periksa data terbaru.', 409); throw error; }
  }
  if (segments.length === 3 && segments[2] === 'progress' && method === 'PUT') {
    if (actor.role !== 'PEKERJA') return fail('Hanya pekerja yang ditugaskan dapat mengubah progres.', 403);
    const parsed = z.object({ progressPercent: z.number().int().min(0).max(100), notes: z.string().trim().max(2000) }).strict().safeParse(await body(request));
    if (!parsed.success) return fail('Progres harus bilangan bulat 0–100 dan catatan maksimal 2000 karakter.', 422);
    return db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Spk" WHERE "id" = ${id} FOR UPDATE`;
      const record = await tx.spk.findFirst({ where: { id, ...access(actor) }, include: { assignment: true } });
      if (!record?.assignment) return fail('Penugasan tidak ditemukan atau akses telah dicabut.', 404);
      const current = record.assignment;
      const { progressPercent, notes } = parsed.data;
      const status = progressPercent === 100 ? 'COMPLETED' : progressPercent > 0 ? 'IN_PROGRESS' : 'ASSIGNED';
      await tx.assignment.update({ where: { id: current.id }, data: { progressPercent, progressNotes: notes, status, progressUpdatedAt: new Date(), progressUpdatedById: actor.id } });
      if (status !== current.status) await tx.assignmentAudit.create({ data: { assignmentId: current.id, actorId: actor.id, event: 'STATUS_CHANGED', fromStatus: current.status, toStatus: status } });
      return json(view(await tx.spk.findUniqueOrThrow({ where: { id }, include })));
    });
  }
  return fail('Tidak ditemukan', 404);
}
