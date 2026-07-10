import bcrypt from 'bcryptjs'
import type { User } from 'next-auth'

type PasswordUser = {
  id: string
  email: string
  name: string
  role: string
  passwordHash: string
}

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value)
}

function configuredUsers(): PasswordUser[] {
  const email = process.env.AUTH_USER_EMAIL?.trim().toLowerCase()
  const passwordHash = process.env.AUTH_USER_PASSWORD_HASH?.trim()

  if (!email || !passwordHash || !isBcryptHash(passwordHash)) {
    return []
  }

  return [
    {
      id: process.env.AUTH_USER_ID?.trim() || 'admin',
      email,
      name: process.env.AUTH_USER_NAME?.trim() || 'Studio Admin',
      role: process.env.AUTH_USER_ROLE?.trim() || 'admin',
      passwordHash
    }
  ]
}

export async function verifyPasswordUser(email: string, password: string): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase()
  const user = configuredUsers().find((candidate) => candidate.email === normalizedEmail)

  if (!user || !password) {
    return null
  }

  let valid = false
  try {
    valid = await bcrypt.compare(password, user.passwordHash)
  } catch {
    return null
  }

  if (!valid) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  }
}

export function hasConfiguredPasswordUser(): boolean {
  return configuredUsers().length > 0
}
