import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const VERSION = 'v1'

function encryptionKey(): Buffer {
  const configured = process.env.DATA_SOURCE_ENCRYPTION_KEY?.trim()
  if (configured) {
    const decoded = Buffer.from(configured, 'base64')
    if (decoded.length !== 32) {
      throw new Error('DATA_SOURCE_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
    }
    return decoded
  }

  if (process.env.NODE_ENV !== 'production' && process.env.AUTH_SECRET) {
    return createHash('sha256').update(process.env.AUTH_SECRET).digest()
  }

  throw new Error('DATA_SOURCE_ENCRYPTION_KEY is required to store customer database passwords')
}

export function encryptDataSourcePassword(password: string): string {
  if (!password) throw new Error('Customer database password is required')

  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptDataSourcePassword(payload: string): string {
  const [version, ivValue, tagValue, encryptedValue] = payload.split('.')
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Stored customer database password has an unsupported format')
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}
