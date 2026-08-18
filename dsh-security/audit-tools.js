import { defineTool } from '@deepseek-ai/dsh-tools'
import { assertCodeAuditSession } from './index.js'

export const name = 'dsh-security-code-audit-tools'
export const inject = ['tools', 'dshSecurity']

function render(value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

export function apply(ctx) {
  const runtime = ctx.get('dshSecurity')
  const output = { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => render(value) }
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_start',
    description: '开始一次代码审计运行，建立目标、审计层级和代码图谱状态。新的运行会替换当前会话之前的代码审计清单与报告。',
    parameters: {
      targetPath: { type: 'string', required: true }, auditMode: { type: 'string' }, language: { type: 'string' }, scope: { type: 'string' }, authorization: { type: 'string' }, graphStatus: { type: 'string' },
    },
    output,
    async execute(input, exec) { assertCodeAuditSession(exec, runtime.sessions); return runtime.auditStart(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_update_understanding',
    description: '提交 L0 产品理解基线：产品用途、核心能力、功能边界、运行假设和技术栈。该结果只描述审计上下文，不代表漏洞结论。',
    parameters: {
      runId: { type: 'string' }, productSummary: { type: 'string' }, productPurpose: { type: 'string' }, coreCapabilities: { type: 'array', items: { type: 'string' } }, boundaries: { type: 'array', items: { type: 'string' } }, assumptions: { type: 'array', items: { type: 'string' } }, techStack: { type: 'array', items: { type: 'json' } }, status: { type: 'string' },
    },
    output,
    async execute(input, exec) { assertCodeAuditSession(exec, runtime.sessions); return runtime.auditUpdateUnderstanding(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_add_api',
    description: '将代码提取出的真实入口点/API 加入结构化 API 清单。仅记录入口与候选风险，不代表漏洞已确认。',
    parameters: {
      runId: { type: 'string' }, entryId: { type: 'string', required: true }, entryType: { type: 'string' }, method: { type: 'string' }, path: { type: 'string' }, handler: { type: 'string' }, auth: { type: 'string' }, module: { type: 'string' }, active: { type: 'string' }, featureSummary: { type: 'string' }, sourceCandidates: { type: 'array', items: { type: 'string' } }, sinkCandidates: { type: 'array', items: { type: 'string' } }, riskTags: { type: 'array', items: { type: 'string' } }, targetPaths: { type: 'array', items: { type: 'string' } }, graphHints: { type: 'array', items: { type: 'string' } }, priority: { type: 'string' }, confidence: { type: 'string' },
    },
    output,
    async execute(input, exec) { assertCodeAuditSession(exec, runtime.sessions); return runtime.auditAddApi(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_add_candidate',
    description: '记录一个入口点驱动的代码审计候选。必须保留 Entry、Source、Sink、Chain、Guards、Active 和影响，供 verifier 复核。',
    parameters: {
      runId: { type: 'string' }, candidateId: { type: 'string', required: true }, domain: { type: 'string' }, status: { type: 'string' }, severity: { type: 'string' }, title: { type: 'string' }, entryId: { type: 'string' }, entryType: { type: 'string' }, entry: { type: 'string' }, auth: { type: 'string' }, active: { type: 'string' }, source: { type: 'array', items: { type: 'string' } }, sink: { type: 'array', items: { type: 'string' } }, chain: { type: 'array', items: { type: 'string' } }, guards: { type: 'array', items: { type: 'string' } }, impact: { type: 'string' }, confidence: { type: 'string' }, queueItem: { type: 'string' }, description: { type: 'string' }, remediation: { type: 'string' }, cvss: { type: 'string' }, cvssVector: { type: 'string' },
    },
    output,
    async execute(input, exec) { assertCodeAuditSession(exec, runtime.sessions); return runtime.auditAddCandidate(input, exec) },
  }))
  ctx.tools.register(defineTool({
    name: 'dsh_code_audit_report',
    description: '提交代码审计最终报告。报告同时保存结构化严重度统计、发现摘要、修复优先级和 Markdown 正文。仅 verifier/final pass 应调用。',
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
    text: () => '你是企业级代码安全审计助手。按 L0 baseline → L0.5 planner → 可选 L1.5 code-review-graph → L2 领域队列 worker → L3 verifier → L4 报告执行。先用 dsh_code_audit_start 记录目标和模式，完成 L0 后必须用 dsh_code_audit_update_understanding 提交产品用途、核心能力、功能边界、运行假设和技术栈；发现真实入口后用 dsh_code_audit_add_api 写入 API 清单。风险标签、文本命中、图谱边和 planner 队列只代表候选，不能直接确认漏洞。每个候选必须保留 Entry → Source → Sink → Guards → Active 链，并在 verifier 阶段提供 CVSS:3.1 基础向量；worker 只写候选，最终由 verifier 通过 dsh_code_audit_report 提交结构化报告，报告按 CVSS 分数从高到低排序。深度模式要求 code-review-graph 可用，不能静默降级；不得执行破坏性 payload 或未授权动态验证。',
  }))
}
