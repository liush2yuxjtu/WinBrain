import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { CustomerDataSourceConnectionInput } from './types'

export class CustomerDataSourceValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CustomerDataSourceValidationError'
  }
}

export type NormalizedCustomerDataSourceConnection = CustomerDataSourceConnectionInput

function cleanRequired(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CustomerDataSourceValidationError(`${field} is required`)
  }

  const cleaned = value.trim()
  if (cleaned.length > maxLength || /[\u0000-\u001f\u007f]/.test(cleaned)) {
    throw new CustomerDataSourceValidationError(`${field} is invalid`)
  }
  return cleaned
}

export function normalizeCustomerDataSourceConnection(input: CustomerDataSourceConnectionInput): NormalizedCustomerDataSourceConnection {
  const host = cleanRequired(input.host, 'host', 253).toLowerCase()
  if (host.includes('://') || host.includes('/') || host.includes('@') || (/\s/.test(host))) {
    throw new CustomerDataSourceValidationError('host must be a hostname or IP address, not a URL')
  }

  if (!isIP(host) && !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)) {
    throw new CustomerDataSourceValidationError('host is not a valid hostname or IP address')
  }

  const port = Number(input.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new CustomerDataSourceValidationError('port must be an integer between 1 and 65535')
  }

  const kind = input.kind
  if (kind !== 'MYSQL' && kind !== 'OCEANBASE_MYSQL') {
    throw new CustomerDataSourceValidationError('kind must be MYSQL or OCEANBASE_MYSQL')
  }

  const sslMode = input.sslMode
  if (sslMode !== 'DISABLED' && sslMode !== 'REQUIRED') {
    throw new CustomerDataSourceValidationError('sslMode must be DISABLED or REQUIRED')
  }

  const charset = cleanRequired(input.charset || 'utf8mb4', 'charset', 40)
  if (!/^[a-zA-Z0-9_]+$/.test(charset)) {
    throw new CustomerDataSourceValidationError('charset contains unsupported characters')
  }

  return {
    kind,
    host,
    port,
    username: cleanRequired(input.username, 'username', 128),
    password: cleanRequired(input.password, 'password', 1024),
    databaseName: cleanRequired(input.databaseName, 'databaseName', 128),
    charset,
    sslMode
  }
}

function isRestrictedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts

  return a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 0 && parts[2] === 2) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && parts[2] === 113) ||
    a >= 224
}

export function isRestrictedNetworkAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isRestrictedIpv4(address)
  if (family !== 6) return true

  const normalized = address.toLowerCase()
  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  if (mappedIpv4) return isRestrictedIpv4(mappedIpv4)

  return normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
}

function configuredHostSuffixes(): string[] {
  return (process.env.DATA_SOURCE_ALLOWED_HOST_SUFFIXES || '')
    .split(',')
    .map((value) => value.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean)
}

function hostMatchesSuffix(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`)
}

export async function resolveCustomerDataSourceHost(host: string): Promise<{ address: string; family: number; allAddresses: string[] }> {
  const allowedSuffixes = configuredHostSuffixes()
  if (allowedSuffixes.length && !allowedSuffixes.some((suffix) => hostMatchesSuffix(host, suffix))) {
    throw new CustomerDataSourceValidationError('host is not included in DATA_SOURCE_ALLOWED_HOST_SUFFIXES')
  }

  const records = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true, verbatim: true })

  if (!records.length) {
    throw new CustomerDataSourceValidationError('host did not resolve to an IP address')
  }

  const allowRestricted = process.env.ALLOW_PRIVATE_DATA_SOURCE_HOSTS === 'true' || process.env.NODE_ENV !== 'production'
  const restricted = records.filter((record) => isRestrictedNetworkAddress(record.address))
  if (restricted.length && !allowRestricted) {
    throw new CustomerDataSourceValidationError('host resolves to a private, loopback, link-local, or reserved address')
  }

  return {
    address: records[0]!.address,
    family: records[0]!.family,
    allAddresses: records.map((record) => record.address)
  }
}
