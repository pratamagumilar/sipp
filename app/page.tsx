import { auth, signOut } from '../auth';
import { redirect } from 'next/navigation';
import { db } from '../server/db';
import { listInstallationTypes, listJobs, type Actor } from '../server/api';
import Simulation from './simulation';

export default async function Home() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, name: true, role: true } });
  if (!user) redirect('/login');
  const actor: Actor = { id: user.id, role: user.role };
  const initial = user.role === 'FINANCE' ? null : await Promise.all([listJobs(actor), listInstallationTypes()]).then(([jobs, types]) => ({ jobs: JSON.parse(JSON.stringify(jobs)), types: JSON.parse(JSON.stringify(types)) }));

  return <Simulation user={{ name: user.name, role: user.role }} initial={initial} logout={async () => {
    'use server';
    await signOut({ redirectTo: '/login' });
  }} />;
}
