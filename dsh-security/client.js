(function registerDshSecurity(global) {
  const loader = global.__ModuleLoader__
  if (!loader || typeof loader.load !== 'function') throw new Error('dsh-security: client module loader is unavailable')

  loader.load({
    id: 'dsh-security',
    factory(require) {
      const React = require('react')
      const h = React.createElement
      const MarkdownText = require('@deepseek-ai/dsh-client-ui-primitives').MarkdownText

      const CSS = `
.dsec-view{display:flex;flex-direction:column;width:100%;max-width:100%;min-width:0;min-height:0;overflow:hidden;color:var(--dsw-alias-label-primary,#25282d);font-size:12px;background:var(--dsw-alias-bg-layer-1,#fff)}
.dsec-view *{box-sizing:border-box;min-width:0}.dsec-head{display:flex;align-items:center;gap:8px;width:100%;min-width:0;padding:11px 14px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb);flex:0 0 auto;flex-wrap:wrap}.dsec-title{font-weight:650;min-width:0;flex:1 1 140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsec-meta{min-width:0;color:var(--dsw-alias-label-tertiary,#969da7);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsec-body{display:flex;width:100%;max-width:100%;min-width:0;min-height:0;overflow:auto;overflow-x:hidden;flex:1;flex-direction:column;gap:9px;padding:12px 14px}.dsec-btn{flex:0 0 auto;border:1px solid var(--dsw-alias-border-l2,#d8dce2);border-radius:6px;padding:5px 9px;background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;cursor:pointer;font:inherit;font-size:11px}.dsec-btn:hover{background:var(--dsw-alias-bg-layer-2,#f1f3f6)}.dsec-btn:disabled{opacity:.5;cursor:default}.dsec-warning,.dsec-error{max-width:100%;padding:9px 10px;border-radius:6px;line-height:1.5;overflow-wrap:anywhere}.dsec-warning{background:#fff8e6;color:#8a621c}.dsec-error{background:#fff0f0;color:#bd4747}.dsec-list{display:flex;flex-direction:column;gap:5px;width:100%;max-width:100%;min-height:0;overflow:auto;overflow-x:hidden}.dsec-flow{display:grid;width:100%;max-width:100%;min-width:0;grid-template-columns:48px 54px minmax(0,1fr) auto;gap:7px;align-items:center;text-align:left;padding:7px 8px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:6px;background:transparent;color:inherit;cursor:pointer;font:inherit}.dsec-flow:hover,.dsec-flow.active{background:var(--dsw-alias-bg-layer-2,#f1f3f6)}.dsec-flow-url{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsec-flow-meta{min-width:72px;text-align:right;color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px;white-space:nowrap}.dsec-pass{color:#32864b}.dsec-fail{color:#c04b4b}.dsec-detail{display:grid;width:100%;max-width:100%;min-width:0;grid-template-columns:minmax(0,1fr);gap:9px}.dsec-card{min-width:0;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:6px;overflow:hidden}.dsec-card-title{padding:7px 9px;background:var(--dsw-alias-bg-layer-2,#f5f6f8);font-weight:600}.dsec-pre{width:100%;max-width:100%;margin:0;padding:9px;max-height:290px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.dsec-report{width:100%;max-width:100%;min-width:0;padding:2px 0 14px;overflow-wrap:anywhere}.dsec-report-head{display:flex;align-items:center;gap:8px;min-width:0}.dsec-report-title{font-weight:650;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsec-markdown{width:100%;max-width:100%;min-width:0;padding-top:6px;overflow-wrap:anywhere}.dsec-markdown :where(pre,table){display:block;max-width:100%;overflow:auto}.dsec-markdown :where(img,video){max-width:100%;height:auto}.dsec-markdown :where(code,a){overflow-wrap:anywhere}.dsec-report-list{width:100%;max-width:100%;min-width:0}.dsec-empty{max-width:100%;color:var(--dsw-alias-label-tertiary,#969da7);overflow-wrap:anywhere}
@media (min-width:800px){.dsec-detail{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.dsec-body{overflow:hidden}.dsec-report-list{overflow:auto}}.dsec-mode{display:inline-flex;align-items:center;gap:5px;max-width:280px;padding:3px 8px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:999px;color:var(--dsw-alias-label-secondary,#5f6670);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dsec-mode-pentest{border-color:#f0c36a;background:#fff8e6;color:#8a621c}.dsec-mode-audit{border-color:#a9c7f4;background:#f1f6ff;color:#275c9e}.dsec-mode-standard{background:var(--dsw-alias-bg-layer-2,#f5f6f8)}.dsec-mode-name{overflow:hidden;text-overflow:ellipsis}.dsec-mode-policy{color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px}
@media (max-width:560px){.dsec-head{align-items:flex-start}.dsec-title{flex-basis:calc(100% - 92px)}.dsec-meta{order:3;flex:1 1 100%;white-space:normal}.dsec-flow{grid-template-columns:42px 48px minmax(0,1fr)}.dsec-flow-meta{grid-column:2 / -1;min-width:0;text-align:left}}.dsec-api-grid{display:grid;grid-template-columns:108px minmax(160px,1fr) minmax(150px,1fr) 80px 100px;min-width:680px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:6px;overflow:auto}.dsec-api-cell{padding:8px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsec-api-head{background:var(--dsw-alias-bg-layer-2,#f5f6f8);font-weight:600}.dsec-api-row{display:contents}.dsec-api-row:last-child .dsec-api-cell{border-bottom:0}.dsec-api-button{width:100%;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}.dsec-api-button:hover{background:var(--dsw-alias-bg-layer-2,#f5f6f8)}.dsec-tags{display:flex;flex-wrap:wrap;gap:4px}.dsec-tag{padding:2px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2,#f1f3f6);font-size:10px}.dsec-summary{display:flex;flex-wrap:wrap;gap:6px}.dsec-summary-card{min-width:78px;padding:8px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#fff)}.dsec-summary-number{display:block;font-size:16px;font-weight:650}.dsec-summary-label{color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px}.dsec-finding{padding:9px 0;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb)}.dsec-finding:last-child{border-bottom:0}.dsec-finding-title{font-weight:650}.dsec-finding-meta{color:var(--dsw-alias-label-tertiary,#969da7);font-size:11px}.dsec-code-report{display:flex;flex-direction:column;gap:10px}
 .dsec-understanding{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid #cfe1f5;border-radius:10px;background:linear-gradient(135deg,#fbfdff,#f4f9ff)}.dsec-eyebrow{color:#1769c2;font-size:10px;font-weight:700;letter-spacing:.16em}.dsec-section-title{font-size:16px;font-weight:700}.dsec-section-subtitle{color:#6f87a2;line-height:1.5}.dsec-understanding-summary{padding:9px 10px;border-radius:7px;background:#eef7ff;color:#496783;line-height:1.55}.dsec-understanding-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.dsec-understanding-card{min-width:0;padding:10px;border:1px solid #d5e4f3;border-radius:7px;background:rgba(255,255,255,.8)}.dsec-understanding-card-title{font-weight:650;margin-bottom:6px;color:#2d587e}.dsec-understanding-list{margin:0;padding-left:17px;color:#526b84;line-height:1.55}.dsec-understanding-list li{overflow-wrap:anywhere}.dsec-stack{padding-top:4px}.dsec-stack-title{font-weight:650;margin-bottom:7px}.dsec-stack-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.dsec-stack-card{min-width:0;border:1px solid #d5e4f3;border-top:3px solid #4d9ce8;border-radius:7px;background:#fff;overflow:hidden}.dsec-stack-card-title{padding:8px 9px;font-weight:650;background:#f4f9ff}.dsec-stack-row{display:grid;grid-template-columns:minmax(72px,.7fr) minmax(0,1.3fr);gap:8px;padding:7px 9px;border-top:1px solid #e7eef6;color:#526b84}.dsec-stack-row span:first-child{color:#89a0b7}.dsec-stack-row span:last-child{overflow-wrap:anywhere}@media (max-width:800px){.dsec-understanding-grid,.dsec-stack-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:560px){.dsec-understanding-grid,.dsec-stack-grid{grid-template-columns:minmax(0,1fr)}}
 .dsec-api-scroll{width:100%;max-width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}.dsec-api-grid{overflow:hidden}
.dsec-policy-form{display:flex;flex-direction:column;gap:10px;max-width:720px}.dsec-checkbox-row{display:flex;align-items:center;gap:7px;font-weight:600}.dsec-policy-note{color:var(--dsw-alias-label-tertiary,#969da7);line-height:1.5}.dsec-policy-textarea{min-height:130px;width:100%;resize:vertical;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.dsec-policy-actions{display:flex;align-items:center;gap:8px}.dsec-policy-status{color:#32864b;font-size:11px}
`

      function installStyle() {
        if (typeof document === 'undefined' || document.querySelector('style[data-plugin="dsh-security"]')) return () => {}
        const style = document.createElement('style')
        style.dataset.plugin = 'dsh-security'
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }

      let apiToken = global.__DSH_SECURITY_API_TOKEN__ || ''
      let apiTokenPromise
      async function ensureApiToken() {
        if (apiToken) return apiToken
        apiTokenPromise ||= fetch('/api/dsh-security/bootstrap', { credentials: 'same-origin' }).then(async response => {
          const result = await response.json().catch(() => ({}))
          if (!response.ok || !result.token) throw new Error(result.error || `安全 API 初始化失败 (${response.status})`)
          apiToken = result.token
          return apiToken
        }).finally(() => { apiTokenPromise = undefined })
        return apiTokenPromise
      }
      async function api(path, options, retried = false) {
        const token = await ensureApiToken()
        const sessionId = new URLSearchParams(String(path).split('?')[1] || '').get('sessionId')
        const response = await fetch('/api/dsh-security/' + path.replace(/^\//, ''), {
          ...options,
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json', 'x-dsh-security-token': token, ...(sessionId ? { 'x-dsh-security-session-id': sessionId } : {}), ...(options && options.headers) },
        })
        const result = await response.json().catch(() => ({}))
        if (response.status === 403 && !retried && apiToken === token) {
          apiToken = ''
          return api(path, options, true)
        }
        if (!response.ok || result.ok === false) throw new Error(result.error || `请求失败 (${response.status})`)
        return result
      }

      function rowPreset(row) {
        return row?.agentPreset || row?.header?.agentPreset || row?.preset || row?.mode?.preset || row?.agent?.session?.header?.agentPreset
      }

      function isSecuritySessionSnapshot(snapshot, id) {
        return Boolean(sessionModeSnapshot(snapshot, id))
      }

      function sessionModeSnapshot(snapshot, id) {
        let cursor = id
        const seen = new Set()
        while (cursor !== undefined && !seen.has(cursor)) {
          seen.add(cursor)
          const row = snapshot?.byId?.[cursor]
          const preset = rowPreset(row)
          if (preset === 'code-audit') return 'code-audit'
          if (preset === 'pentest' || preset === 'security') return 'pentest'
          cursor = row?.parentId
        }
        return undefined
      }

      function sessionPreset(snapshot, id) {
        let cursor = id
        const seen = new Set()
        while (cursor !== undefined && !seen.has(cursor)) {
          seen.add(cursor)
          const row = snapshot?.byId?.[cursor]
          const preset = rowPreset(row)
          if (preset) return preset
          cursor = row?.parentId
        }
        return undefined
      }

      function presetLabel(preset) {
        if (preset === 'security' || preset === 'pentest') return '渗透模式'
        if (preset === 'code-audit') return '代码审计模式'
        if (preset === 'standard') return '标准模式'
        if (preset === 'code') return 'PTC 模式'
        if (preset === 'minimal') return '极简模式'
        return preset || '未记录'
      }

      function createSecurityReferenceSource() {
        function decodeReference(raw) {
          try {
            const value = JSON.parse(String(raw || ''))
            if (!value || !['session', 'report'].includes(value.kind) || typeof value.sessionId !== 'string') return undefined
            if (value.kind === 'report' && typeof value.reportId !== 'string') return undefined
            return value
          } catch { return undefined }
        }
        return {
          trigger: '@',
          name: '安全审计',
          order: 1,
          async candidates(session, request) {
            const result = await api(`reference/candidates?sessionId=${encodeURIComponent(session.sessionId)}&query=${encodeURIComponent(request.query)}&limit=100`, { signal: request.signal })
            if (request.signal.aborted) return []
            return (result.candidates || []).map(candidate => ({
              name: String(candidate.name || candidate.sessionId || '未命名审计资料'),
              description: String(candidate.description || ''),
              hint: String(candidate.ref || ''),
            }))
          },
          onPick({ candidate }) {
            const ref = decodeReference(candidate.hint)
            if (!ref) return undefined
            return { insert: { source: 'dsh-security-audit', ref: candidate.hint, label: candidate.name, clipboardText: `@${candidate.name}` } }
          },
          codec: {
            clipboardText(ref) {
              const value = decodeReference(ref)
              return value ? `@${value.kind === 'report' ? '报告' : '代码审计会话'}` : '@安全审计资料'
            },
            async serialize(ref, signal) {
              const value = decodeReference(ref)
              if (!value) throw new Error('安全引用内容已失效，请重新选择 @ 安全审计资料')
              const params = new URLSearchParams({ sessionId: value.sessionId, sourceSessionId: value.sessionId, kind: value.kind })
              if (value.reportId) params.set('reportId', value.reportId)
              const result = await api(`reference/content?${params.toString()}`, { signal })
              return String(result.text || '')
            },
          },
        }
      }

      function SessionModeBadge(props) {
        const snapshot = typeof props.useSessions === 'function' ? props.useSessions(state => state) : undefined
        const preset = sessionPreset(snapshot, props.sessionId)
        const mode = preset === 'code-audit' ? 'code-audit' : ['pentest', 'security'].includes(preset) ? 'pentest' : undefined
        return h('span', {
          className: `dsec-mode ${mode === 'pentest' ? 'dsec-mode-pentest' : mode === 'code-audit' ? 'dsec-mode-audit' : 'dsec-mode-standard'}`,
          title: `会话模式：${presetLabel(preset)}`,
        }, h('span', { className: 'dsec-mode-name' }, `会话模式：${presetLabel(preset)}`))
      }

      function SecurityOnly(props) {
        return h('div', { className: 'dsec-warning' }, '该标签仅在渗透模式或代码审计模式会话中可用。')
      }

      function SecurityPolicyView(props) {
        const [policy, setPolicy] = React.useState({ requireAllowlist: false, allowedHosts: [] })
        const [hostsText, setHostsText] = React.useState('')
        const [loading, setLoading] = React.useState(true)
        const [saving, setSaving] = React.useState(false)
        const [error, setError] = React.useState('')
        const [saved, setSaved] = React.useState(false)
        const load = React.useCallback(async () => {
          setLoading(true)
          try {
            const result = await api(`config?sessionId=${encodeURIComponent(props.sessionId)}`)
            setPolicy({ requireAllowlist: result.requireAllowlist === true, allowedHosts: result.allowedHosts || [] })
            setHostsText((result.allowedHosts || []).join('\n'))
            setError('')
          } catch (cause) { setError(cause?.message || String(cause)) } finally { setLoading(false) }
        }, [props.sessionId])
        React.useEffect(() => { load() }, [load])
        const save = async () => {
          if (saving) return
          setSaving(true); setSaved(false)
          try {
            const allowedHosts = hostsText.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean)
            const result = await api(`config?sessionId=${encodeURIComponent(props.sessionId)}`, { method: 'POST', body: JSON.stringify({ requireAllowlist: policy.requireAllowlist, allowedHosts }) })
            setPolicy({ requireAllowlist: result.requireAllowlist === true, allowedHosts: result.allowedHosts || [] })
            setHostsText((result.allowedHosts || []).join('\n'))
            setError(''); setSaved(true)
          } catch (cause) { setError(cause?.message || String(cause)) } finally { setSaving(false) }
        }
        return h('section', { className: 'dsec-view' },
          h('header', { className: 'dsec-head' }, h('span', { className: 'dsec-title' }, '安全策略'), h('span', { className: 'dsec-meta' }, '当前运行实例'), h('button', { className: 'dsec-btn', onClick: load, disabled: loading || saving }, '刷新')),
          h('div', { className: 'dsec-body' },
            error ? h('div', { className: 'dsec-error', role: 'alert' }, error) : null,
            h('div', { className: 'dsec-policy-form' },
              h('label', { className: 'dsec-checkbox-row' }, h('input', { type: 'checkbox', checked: policy.requireAllowlist, disabled: loading || saving, onChange: event => { setPolicy(current => ({ ...current, requireAllowlist: event.target.checked })); setSaved(false) } }), '启用目标主机白名单'),
              h('div', { className: 'dsec-policy-note' }, '开启后，仅允许下方主机名匹配的目标。访问私网、localhost 或 DNS 解析到内部地址时，会在真正发起请求前提交一次性用户审批；每行一个主机名，也支持逗号分隔。'),
              h('textarea', { className: 'dsec-policy-textarea', value: hostsText, disabled: loading || saving, onChange: event => { setHostsText(event.target.value); setSaved(false) }, placeholder: 'example.com\n*.authorized.example' }),
              h('div', { className: 'dsec-policy-actions' }, h('button', { className: 'dsec-btn', onClick: save, disabled: loading || saving }, saving ? '保存中…' : '保存策略'), saved ? h('span', { className: 'dsec-policy-status' }, '已保存') : null),
            ),
          ),
        )
      }

      function RequestDetail(props) {
        if (!props.flow) return h('div', { className: 'dsec-empty' }, '选择一条记录查看请求包和响应包。')
        return h('div', { className: 'dsec-detail' },
          h('section', { className: 'dsec-card' }, h('div', { className: 'dsec-card-title' }, '请求包'), h('pre', { className: 'dsec-pre' }, props.flow.requestPacket || '')),
          h('section', { className: 'dsec-card' }, h('div', { className: 'dsec-card-title' }, '响应包'), h('pre', { className: 'dsec-pre' }, props.flow.responsePacket || props.flow.error || '无响应包')),
        )
      }

      function mergeRows(incoming, previous, key = 'id') {
        const rows = [...incoming, ...previous]
        const seen = new Set()
        return rows.filter(row => {
          const value = row?.[key]
          if (seen.has(value)) return false
          seen.add(value)
          return true
        })
      }

      function SecurityHistoryView(props) {
        // The slot is registered only after the server-side ancestor check succeeds.
        // Do not depend on optional client snapshot metadata here.
        const security = true
        const [history, setHistory] = React.useState([])
        const [selected, setSelected] = React.useState(null)
        const [error, setError] = React.useState('')
        const [hasMore, setHasMore] = React.useState(false)
        const [nextCursor, setNextCursor] = React.useState(null)
        const [loading, setLoading] = React.useState(false)
        const loadedMore = React.useRef(false)
        const requestInFlight = React.useRef(false)
        const requestGeneration = React.useRef(0)
        const refresh = React.useCallback(async () => {
          if (!security || requestInFlight.current) return
          const generation = ++requestGeneration.current
          requestInFlight.current = true
          setLoading(true)
          try {
            const result = await api(`history?sessionId=${encodeURIComponent(props.sessionId)}&limit=100`)
            if (generation !== requestGeneration.current) return
            setHistory(previous => loadedMore.current ? mergeRows(result.history || [], previous) : (result.history || []))
            setHasMore(Boolean(result.hasMore))
            setNextCursor(result.nextCursor || null)
            setError('')
          } catch (cause) { if (generation === requestGeneration.current) setError(cause?.message || String(cause)) } finally { if (generation === requestGeneration.current) { requestInFlight.current = false; setLoading(false) } }
        }, [security, props.sessionId])
        React.useEffect(() => {
          requestGeneration.current += 1
          requestInFlight.current = false
          loadedMore.current = false
          setHistory([]); setSelected(null); setHasMore(false); setNextCursor(null); setError('')
          void refresh()
          if (!security) return undefined
          const timer = window.setInterval(refresh, 1500)
          return () => { window.clearInterval(timer); requestGeneration.current += 1; requestInFlight.current = false }
        }, [refresh, security])
        const loadMore = async () => {
          if (!security || requestInFlight.current || loading || !hasMore) return
          requestInFlight.current = true
          setLoading(true)
          const generation = requestGeneration.current
          try {
            const result = await api(`history?sessionId=${encodeURIComponent(props.sessionId)}&limit=100${nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : ''}`)
            if (generation !== requestGeneration.current) return
            setHistory(previous => mergeRows(previous, result.history || []))
            setHasMore(Boolean(result.hasMore))
            setNextCursor(result.nextCursor || null)
            loadedMore.current = true
          } catch (cause) { if (requestGeneration.current === generation) setError(cause?.message || String(cause)) } finally { if (requestGeneration.current === generation) { requestInFlight.current = false; setLoading(false) } }
        }
        const clear = async () => {
          if (typeof window !== 'undefined' && !window.confirm('确定清空当前安全会话的全部请求历史、结构化记录和报告吗？此操作不可撤销。')) return
          try { await api(`clear?sessionId=${encodeURIComponent(props.sessionId)}`, { method: 'POST', body: '{}' }); setSelected(null); setHistory([]); setHasMore(false); setNextCursor(null); loadedMore.current = false; await refresh() } catch (cause) { setError(cause?.message || String(cause)) }
        }
        if (!security) return h('section', { className: 'dsec-view' }, h('header', { className: 'dsec-head' }, h('span', { className: 'dsec-title' }, '历史记录')), h('div', { className: 'dsec-body' }, h(SecurityOnly)))
        return h('section', { className: 'dsec-view' },
          h('header', { className: 'dsec-head' }, h('span', { className: 'dsec-title' }, '请求历史'), h('span', { className: 'dsec-meta' }, `${history.length} 条 · HTTP / HTTPS / WebSocket`), h('button', { className: 'dsec-btn', onClick: refresh }, '刷新'), h('button', { className: 'dsec-btn', onClick: clear, disabled: loading }, '清空')),
          h('div', { className: 'dsec-body' },
            error ? h('div', { className: 'dsec-error' }, error) : null,
            h('div', { className: 'dsec-list' }, history.length ? history.map(flow => h('button', { key: flow.id, className: 'dsec-flow' + (selected?.id === flow.id ? ' active' : ''), onClick: () => setSelected(flow) }, h('span', null, flow.protocol.toUpperCase()), h('span', { className: flow.status >= 400 || flow.error || flow.response?.truncated ? 'dsec-fail' : 'dsec-pass' }, flow.response?.truncated ? '截断' : (flow.status || 'ERR')), h('span', { className: 'dsec-flow-url', title: flow.target }, flow.target), h('span', { className: 'dsec-flow-meta' }, `${flow.durationMs || 0} ms`))) : h('div', { className: 'dsec-empty' }, '尚未记录渗透模式发起的请求。')),
            hasMore ? h('button', { className: 'dsec-btn', onClick: loadMore, disabled: loading }, loading ? '加载中…' : '加载更早记录') : null,
            h(RequestDetail, { flow: selected }),
          ),
        )
      }

      function SecurityReportsView(props) {
        // The slot is registered only after the server-side ancestor check succeeds.
        const security = true
        const [reports, setReports] = React.useState([])
        const [error, setError] = React.useState('')
        const [hasMore, setHasMore] = React.useState(false)
        const [nextCursor, setNextCursor] = React.useState(null)
        const [loading, setLoading] = React.useState(false)
        const loadedMore = React.useRef(false)
        const requestInFlight = React.useRef(false)
        const requestGeneration = React.useRef(0)
        const refresh = React.useCallback(async () => {
          if (!security || requestInFlight.current) return
          const generation = ++requestGeneration.current
          requestInFlight.current = true
          setLoading(true)
          try { const result = await api(`reports?sessionId=${encodeURIComponent(props.sessionId)}&limit=50`); if (generation !== requestGeneration.current) return; setReports(previous => loadedMore.current ? mergeRows(result.reports || [], previous, 'key') : (result.reports || [])); setHasMore(Boolean(result.hasMore)); setNextCursor(result.nextCursor || null); setError('') } catch (cause) { if (generation === requestGeneration.current) setError(cause?.message || String(cause)) } finally { if (generation === requestGeneration.current) { requestInFlight.current = false; setLoading(false) } }
        }, [security, props.sessionId])
        React.useEffect(() => {
          requestGeneration.current += 1; requestInFlight.current = false; loadedMore.current = false
          setReports([]); setHasMore(false); setNextCursor(null); setError('')
          void refresh()
          if (!security) return undefined
          const timer = window.setInterval(refresh, 1800)
          return () => { window.clearInterval(timer); requestGeneration.current += 1; requestInFlight.current = false }
        }, [refresh, security])
        const loadMore = async () => {
          if (!security || requestInFlight.current || loading || !hasMore) return
          requestInFlight.current = true
          setLoading(true)
          const generation = requestGeneration.current
          try { const result = await api(`reports?sessionId=${encodeURIComponent(props.sessionId)}&limit=50${nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : ''}`); if (generation !== requestGeneration.current) return; setReports(previous => mergeRows(previous, result.reports || [], 'key')); setHasMore(Boolean(result.hasMore)); setNextCursor(result.nextCursor || null); loadedMore.current = true } catch (cause) { if (generation === requestGeneration.current) setError(cause?.message || String(cause)) } finally { if (generation === requestGeneration.current) { requestInFlight.current = false; setLoading(false) } }
        }
        if (!security) return h('section', { className: 'dsec-view' }, h('header', { className: 'dsec-head' }, h('span', { className: 'dsec-title' }, '报告')), h('div', { className: 'dsec-body' }, h(SecurityOnly)))
        function ReportItem({ report, index }) {
          return h(React.Fragment, { key: report.key },
            index ? h('hr', { style: { width: '100%', border: 0, borderTop: '1px solid var(--dsw-alias-border-l1,#e5e7eb)' } }) : null,
            h('article', { className: 'dsec-report' },
              h('div', { className: 'dsec-report-head' }, h('span', { className: 'dsec-report-title' }, report.key), h('span', { className: 'dsec-meta' }, report.updatedAt)),
              h('div', { className: 'dsec-markdown' }, h(MarkdownText, { text: report.markdown || '' })),
            ),
          )
        }
        return h('section', { className: 'dsec-view' },
          h('header', { className: 'dsec-head' }, h('span', { className: 'dsec-title' }, '渗透报告'), h('span', { className: 'dsec-meta' }, `${reports.length} 个域名:端口维度`), h('button', { className: 'dsec-btn', onClick: refresh }, '刷新')),
          h('div', { className: 'dsec-body dsec-report-list' }, error ? h('div', { className: 'dsec-error' }, error) : null, reports.length ? reports.map((report, index) => h(ReportItem, { key: report.key, report, index })) : h('div', { className: 'dsec-empty' }, '尚未提交报告。LLM 可使用 dsh_security_report 按域名:端口持续补充 Markdown 结果。'), hasMore ? h('button', { className: 'dsec-btn', onClick: loadMore, disabled: loading }, loading ? '加载中…' : '加载更多报告') : null),
        )
      }

      function CodeAuditApiView(props) {
        const [apis, setApis] = React.useState([])
        const [selected, setSelected] = React.useState(null)
        const [error, setError] = React.useState('')
        const [hasMore, setHasMore] = React.useState(false)
        const [nextCursor, setNextCursor] = React.useState(null)
        const [loading, setLoading] = React.useState(false)
        const requestInFlight = React.useRef(false)
        const requestGeneration = React.useRef(0)
        const refresh = React.useCallback(async () => {
          if (requestInFlight.current) return
          const generation = ++requestGeneration.current
          requestInFlight.current = true
          setLoading(true)
          try { const result = await api(`audit/apis?sessionId=${encodeURIComponent(props.sessionId)}&limit=100`); if (generation !== requestGeneration.current) return; setApis(result.apis || []); setHasMore(Boolean(result.hasMore)); setNextCursor(result.nextCursor || null); setError('') } catch (cause) { if (generation === requestGeneration.current) setError(cause?.message || String(cause)) } finally { if (generation === requestGeneration.current) { requestInFlight.current = false; setLoading(false) } }
        }, [props.sessionId])
        React.useEffect(() => {
          requestGeneration.current += 1; requestInFlight.current = false
          setApis([]); setSelected(null); setHasMore(false); setNextCursor(null); setError('')
          void refresh()
          const timer = window.setInterval(refresh, 1800)
          return () => { window.clearInterval(timer); requestGeneration.current += 1; requestInFlight.current = false }
        }, [refresh])
        const loadMore = async () => {
          if (loading || requestInFlight.current || !hasMore) return
          requestInFlight.current = true
          setLoading(true)
          const generation = requestGeneration.current
          try { const result = await api(`audit/apis?sessionId=${encodeURIComponent(props.sessionId)}&limit=100${nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : ''}`); if (generation !== requestGeneration.current) return; setApis(previous => mergeRows(previous, result.apis || [])); setHasMore(Boolean(result.hasMore)); setNextCursor(result.nextCursor || null) } catch (cause) { if (generation === requestGeneration.current) setError(cause?.message || String(cause)) } finally { if (generation === requestGeneration.current) { requestInFlight.current = false; setLoading(false) } }
        }
        const clear = async () => {
          if (typeof window !== 'undefined' && !window.confirm('确定清空当前代码审计的 API 清单、候选和报告吗？此操作不可撤销。')) return
          try { await api(`clear?sessionId=${encodeURIComponent(props.sessionId)}`, { method: 'POST', body: '{}' }); setApis([]); setSelected(null); setHasMore(false); await refresh() } catch (cause) { setError(cause?.message || String(cause)) }
        }
        return h('section', { className: 'dsec-view' },
          h('header', { className: 'dsec-head' }, h('span', { className: 'dsec-title' }, 'API 清单'), h('span', { className: 'dsec-meta' }, `${apis.length} 个入口 · 静态提取`), h('button', { className: 'dsec-btn', onClick: refresh }, '刷新'), h('button', { className: 'dsec-btn', onClick: clear, disabled: loading }, '清空')),
          h('div', { className: 'dsec-body' }, error ? h('div', { className: 'dsec-error' }, error) : null,
            apis.length ? h('div', { className: 'dsec-api-scroll' }, h('div', { className: 'dsec-api-grid' },
              h('div', { className: 'dsec-api-cell dsec-api-head' }, '类型/方法'), h('div', { className: 'dsec-api-cell dsec-api-head' }, '路径/入口'), h('div', { className: 'dsec-api-cell dsec-api-head' }, 'Handler'), h('div', { className: 'dsec-api-cell dsec-api-head' }, '鉴权'), h('div', { className: 'dsec-api-cell dsec-api-head' }, '风险'),
              apis.map(item => h('div', { className: 'dsec-api-row', key: item.id },
                h('button', { className: 'dsec-api-cell dsec-api-button', onClick: () => setSelected(selected?.id === item.id ? null : item) }, `${item.entryType || 'unknown'}${item.method ? ` · ${item.method}` : ''}`),
                h('button', { className: 'dsec-api-cell dsec-api-button', onClick: () => setSelected(selected?.id === item.id ? null : item), title: item.path || item.entryId }, item.path || item.entryId),
                h('button', { className: 'dsec-api-cell dsec-api-button', onClick: () => setSelected(selected?.id === item.id ? null : item), title: item.handler }, item.handler || '—'),
                h('div', { className: 'dsec-api-cell' }, item.auth || 'unknown'),
                h('div', { className: 'dsec-api-cell' }, h('div', { className: 'dsec-tags' }, (item.riskTags || []).length ? item.riskTags.map(tag => h('span', { className: 'dsec-tag', key: tag }, tag)) : h('span', { className: 'dsec-meta' }, '—'))),
              )),
            )) : h('div', { className: 'dsec-empty' }, '尚未提取 API 入口。请先运行 dsh_code_audit_start，再按入口点调用 dsh_code_audit_add_api。'),
            hasMore ? h('button', { className: 'dsec-btn', onClick: loadMore, disabled: loading }, loading ? '加载中…' : '加载更多 API') : null,
            selected ? h('section', { className: 'dsec-card' }, h('div', { className: 'dsec-card-title' }, `${selected.entryId} · 入口详情`), h('pre', { className: 'dsec-pre' }, JSON.stringify(selected, null, 2))) : null,
          ),
        )
      }

      function CodeAuditReportsView(props) {
        const [reports, setReports] = React.useState([])
        const [run, setRun] = React.useState(null)
        const [error, setError] = React.useState('')
        const [hasMore, setHasMore] = React.useState(false)
        const [nextCursor, setNextCursor] = React.useState(null)
        const [loading, setLoading] = React.useState(false)
        const requestInFlight = React.useRef(false)
        const requestGeneration = React.useRef(0)
        const loadedMore = React.useRef(false)
        const refresh = React.useCallback(async () => {
          if (requestInFlight.current) return
          const generation = ++requestGeneration.current
          requestInFlight.current = true
          setLoading(true)
          try {
            const [result, state] = await Promise.all([
              api(`audit/reports?sessionId=${encodeURIComponent(props.sessionId)}&limit=50`),
              api(`audit/state?sessionId=${encodeURIComponent(props.sessionId)}`),
            ])
            if (generation !== requestGeneration.current) return
            setReports(previous => loadedMore.current ? mergeRows(result.reports || [], previous, 'id') : (result.reports || []))
            setHasMore(Boolean(result.hasMore))
            setNextCursor(result.nextCursor || null)
            setRun(state.state?.run || null)
            setError('')
          } catch (cause) { if (generation === requestGeneration.current) setError(cause?.message || String(cause)) } finally { if (generation === requestGeneration.current) { requestInFlight.current = false; setLoading(false) } }
        }, [props.sessionId])
        React.useEffect(() => {
          requestGeneration.current += 1; requestInFlight.current = false
          setReports([]); setRun(null); setHasMore(false); setNextCursor(null); loadedMore.current = false; setError('')
          void refresh()
          const timer = window.setInterval(refresh, 2000)
          return () => { window.clearInterval(timer); requestGeneration.current += 1; requestInFlight.current = false }
        }, [refresh])
        const loadMore = async () => {
          if (requestInFlight.current || loading || !hasMore || !nextCursor) return
          requestInFlight.current = true
          setLoading(true)
          const generation = requestGeneration.current
          try {
            const result = await api(`audit/reports?sessionId=${encodeURIComponent(props.sessionId)}&limit=50&cursor=${encodeURIComponent(nextCursor)}`)
            if (generation !== requestGeneration.current) return
            setReports(previous => mergeRows(previous, result.reports || [], 'id'))
            setHasMore(Boolean(result.hasMore))
            setNextCursor(result.nextCursor || null)
            loadedMore.current = true
          } catch (cause) { if (generation === requestGeneration.current) setError(cause?.message || String(cause)) } finally { if (generation === requestGeneration.current) { requestInFlight.current = false; setLoading(false) } }
        }
        const labels = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', none: 'None', info: 'Info', unknown: 'Unknown' }
        function ListCard({ title, values }) {
          const items = Array.isArray(values) ? values : []
          return h('section', { className: 'dsec-understanding-card' }, h('div', { className: 'dsec-understanding-card-title' }, title), items.length ? h('ul', { className: 'dsec-understanding-list' }, items.map((item, index) => h('li', { key: `${title}-${index}` }, item))) : h('div', { className: 'dsec-meta' }, '未记录'))
        }
        function ProductUnderstanding({ understanding }) {
          const incomplete = !understanding || (understanding.status === 'pending' && !understanding.productSummary && !understanding.productPurpose && !(understanding.coreCapabilities || []).length && !(understanding.boundaries || []).length && !(understanding.assumptions || []).length && !(understanding.techStack || []).length)
          if (incomplete) return h('div', { className: 'dsec-warning' }, '尚未提交 L0 产品理解。请先完成产品用途、核心能力、功能边界、运行假设和技术栈分析。')
          const stack = Array.isArray(understanding.techStack) ? understanding.techStack : []
          return h('section', { className: 'dsec-understanding' },
            h('div', { className: 'dsec-eyebrow' }, 'PRODUCT UNDERSTANDING'),
            h('div', { className: 'dsec-section-title' }, '产品理解'),
            h('div', { className: 'dsec-section-subtitle' }, '展示产品用途、功能边界与运行假设，作为 API 清单和漏洞结论的上下文基线。'),
            h('div', { className: 'dsec-understanding-summary' }, understanding.productSummary || '未记录产品概述。'),
            h('div', { className: 'dsec-understanding-grid' },
              h(ListCard, { title: '产品用途', values: understanding.productPurpose ? [understanding.productPurpose] : [] }),
              h(ListCard, { title: '核心能力', values: understanding.coreCapabilities }),
              h(ListCard, { title: '功能边界', values: understanding.boundaries }),
              h(ListCard, { title: '运行假设', values: understanding.assumptions }),
            ),
            stack.length ? h('div', { className: 'dsec-stack' }, h('div', { className: 'dsec-stack-title' }, '技术栈'), h('div', { className: 'dsec-stack-grid' }, stack.map((group, index) => h('section', { className: 'dsec-stack-card', key: `${group.category || 'stack'}-${index}` }, h('div', { className: 'dsec-stack-card-title' }, group.category || '其他'), (group.items || []).map((item, itemIndex) => h('div', { className: 'dsec-stack-row', key: `${item.label || 'item'}-${itemIndex}` }, h('span', null, item.label || '项目'), h('span', null, item.value || '—'))))))) : null,
            h('span', { className: 'dsec-meta' }, `基线状态：${understanding.status || 'unknown'} · ${understanding.updatedAt || ''}`),
          )
        }
        return h('section', { className: 'dsec-view' },
          h('header', { className: 'dsec-head' }, h('span', { className: 'dsec-title' }, '代码审计报告'), h('span', { className: 'dsec-meta' }, `${reports.length} 份结构化报告`), h('button', { className: 'dsec-btn', onClick: refresh, disabled: loading }, '刷新')),
          h('div', { className: 'dsec-body dsec-report-list' }, error ? h('div', { className: 'dsec-error' }, error) : null,
            h(ProductUnderstanding, { understanding: run?.productUnderstanding || reports[0]?.productUnderstanding }),
            reports.length ? reports.map((report, index) => h(React.Fragment, { key: report.id }, index ? h('hr', { style: { width: '100%', border: 0, borderTop: '1px solid var(--dsw-alias-border-l1,#e5e7eb)' } }) : null,
              h('article', { className: 'dsec-code-report' },
                h('div', { className: 'dsec-report-head' }, h('span', { className: 'dsec-report-title' }, report.title), h('span', { className: 'dsec-meta' }, report.status)),
                h('div', { className: 'dsec-meta' }, report.summary),
                h('div', { className: 'dsec-summary' }, Object.entries(report.counts || {}).map(([severity, count]) => h('div', { className: 'dsec-summary-card', key: severity }, h('span', { className: 'dsec-summary-number' }, count), h('span', { className: 'dsec-summary-label' }, labels[severity] || severity))),),
                report.findings?.length ? h('div', { className: 'dsec-card' }, h('div', { className: 'dsec-card-title' }, '结构化发现（按 CVSS 3.1 降序）'), h('div', { style: { padding: '0 9px' } }, report.findings.map(finding => h('div', { className: 'dsec-finding', key: finding.id || finding.title }, h('div', { className: 'dsec-finding-title' }, `${String(finding.cvssSeverity || finding.severity || 'unknown').toUpperCase()}${finding.cvssScore == null ? '' : ` · CVSS ${finding.cvssScore}`} · ${finding.title || finding.id}`), h('div', { className: 'dsec-finding-meta' }, `${finding.status || 'candidate'} · ${finding.entry || finding.entryId || '未记录'} · ${finding.confidence || 'unknown'}${finding.cvssVector ? ` · ${finding.cvssVector}` : ''}`), finding.impact ? h('div', null, finding.impact) : null))),) : null,
                h('div', { className: 'dsec-markdown' }, h(MarkdownText, { text: report.markdown || '' })),
              ),
            )) : h('div', { className: 'dsec-empty' }, '尚未提交代码审计最终报告。请在 verifier 复核后调用 dsh_code_audit_report。'),
            hasMore ? h('button', { className: 'dsec-btn', onClick: loadMore, disabled: loading }, loading ? '加载中…' : '加载更多报告') : null,
          ),
        )
      }

      return {
        inject: ['slots', 'sessions', 'inputTriggers', 'remote'],
        apply(ctx) {
          ctx.effect(() => installStyle(), 'dsh-security: style')
          // Older Harness clients did not fold the committed preset event into
          // the current session row. Keep the core mode chip and this plugin's
          // ancestor-mode projection in sync after a successful switch; newer
          // clients already do this, so the write remains idempotent.
          if (ctx.remote && typeof ctx.remote.$on === 'function' && typeof ctx.sessions?.noteAgentPreset === 'function') {
            ctx.effect(() => ctx.remote.$on('agent-preset/selected', (sessionId, agentPreset) => {
              ctx.sessions.noteAgentPreset(sessionId, agentPreset)
            }), 'dsh-security: sync selected preset')
          }
          // Normalize the legacy label on the currently reusable blank
          // session before the core seat renders it. This is important after
          // switching workspaces: old workspaces can still contain a blank
          // `security` session even though the roster now exposes `pentest`.
          if (typeof ctx.sessions?.noteAgentPreset === 'function' && ctx.sessions?.list?.subscribe) {
            ctx.effect(() => {
              const normalize = () => {
                const snapshot = ctx.sessions.list.getSnapshot()
                const current = snapshot.current === undefined ? undefined : snapshot.byId[snapshot.current]
                if (current?.blank === true && current.agentPreset === 'security') {
                  ctx.sessions.noteAgentPreset(current.id, 'pentest')
                }
              }
              normalize()
              return ctx.sessions.list.subscribe(normalize)
            }, 'dsh-security: normalize legacy blank mode')
          }
          const inputTriggers = ctx.inputTriggers || (typeof ctx.get === 'function' ? ctx.get('inputTriggers') : undefined)
          if (inputTriggers && typeof inputTriggers.registerSource === 'function') {
            ctx.effect(() => inputTriggers.registerSource(createSecurityReferenceSource()), 'dsh-security: @ audit reference source')
          }
          ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
            name: 'conversation.session.header.utilities',
            id: 'security-session-mode',
            order: -20,
          }, SessionModeBadge))
          ctx.slots.inject('conversation.view', () => {
            let disposeHistory
            let disposeReports
            let disposePolicy
            let sessionId
            let mode
            let enabled
            let checkingSession
            let syncVersion = 0
            const registerViews = nextMode => {
              disposeHistory?.(); disposeReports?.(); disposePolicy?.(); disposeHistory = undefined; disposeReports = undefined; disposePolicy = undefined
              if (nextMode === 'code-audit') {
                disposeHistory = ctx.slots.register({ name: 'conversation.view', id: 'code-audit-apis', order: 20, label: () => 'API 清单' }, CodeAuditApiView)
                disposeReports = ctx.slots.register({ name: 'conversation.view', id: 'code-audit-reports', order: 30, label: () => '报告' }, CodeAuditReportsView)
              } else {
                disposeHistory = ctx.slots.register({ name: 'conversation.view', id: 'pentest-history', order: 20, label: () => '历史记录' }, SecurityHistoryView)
                disposeReports = ctx.slots.register({ name: 'conversation.view', id: 'pentest-reports', order: 30, label: () => '报告' }, SecurityReportsView)
              }
            }
            const sync = () => {
              const snapshot = ctx.sessions.list.getSnapshot()
              const current = snapshot.current
              const nextMode = current === undefined ? undefined : sessionModeSnapshot(snapshot, current)
              const nextEnabled = Boolean(nextMode)
              if (current === sessionId && nextMode === mode && nextEnabled === enabled && (nextEnabled || checkingSession === current)) return
              syncVersion += 1
              const version = syncVersion
              disposeHistory?.(); disposeReports?.(); disposePolicy?.(); disposeHistory = undefined; disposeReports = undefined; disposePolicy = undefined
              sessionId = current; mode = nextMode; enabled = nextEnabled; checkingSession = undefined
              if (!current) return
              if (nextEnabled) { registerViews(nextMode); return }
              checkingSession = current
              api(`status?sessionId=${encodeURIComponent(current)}`).then(result => {
                if (version !== syncVersion || sessionId !== current || !result.security || !result.mode) return
                enabled = true
                mode = result.mode
                registerViews(result.mode)
              }).catch(() => {}).finally(() => { if (checkingSession === current) checkingSession = undefined })
            }
            sync()
            const offList = ctx.sessions.list.subscribe(sync)
            return () => { offList(); disposeHistory?.(); disposeReports?.(); disposePolicy?.() }
          })
        },
      }
    },
  })
})(typeof window === 'undefined' ? globalThis : window)
