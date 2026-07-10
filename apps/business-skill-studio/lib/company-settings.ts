import { createHash } from 'node:crypto'
import { getPrismaClient } from './db'
import { decryptDataSourcePassword, encryptDataSourcePassword } from './data-source-crypto'
import { normalizeCustomerDataSourceConnection } from './data-source-security'
import { testCustomerDatabaseConnection } from './customer-database'
import type {
  CompanySetupPayload,
  CustomerDatabaseTestResult,
  CustomerDataSourceConnectionInput,
  CustomerDataSourceCreateRequest,
  CustomerDataSourceSummary,
  ExpertSummary,
  OrganizationSummary
} from './types'

export class CompanySettingsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompanySettingsValidationError'
  }
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new CompanySettingsValidationError(`${field} is required`)
  const cleaned = value.trim()
  if (cleaned.length > maxLength) throw new CompanySettingsValidationError(`${field} is too long`)
  return cleaned
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const cleaned = value.trim()
  if (cleaned.length > maxLength) throw new CompanySettingsValidationError('Optional field is too long')
  return cleaned
}

function organizationSlug(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 68)
  if (normalized) return normalized
  return `company-${createHash('sha256').update(name.trim()).digest('hex').slice(0, 12)}`
}

function organizationSummary(organization: {
  id: string
  slug: string
  name: string
  industry: string | null
  description: string | null
  createdAt: Date
  updatedAt: Date
}): OrganizationSummary {
  return {
    id: organization.id,
    slug: organization.slug,
    name: organization.name,
    industry: organization.industry || undefined,
    description: organization.description || undefined,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString()
  }
}

function expertSummary(expert: {
  id: string
  organizationId: string
  name: string
  email: string | null
  role: string
  department: string | null
  expertise: string | null
  businessContext: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): ExpertSummary {
  return {
    id: expert.id,
    organizationId: expert.organizationId,
    name: expert.name,
    email: expert.email || undefined,
    role: expert.role,
    department: expert.department || undefined,
    expertise: expert.expertise || undefined,
    businessContext: expert.businessContext || undefined,
    isActive: expert.isActive,
    createdAt: expert.createdAt.toISOString(),
    updatedAt: expert.updatedAt.toISOString()
  }
}

function dataSourceSummary(source: {
  id: string
  organizationId: string
  expertId: string | null
  name: string
  kind: 'MYSQL' | 'OCEANBASE_MYSQL'
  host: string
  port: number
  username: string
  databaseName: string
  charset: string
  sslMode: 'DISABLED' | 'REQUIRED'
  lastStatus: 'UNTESTED' | 'HEALTHY' | 'WARNING' | 'FAILED'
  lastTestedAt: Date | null
  lastLatencyMs: number | null
  lastTableCount: number | null
  lastServerVersion: string | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}): CustomerDataSourceSummary {
  return {
    id: source.id,
    organizationId: source.organizationId,
    expertId: source.expertId || undefined,
    name: source.name,
    kind: source.kind,
    host: source.host,
    port: source.port,
    username: source.username,
    databaseName: source.databaseName,
    charset: source.charset,
    sslMode: source.sslMode,
    lastStatus: source.lastStatus,
    lastTestedAt: source.lastTestedAt?.toISOString(),
    lastLatencyMs: source.lastLatencyMs ?? undefined,
    lastTableCount: source.lastTableCount ?? undefined,
    lastServerVersion: source.lastServerVersion || undefined,
    lastError: source.lastError || undefined,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString()
  }
}

export async function listCompanySetup(): Promise<CompanySetupPayload> {
  const prisma = getPrismaClient()
  const [organizations, experts, dataSources] = await Promise.all([
    prisma.organization.findMany({ orderBy: { name: 'asc' } }),
    prisma.expert.findMany({ orderBy: [{ organizationId: 'asc' }, { name: 'asc' }] }),
    prisma.dataSource.findMany({ orderBy: [{ organizationId: 'asc' }, { name: 'asc' }] })
  ])

  return {
    organizations: organizations.map(organizationSummary),
    experts: experts.map(expertSummary),
    dataSources: dataSources.map(dataSourceSummary)
  }
}

export async function createOrganization(input: {
  name: string
  industry?: string
  description?: string
}): Promise<OrganizationSummary> {
  const name = requiredText(input.name, 'name', 160)
  const organization = await getPrismaClient().organization.create({
    data: {
      name,
      slug: organizationSlug(name),
      industry: optionalText(input.industry, 160),
      description: optionalText(input.description, 4_000)
    }
  })
  return organizationSummary(organization)
}

export async function createExpert(input: {
  organizationId: string
  name: string
  email?: string
  role: string
  department?: string
  expertise?: string
  businessContext?: string
}): Promise<ExpertSummary> {
  const organizationId = requiredText(input.organizationId, 'organizationId', 128)
  const prisma = getPrismaClient()
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })
  if (!organization) throw new CompanySettingsValidationError('organization does not exist')

  const email = optionalText(input.email, 320)?.toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CompanySettingsValidationError('email is invalid')
  }

  const expert = await prisma.expert.create({
    data: {
      organizationId,
      name: requiredText(input.name, 'name', 160),
      email,
      role: requiredText(input.role, 'role', 160),
      department: optionalText(input.department, 160),
      expertise: optionalText(input.expertise, 4_000),
      businessContext: optionalText(input.businessContext, 8_000)
    }
  })
  return expertSummary(expert)
}

export async function createCustomerDataSource(input: CustomerDataSourceCreateRequest): Promise<CustomerDataSourceSummary> {
  const organizationId = requiredText(input.organizationId, 'organizationId', 128)
  const name = requiredText(input.name, 'name', 160)
  const connection = normalizeCustomerDataSourceConnection(input)
  const prisma = getPrismaClient()

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })
  if (!organization) throw new CompanySettingsValidationError('organization does not exist')

  const expertId = optionalText(input.expertId, 128)
  if (expertId) {
    const expert = await prisma.expert.findUnique({ where: { id: expertId }, select: { organizationId: true } })
    if (!expert || expert.organizationId !== organizationId) {
      throw new CompanySettingsValidationError('expert does not belong to the selected organization')
    }
  }

  const source = await prisma.dataSource.create({
    data: {
      organizationId,
      expertId,
      name,
      kind: connection.kind,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      passwordEncrypted: encryptDataSourcePassword(connection.password),
      databaseName: connection.databaseName,
      charset: connection.charset,
      sslMode: connection.sslMode
    }
  })
  return dataSourceSummary(source)
}

export async function testUnsavedCustomerDataSource(input: CustomerDataSourceConnectionInput): Promise<CustomerDatabaseTestResult> {
  return testCustomerDatabaseConnection(input)
}

export async function testSavedCustomerDataSource(dataSourceId: string): Promise<CustomerDatabaseTestResult> {
  const prisma = getPrismaClient()
  const source = await prisma.dataSource.findUnique({ where: { id: requiredText(dataSourceId, 'dataSourceId', 128) } })
  if (!source) throw new CompanySettingsValidationError('data source does not exist')

  const result = await testCustomerDatabaseConnection({
    kind: source.kind,
    host: source.host,
    port: source.port,
    username: source.username,
    password: decryptDataSourcePassword(source.passwordEncrypted),
    databaseName: source.databaseName,
    charset: source.charset,
    sslMode: source.sslMode
  })

  await prisma.dataSource.update({
    where: { id: source.id },
    data: {
      lastStatus: result.status,
      lastTestedAt: new Date(),
      lastLatencyMs: result.latencyMs,
      lastTableCount: result.tableCount,
      lastServerVersion: result.serverVersion,
      lastError: result.error || (result.warnings.length ? result.warnings.join('\n') : null)
    }
  })

  return result
}
