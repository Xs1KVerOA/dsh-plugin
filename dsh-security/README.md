# dsh-security

`dsh-security` adds two isolated conversation presets for authorized LLM-assisted penetration testing and static code auditing.

It provides:

- Pentest preset: `dsh_security_request` records bounded HTTP/HTTPS/WebSocket exchanges, while `dsh_security_report` groups Markdown by `domain:port`.
- Code-audit preset: `dsh_code_audit_start`, `dsh_code_audit_update_understanding`, `dsh_code_audit_add_api`, `dsh_code_audit_add_candidate`, `dsh_code_audit_review_candidate`, and `dsh_code_audit_report` store product understanding, the entrypoint/API inventory, evidence-backed candidates, review dispositions, and a structured report.
- The pentest History view becomes an API Inventory view in code-audit sessions. Code-audit reports show product understanding/tech stack first, then CVSS 3.1 severity counts, score-descending findings, remediation priorities, and Markdown.

Pentest tools are mounted only by `pentest`, and code-audit tools only by `code-audit`; ordinary presets do not expose them. The client selects the matching views from the current session or its ancestor chain. Each session header shows the actual mode. Pentest keeps the private-address/DNS/allowlist controls; code audit records product understanding, API inventory, candidates, and a structured report without requiring an external audit workflow. A legacy `security` preset remains as a compatibility entry point.

## Install

From this directory:

```bash
npm install
npm test
npx @deepseek-ai/dsh plugin --profile web add .
```

The bundle automatically registers its read-only preset root. Select `渗透模式` or `代码审计模式` for a new blank session. Existing sessions can only change preset before they have produced output.

## Configuration

Host allowlist matching is disabled by default. The pentest session's “Security policy” view can enable it and edit `allowedHosts` at runtime. `requireAllowlist` is the switch: `true` enables host matching and `false` disables only the allowlist check. Requests to private, localhost, IPv6 loopback/private, or `100.64.0.0/10` targets — including public hostnames resolving there — pause for a `ctx.approval` decision before any network connection. The approval UI offers `允许一次`, `允许本会话`, and `完全允许`; the last option is remembered for the current DSH runtime only.

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
```

For an isolated, authorized test environment where host matching is intentionally disabled:

```yaml
- id: dsh-security
  name: dsh-security
  config:
    requireAllowlist: false
    allowPrivateTargets: false
```

Profile configuration supplies the startup value; UI saves apply to the current running instance. Disabling the allowlist does not bypass DNS rebinding checks or approval for private/internal targets. The legacy `allowPrivateTargets` field is retained for compatibility only and no longer bypasses approval. Reload or restart DSH after changing the profile.

Structured records and request history are stored in the `security` storage domain and routed to `$DSH_HOME/storages/security-sessions.db` through the bundled SQLite backend. Request bodies, WebSocket messages, API inventory, and accumulated reports are bounded; the UI loads history, inventory, and reports in pages. CVSS uses the CVSS:3.1 base vector (AV/AC/PR/UI/S/C/I/A); candidates without a valid vector remain unscored. Clear them from the corresponding view or start a new run with `dsh_security_start` or `dsh_code_audit_start`.
