import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from './server/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  providers: [Credentials({ credentials: { email: {}, password: {} }, async authorize(credentials) {
    if (typeof credentials.email !== 'string' || typeof credentials.password !== 'string' || Buffer.byteLength(credentials.password, 'utf8') > 72) return null;
    const user = await db.user.findUnique({ where: { email: credentials.email.toLowerCase().trim() } });
    if (!user || !await bcrypt.compare(credentials.password, user.passwordHash)) return null;
    return { id: user.id, name: user.name, email: user.email };
  } })],
  pages: { signIn: '/login' },
});
