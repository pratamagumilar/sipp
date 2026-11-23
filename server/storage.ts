import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';

const localDir = path.resolve(process.env.UPLOAD_DIR || './private-uploads');
const publicDir = path.resolve('./public');
if (localDir === publicDir || localDir.startsWith(publicDir + path.sep)) throw new Error('UPLOAD_DIR tidak boleh berada di public');

export async function putObject(bytes: ArrayBuffer): Promise<string> {
  const id = randomUUID();
  await mkdir(localDir, { recursive: true, mode: 0o700 });
  await writeFile(path.join(localDir, id), Buffer.from(bytes));
  return id;
}

export async function getObject(id: string): Promise<ReadableStream<Uint8Array> | null> {
  try { return new Blob([await readFile(path.join(localDir, id))]).stream(); } catch { return null; }
}

export async function deleteObject(id: string): Promise<void> {
  await unlink(path.join(localDir, id));
}
