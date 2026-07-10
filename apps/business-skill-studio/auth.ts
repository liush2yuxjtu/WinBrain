import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { verifyPasswordUser } from '@/lib/auth-users'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login'
  },
  providers: [
    Credentials({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''

        return verifyPasswordUser(email, password)
      }
    })
  ],
  callbacks: {
    authorized({ auth: session }) {
      return Boolean(session?.user)
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role || 'user'
      }

      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id || '')
        session.user.role = String(token.role || 'user')
      }

      return session
    }
  }
})
