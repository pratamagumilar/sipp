import { auth, signOut } from '../auth';
import { redirect } from 'next/navigation';
import { db } from '../server/db';
import Simulation from './simulation';

export default async function Home() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { name: true, role: true } });
  if (!user) redirect('/login');

  return <Simulation user={{ name: user.name, role: user.role }} logout={async () => {
    'use server';
    await signOut({ redirectTo: '/login' });
  }} />;
}
