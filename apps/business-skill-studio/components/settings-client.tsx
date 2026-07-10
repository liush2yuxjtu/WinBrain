"use client"

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type {
  CompanySetupPayload,
  CustomerDatabaseTestResult,
  CustomerDataSourceKind,
  CustomerDataSourceSslMode
} from '@/lib/types'

const emptySetup: CompanySetupPayload = { organizations: [], experts: [], dataSources: [] }

async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null) as { error?: string } | null
  return new Error(body?.error || `Server returned ${response.status}`)
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!response.ok) throw await responseError(response)
  return response.json() as Promise<T>
}

export function SettingsClient() {
  const [setup, setSetup] = useState<CompanySetupPayload>(emptySetup)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState<CustomerDatabaseTestResult | null>(null)

  const [organizationForm, setOrganizationForm] = useState({ name: '', industry: '', description: '' })
  const [expertForm, setExpertForm] = useState({
    organizationId: '', name: '', email: '', role: '', department: '', expertise: '', businessContext: ''
  })
  const [sourceForm, setSourceForm] = useState({
    organizationId: '', expertId: '', name: 'FMCG 分析库', kind: 'OCEANBASE_MYSQL' as CustomerDataSourceKind,
    host: '', port: 3306, username: '', password: '', databaseName: '', charset: 'utf8mb4',
    sslMode: 'DISABLED' as CustomerDataSourceSslMode
  })

  const sourceExperts = useMemo(
    () => setup.experts.filter((expert) => expert.organizationId === sourceForm.organizationId && expert.isActive),
    [setup.experts, sourceForm.organizationId]
  )

  async function loadSetup(preferredOrganizationId?: string) {
    setLoading(true)
    try {
      const response = await fetch('/api/setup')
      if (!response.ok) throw await responseError(response)
      const payload = await response.json() as CompanySetupPayload
      setSetup(payload)
      const organizationId = preferredOrganizationId || payload.organizations[0]?.id || ''
      setExpertForm((current) => ({ ...current, organizationId: current.organizationId || organizationId }))
      setSourceForm((current) => ({ ...current, organizationId: current.organizationId || organizationId }))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadSetup() }, [])

  async function submitOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('organization')
    setNotice('')
    setError('')
    try {
      const result = await postJson<{ organization: { id: string; name: string } }>('/api/organizations', organizationForm)
      setOrganizationForm({ name: '', industry: '', description: '' })
      setExpertForm((current) => ({ ...current, organizationId: result.organization.id }))
      setSourceForm((current) => ({ ...current, organizationId: result.organization.id }))
      await loadSetup(result.organization.id)
      setNotice(`公司“${result.organization.name}”已创建。`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setBusy('')
    }
  }

  async function submitExpert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('expert')
    setNotice('')
    setError('')
    try {
      const result = await postJson<{ expert: { name: string } }>('/api/experts', expertForm)
      setExpertForm((current) => ({
        ...current, name: '', email: '', role: '', department: '', expertise: '', businessContext: ''
      }))
      await loadSetup(expertForm.organizationId)
      setNotice(`专家“${result.expert.name}”已添加。`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setBusy('')
    }
  }

  function useLocalFmcgPreset() {
    setSourceForm((current) => ({
      ...current,
      name: '本地 FMCG 测试库',
      kind: 'MYSQL',
      host: '127.0.0.1',
      port: 3307,
      username: 'fmcg_readonly',
      password: 'local-fmcg-readonly',
      databaseName: 'uat_dws',
      charset: 'utf8mb4',
      sslMode: 'DISABLED'
    }))
    setTestResult(null)
  }

  async function testConnection() {
    setBusy('test')
    setNotice('')
    setError('')
    setTestResult(null)
    try {
      const response = await postJson<{ result: CustomerDatabaseTestResult }>('/api/data-sources/test', sourceForm)
      setTestResult(response.result)
      setNotice(response.result.status === 'FAILED' ? '连接检测失败，请按步骤修正配置。' : '连接检测已完成。')
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : String(testError))
    } finally {
      setBusy('')
    }
  }

  async function submitDataSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('source')
    setNotice('')
    setError('')
    try {
      const response = await postJson<{ dataSource: { id: string; name: string } }>('/api/data-sources', sourceForm)
      setSourceForm((current) => ({ ...current, name: '', password: '' }))
      await loadSetup(sourceForm.organizationId)
      setNotice(`数据源“${response.dataSource.name}”已加密保存。可在下方重新检测。`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setBusy('')
    }
  }

  async function retestSaved(dataSourceId: string) {
    setBusy(`retest:${dataSourceId}`)
    setNotice('')
    setError('')
    setTestResult(null)
    try {
      const response = await postJson<{ result: CustomerDatabaseTestResult }>('/api/data-sources/test', { dataSourceId })
      setTestResult(response.result)
      await loadSetup()
      setNotice('已使用加密保存的密码重新检测数据源。')
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : String(testError))
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="settings-stage" id="company-settings">
      <header className="studio-topbar">
        <div className="topbar-inner">
          <div className="breadcrumb"><span>WinBrain</span><span>/</span><b>公司与数据源设置</b></div>
          <div className="title-row">
            <div>
              <h1>公司、专家与业务数据库</h1>
              <p>为不同公司建立独立专家上下文，并检测 MySQL / OceanBase MySQL 模式的只读业务数据库。</p>
            </div>
            <a className="button secondary settings-back-link" href="/">返回 Skill 工作台</a>
          </div>
        </div>
      </header>

      <div className="settings-content">
        <section className="settings-security-note">
          <strong>安全边界</strong>
          <span>密码只在服务端使用 AES-256-GCM 加密保存，API 不会返回密码。检测过程仅执行 SELECT、SHOW GRANTS 与 information_schema 查询。</span>
        </section>

        {notice ? <div className="settings-notice" role="status">{notice}</div> : null}
        {error ? <div className="settings-error" role="alert">{error}</div> : null}
        {loading ? <div className="settings-loading">正在读取配置…</div> : null}

        <div className="settings-grid">
          <form className="settings-card" onSubmit={submitOrganization}>
            <div className="settings-card-header"><span>01</span><div><h2>创建公司</h2><p>每个公司的专家、数据源和 Skill 独立归属。</p></div></div>
            <label>公司名称<input required value={organizationForm.name} onChange={(event) => setOrganizationForm({ ...organizationForm, name: event.target.value })} placeholder="例如：华北快消集团" /></label>
            <label>行业<input value={organizationForm.industry} onChange={(event) => setOrganizationForm({ ...organizationForm, industry: event.target.value })} placeholder="快消、零售、制造…" /></label>
            <label>公司业务背景<textarea value={organizationForm.description} onChange={(event) => setOrganizationForm({ ...organizationForm, description: event.target.value })} placeholder="业务模式、主要产品、组织术语和限制条件" /></label>
            <button className="button primary" disabled={busy === 'organization'} type="submit">{busy === 'organization' ? '创建中…' : '创建公司'}</button>
          </form>

          <form className="settings-card" onSubmit={submitExpert}>
            <div className="settings-card-header"><span>02</span><div><h2>添加专家</h2><p>专家信息会自动带入访谈和 Skill 生成上下文。</p></div></div>
            <label>所属公司<select required value={expertForm.organizationId} onChange={(event) => setExpertForm({ ...expertForm, organizationId: event.target.value })}><option value="">请选择</option>{setup.organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}</select></label>
            <div className="settings-two-columns">
              <label>姓名<input required value={expertForm.name} onChange={(event) => setExpertForm({ ...expertForm, name: event.target.value })} /></label>
              <label>角色<input required value={expertForm.role} onChange={(event) => setExpertForm({ ...expertForm, role: event.target.value })} placeholder="销售运营专家" /></label>
            </div>
            <div className="settings-two-columns">
              <label>部门<input value={expertForm.department} onChange={(event) => setExpertForm({ ...expertForm, department: event.target.value })} /></label>
              <label>邮箱<input type="email" value={expertForm.email} onChange={(event) => setExpertForm({ ...expertForm, email: event.target.value })} /></label>
            </div>
            <label>专业领域<textarea value={expertForm.expertise} onChange={(event) => setExpertForm({ ...expertForm, expertise: event.target.value })} placeholder="负责的指标、流程、系统和判断标准" /></label>
            <label>业务上下文<textarea value={expertForm.businessContext} onChange={(event) => setExpertForm({ ...expertForm, businessContext: event.target.value })} placeholder="公司术语、例外、数据口径和合规限制" /></label>
            <button className="button primary" disabled={busy === 'expert' || !setup.organizations.length} type="submit">{busy === 'expert' ? '保存中…' : '添加专家'}</button>
          </form>
        </div>

        <form className="settings-card settings-card-wide" id="data-sources" onSubmit={submitDataSource}>
          <div className="settings-card-header">
            <span>03</span><div><h2>配置并检测业务数据库</h2><p>支持 MySQL 和 OceanBase MySQL 模式。建议为 WinBrain 创建只读专用账号。</p></div>
            <button className="button secondary" type="button" onClick={useLocalFmcgPreset}>填入本地 FMCG 测试库</button>
          </div>
          <div className="settings-three-columns">
            <label>所属公司<select required value={sourceForm.organizationId} onChange={(event) => setSourceForm({ ...sourceForm, organizationId: event.target.value, expertId: '' })}><option value="">请选择</option>{setup.organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}</select></label>
            <label>适用专家（可选）<select value={sourceForm.expertId} onChange={(event) => setSourceForm({ ...sourceForm, expertId: event.target.value })}><option value="">公司共享</option>{sourceExperts.map((expert) => <option value={expert.id} key={expert.id}>{expert.name}</option>)}</select></label>
            <label>数据源名称<input required value={sourceForm.name} onChange={(event) => setSourceForm({ ...sourceForm, name: event.target.value })} /></label>
            <label>数据库类型<select value={sourceForm.kind} onChange={(event) => setSourceForm({ ...sourceForm, kind: event.target.value as CustomerDataSourceKind })}><option value="OCEANBASE_MYSQL">OceanBase MySQL</option><option value="MYSQL">MySQL</option></select></label>
            <label>主机<input required value={sourceForm.host} onChange={(event) => setSourceForm({ ...sourceForm, host: event.target.value })} placeholder="db.example.com" /></label>
            <label>端口<input required type="number" min="1" max="65535" value={sourceForm.port} onChange={(event) => setSourceForm({ ...sourceForm, port: Number(event.target.value) })} /></label>
            <label>用户名<input required autoComplete="off" value={sourceForm.username} onChange={(event) => setSourceForm({ ...sourceForm, username: event.target.value })} /></label>
            <label>密码<input required type="password" autoComplete="new-password" value={sourceForm.password} onChange={(event) => setSourceForm({ ...sourceForm, password: event.target.value })} /></label>
            <label>数据库 / Schema<input required value={sourceForm.databaseName} onChange={(event) => setSourceForm({ ...sourceForm, databaseName: event.target.value })} /></label>
            <label>字符集<input required value={sourceForm.charset} onChange={(event) => setSourceForm({ ...sourceForm, charset: event.target.value })} /></label>
            <label>TLS<select value={sourceForm.sslMode} onChange={(event) => setSourceForm({ ...sourceForm, sslMode: event.target.value as CustomerDataSourceSslMode })}><option value="DISABLED">关闭</option><option value="REQUIRED">必须验证证书</option></select></label>
          </div>
          <p className="settings-field-help">密码只保留在当前表单内；保存后浏览器不会再次读取密码。生产环境可通过域名白名单和内网地址策略限制连接目标。</p>
          <div className="settings-actions">
            <button className="button secondary" disabled={busy === 'test'} type="button" onClick={testConnection}>{busy === 'test' ? '检测中…' : '仅检测连接'}</button>
            <button className="button primary" disabled={busy === 'source' || !setup.organizations.length} type="submit">{busy === 'source' ? '加密保存中…' : '加密保存数据源'}</button>
          </div>
        </form>

        {testResult ? (
          <section className={`connection-result ${testResult.status.toLowerCase()}`}>
            <div className="connection-result-header"><div><span>连接检测</span><h2>{testResult.status === 'HEALTHY' ? '连接健康' : testResult.status === 'WARNING' ? '连接成功，但有安全警告' : '连接失败'}</h2></div><strong>{testResult.latencyMs ? `${testResult.latencyMs}ms` : testResult.status}</strong></div>
            <ol className="connection-steps">{testResult.steps.map((step) => <li className={step.status} key={`${step.key}-${step.label}`}><i /> <div><strong>{step.label}</strong><p>{step.detail}</p></div></li>)}</ol>
            {testResult.tables.length ? <div className="schema-preview"><h3>Schema 预览（{testResult.tableCount} 个表/视图）</h3>{testResult.tables.slice(0, 12).map((table) => <details key={table.name}><summary>{table.name} <span>{table.type} · {table.columns.length} fields</span></summary><div className="schema-columns">{table.columns.map((column) => <code key={`${table.name}-${column.name}`}>{column.name}: {column.dataType}{column.key ? ` [${column.key}]` : ''}</code>)}</div></details>)}</div> : null}
          </section>
        ) : null}

        <section className="settings-list-card">
          <div className="settings-card-header"><span>04</span><div><h2>已保存的数据源</h2><p>列表永远不返回密码；重新检测时由服务端解密。</p></div></div>
          {!setup.dataSources.length ? <p className="settings-empty">尚未保存数据源。</p> : <div className="data-source-list">{setup.dataSources.map((source) => {
            const organization = setup.organizations.find((candidate) => candidate.id === source.organizationId)
            return <article key={source.id}><div><strong>{source.name}</strong><span>{organization?.name} · {source.kind} · {source.host}:{source.port}/{source.databaseName}</span><small className={`health-${source.lastStatus.toLowerCase()}`}>{source.lastStatus}{source.lastTestedAt ? ` · ${new Date(source.lastTestedAt).toLocaleString()}` : ''}</small></div><button className="button secondary" type="button" disabled={busy === `retest:${source.id}`} onClick={() => retestSaved(source.id)}>{busy === `retest:${source.id}` ? '检测中…' : '重新检测'}</button></article>
          })}</div>}
        </section>
      </div>
    </main>
  )
}
