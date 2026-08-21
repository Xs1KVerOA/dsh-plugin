import { spawn } from 'node:child_process'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { assertCodeAuditSession } from './index.js'

export const name = 'dsh-security-code-audit-tools'
export const inject = ['tools', 'dshSecurity', 'sandboxPolicy']

function render(value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

const SAFE_REPOSITORY_PART = /^[A-Za-z0-9._-]+$/
const SAFE_REF = /^(?!-)[A-Za-z0-9._/-]{1,128}$/

export function normalizeAuditRepository(value) {
  const raw = String(value || '').trim()
  let url
  try { url = new URL(raw) } catch { throw new Error('代码审计远程仓库必须是有效的 HTTPS GitHub URL') }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || url.username || url.password || url.search || url.hash) {
    throw new Error('代码审计远程拉取目前只允许不带凭据的 HTTPS GitHub 仓库 URL')
  }
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2 || parts.length > 2) throw new Error('GitHub 仓库 URL 必须是 https://github.com/<owner>/<repo>')
  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/i, '')
  if (!SAFE_REPOSITORY_PART.test(owner) || !SAFE_REPOSITORY_PART.test(repo)) throw new Error('GitHub 仓库名称包含不支持的字符')
  return { url: `https://github.com/${owner}/${repo}.git`, owner, repo }
}

function auditWorkspace(exec, sandboxPolicy) {
  const session = exec?.agent?.session
  const policyRoot = sandboxPolicy?.resolve?.({ session })?.workspaceRoot
  const cwd = String(exec?.agent?.session?.header?.cwd || '').trim()
  return resolve(String(policyRoot || cwd || process.cwd()))
}

export function resolveAuditRepositoryDestination(exec, repository, requested, sandboxPolicy) {
  const workspace = auditWorkspace(exec, sandboxPolicy)
  const defaultName = `${repository.owner}-${repository.repo}`
  const value = String(requested || join('.dsh-audit', defaultName)).trim()
  if (!value) throw new Error('远程仓库落盘目录不能为空')
  const destination = resolve(workspace, value)
  const outside = relative(workspace, destination)
  if (outside === '..' || outside.startsWith(`..${String.fromCharCode(47)}`) || isAbsolute(outside)) {
    throw new Error('远程仓库只能拉取到当前工作区目录内')
  }
  return { workspace, destination }
}

async function existingDirectoryState(destination) {
  try {
    const info = await stat(destination)
    if (!info.isDirectory()) throw new Error(`远程仓库落盘路径不是目录：${destination}`)
    const entries = await readdir(destination)
    if (entries.length) throw new Error(`远程仓库落盘目录已存在且非空：${destination}`)
    return { existed: true }
  } catch (error) {
    if (error?.code === 'ENOENT') return { existed: false }
    throw error
  }
}

function cloneRepository({ repository, ref, workspace, destination, signal }) {
  const args = ['clone', '--depth', '1', '--no-tags', '--single-branch']
  if (ref) args.push('--branch', ref)
  args.push(repository.url, destination)
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', args, {
      cwd: workspace,
      shell: false,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    let settled = false
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      if (signal) signal.removeEventListener?.('abort', abort)
      callback(value)
    }
    const abort = () => {
      child.kill('SIGTERM')
      finish(reject, new Error('远程仓库拉取已取消'))
    }
    if (signal?.aborted) return abort()
    signal?.addEventListener?.('abort', abort, { once: true })
    child.stderr.on('data', chunk => {
      stderr = `${stderr}${String(chunk)}`.slice(-4000)
    })
    child.once('error', error => finish(reject, new Error(`无法启动 git 拉取：${error.message}`)))
    child.once('exit', (code, reason) => {
      if (code === 0) return finish(resolvePromise, undefined)
      const detail = stderr.trim().replace(/\s+/g, ' ')
      finish(reject, new Error(`远程仓库拉取失败${detail ? `：${detail}` : `（${reason || `exit ${code}`}）`}`))
    })
  })
}

async function materializeAuditTarget(input, exec, sandboxPolicy) {
  const targetPath = String(input.targetPath || '').trim()
  if (!/^https?:\/\//i.test(targetPath)) return { targetPath }
  const repository = normalizeAuditRepository(targetPath)
  const ref = String(input.ref || '').trim()
  if (ref && !SAFE_REF.test(ref)) throw new Error('远程仓库 ref 包含不支持的字符')
  const { workspace, destination } = resolveAuditRepositoryDestination(exec, repository, input.destination, sandboxPolicy)
  const state = await existingDirectoryState(destination)
  await mkdir(dirname(destination), { recursive: true })
  try {
    await cloneRepository({ repository, ref, workspace, destination, signal: exec?.signal })
  } catch (error) {
    if (!state.existed) await rm(destination, { recursive: true, force: true }).catch(() => {})
    throw error
  }
  return { targetPath: destination, sourceRepository: targetPath, sourceLocalPath: destination, sourceRef: ref || undefined }
}

export function apply(ctx) {
  const runtime = ctx.get('dshSecurity')
  const sandboxPolicy = ctx.get('sandboxPolicy')
  const output = { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => render(value) }
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_start',
    description: '开始一次代码审计运行，记录目标、语言、范围和授权说明。targetPath 可以直接传 HTTPS GitHub 仓库 URL，工具会自动以浅克隆方式拉取到当前工作区后开始静态审计；不得使用 Web Fuzzer 或 MITM 代替仓库拉取。新的运行会替换当前会话之前的代码审计清单与报告。',
    parameters: {
      targetPath: { type: 'string', required: true }, destination: { type: 'string', description: '远程仓库落盘目录，只能位于当前工作区内。' }, ref: { type: 'string', description: '可选 Git 分支、tag 或 commit。' }, language: { type: 'string' }, scope: { type: 'string' }, authorization: { type: 'string' },
    },
    output,
    async execute(input, exec) {
      assertCodeAuditSession(exec, runtime.sessions)
      const materialized = await materializeAuditTarget(input, exec, sandboxPolicy)
      const run = await runtime.auditStart({ ...input, targetPath: materialized.targetPath }, exec)
      return { ...run, ...(materialized.sourceRepository ? { sourceRepository: materialized.sourceRepository, sourceLocalPath: materialized.sourceLocalPath, sourceRef: materialized.sourceRef || null } : {}) }
    },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_update_understanding',
    description: '提交产品理解基线：产品用途、核心能力、功能边界、运行假设和技术栈。该结果只描述审计上下文，不代表漏洞结论。',
    parameters: {
      runId: { type: 'string' }, productSummary: { type: 'string' }, productPurpose: { type: 'string' }, coreCapabilities: { type: 'array', items: { type: 'string' } }, boundaries: { type: 'array', items: { type: 'string' } }, assumptions: { type: 'array', items: { type: 'string' } }, techStack: { type: 'array', items: { type: 'json' } }, status: { type: 'string' },
    },
    output,
    async execute(input, exec) { assertCodeAuditSession(exec, runtime.sessions); return runtime.auditUpdateUnderstanding(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_add_api',
    description: '将代码提取出的真实入口点/API 加入结构化 API 清单。不要按路径、方法或其他字段归一化；同一 entryId 下每个不同 handler 必须单独调用一次，并保持 handler 原文。仅记录入口与候选风险，不代表漏洞已确认。',
    parameters: {
      runId: { type: 'string' }, entryId: { type: 'string', required: true }, entryType: { type: 'string' }, method: { type: 'string' }, path: { type: 'string' }, handler: { type: 'string' }, auth: { type: 'string' }, module: { type: 'string' }, active: { type: 'string' }, featureSummary: { type: 'string' }, sourceCandidates: { type: 'array', items: { type: 'string' } }, sinkCandidates: { type: 'array', items: { type: 'string' } }, riskTags: { type: 'array', items: { type: 'string' } }, targetPaths: { type: 'array', items: { type: 'string' } }, graphHints: { type: 'array', items: { type: 'string' } }, contextFiles: { type: 'array', items: { type: 'string' } }, relatedSymbols: { type: 'array', items: { type: 'string' } }, authGuards: { type: 'array', items: { type: 'string' } }, configRefs: { type: 'array', items: { type: 'string' } }, dataModels: { type: 'array', items: { type: 'string' } }, errorHandlers: { type: 'array', items: { type: 'string' } }, middleware: { type: 'array', items: { type: 'string' } }, priority: { type: 'string' }, confidence: { type: 'string' }, language: { type: 'string' }, sourceConfidence: { type: 'string' }, aiAuthConclusion: { type: 'string' }, auditCoverage: { type: 'string', description: '可选固定枚举：extracted、in-progress、reviewed、verified；旧值 partial 会转换为 in-progress。' }, auditDomains: { type: 'array', items: { type: 'string' } },
    },
    output,
    async execute(input, exec) { assertCodeAuditSession(exec, runtime.sessions); return runtime.auditAddApi(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_mark_api_reviewed',
    description: '显式标记一个 API 入口已完成审计。即使没有发现漏洞，也必须在逐项分析结束后调用；只有 reviewed 或 verified 才会计入 API 覆盖率。',
    parameters: {
      runId: { type: 'string' }, apiId: { type: 'string' }, entryId: { type: 'string', required: true }, handler: { type: 'string' }, auditCoverage: { type: 'string', required: true }, auditSummary: { type: 'string', required: true }, confidence: { type: 'string' }, aiAuthConclusion: { type: 'string' }, auditDomains: { type: 'array', items: { type: 'string' } },
    },
    output,
    async execute(input, exec) { assertCodeAuditSession(exec, runtime.sessions); return runtime.auditMarkApiReviewed(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_add_candidate',
    description: '记录一个入口点驱动的独立代码审计候选。一个候选只能描述一个漏洞根因、一个影响边界和一个漏洞类型；同一 API 上的 CORS、错误处理、越权等不同问题必须拆成不同 candidateId 分别记录，不能在一个候选中合并。保留 Entry、Source、Sink、Chain、Guards、证据位置、Active、影响、修复建议和未执行的 Request PoC 模板，供候选复核和报告汇总；第一阶段始终进入待复核。确认漏洞前必须补充安全、非破坏性的 Request PoC，不得执行请求。',
    parameters: {
      runId: { type: 'string' }, candidateId: { type: 'string', required: true }, domain: { type: 'string' }, vulnerabilityType: { type: 'string', description: '单一漏洞类型，例如 authorization、sql-injection、rce、file-read、secret-exposure；不能填写多个类型。' }, status: { type: 'string', description: '首阶段候选内部固定为 needs-review；传 pending 会兼容转换为 needs-review。' }, severity: { type: 'string', description: '仅作兼容显示；最终严重度由有效 CVSS 3.1 向量计算。' }, title: { type: 'string' }, apiId: { type: 'string', description: '可传当前运行完整 apiId，也可传 API 返回 ID 的 api-... 后缀；仍必须属于当前运行。' }, entryId: { type: 'string', required: true }, handler: { type: 'string' }, entryType: { type: 'string' }, entry: { type: 'string', required: true }, auth: { type: 'string' }, active: { type: 'string' }, source: { type: 'array', required: true, items: { type: 'string' } }, sink: { type: 'array', required: true, items: { type: 'string' } }, chain: { type: 'array', items: { type: 'string' } }, guards: { type: 'array', items: { type: 'string' } }, evidence: { type: 'array', required: true, items: { type: 'string' } }, evidenceLocations: { type: 'array', required: true, items: { type: 'json' } }, impact: { type: 'string', required: true }, impactEvidence: { type: 'string', description: '说明真实危害如何由证据成立，而不是推测。' }, confidence: { type: 'string' }, queueItem: { type: 'string' }, description: { type: 'string' }, remediation: { type: 'string' }, requestPoc: { type: 'string', description: 'HTTP/1.x 原始请求格式，使用占位符和非破坏性请求；确认时必填。' }, cvss: { type: 'string' }, cvssVector: { type: 'string' }, secretType: { type: 'string', description: 'key/secret 数据类型。' }, secretExposure: { type: 'string', description: '暴露位置、范围和数据类型。' }, secretValue: { type: 'string', description: '实际获得的 key/secret 原始值，报告中原样显示；不得复制到 Request PoC。' }, exploitation: { type: 'string', description: '非破坏性利用/影响验证方式、权限边界和轮换建议；不得在验证中执行破坏性操作。' },
    },
    output,
    async execute(input, exec) { assertCodeAuditSession(exec, runtime.sessions); return runtime.auditAddCandidate(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_review_candidate',
    description: '复核一个代码审计候选。状态只能是 needs-review、confirmed、false-positive 或 accepted-risk；复核需要补充可达性、权限、防护、生产代码和证据充分性判断。confirmed 只允许真实有效且有实际危害的漏洞：还必须有完整自检、high/medium 置信度、有效 CVSS 3.1 向量、证据位置和未执行的 HTTP/1.x Request PoC，否则会保留为待复核。Request PoC 只能使用占位符和非破坏性请求形状。key/secret 可通过 secretValue 原样写入报告展示，但不得复制到 PoC；同时提供暴露位置、非破坏性利用方式和轮换建议。',
    parameters: {
      runId: { type: 'string' }, candidateId: { type: 'string', required: true }, status: { type: 'string', required: true }, cvssVector: { type: 'string' }, cvss: { type: 'string' }, requestPoc: { type: 'string' }, impactEvidence: { type: 'string' }, secretType: { type: 'string' }, secretExposure: { type: 'string' }, secretValue: { type: 'string', description: '实际获得的 key/secret 原始值，原样显示在报告中，不进入 PoC。' }, exploitation: { type: 'string' }, confidence: { type: 'string' }, reviewNotes: { type: 'string' }, evidenceLocations: { type: 'array', items: { type: 'json' } }, reachable: { type: 'string' }, authorization: { type: 'string' }, inputValidation: { type: 'string' }, productionCode: { type: 'string' }, sufficientEvidence: { type: 'string' },
    },
    output,
    async execute(input, exec) { assertCodeAuditSession(exec, runtime.sessions); return runtime.auditReviewCandidate(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_report',
    description: '提交代码审计最终报告。报告同时保存结构化严重度统计、发现摘要、修复优先级和 Markdown 正文。',
    parameters: { runId: { type: 'string' }, title: { type: 'string' }, status: { type: 'string' }, summary: { type: 'string' }, markdown: { type: 'string' }, findings: { type: 'array', items: { type: 'json' } }, topPriorities: { type: 'array', items: { type: 'string' } }, observations: { type: 'array', items: { type: 'string' } } },
    output,
    async execute(input, exec) { assertCodeAuditSession(exec, runtime.sessions); return runtime.auditReport(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_state',
    description: '读取当前代码审计运行、API 清单、候选发现和最终报告。',
    parameters: {},
    output,
    async execute(_input, exec) { assertCodeAuditSession(exec, runtime.sessions); return runtime.auditState(exec.sessionId || exec.agent?.session?.id) },
  }))
  ctx.inject(['systemPrompt'], scope => scope.systemPrompt.section({
    name: 'dsh-security:code-audit-protocol', order: 50,
    text: () => '你是企业级代码安全审计助手。只使用 DSH 自身的业务流程，按“建立运行 → 产品理解 → API/入口提取 → 入口逐项分析 → 候选记录 → 候选复核 → 结构化报告”的顺序工作，不引入 AST 或额外编排阶段。若审计目标是 HTTPS GitHub 仓库，直接把仓库 URL 传给 dsh_code_audit_start，由工具自动拉取到当前工作区；禁止调用 dsh_web_fuzzer 或 dsh_mitm_capture 获取源代码。先用 dsh_code_audit_start 记录目标、语言、范围和授权说明，再用 dsh_code_audit_update_understanding 提交产品用途、核心能力、功能边界、运行假设和技术栈。提取 API 时不要归一化或合并记录：同一 entryId 下每个不同 handler 都必须单独调用 dsh_code_audit_add_api，并原样保留 handler；后续候选和覆盖标记在多个 handler 时必须提供 handler 或 apiId。提取 API 后逐个分析：同时读取路由/入口、Handler、参数来源、调用的 Service/Repository、权限校验函数、关键配置、相关 Model/数据库操作、同功能错误处理和中间件；先搜索入口与符号，再搜索调用者和被调用者，长文件按函数或行号分块，并把已读取文件和相关符号写入 API 清单上下文。每个 API 分析结束后必须调用 dsh_code_audit_mark_api_reviewed，设置 reviewed 或 verified、auditSummary 和 confidence；没有确认漏洞的 API 也必须标记完成，不能靠候选记录代替覆盖状态。第一阶段只能用 dsh_code_audit_add_candidate 提出候选，一个候选只能有一个漏洞类型、一个独立根因和一个影响边界；同一 API 的多个独立问题必须用不同 candidateId 分开记录，不能把 CORS、错误处理、越权、信息泄露等合并。候选必须关联已有 API，并提供 Entry、Source、Sink、Impact、真实影响证据、证据说明和至少一个文件/行号/代码位置；推测、最佳实践缺失或无法说明实际危害的内容不要作为漏洞候选。可以同时提供安全的 Request PoC 模板，但不得执行。第二阶段逐个使用 dsh_code_audit_review_candidate，回答可达性、认证授权、输入过滤/编码、是否生产代码、证据是否充分五项自检；确认漏洞时必须补充 high/medium 置信度、真实影响证据和 requestPoc，使用原始 HTTP/1.x 请求格式、占位符和非破坏性请求语义，不得放入真实密钥或破坏性 payload。每个 confirmed 候选必须提供有效 CVSS:3.1 基础向量，报告按 CVSS 分数从高到低排序；severity 只作为兼容字段，不能覆盖 CVSS 计算结果。任何一项未知、低置信度、缺少有效 CVSS:3.1 向量、证据位置、真实影响证据或 HTTP requestPoc，都只能是 needs-review。若发现 key/secret，只记录脱敏的数据类型、暴露位置、非破坏性利用/影响验证方式和轮换建议，不输出真实值。最终状态只能是 confirmed、needs-review、false-positive、accepted-risk；报告只把 confirmed 纳入已确认漏洞，并为每条 confirmed 输出漏洞类型、调用链、受影响文件、修复建议、未执行的 Request PoC、CVSS 和置信度，同时提供 API 覆盖率和未覆盖入口。不得执行破坏性 payload 或未授权动态验证。',
  }))
  ctx.inject(['systemPrompt'], scope => scope.systemPrompt.section({
    name: 'dsh-security:secret-output', order: 51,
    text: () => '凭据输出规则：如果在授权审计证据中实际获得 key/secret，必须通过 secretValue 原样记录并在报告中显示，同时记录 secretType、secretExposure 和 exploitation。secretValue 只能作为报告证据展示，不得复制进 Request PoC，不得据此扩大授权范围或执行额外请求。',
  }))
}
