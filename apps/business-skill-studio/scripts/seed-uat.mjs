import pg from 'pg'

const { Client } = pg

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the UAT database')
}

const client = new Client({ connectionString: databaseUrl })

const skillMarkdown = `---
name: uat-inventory-exception-response
description: UAT fixture for handling FMCG inventory exceptions.
---

# UAT Inventory Exception Response

Use this Skill to review out-of-stock signals, identify the affected store and SKU, and prepare an escalation summary for operations.

## Workflow

1. Confirm the reporting date, store, and product.
2. Compare on-hand quantity, in-transit quantity, and days of supply.
3. Classify the exception and record the recommended action.
4. Escalate unresolved supply risks to the UAT operations owner.
`

const evalsJson = JSON.stringify({
  skill_name: 'uat-inventory-exception-response',
  evals: [
    {
      id: 'uat-inventory-001',
      prompt: '北京北区大卖场的即饮拿铁库存异常，请给出处理步骤。',
      expected_output: 'A structured inventory-exception workflow with validation and escalation steps.'
    }
  ]
}, null, 2)

try {
  await client.connect()
  await client.query('BEGIN')

  const organizationResult = await client.query(`
    INSERT INTO organizations (id, slug, name, industry, description, created_at, updated_at)
    VALUES ('uat-org-fmcg', 'uat-fmcg', 'WinBrain UAT FMCG', '快速消费品', 'UAT environment for validating organization-scoped Skills and customer data-source workflows.', NOW(), NOW())
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      industry = EXCLUDED.industry,
      description = EXCLUDED.description,
      updated_at = NOW()
    RETURNING id
  `)
  const organizationId = organizationResult.rows[0].id

  const expertResult = await client.query(`
    INSERT INTO experts (id, organization_id, name, email, role, department, expertise, business_context, is_active, created_at, updated_at)
    VALUES ('uat-expert-ops', $1, 'UAT 供应链专家', 'uat-supply@example.com', '供应链运营负责人', '供应链运营', '库存异常、补货和渠道协同', '负责识别缺货风险、协调补货并形成运营升级记录。', TRUE, NOW(), NOW())
    ON CONFLICT (organization_id, email) DO UPDATE SET
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      department = EXCLUDED.department,
      expertise = EXCLUDED.expertise,
      business_context = EXCLUDED.business_context,
      is_active = TRUE,
      updated_at = NOW()
    RETURNING id
  `, [organizationId])
  const expertId = expertResult.rows[0].id

  const skillResult = await client.query(`
    INSERT INTO skills (id, scope_key, organization_id, expert_id, slug, name, created_at, updated_at)
    VALUES ('uat-skill-inventory', $1, $1, $2, 'uat-inventory-exception-response', 'uat-inventory-exception-response', NOW(), NOW())
    ON CONFLICT (scope_key, slug) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      expert_id = EXCLUDED.expert_id,
      name = EXCLUDED.name,
      updated_at = NOW()
    RETURNING id
  `, [organizationId, expertId])
  const skillId = skillResult.rows[0].id

  await client.query(`
    INSERT INTO skill_revisions (id, skill_id, version, skill_markdown, evals_json, created_at)
    SELECT 'uat-skill-inventory-v1', $1, 1, $2, $3, NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM skill_revisions WHERE skill_id = $1 AND version = 1
    )
  `, [skillId, skillMarkdown, evalsJson])

  await client.query('COMMIT')
  console.log(JSON.stringify({
    seeded: true,
    organizationId,
    expertId,
    skillId
  }))
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined)
  throw error
} finally {
  await client.end().catch(() => undefined)
}
