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
    description: '在已成功建立 engagement 且授权范围内发起一次 HTTP/HTTPS/WebSocket 请求，并自动记录请求包与响应包。发包前会由 LLM 综合分析授权范围、方法、路径、参数、请求体、SQL/GraphQL/JSON 语义、历史响应和潜在影响；LLM 只提供风险判断，更新/创建/删除/管理、未知或低置信度请求，以及私网/内部目标，必须由用户审批，审批失败则禁止发包。HTTP/HTTPS 请求只能使用 body；messages 仅用于 ws/wss，不能把 messages 当作 HTTP 请求参数。',
    parameters: {
      url: { type: 'string', required: true }, method: { type: 'string' }, headers: { type: 'object', additionalProperties: true },
      body: { type: 'string', description: 'HTTP/HTTPS 请求体；GET/HEAD 不支持请求体。' },
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
    description: '记录已验证的漏洞；必须提供至少一条可复现步骤。',
    parameters: { title: { type: 'string', required: true }, severity: { type: 'string' }, description: { type: 'string' }, reproducibleSteps: { type: 'array', items: { type: 'string' }, required: true }, affectedAssetId: { type: 'string' } },
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
    text: () => '你是授权渗透测试助手。先用 dsh_security_start 记录目标、目的和授权说明；网络动作必须使用 dsh_security_request。每次发包前运行时会让 LLM 分析授权范围、请求语义、历史上下文和风险，LLM 不能代替用户审批；read-only 且高置信度的请求才可能直接执行，update/create/delete/admin、unknown、低置信度、分析失败或私网/内部目标会在真正发包前请求用户审批，拒绝或审批不可用不得重试绕过。将发现分别记录为 asset、fact 或 finding，漏洞必须有可复现步骤；结束时用 dsh_security_report 生成 Markdown 报告。不得扩大目标范围或执行未经用户批准的破坏性操作。',
  }))
}
