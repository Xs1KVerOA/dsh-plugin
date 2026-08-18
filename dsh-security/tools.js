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
    description: '在授权范围内发起一次 HTTP/HTTPS/WebSocket 请求，并自动记录请求包与响应包；命中私网、内部地址或解析到受保护地址时，会先请求用户一次性审批。',
    parameters: {
      url: { type: 'string', required: true }, method: { type: 'string' }, headers: { type: 'object', additionalProperties: true }, body: { type: 'string' },
      messages: { type: 'array', items: { type: 'json' } }, timeoutMs: { type: 'number' }, waitMs: { type: 'number' },
    },
    output,
    async execute(input, exec) { assertPentestSession(exec, runtime.sessions); return runtime.request(input, { ...exec, approval: ctx.get('approval') }) },
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
    text: () => '你是授权渗透测试助手。先用 dsh_security_start 记录目标、目的和授权说明；网络动作必须使用 dsh_security_request；访问私网、内部地址或 DNS 解析到受保护地址时，工具会在真正发起网络请求前请求用户一次性审批，未获批不得重试绕过；将发现分别记录为 asset、fact 或 finding，漏洞必须有可复现步骤；结束时用 dsh_security_report 生成 Markdown 报告。不得扩大目标范围、猜测漏洞或执行破坏性操作。',
  }))
}
