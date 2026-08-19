# dsh-security

`dsh-security` 为 DSH 增加两个隔离的 LLM 辅助安全模式：渗透模式和代码审计模式。

功能包括：

- 渗透模式：`dsh_security_request` 发起受限的 HTTP/HTTPS/WebSocket 请求并记录请求包、响应包；`dsh_security_report` 按 `域名:端口` 合并报告。
- 每次请求发出前，运行时会让当前会话的 LLM 综合判断授权范围、HTTP 方法/路径/参数/请求体/Content-Type、SQL/GraphQL/JSON 语义、历史响应和潜在影响。只有高置信度、无影响的 `read` 请求可以直接执行；创建、更新、删除、管理、未知、低置信度、分析失败和受保护目标必须由用户审批。
- 审批范围不会只按域名缓存：`允许一次` 只作用于当前请求指纹；`允许本会话` 绑定目标、方法、路径模式和风险类型；`完全允许` 也只覆盖该明确范围，不会默认放行所有破坏性请求。LLM 只能提出风险判断，不能代替用户批准；审批拒绝或通道不可用时禁止发包。
- 代码审计模式：`dsh_code_audit_start` 建立审计运行，`dsh_code_audit_update_understanding` 记录产品用途、核心能力、功能边界、运行假设和技术栈，`dsh_code_audit_add_api` 记录代码提取的入口/API，`dsh_code_audit_add_candidate` 要求关联已有 API 并记录入口、Source、Sink、影响和证据位置，`dsh_code_audit_review_candidate` 复核候选状态，`dsh_code_audit_report` 提交结构化报告。最终报告只统计 confirmed，needs-review 和 false-positive 分区展示，并包含 API 覆盖率与未覆盖入口。
- 渗透模式支持输入 `@` 引用代码审计模式的会话或审计报告。候选只展示代码审计来源；发送时按来源会话和报告 ID 重新校验，并以有界的只读审计资料注入当前提示词，普通模式和代码审计模式不能使用该引用。
- 渗透模式的“历史记录”在代码审计模式中变为“API 清单”；报告页先展示产品理解和技术栈，再按 CVSS 3.1 分数降序展示漏洞、严重性统计、修复优先级和 Markdown 正文。

渗透工具只挂载到 `pentest` preset，代码审计工具只挂载到 `code-audit` preset，普通模式不会暴露这些工具。客户端根据当前会话或祖先会话动态显示对应栏目；每个会话页头会显示实际模式。渗透模式默认不要求主机白名单；当目标本身或 DNS 解析结果属于私网、localhost、IPv6 回环/私网或 `100.64.0.0/10` 共享地址段时，工具会先通过 `ctx.approval` 发起一次性用户审批，审批通过后才建立网络连接。代码审计模式只负责收集产品理解、API 清单、审计候选和结构化报告，不依赖额外图谱或外部审计编排。

## 安装

在本目录执行：

```bash
npm install
npm test
npx @deepseek-ai/dsh plugin --profile web add .
```

插件会自动注册随包提供的只读 preset 根目录。新建空白会话后，在模式下拉框选择“渗透模式”或“代码审计模式”。已经产生输出的会话不能切换 preset。旧 `security` preset 仍保留为兼容入口，新会话请使用 `pentest`。渗透模式默认执行 DNS rebinding 检查；命中受保护地址的请求需要一次性用户审批。目标主机白名单可在“安全策略”入口中开启并编辑。

## 配置授权范围

默认不启用主机白名单匹配；渗透会话中的“安全策略”入口可以实时开启白名单并编辑 `allowedHosts`。`requireAllowlist` 设为 `true` 启用，设为 `false` 关闭白名单匹配；私网/内部地址请求改为先等待一次性用户审批，DNS 解析校验始终保留：

```yaml
- id: dsh-security
  name: dsh-security
  config:
    allowedHosts:
      - example.com
      - '*.authorized.example'
    requireAllowlist: true
    allowPrivateTargets: false
    dnsLookupTimeoutMs: 10000
    maxPacketBytes: 262144
    maxReportBytes: 262144
    maxReferenceBytes: 131072
    maxReferenceCandidates: 100
```

也可以在 profile 中显式关闭白名单：

```yaml
- id: dsh-security
  name: dsh-security
  config:
    requireAllowlist: false
    allowPrivateTargets: false
```

profile 配置决定启动时的初始值；UI 保存的策略作用于当前运行实例。关闭白名单不会关闭 DNS rebinding 检查，也不会绕过私网/内部地址的用户审批。旧配置中的 `allowPrivateTargets` 字段仅为兼容保留，不再直接放行请求。

结构化记录和请求历史保存在 `security` storage domain，并通过随包 SQLite backend 写入 `$DSH_HOME/storages/security-sessions.db`。请求体、WebSocket 消息和累计报告均受大小上限保护；历史记录、API 清单和报告在 UI 中分页加载。CVSS 向量使用 CVSS:3.1 基础指标（AV/AC/PR/UI/S/C/I/A），无有效向量的候选保留为未评分，不会伪造分数。可以在对应标签清空，或用 `dsh_security_start` / `dsh_code_audit_start` 开始新的运行。
