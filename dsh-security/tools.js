import { defineTool } from '@deepseek-ai/dsh-tools'
import { assertPentestSession } from './index.js'

export const name = 'dsh-security-tools'
export const inject = ['tools', 'dshSecurity', 'approval']

function render(value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

export function apply(ctx) {
  const runtime = ctx.get('dshSecurity')
  const output = { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => render(value) }
  ctx.tools.register(defineTool({
    name: 'dsh_security_request',
    description: '在已成功建立 engagement 且授权范围内发起一次 HTTP/HTTPS/WebSocket 请求，并自动记录请求包、响应包、探测阶段和稳定请求指纹。发包前会由 LLM 综合分析授权范围、方法、路径、参数、请求体、SQL/GraphQL/JSON 语义、历史响应和潜在影响；LLM 只提供风险判断，更新/创建/删除/管理、未知或低置信度请求，以及私网/内部目标，必须由用户审批，审批失败则禁止发包。probePhase 用于标记 engagement/reconnaissance/discovery/authentication/authorization/input-validation/exploitation/verification/cleanup；HTTP/HTTPS 请求只能使用 body；messages 仅用于 ws/wss，不能把 messages 当作 HTTP 请求参数。',
    parameters: {
      url: { type: 'string', required: true }, method: { type: 'string' }, headers: { type: 'object', additionalProperties: true },
      body: { type: 'string', description: 'HTTP/HTTPS 请求体；GET/HEAD 不支持请求体。' },
      probePhase: { type: 'string', description: '本次请求所属探测阶段；默认 reconnaissance。' },
      messages: { type: 'array', items: { type: 'json' }, description: '仅用于 ws/wss 的消息数组；HTTP/HTTPS 必须使用 body。' }, timeoutMs: { type: 'number' }, waitMs: { type: 'number' },
    },
    output,
    async execute(input, exec) { assertPentestSession(exec, runtime.sessions); return runtime.request(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_security_start',
    description: '开始或重置一次安全测试 engagement，记录目标、目的和授权说明。',
    parameters: { target: { type: 'string', required: true }, objective: { type: 'string', required: true }, authorization: { type: 'string', required: true } },
    output,
    async execute(input, exec) { return runtime.start(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_security_add_asset',
    description: '记录目标资产，可用 parentId 建立域名、IP、服务和端点的父子关系。',
    parameters: { type: { type: 'string', required: true }, value: { type: 'string', required: true }, parentId: { type: 'string' }, meta: { type: 'string' } },
    output,
    async execute(input, exec) { return runtime.addAsset(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_security_add_fact',
    description: '记录可验证的安全测试事实，区分事实与漏洞结论。',
    parameters: { kind: { type: 'string' }, target: { type: 'string' }, detail: { type: 'string', required: true }, confidence: { type: 'number' } },
    output,
    async execute(input, exec) { return runtime.addFact(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_security_add_finding',
    description: '仅记录真实有效且有实际危害的已确认漏洞。必须提供单一漏洞类型、证据位置、真实影响、high/medium 置信度、有效 CVSS:3.1 向量和未执行的 HTTP/1.x Request PoC；severity 由 CVSS 计算，不能用文字覆盖。PoC 只能使用占位符和非破坏性请求，不能放入真实 key/secret。若发现凭据暴露，另填 secretType、secretExposure、secretValue 和 exploitation：secretValue 用于在报告中显示实际获得的 key/secret，原样保存，不得复制进 PoC；exploitation 只说明非破坏性利用方式、影响验证及轮换建议。',
    parameters: { title: { type: 'string', required: true }, vulnerabilityType: { type: 'string', required: true, description: '单一漏洞类型，例如 sql-injection、rce、idor、file-read、secret-exposure。' }, severity: { type: 'string', description: '兼容字段；最终由 CVSS 3.1 计算。' }, description: { type: 'string', required: true }, evidence: { type: 'array', items: { type: 'string' }, required: true }, impact: { type: 'string', required: true }, requestPoc: { type: 'string', required: true, description: 'HTTP/1.x 原始请求格式，使用占位符，未执行；不得包含真实 key/secret。' }, cvssVector: { type: 'string', required: true }, confidence: { type: 'string', required: true, description: 'high 或 medium。' }, reproducibleSteps: { type: 'array', items: { type: 'string' }, required: true }, secretType: { type: 'string' }, secretExposure: { type: 'string' }, secretValue: { type: 'string', description: '实际获得的 key/secret 原始值，仅显示在报告的凭据区域，不要复制到 Request PoC。' }, exploitation: { type: 'string' }, affectedAssetId: { type: 'string' } },
    output,
    async execute(input, exec) { return runtime.addFinding(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_security_report',
    description: '按域名:端口合并并追加一段 Markdown 渗透测试报告。',
    parameters: { target: { type: 'string', required: true }, title: { type: 'string', required: true }, markdown: { type: 'string', required: true } },
    output,
    async execute(input, exec) { return runtime.report(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_security_state',
    description: '读取当前安全测试的目标、资产、事实、漏洞、请求历史和报告摘要。',
    parameters: {}, output,
    async execute(_input, exec) { assertPentestSession(exec, runtime.sessions); return runtime.stateSummary(exec.sessionId || exec.agent?.session?.id) },
  }))
  ctx.inject(['systemPrompt'], scope => scope.systemPrompt.section({
    name: 'dsh-security:protocol', order: 50,
    text: () => '你是授权渗透测试助手。先用 dsh_security_start 记录目标、目的和授权说明；网络动作必须使用 dsh_security_request。每次发包前运行时会让 LLM 分析授权范围、请求语义、历史上下文和风险，LLM 不能代替用户审批；read-only 且高置信度的请求才可能直接执行，update/create/delete/admin、unknown、低置信度、分析失败或私网/内部目标会在真正发包前请求用户审批，拒绝或审批不可用不得重试绕过。只有真实有效、具有明确危害和证据链的漏洞才能调用 dsh_security_add_finding：必须拆成单一漏洞类型，提供证据位置、真实影响、high/medium 置信度、有效 CVSS:3.1 向量和未执行的 HTTP/1.x Request PoC；没有这些条件就记录为 fact，不得伪装成漏洞。Request PoC 只用占位符和非破坏性请求，不得执行 SQL 注入、RCE、删除/写入或其他破坏性 payload，也不能包含真实 key/secret。若发现 key/secret，使用 secretValue 保存实际获得的原始值供报告展示，同时记录 secretType、secretExposure、exploitation；secretValue 不得复制进 PoC，也不要在无授权范围的后续请求中使用。结束时用 dsh_security_report 生成 Markdown 报告。不得扩大目标范围或执行未经用户批准的破坏性操作。',
  }))
}
