export const meta = {
  name: 'code-review-max-linear',
  description: '线性化的 max 级别代码审查 workflow，深度检查代码质量、安全性、性能和可维护性，自动修复问题并生成 PR 评论',
  whenToUse: '需要对代码进行全面深度审查时使用。支持 PR 号、分支名、文件路径作为参数。自动修复发现的问题并生成评论。',
  phases: [
    { title: 'Collect', detail: '收集待审查的代码 diff 或文件' },
    { title: 'Analyze', detail: '深度分析代码结构和依赖关系' },
    { title: 'Review-Correctness', detail: '审查代码正确性和逻辑问题' },
    { title: 'Review-Security', detail: '审查安全漏洞和风险' },
    { title: 'Review-Performance', detail: '审查性能问题和优化点' },
    { title: 'Review-Maintainability', detail: '审查可维护性和代码质量' },
    { title: 'Fix', detail: '自动修复可修复的问题' },
    { title: 'Comment', detail: '生成 PR 评论报告' },
  ],
}

// ─── Args 处理 ───────────────────────────────────────────────────────────────
const rawArgs = args
const target = typeof rawArgs === 'string' ? rawArgs.trim()
  : (rawArgs && rawArgs.target) ? String(rawArgs.target).trim()
  : null
const cwd = (rawArgs && rawArgs.cwd) ? String(rawArgs.cwd) : '.'

// ─── Schema 定义 ─────────────────────────────────────────────────────────────

const DIFF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    diff: {
      type: 'string',
      description: '完整的 git diff 原文，逐字从 stdout 获取。如果没有 diff，返回 "EMPTY_DIFF"',
    },
    files: {
      type: 'array',
      items: { type: 'string' },
      description: '受影响的文件列表',
    },
  },
  required: ['diff', 'files'],
}

const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    complexity: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'very-high'],
      description: '代码复杂度评估',
    },
    dependencies: {
      type: 'array',
      items: { type: 'string' },
      description: '关键依赖列表',
    },
    patterns: {
      type: 'array',
      items: { type: 'string' },
      description: '识别出的代码模式',
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
      description: '潜在风险点',
    },
  },
  required: ['complexity', 'dependencies', 'patterns', 'risks'],
}

const REVIEW_FINDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    category: {
      type: 'string',
      enum: ['correctness', 'security', 'performance', 'maintainability'],
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          title: { type: 'string', description: '问题标题（一句话）' },
          description: { type: 'string', description: '详细描述问题' },
          impact: { type: 'string', description: '潜在影响' },
          suggestion: { type: 'string', description: '修复建议' },
          autoFixable: { type: 'boolean', description: '是否可自动修复' },
        },
        required: ['file', 'line', 'severity', 'title', 'description', 'impact', 'suggestion', 'autoFixable'],
      },
    },
    clean: { type: 'boolean', description: '该类别是否干净（无问题）' },
  },
  required: ['category', 'findings', 'clean'],
}

// ─── Phase 0: 收集 Diff ──────────────────────────────────────────────────────
phase('Collect')

log('开始收集待审查的代码...')

const diffResult = await agent(
  `你的任务：收集本次审查的完整 git diff 和受影响的文件列表。

工作目录：${cwd}
目标参数：${target ? \`"\${target}"\` : '(未指定，自动检测)'}

按以下优先级执行：

1. 如果目标是 PR 号（纯数字），运行：
   gh pr diff <number>
   gh pr view <number> --json files --jq '.files[].path'

2. 如果目标是分支名，运行：
   git -C "\${cwd}" diff <branch>...HEAD
   git -C "\${cwd}" diff --name-only <branch>...HEAD

3. 如果目标是文件路径，运行：
   git -C "\${cwd}" diff HEAD -- <path>
   git -C "\${cwd}" diff -- <path>
   并返回该文件路径

4. 如果未指定（auto），按顺序尝试：
   a. git -C "\${cwd}" diff @{upstream}...HEAD
   b. 如果失败：git -C "\${cwd}" diff main...HEAD
   c. 如果失败：git -C "\${cwd}" diff HEAD~1...HEAD
   d. git -C "\${cwd}" diff HEAD
   使用 git diff --name-only 获取文件列表

把 diff 原文放入 diff 字段，文件列表放入 files 字段。
如果没有任何 diff，diff 填 "EMPTY_DIFF"，files 填空数组。`,
  { phase: 'Collect', schema: DIFF_SCHEMA }
)

const rawDiff = diffResult?.diff || ''
const affectedFiles = diffResult?.files || []

if (!rawDiff || rawDiff.trim() === 'EMPTY_DIFF') {
  log('⚠️  没有找到任何变更，退出审查流程')
  return
}

log(\`✅ 收集完成，发现 \${affectedFiles.length} 个受影响的文件\`)

const DIFF_TEXT = rawDiff

// ─── Phase 1: 代码分析 ───────────────────────────────────────────────────────
phase('Analyze')

log('分析代码结构和依赖关系...')

const analysisResult = await agent(
  `你的任务：深度分析以下代码变更的结构、依赖和潜在风险。

工作目录：${cwd}
受影响文件：${affectedFiles.join(', ')}

以下是 diff：

\`\`\`diff
${DIFF_TEXT}
\`\`\`

分析步骤：
1. **读取完整文件内容**：用 Read 工具读取所有受影响的文件
2. **识别依赖**：查找 import/require 语句
3. **评估复杂度**：函数嵌套、循环复杂度、状态管理
4. **识别模式**：设计模式、反模式
5. **标记风险点**：错误处理缺失、类型不安全、边界条件、资源泄漏

返回结构化分析结果。`,
  { phase: 'Analyze', schema: ANALYSIS_SCHEMA }
)

log(`✅ 分析完成，复杂度：${analysisResult?.complexity || 'unknown'}`)

const BASE_REVIEW_CONTEXT = `
工作目录：${cwd}
受影响文件：${affectedFiles.join(', ')}

代码分析：
- 复杂度：${analysisResult?.complexity || 'unknown'}
- 依赖：${analysisResult?.dependencies?.join(', ') || 'none'}
- 风险：${analysisResult?.risks?.join('; ') || 'none'}

Diff：
\`\`\`diff
${DIFF_TEXT}
\`\`\`
`

// ─── Phase 2: 审查正确性 ─────────────────────────────────────────────────────
phase('Review-Correctness')
log('审查代码正确性...')

const correctnessResult = await agent(
  `${BASE_REVIEW_CONTEXT}

## 审查维度：正确性（Correctness）

检查：逻辑错误、类型安全、错误处理、数据一致性、API使用

对每个发现标记 file:line、severity、描述、影响、修复建议、是否可自动修复。
category 填 "correctness"`,
  { phase: 'Review-Correctness', schema: REVIEW_FINDING_SCHEMA }
)

log(`✅ 正确性审查完成，发现 ${correctnessResult?.findings?.length || 0} 个问题`)

// ─── Phase 3: 审查安全性 ─────────────────────────────────────────────────────
phase('Review-Security')
log('审查安全漏洞...')

const securityResult = await agent(
  `${BASE_REVIEW_CONTEXT}

## 审查维度：安全性（Security）

检查：注入攻击、认证授权、数据保护、输入验证、依赖安全、配置安全

重点：SQL注入、XSS、命令注入、敏感数据泄露、硬编码凭证
category 填 "security"`,
  { phase: 'Review-Security', schema: REVIEW_FINDING_SCHEMA }
)

log(`✅ 安全性审查完成，发现 ${securityResult?.findings?.length || 0} 个问题`)

// ─── Phase 4: 审查性能 ───────────────────────────────────────────────────────
phase('Review-Performance')
log('审查性能问题...')

const performanceResult = await agent(
  `${BASE_REVIEW_CONTEXT}

## 审查维度：性能（Performance）

检查：算法效率、I/O操作、内存管理、渲染性能、网络优化、启动性能

重点：时间复杂度、串行I/O、N+1查询、内存泄漏、重复计算
category 填 "performance"`,
  { phase: 'Review-Performance', schema: REVIEW_FINDING_SCHEMA }
)

log(`✅ 性能审查完成，发现 ${performanceResult?.findings?.length || 0} 个问题`)

// ─── Phase 5: 审查可维护性 ───────────────────────────────────────────────────
phase('Review-Maintainability')
log('审查可维护性...')

const maintainabilityResult = await agent(
  `${BASE_REVIEW_CONTEXT}

## 审查维度：可维护性（Maintainability）

检查：代码可读性、代码结构、测试覆盖、文档、技术债务、代码一致性

重点：函数过长、参数过多、重复代码、缺少测试、命名不清晰
category 填 "maintainability"`,
  { phase: 'Review-Maintainability', schema: REVIEW_FINDING_SCHEMA }
)

log(`✅ 可维护性审查完成，发现 ${maintainabilityResult?.findings?.length || 0} 个问题`)

// ─── 汇总所有发现 ────────────────────────────────────────────────────────────
const allFindings = [
  ...(correctnessResult?.findings || []),
  ...(securityResult?.findings || []),
  ...(performanceResult?.findings || []),
  ...(maintainabilityResult?.findings || []),
]

log(`📊 审查总结：发现 ${allFindings.length} 个问题`)

// ─── Phase 6: 自动修复 ───────────────────────────────────────────────────────
phase('Fix')

const fixableFindings = allFindings.filter(f => f.autoFixable === true)
log(`🔧 可自动修复：${fixableFindings.length} 个`)

if (fixableFindings.length > 0) {
  await agent(
    `自动修复以下问题：

${fixableFindings.map((f, idx) => `
### ${idx + 1}. [${f.severity}] ${f.file}:${f.line}
**问题**: ${f.title}
**修复建议**: ${f.suggestion}
`).join('\n')}

流程：去重 → 排序（按严重程度）→ 验证（Read文件）→ 修复（Edit工具）→ 验证

原则：只修复autoFixable=true的问题，保守修复，有疑问就跳过

输出：
- ✅ 已修复：N 项
- ⏭️  已跳过：M 项
- ❌ 失败：K 项`,
    { phase: 'Fix', label: '🔧 Auto Fix' }
  )
}

// ─── Phase 7: 生成 PR 评论 ──────────────────────────────────────────────────
phase('Comment')
log('生成 PR 评论...')

await agent(
  `基于审查结果生成 PR 评论。

## 审查结果汇总

总问题数：${allFindings.length}
- 正确性：${correctnessResult?.findings?.length || 0}
- 安全性：${securityResult?.findings?.length || 0}
- 性能：${performanceResult?.findings?.length || 0}
- 可维护性：${maintainabilityResult?.findings?.length || 0}

可自动修复：${fixableFindings.length} 个

## 详细发现

${allFindings.map((f, idx) => `
${idx + 1}. [${f.severity}] ${f.title}
文件: ${f.file}:${f.line}
类别: ${f.category}
描述: ${f.description}
影响: ${f.impact}
建议: ${f.suggestion}
自动修复: ${f.autoFixable ? '✅' : '❌'}
`).join('\n---\n')}

## 任务

1. 检测 PR 环境：运行 \`gh pr view --json number,url\`
2. 生成 markdown 评论：包含审查摘要、关键问题、自动修复情况、改进建议
3. 发布评论：
   - 有 PR：\`gh pr comment <number> --body "<内容>"\`
   - 无 PR：保存到 \`code-review-report.md\`
4. 输出总结

评论格式要清晰、可操作、突出关键问题。`,
  { phase: 'Comment', label: '💬 Generate Comment' }
)

log('✅ Workflow 完成！')
