import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import {
  CompanySettingsValidationError,
  createCustomerDataSource,
  createExpert,
  createOrganization,
  listCompanySetup
} from '../lib/company-settings'
import { getPrismaClient } from '../lib/db'

process.env.DATA_SOURCE_ENCRYPTION_KEY ||= Buffer.alloc(32, 11).toString('base64')
const prisma = getPrismaClient()

before(async () => {
  await prisma.$connect()
})

beforeEach(async () => {
  await prisma.dataSource.deleteMany()
  await prisma.skillRevision.deleteMany()
  await prisma.skill.deleteMany()
  await prisma.expert.deleteMany()
  await prisma.organization.deleteMany()
})

after(async () => {
  await prisma.$disconnect()
})

test('persists organizations, experts, and encrypted customer data sources', async () => {
  const organization = await createOrganization({
    name: '华北快消集团',
    industry: 'FMCG',
    description: '多渠道快消品销售与库存分析。'
  })
  const expert = await createExpert({
    organizationId: organization.id,
    name: '张敏',
    email: 'zhangmin@example.com',
    role: '销售运营专家',
    department: '渠道运营',
    expertise: '客户健康度、续约风险和渠道动销',
    businessContext: '使用 DWS 日销售和库存快照作为统一口径。'
  })
  const source = await createCustomerDataSource({
    organizationId: organization.id,
    expertId: expert.id,
    name: 'FMCG 分析库',
    kind: 'OCEANBASE_MYSQL',
    host: 'analytics.example.com',
    port: 3306,
    username: 'readonly_user',
    password: 'not-stored-in-plaintext',
    databaseName: 'uat_dws',
    charset: 'utf8mb4',
    sslMode: 'REQUIRED'
  })

  assert.equal(source.organizationId, organization.id)
  assert.equal(source.expertId, expert.id)
  assert.equal('password' in source, false)

  const stored = await prisma.dataSource.findUniqueOrThrow({ where: { id: source.id } })
  assert.notEqual(stored.passwordEncrypted, 'not-stored-in-plaintext')
  assert.equal(stored.passwordEncrypted.includes('not-stored-in-plaintext'), false)

  const setup = await listCompanySetup()
  assert.equal(setup.organizations.length, 1)
  assert.equal(setup.experts[0]?.role, '销售运营专家')
  assert.equal(setup.dataSources[0]?.databaseName, 'uat_dws')
})

test('rejects assigning a data source to an expert from another organization', async () => {
  const first = await createOrganization({ name: 'Company A' })
  const second = await createOrganization({ name: 'Company B' })
  const expert = await createExpert({ organizationId: first.id, name: 'Expert A', role: 'Analyst' })

  await assert.rejects(() => createCustomerDataSource({
    organizationId: second.id,
    expertId: expert.id,
    name: 'Invalid assignment',
    kind: 'MYSQL',
    host: 'db.example.com',
    port: 3306,
    username: 'readonly',
    password: 'secret',
    databaseName: 'analytics',
    charset: 'utf8mb4',
    sslMode: 'REQUIRED'
  }), CompanySettingsValidationError)
})
