import { auth, signIn } from '../../auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { db } from '../../server/db';
import RestoreCheck from './restore-check';
import PasswordField from './password-field';
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (session?.user?.email && await db.user.findUnique({ where: { email: session.user.email, active: true }, select: { id: true } })) redirect('/');
  const params = await searchParams;
  const demoPassword = process.env.NODE_ENV !== 'production' ? process.env.DEMO_LOGIN_PASSWORD : undefined;
  return <main className="login"><RestoreCheck /><div className="brand">KERJANYATA <span>/ SISTEM PENGAJUAN</span></div><h1>Masuk ke ruang kerja</h1><p>Gunakan akun yang telah disediakan untuk Anda.</p>{params.error && <p role="alert" className="error">Email atau kata sandi tidak valid.</p>}<form action={async (data) => { 'use server'; try { await signIn('credentials', { email: data.get('email'), password: data.get('password'), redirectTo: '/' }); } catch (error) { if (error instanceof AuthError) redirect('/login?error=1'); throw error; } }}><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="username"/><label htmlFor="password">Kata sandi</label><PasswordField defaultValue={demoPassword}/><button className="primary">Masuk</button></form></main>;
}
