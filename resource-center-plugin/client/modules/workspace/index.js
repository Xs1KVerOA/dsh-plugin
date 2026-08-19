(function defineDshResourceCenterModule_workspace(global) {
  const registry = global.__dshResourceCenterModuleRegistry || (global.__dshResourceCenterModuleRegistry = {})
  if (registry.workspace) return
  registry.workspace = function registerDshResourceCenterWorkspace(global) {
  const loader = global.__ModuleLoader__
  if (!loader || typeof loader.load !== 'function') {
    throw new Error('dsh-resource-center: client module loader is unavailable')
  }

  loader.load({
    id: 'dsh-resource-center',
    factory(require) {
      const React = require('react')
      let serviceManager
      try {
        serviceManager = require('dsh-resource-center-service-manager')
      } catch {
        // The workspace module can run independently when service-manager is not
        // part of the selected sidebar module set.
        serviceManager = undefined
      }
      let testModule
      try {
        testModule = require('dsh-resource-center-test')
      } catch {
        // Test is optional so the workspace can still be developed and loaded
        // without the test sidebar module.
        testModule = undefined
      }
      let usageStatsModule
      try {
        usageStatsModule = require('dsh-resource-center-usage-stats')
      } catch {
        // Usage statistics are optional so the resource center remains usable
        // when this optional sidebar module is not selected.
        usageStatsModule = undefined
      }
      let rightSidebarModule
      try {
        rightSidebarModule = require('dsh-resource-center-right-sidebar')
      } catch {
        // The right sidebar bridge is optional so the resource center can be
        // developed with only the selected sidebar modules.
        rightSidebarModule = undefined
      }
      const h = React.createElement

      const DSH_CENTER_TITLE = 'DSH Center'
      const DSH_CENTER_BRAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="dsh-center-shield" x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
      <stop stop-color="#090b0d"/>
      <stop offset=".72" stop-color="#1a1d20"/>
      <stop offset="1" stop-color="#8dff00"/>
    </linearGradient>
    <linearGradient id="dsh-center-core" x1="17" y1="17" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff"/>
      <stop offset=".58" stop-color="#f4f6f7"/>
      <stop offset="1" stop-color="#8dff00"/>
    </linearGradient>
  </defs>
  <path d="M32 3.5 56 15v16.5c0 14.6-9.1 25.2-24 29-14.9-3.8-24-14.4-24-29V15z" fill="url(#dsh-center-shield)"/>
  <path d="M32 9.5 49.5 18v13.3c0 10.9-6.2 19-17.5 23-11.3-4-17.5-12.1-17.5-23V18z" fill="#f8fafb"/>
  <path d="M32 13 45.5 20v11c0 8.3-4.5 14.7-13.5 18.5-9-3.8-13.5-10.2-13.5-18.5V20z" fill="#101316"/>
  <path d="M24.5 31.5 32 25l7.5 6.5M32 25v14.5m-7.5-8v8m15-8v8M24.5 39.5h15" fill="none" stroke="url(#dsh-center-core)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="25" r="3.1" fill="#fff"/>
  <circle cx="24.5" cy="31.5" r="2.6" fill="#fff"/>
  <circle cx="39.5" cy="31.5" r="2.6" fill="#8dff00"/>
  <circle cx="32" cy="39.5" r="2.8" fill="#8dff00"/>
  <path d="M45.5 21.5h7m-4 6h6m-7 6h8M18.5 42h-7m4-6h-6" fill="none" stroke="#8dff00" stroke-width="1.8" stroke-linecap="round"/>
  <path d="m46 13 1.1 2.5 2.5 1.1-2.5 1.1-1.1 2.5-1.1-2.5-2.5-1.1 2.5-1.1z" fill="#8dff00"/>
</svg>`
      const DSH_CENTER_BRAND_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(DSH_CENTER_BRAND_SVG)}`
      const CURRENT_SESSION_USAGE_PATH = '/api/dsh-resource-center/usage-stats'

      function fetchWithTimeout(input, options = {}, timeoutMs = 12000) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null
        const parentSignal = options.signal
        let timer
        const abort = () => controller?.abort()
        if (parentSignal?.aborted) abort()
        else parentSignal?.addEventListener?.('abort', abort, { once: true })
        if (controller) timer = setTimeout(() => controller.abort(), timeoutMs)
        return fetch(input, { ...options, ...(controller ? { signal: controller.signal } : {}) }).finally(() => {
          if (timer) clearTimeout(timer)
          parentSignal?.removeEventListener?.('abort', abort)
        })
      }

      function installDocumentBranding() {
        if (typeof document === 'undefined' || !document.head) return () => {}
        const previousTitle = document.title
        let brandLink = document.querySelector('link[data-dsh-resource-center-branding]')
        const ownsBrandLink = !brandLink
        if (!brandLink) {
          brandLink = document.createElement('link')
          brandLink.rel = 'icon'
          brandLink.type = 'image/svg+xml'
          brandLink.dataset.dshResourceCenterBranding = 'true'
          if (typeof document.head.prepend === 'function') document.head.prepend(brandLink)
          else document.head.appendChild?.(brandLink)
        }
        const sync = () => {
          if (document.title !== DSH_CENTER_TITLE) document.title = DSH_CENTER_TITLE
          if (brandLink.href !== DSH_CENTER_BRAND_ICON) brandLink.href = DSH_CENTER_BRAND_ICON
        }
        sync()
        const observer = typeof MutationObserver === 'function' ? new MutationObserver(sync) : undefined
        observer?.observe(document.head, { childList: true, characterData: true })
        return () => {
          observer?.disconnect()
          if (ownsBrandLink) brandLink.remove()
          if (document.title === DSH_CENTER_TITLE) document.title = previousTitle
        }
      }

      const CSS = `
.drc-dock{position:fixed;left:0;top:var(--dsh-resource-center-top,114px);width:var(--dsh-resource-center-rail-width,48px);height:calc(100vh - var(--dsh-resource-center-top,114px) - var(--dsh-resource-center-bottom,100px));z-index:24;display:flex;min-height:0;overflow:hidden;color:var(--dsw-alias-label-primary,#25282d);box-sizing:border-box;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:8px 0 24px rgba(22,35,55,.08);isolation:isolate;transition:width .16s ease}
.drc-dock.drc-open{width:min(var(--dsh-resource-center-left-width,280px),100vw)}
html[data-dsh-sidebar-collapsed="true"] .drc-dock.drc-open{top:0;height:100vh;background:transparent;box-shadow:none;pointer-events:none}
html[data-dsh-sidebar-collapsed="true"] .drc-dock.drc-open .drc-rail{height:100%;padding-top:calc(var(--dsh-resource-center-top,114px) + 10px);background:transparent;border-right-color:transparent;pointer-events:none}
html[data-dsh-sidebar-collapsed="true"] .drc-dock.drc-open .drc-rail-button{pointer-events:auto}
html[data-dsh-sidebar-collapsed="true"] .drc-dock.drc-open .drc-panel{pointer-events:auto}
.drc-dock *{box-sizing:border-box}
.pI_x6G_frame.dsh-resource-center-right-inset .pI_x6G_centerCol{box-sizing:border-box;min-width:0;padding-right:var(--dsh-resource-center-right-width,0px)}
.drc-rail{width:var(--dsh-resource-center-rail-width,48px);flex:0 0 var(--dsh-resource-center-rail-width,48px);display:flex;flex-direction:column;align-items:center;padding:10px 0;border-right:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fafbfc)}
.drc-rail-button{position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary,#7b818b);cursor:pointer;transition:background .15s,color .15s}
.drc-rail-button:hover{background:var(--dsw-alias-bg-layer-2,#f0f2f5);color:var(--dsw-alias-label-primary,#25282d)}
.drc-rail-button.drc-active{background:var(--dsw-alias-interactive-bg-hover,#eaf2ff);color:var(--dsw-alias-state-business-primary,#3578e5)}
.drc-rail-button.drc-active:before{content:"";position:absolute;left:-5px;top:8px;bottom:8px;width:3px;border-radius:0 2px 2px 0;background:var(--dsw-alias-state-business-primary,#3578e5)}
.drc-rail-button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#3578e5);outline-offset:1px}
.drc-rail-button svg{width:21px;height:21px}
.drc-panel{position:relative;z-index:0;width:auto;min-width:0;flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#fff);border-left:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-right:1px solid var(--dsw-alias-border-l1,#e5e7eb);animation:drc-panel-in .16s ease-out}
@keyframes drc-panel-in{from{transform:translateX(-8px);opacity:.55}to{transform:none;opacity:1}}
.drc-toolbar{display:flex;align-items:center;gap:4px;min-width:0;padding:11px 10px 7px}
.drc-toolbar-title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:650;color:var(--dsw-alias-label-secondary,#777e88)}
.drc-toolbar-count{margin-left:4px;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-weight:500;font-variant-numeric:tabular-nums}
.drc-toolbar-actions{display:flex;align-items:center;gap:2px;flex:0 0 auto}
.drc-toolbar-button{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#747b85);font-size:16px;cursor:pointer}
.drc-toolbar-button:hover{background:var(--dsw-alias-bg-layer-2,#f0f2f5);color:var(--dsw-alias-label-primary,#25282d)}
.drc-search-row{display:flex;align-items:center;gap:6px;margin:0 10px 7px;padding:5px 7px;border:1px solid var(--dsw-alias-border-l2,#d9dde3);border-radius:6px;background:var(--dsw-alias-input-fill,#fff)}
.drc-search-row:focus-within{border-color:var(--dsw-alias-state-business-primary,#3578e5)}
.drc-search-glyph{flex:0 0 auto;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:13px}
.drc-search-input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:11.5px}
.drc-search-status{flex:0 0 auto;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:9.5px}
.drc-tree-layout{display:flex;flex:1;min-width:0;min-height:0;flex-direction:column}
.drc-scroll{min-width:0;min-height:0;flex:1;overflow-x:hidden;overflow-y:auto;padding:0 8px 8px;scrollbar-width:thin}
.drc-bottom{flex:0 0 auto;padding:8px 10px 10px;border-top:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:linear-gradient(180deg,var(--dsw-alias-bg-layer-1,#fff),var(--dsw-alias-bg-layer-2,#fafbfd));box-shadow:0 -5px 14px rgba(22,35,55,.04)}
.drc-create-workspace{display:flex;align-items:center;gap:6px;width:100%;min-height:32px;padding:6px 7px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-state-business-primary,#3578e5);font:inherit;font-size:12px;font-weight:520;text-align:left;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.drc-create-workspace:hover{border-color:#d6e5ff;background:#f1f6ff;color:#2468d4}
.drc-create-workspace:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#3578e5);outline-offset:1px}
.drc-create-workspace .drc-create-icon{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;color:inherit;font-size:14px;line-height:1}
.drc-group{margin:2px 0 4px}
.drc-group-row,.drc-session-row{position:relative;display:flex;align-items:center;gap:6px;width:100%;min-width:0;border:0;border-radius:7px;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer;box-sizing:border-box}
.drc-group-row{padding:7px 6px;color:var(--dsw-alias-label-primary,#353940)}
.drc-group-row:hover,.drc-session-row:hover{background:var(--dsw-alias-bg-layer-2,#f2f4f7)}
.drc-group-row:focus-visible,.drc-session-row:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#3578e5);outline-offset:-1px}
.drc-chevron{width:12px;flex:0 0 12px;text-align:center;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:11px;transition:transform .12s}
.drc-chevron.drc-open{transform:rotate(90deg)}
.drc-folder-small{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 18px;color:var(--dsw-alias-label-secondary,#717983)}
.drc-folder-small svg{width:17px;height:17px}
.drc-group-name,.drc-session-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.drc-group-name{font-size:12.5px;font-weight:560}
.drc-group-count{flex:0 0 auto;min-width:16px;text-align:right;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-variant-numeric:tabular-nums}
.drc-add-session{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:15px;cursor:pointer}
.drc-add-session:hover{background:var(--dsw-alias-bg-layer-3,#e7eaf0);color:var(--dsw-alias-state-business-primary,#3578e5)}
.drc-more{width:22px;height:22px;display:none;align-items:center;justify-content:center;flex:0 0 22px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:15px;cursor:pointer}
.drc-group-row:hover .drc-more,.drc-session-row:hover .drc-more{display:inline-flex}
.drc-more:hover{background:var(--dsw-alias-bg-layer-3,#e7eaf0);color:var(--dsw-alias-label-primary,#25282d)}
.drc-session-row{padding:6px 6px 6px 35px}
.drc-session-row.drc-current{background:var(--dsw-alias-bg-layer-2,#eef0f3)}
.drc-session-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#a5abb3)}
.drc-session-dot.drc-running{background:#45b96b;box-shadow:0 0 0 3px rgba(69,185,107,.12)}
.drc-session-name{font-size:12px;color:var(--dsw-alias-label-primary,#3a3e45)}
.drc-session-id{max-width:58px;flex:0 0 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9.5px;color:var(--dsw-alias-label-tertiary,#a2a7af)}
.drc-rename-input{min-width:0;flex:1;height:24px;padding:2px 6px;border:1px solid var(--dsw-alias-state-business-primary,#3578e5);border-radius:5px;background:var(--dsw-alias-input-fill,#fff);color:inherit;font:inherit;font-size:12px;outline:0}
.drc-empty{padding:28px 14px;text-align:center;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:12px;line-height:1.7}
.drc-hint{margin:8px 4px 0;padding:8px 2px 0;border-top:1px solid var(--dsw-alias-border-l1,#e5e7eb);color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:10px;line-height:1.5}.drc-action-error{margin:8px 4px 0;padding:8px 9px;border:1px solid rgba(217,75,75,.24);border-radius:6px;background:rgba(217,75,75,.07);color:var(--dsw-alias-state-error-primary,#d94b4b);font-size:11px;line-height:1.45;overflow-wrap:anywhere}
.drc-menu-backdrop{position:fixed;inset:0;z-index:1190}
.drc-menu{position:fixed;min-width:148px;padding:4px;border:1px solid var(--dsw-alias-border-l1,#dfe2e7);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 8px 24px rgba(25,35,50,.16)}
.drc-menu-item{display:flex;align-items:center;width:100%;padding:7px 10px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-primary,#30343a);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.drc-menu-item:hover{background:var(--dsw-alias-bg-layer-2,#f1f3f6)}
.drc-menu-item.drc-danger{color:var(--dsw-alias-state-error-primary,#d94b4b)}
.drc-menu-separator{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1,#e5e7eb)}
.dsh-resource-center-session-cost{display:inline-flex;align-items:center;min-height:24px;margin:0 8px 0 0;padding:0 9px;border:1px solid var(--dsw-alias-state-business-tertiary,#cfe0ff);border-radius:999px;background:var(--dsw-alias-state-business-quaternary,#f4f8ff);color:var(--dsw-alias-state-business-primary,#3578e5);font-size:12px;font-weight:500;line-height:22px;font-variant-numeric:tabular-nums;white-space:nowrap}
@media (prefers-color-scheme:dark){.drc-panel,.drc-rail{background:var(--dsw-specific-sidebar-fill,#1d1f23)}.drc-menu{background:var(--dsw-alias-bg-layer-1,#24272c)}}
`

      function compactUsageTokens(value) {
        const number = Number(value) || 0
        if (number < 1000) return String(Math.round(number))
        if (number < 1e6) return `${Math.round(number / 100) / 10}K`
        return `${Math.round(number / 1e5) / 10}M`
      }

      // Render this through the host's session-scoped header utility slot. The
      // slot remounts when sessionId changes, so switching conversations cannot
      // leave the previous cost behind or expand the composer footer.
      function CurrentSessionCost(props) {
        const sessionId = typeof props?.sessionId === 'string' ? props.sessionId : ''
        const [usage, setUsage] = React.useState(null)
        React.useEffect(() => {
          if (!sessionId) return undefined
          let disposed = false
          let controller
          let timer
          const refresh = async () => {
            controller?.abort?.()
            controller = typeof AbortController === 'function' ? new AbortController() : undefined
            try {
              const response = await fetchWithTimeout(
                `${CURRENT_SESSION_USAGE_PATH}?sessionId=${encodeURIComponent(sessionId)}`,
                controller ? { signal: controller.signal } : undefined,
              )
              const result = await response.json().catch(() => ({}))
              const nextUsage = result.currentSession?.id === sessionId ? result.currentSession.usage : undefined
              if (!disposed && response.ok && result.ok !== false && nextUsage) {
                setUsage({
                  calls: Number(nextUsage.calls) || 0,
                  input: Number(nextUsage.input) || 0,
                  cacheHit: Number(nextUsage.cacheHit) || 0,
                  output: Number(nextUsage.output) || 0,
                  cost: Number(nextUsage.cost) || 0,
                })
              }
            } catch (error) {
              // An unmounted session or a superseded refresh is expected.
              if (error?.name !== 'AbortError' && !disposed) return
            }
          }
          void refresh()
          if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
            timer = window.setInterval(refresh, 10_000)
          }
          return () => {
            disposed = true
            controller?.abort?.()
            if (timer !== undefined) window.clearInterval(timer)
          }
        }, [sessionId])

        if (!sessionId) return null
        const cost = Number(usage?.cost) || 0
        const calls = Number(usage?.calls) || 0
        const input = compactUsageTokens(usage?.input)
        const output = compactUsageTokens(usage?.output)
        const cacheHit = compactUsageTokens(usage?.cacheHit)
        const title = `${calls} 次 · 输入 ${input} tok · 输出 ${output} tok · 缓存命中 ${cacheHit} tok`
        return h('span', {
          className: 'dsh-resource-center-session-cost',
          'data-dsh-resource-center-session-cost': 'true',
          title,
        }, usage ? `本会话 ¥${cost.toFixed(4)}` : '本会话 …')
      }

      function ActivityIcon() {
        return h('svg', {
          viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
          strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
          h('path', { d: 'M3.5 6.5h6l2 2h9v9.25A1.75 1.75 0 0 1 18.75 19.5H5.25A1.75 1.75 0 0 1 3.5 17.75z' }),
          h('path', { d: 'M3.5 6.5v-1A1.5 1.5 0 0 1 5 4h4l2 2h7.5A1.5 1.5 0 0 1 20 7.5v1' }),
        )
      }

      function SmallFolderIcon(props) {
        return h('svg', {
          viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
          strokeWidth: 1.65, strokeLinecap: 'round', strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
          h('path', { d: props.open ? 'M3 6.5h6l2 2h9v8.25A1.75 1.75 0 0 1 18.25 18.5H5.75A1.75 1.75 0 0 1 4 16.75z' : 'M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h7.5A1.5 1.5 0 0 1 20 9.5v7A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5z' }),
        )
      }

      function useSessionSnapshot(sessions) {
        const read = () => {
          try {
            return sessions && sessions.list && typeof sessions.list.getSnapshot === 'function'
              ? sessions.list.getSnapshot()
              : { current: undefined, byId: {} }
          } catch {
            return { current: undefined, byId: {} }
          }
        }
        const [snapshot, setSnapshot] = React.useState(read)
        React.useEffect(() => {
          if (!sessions || !sessions.list || typeof sessions.list.subscribe !== 'function') return undefined
          setSnapshot(read())
          return sessions.list.subscribe(() => setSnapshot(read()))
        }, [sessions])
        return snapshot || { current: undefined, byId: {} }
      }

      function ContextMenu(props) {
        if (!props.menu) return null
        return h('div', {
          className: 'drc-menu-backdrop',
          onClick: props.onClose,
          onContextMenu: (event) => { event.preventDefault(); props.onClose() },
        }, h('div', {
          className: 'drc-menu',
          style: { left: props.menu.x, top: props.menu.y },
          onClick: (event) => event.stopPropagation(),
        }, props.menu.items.map((item, index) => item.separator
          ? h('div', { key: 'separator-' + index, className: 'drc-menu-separator' })
          : h('button', {
            key: item.id,
            className: 'drc-menu-item' + (item.danger ? ' drc-danger' : ''),
            onClick: () => { props.onClose(); item.run() },
          }, item.label))))
      }

      function requestRename(id, title) {
        return fetchWithTimeout('/api/dsh-resource-center/rename-session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, title }),
        }).then(async response => {
          const result = await response.json().catch(() => ({}))
          if (!response.ok || result.ok === false) throw new Error(result.error || '重命名失败')
          return result
        })
      }

      function sessionSnapshot(sessions) {
        try {
          return sessions && sessions.list && typeof sessions.list.getSnapshot === 'function'
            ? sessions.list.getSnapshot()
            : { current: undefined, byId: {} }
        } catch {
          return { current: undefined, byId: {} }
        }
      }

      function workspaceSnapshot(workspaces) {
        try {
          if (workspaces?.list && typeof workspaces.list.getSnapshot === 'function') return workspaces.list.getSnapshot()
          if (typeof workspaces?.getSnapshot === 'function') return workspaces.getSnapshot()
        } catch {}
        return {}
      }

      function archivedSessionSet(sessions, workspaces, snapshot = sessionSnapshot(sessions)) {
        const workspaceState = workspaceSnapshot(workspaces)
        const archived = [
          workspaceState?.archivedSessionIds,
          snapshot?.archivedSessionIds,
          workspaces?.archivedSessionIds,
        ]
        const ids = new Set()
        for (const values of archived) {
          if (!Array.isArray(values)) continue
          for (const id of values) ids.add(String(id))
        }
        return ids
      }

      function sessionTitle(session) {
        return String(session?.displayTitle || session?.title || session?.id || '未命名会话').trim() || '未命名会话'
      }

      function sessionContent(value, state = { size: 0, parts: [] }) {
        if (state.size >= 12000 || value == null) return state
        if (typeof value === 'string') {
          const part = value.slice(0, 12000 - state.size)
          state.parts.push(part)
          state.size += part.length
          return state
        }
        if (Array.isArray(value)) {
          for (const item of value) {
            sessionContent(item, state)
            if (state.size >= 12000) break
          }
          return state
        }
        if (typeof value === 'object') {
          for (const item of Object.values(value)) {
            sessionContent(item, state)
            if (state.size >= 12000) break
          }
        }
        return state
      }

      function sessionAlias(session, used) {
        const id = String(session?.id || '')
        const base = sessionTitle(session).replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 42) || `session-${id.slice(-6)}`
        let alias = base
        if (used.has(alias)) alias = `${base}-${id.slice(-6)}`
        let index = 2
        while (used.has(alias)) alias = `${base}-${index++}`
        used.add(alias)
        return alias
      }

      function createSessionInputSource(sessions, workspaces) {
        const aliases = new Map()
        const listeners = new Set()
        const rebuild = (currentId = '') => {
          aliases.clear()
          const used = new Set()
          const snapshot = sessionSnapshot(sessions)
          const archived = archivedSessionSet(sessions, workspaces, snapshot)
          for (const session of Object.values(snapshot.byId || {})) {
            if (!session || archived.has(String(session.id)) || String(session.id) === String(currentId) || session.origin === 'subagent' || session.blank) continue
            aliases.set(sessionAlias(session, used), session)
          }
          return snapshot
        }
        const resolve = ref => {
          const snapshot = sessionSnapshot(sessions)
          if (archivedSessionSet(sessions, workspaces, snapshot).has(String(ref))) return undefined
          return snapshot.byId?.[String(ref)] || [...aliases.values()].find(session => String(session.id) === String(ref))
        }
        return {
          trigger: '@',
          name: '会话',
          order: 1,
          async candidates(session, { query, signal }) {
            const snapshot = rebuild(session?.sessionId)
            if (signal.aborted) return []
            const needle = String(query || '').trim().toLocaleLowerCase()
            return [...aliases.entries()]
              .map(([alias, item]) => {
                const content = sessionContent(item.events).parts.join(' ').replace(/\s+/g, ' ').trim()
                return { alias, item, content }
              })
              .filter(({ alias, item, content }) => !needle || `${alias} ${sessionTitle(item)} ${item.id} ${content}`.toLocaleLowerCase().includes(needle))
              .map(({ alias, item, content }) => ({
                name: alias,
                description: `${sessionTitle(item)} · ${String(item.id || '').slice(0, 12)}`,
                icon: '◉',
                hint: content ? `引用会话内容 · ${content.slice(0, 68)}` : '引用会话内容',
              }))
          },
          warm(session) { rebuild(session?.sessionId) },
          lexicon(session) { rebuild(session?.sessionId); return [...aliases.keys()] },
          subscribeLexicon(_session, listener) {
            listeners.add(listener)
            const notify = () => { listeners.forEach(callback => callback()) }
            const subscriptions = [sessions?.list, workspaces?.list || workspaces]
              .filter(store => store && typeof store.subscribe === 'function')
              .map(store => store.subscribe(notify))
            return () => { listeners.delete(listener); subscriptions.forEach(unsubscribe => unsubscribe?.()) }
          },
          matchSpace(session, token) {
            rebuild(session?.sessionId)
            const sessionItem = aliases.get(String(token).slice(1))
            if (!sessionItem) return undefined
            const alias = [...aliases.entries()].find(([, item]) => String(item.id) === String(sessionItem.id))?.[0] || `session-${String(sessionItem.id).slice(-6)}`
            return { insert: { source: '会话', ref: String(sessionItem.id), label: sessionTitle(sessionItem), clipboardText: `@${alias}` } }
          },
          onPick({ candidate }) {
            const sessionItem = aliases.get(candidate.name)
            if (!sessionItem) return undefined
            return { insert: { source: '会话', ref: String(sessionItem.id), label: sessionTitle(sessionItem), clipboardText: `@${candidate.name}` } }
          },
          codec: {
            clipboardText(ref) {
              const sessionItem = resolve(ref)
              if (!sessionItem) return `@session-${String(ref).slice(-6)}`
              const snapshot = sessionSnapshot(sessions)
              rebuild(snapshot.current || '')
              const alias = [...aliases.entries()].find(([, item]) => String(item.id) === String(ref))?.[0] || `session-${String(ref).slice(-6)}`
              return `@${alias}`
            },
            async serialize(ref, signal) {
              if (!resolve(ref)) throw new Error('会话不存在或已归档，不能引用')
              const response = await fetchWithTimeout('/api/dsh-resource-center/session-reference', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: String(ref) }), signal })
              const result = await response.json().catch(() => ({}))
              if (!response.ok || result.ok === false) throw new Error(result.error || '会话引用加载失败')
              return result.markup
            },
          },
        }
      }

      function WorkspaceTree(props) {
        const fallback = useSessionSnapshot(props.sessions)
        const useSessions = props.slotProps && props.slotProps.useSessions
        const useWorkspaces = props.slotProps && props.slotProps.useWorkspaces
        const nativeIds = typeof useSessions === 'function' ? useSessions(state => state ? state.ids : undefined) : undefined
        const nativeById = typeof useSessions === 'function' ? useSessions(state => state ? state.byId : undefined) : undefined
        const nativeCurrent = typeof useSessions === 'function' ? useSessions(state => state ? state.current : undefined) : undefined
        const nativeItems = typeof useWorkspaces === 'function' ? useWorkspaces(state => state ? state.items : undefined) : undefined
        const nativeArchived = typeof useWorkspaces === 'function' ? useWorkspaces(state => state ? state.archivedSessionIds : undefined) : undefined
        const [query, setQuery] = React.useState('')
        const [searchOpen, setSearchOpen] = React.useState(false)
        const [contentMatches, setContentMatches] = React.useState(null)
        const [searching, setSearching] = React.useState(false)
        const [searchError, setSearchError] = React.useState('')
        const [flat, setFlat] = React.useState(false)
        const [collapsed, setCollapsed] = React.useState({})
        const [menu, setMenu] = React.useState(null)
        const [renaming, setRenaming] = React.useState(null)
        const [actionError, setActionError] = React.useState('')

        const reportActionError = cause => setActionError(cause?.message || String(cause || '操作失败'))
        const runAction = operation => {
          try {
            return Promise.resolve(operation()).then(() => { setActionError('') }).catch(reportActionError)
          } catch (cause) {
            reportActionError(cause)
            return Promise.resolve()
          }
        }

        const ids = nativeIds !== undefined ? (nativeIds || []) : Object.keys(fallback.byId || {})
        const byId = nativeById !== undefined ? (nativeById || {}) : (fallback.byId || {})
        const current = nativeCurrent !== undefined ? nativeCurrent : fallback.current
        const items = nativeItems !== undefined ? (nativeItems || []) : []
        const archived = nativeArchived !== undefined ? (nativeArchived || []) : []
        const archivedSet = new Set(archived)
        const normalizedQuery = query.trim().toLowerCase()
        const searchableIds = ids.filter(id => byId[id] && !archivedSet.has(id))
        const searchableIdsKey = searchableIds.join('\u0001')
        React.useEffect(() => {
          if (!normalizedQuery) {
            setContentMatches(null)
            setSearching(false)
            setSearchError('')
            return undefined
          }
          let alive = true
          setSearching(true)
          setSearchError('')
          const timer = window.setTimeout(() => {
            fetchWithTimeout('/api/dsh-resource-center/search-sessions', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ ids: searchableIds, query: query.trim() }),
            }).then(async response => {
              const result = await response.json().catch(() => ({}))
              if (!response.ok || result.ok === false) throw new Error(result.error || '内容搜索失败')
              if (!alive) return
              setContentMatches(new Set((result.matches || []).map(item => item.id)))
              setSearching(false)
            }).catch(error => {
              if (!alive) return
              setContentMatches(new Set())
              setSearching(false)
              setSearchError(error?.message || '搜索失败')
            })
          }, 180)
          return () => { alive = false; window.clearTimeout(timer) }
        }, [normalizedQuery, searchableIdsKey])
        const visible = (session) => {
          if (!session || archivedSet.has(session.id) || session.origin === 'subagent') return false
          if (session.blank && session.id !== current) return false
          if (!normalizedQuery) return true
          const titleMatch = ((session.displayTitle || session.title || '') + ' ' + session.id).toLowerCase().includes(normalizedQuery)
          return titleMatch || Boolean(contentMatches && contentMatches.has(session.id))
        }
        const workspaceTitle = (workspace) => workspace.title || workspace.path || workspace.workspaceId || '未命名工作区'
        const groups = items.map(workspace => ({
          workspace,
          title: workspaceTitle(workspace),
          sessions: (workspace.sessionIds || []).map(id => byId[id]).filter(visible),
        })).filter(group => !normalizedQuery || group.sessions.length > 0)
        const accounted = new Set(items.flatMap(workspace => workspace.sessionIds || []))
        const ungrouped = ids.map(id => byId[id]).filter(session => visible(session) && !accounted.has(session.id))
        const allVisible = groups.reduce((total, group) => total + group.sessions.length, 0) + ungrouped.length

        const closeMenu = () => setMenu(null)
        const openMenu = (event, itemsForMenu) => {
          event.preventDefault()
          event.stopPropagation()
          setMenu({ x: Math.min(event.clientX, window.innerWidth - 175), y: Math.min(event.clientY, window.innerHeight - 190), items: itemsForMenu })
        }
        const openButtonMenu = (event, itemsForMenu) => {
          event.stopPropagation()
          const rect = event.currentTarget.getBoundingClientRect()
          setMenu({ x: Math.min(rect.right - 150, window.innerWidth - 175), y: Math.min(rect.bottom + 4, window.innerHeight - 190), items: itemsForMenu })
        }
        const renameSession = (session) => setRenaming({ kind: 'session', id: session.id, title: session.displayTitle || session.title || session.id })
        const renameWorkspace = (workspace) => setRenaming({ kind: 'workspace', id: workspace.workspaceId, title: workspaceTitle(workspace) })
        const saveRename = (kind, id, title) => {
          const next = String(title || '').trim()
          if (!next) { setRenaming(null); return }
          setRenaming(null)
          if (kind === 'workspace') {
            if (props.workspaces && typeof props.workspaces.rename === 'function') runAction(() => props.workspaces.rename(id, next))
          } else {
            runAction(() => requestRename(id, next))
          }
        }
        const sessionMenu = (session) => [
          { id: 'rename-session', label: '重命名', run: () => renameSession(session) },
          { id: 'fork-session', label: '分叉会话', run: () => {
            if (props.sessions && typeof props.sessions.fork === 'function') {
              runAction(() => props.sessions.fork({ sessionId: session.id }).then(id => { if (id && props.sessions.open) props.sessions.open(id) }))
            }
          } },
          { separator: true },
          { id: 'archive-session', label: '归档会话', run: () => {
            if (props.workspaces && typeof props.workspaces.archiveSession === 'function') runAction(() => props.workspaces.archiveSession(session.id))
          } },
        ]
        const workspaceMenu = (workspace) => [
          { id: 'rename-workspace', label: '重命名工作区', run: () => renameWorkspace(workspace) },
          { separator: true },
          { id: 'delete-workspace', label: '删除工作区', danger: true, run: () => {
            if (typeof window !== 'undefined' && !window.confirm(`确定删除工作区“${workspaceTitle(workspace)}”吗？此操作不可撤销。`)) return
            if (props.workspaces && typeof props.workspaces.delete === 'function') runAction(() => props.workspaces.delete(workspace.workspaceId))
          } },
        ]
        const sessionRow = (session) => {
          const isRenaming = renaming && renaming.kind === 'session' && renaming.id === session.id
          return h('div', {
            key: session.id,
            className: 'drc-session-row' + (session.id === current ? ' drc-current' : ''),
            role: 'button', tabIndex: 0,
            onClick: () => { if (props.sessions && props.sessions.open) props.sessions.open(session.id) },
            onKeyDown: event => {
              if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
                event.preventDefault()
                if (props.sessions && props.sessions.open) props.sessions.open(session.id)
              }
            },
            onContextMenu: event => openMenu(event, sessionMenu(session)),
          },
            h('span', { className: 'drc-session-dot' + (session.running ? ' drc-running' : '') }),
            isRenaming ? h('input', {
              className: 'drc-rename-input', autoFocus: true, defaultValue: renaming.title,
              onClick: event => event.stopPropagation(),
              onKeyDown: event => {
                if (event.key === 'Enter') saveRename('session', session.id, event.currentTarget.value)
                if (event.key === 'Escape') setRenaming(null)
              },
              onBlur: event => saveRename('session', session.id, event.currentTarget.value),
            }) : h('span', { className: 'drc-session-name' }, session.displayTitle || session.title || session.id),
            h('span', { className: 'drc-session-id' }, session.id.slice(0, 8)),
            h('button', {
              className: 'drc-more', title: '更多操作',
              onClick: event => openButtonMenu(event, sessionMenu(session)),
            }, '⋯'),
          )
        }
        const groupRow = (group) => {
          const workspace = group.workspace
          const id = workspace.workspaceId
          const open = collapsed[id] !== true
          const isRenaming = renaming && renaming.kind === 'workspace' && renaming.id === id
          return h('div', { className: 'drc-group', key: id },
            h('div', {
              className: 'drc-group-row',
              role: 'button', tabIndex: 0,
              onClick: () => setCollapsed(previous => Object.assign({}, previous, { [id]: open })),
              onKeyDown: event => {
                if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
                  event.preventDefault()
                  setCollapsed(previous => Object.assign({}, previous, { [id]: open }))
                }
              },
              onContextMenu: event => openMenu(event, workspaceMenu(workspace)),
            },
              h('span', { className: 'drc-chevron' + (open ? ' drc-open' : '') }, '›'),
              h('span', { className: 'drc-folder-small' }, h(SmallFolderIcon, { open })),
              isRenaming ? h('input', {
                className: 'drc-rename-input', autoFocus: true, defaultValue: renaming.title,
                onClick: event => event.stopPropagation(),
                onKeyDown: event => {
                  if (event.key === 'Enter') saveRename('workspace', id, event.currentTarget.value)
                  if (event.key === 'Escape') setRenaming(null)
                },
                onBlur: event => saveRename('workspace', id, event.currentTarget.value),
              }) : h('span', { className: 'drc-group-name' }, group.title),
              h('span', { className: 'drc-group-count' }, group.sessions.length),
              h('button', {
                className: 'drc-add-session', title: '在此工作区新建会话',
                onClick: event => {
                  event.stopPropagation()
                  if (props.workspaces && typeof props.workspaces.startSession === 'function') props.workspaces.startSession(id)
                },
              }, '+'),
              h('button', { className: 'drc-more', title: '工作区操作', onClick: event => openButtonMenu(event, workspaceMenu(workspace)) }, '⋯'),
            ),
            open ? group.sessions.map(sessionRow) : null,
          )
        }
        const createWorkspace = () => {
          if (!props.workspaces || typeof props.workspaces.pickDirectory !== 'function') return
          runAction(() => props.workspaces.pickDirectory().then(path => {
            if (path && typeof props.workspaces.create === 'function') return props.workspaces.create({ path })
            return undefined
          }))
        }

        return h('div', { className: 'drc-tree-layout' },
          h('div', { className: 'drc-toolbar' },
            h('span', { className: 'drc-toolbar-title' }, '会话', h('span', { className: 'drc-toolbar-count' }, allVisible)),
            h('div', { className: 'drc-toolbar-actions' },
              h('button', { className: 'drc-toolbar-button', title: '搜索会话内容', onClick: () => setSearchOpen(value => !value) }, '⌕'),
              h('button', { className: 'drc-toolbar-button', title: flat ? '按工作区分组' : '平铺会话', onClick: () => setFlat(value => !value) }, flat ? '☷' : '≡'),
              h('button', { className: 'drc-toolbar-button', title: '新建会话', onClick: () => { if (props.workspaces && props.workspaces.startSession) props.workspaces.startSession() } }, '+'),
            ),
          ),
          searchOpen ? h('div', { className: 'drc-search-row' },
            h('span', { className: 'drc-search-glyph' }, '⌕'),
            h('input', {
              className: 'drc-search-input', autoFocus: true, value: query, placeholder: '搜索会话标题和内容…',
              onChange: event => setQuery(event.target.value),
              onKeyDown: event => { if (event.key === 'Escape') setSearchOpen(false) },
            }),
            h('span', { className: 'drc-search-status' }, searching ? '检索中' : (searchError || (query.trim() ? '标题+内容' : ''))),
          ) : null,
          h('div', { className: 'drc-scroll' },
            allVisible === 0 ? h('div', { className: 'drc-empty' }, '暂无匹配会话', h('br'), normalizedQuery ? '请尝试其他关键词' : '新建会话后会显示在这里') : null,
            flat ? ids.map(id => byId[id]).filter(visible).map(sessionRow) : h('div', null,
              groups.map(groupRow),
              ungrouped.length ? h('div', { className: 'drc-group', key: '__ungrouped' },
                h('button', { className: 'drc-group-row', onClick: () => setCollapsed(previous => Object.assign({}, previous, { __ungrouped: previous.__ungrouped !== true })) },
                  h('span', { className: 'drc-chevron' + (collapsed.__ungrouped !== true ? ' drc-open' : '') }, '›'),
                  h('span', { className: 'drc-folder-small' }, h(SmallFolderIcon, { open: collapsed.__ungrouped !== true })),
                  h('span', { className: 'drc-group-name' }, '未分组'),
                  h('span', { className: 'drc-group-count' }, ungrouped.length),
                ),
                collapsed.__ungrouped !== true ? ungrouped.map(sessionRow) : null,
              ) : null,
            ),
          ),
          h('div', { className: 'drc-bottom' },
            h('button', { className: 'drc-create-workspace', type: 'button', title: '新建工作区', onClick: createWorkspace },
              h('span', { className: 'drc-create-icon', 'aria-hidden': 'true' }, '+'),
              h('span', { className: 'drc-folder-small' }, h(SmallFolderIcon, { open: false })),
              h('span', { className: 'drc-group-name' }, '新建工作区'),
            ),
            actionError ? h('div', { className: 'drc-action-error', role: 'alert' }, actionError) : null,
            h('div', { className: 'drc-hint' }, '右键会话可重命名、分叉或归档；右键工作区可重命名或删除。'),
          ),
          h(ContextMenu, { menu, onClose: closeMenu }),
        )
      }

      function WorkspaceActivityPanel(props) {
        return h(WorkspaceTree, {
          sessions: props.sessions,
          workspaces: props.workspaces,
          slotProps: props.slotProps,
        })
      }

      const panelStore = {
        // The workspace is the primary navigation surface. It is selected on
        // every fresh page load; clicking the active rail button can still
        // collapse it for the current page.
        active: 'workspace',
        listeners: new Set(),
        get() { return this.active },
        set(value) {
          this.active = value
          setDockLayoutOpen(Boolean(value))
          for (const listener of this.listeners) listener()
        },
        subscribe(listener) {
          this.listeners.add(listener)
          return () => this.listeners.delete(listener)
        },
      }

      function usePanelState() {
        const [active, setActive] = React.useState(() => panelStore.get())
        React.useEffect(() => panelStore.subscribe(() => setActive(panelStore.get())), [])
        return [active, value => panelStore.set(value)]
      }

      const HOST_RIGHT_PANEL_SELECTOR = '.W-zNGW_panel, .nArs4W_panel'
      const HOST_RIGHT_TOGGLE_SELECTOR = '.W-zNGW_toggleCluster, .nArs4W_toggleCluster'
      const HOST_RIGHT_PANEL_HIDDEN_CLASSES = ['W-zNGW_panelHidden', 'nArs4W_panelHidden']
      const HOST_FRAME_SELECTOR = '.pI_x6G_frame'
      const HOST_CENTER_SELECTOR = '.pI_x6G_centerCol'
      const HOST_DETAILS_SELECTOR = '.pI_x6G_detailsCol'

      function syncHostLayoutMetrics() {
        if (typeof document === 'undefined' || typeof window === 'undefined' || !document.documentElement) return
        const hostRoot = document.querySelector('.hHd-Xa_root')
        const hostFrame = document.querySelector(HOST_FRAME_SELECTOR)
        const hostDetails = document.querySelector(HOST_DETAILS_SELECTOR)
        const hostColumn = document.querySelector('.pI_x6G_sidebarCol') || hostRoot
        const hostRect = hostColumn?.getBoundingClientRect?.()
        const collapsed = hostRoot?.classList?.contains?.('hHd-Xa_collapsed') || hostColumn?.classList?.contains?.('hHd-Xa_collapsed')
        const width = !collapsed && hostRect && hostRect.width >= 240 ? Math.round(hostRect.width) : 280
        const newSession = document.querySelector('.hHd-Xa_newSession')
        const newSessionRect = newSession?.getBoundingClientRect?.()
        const top = newSessionRect ? Math.max(96, Math.round(newSessionRect.bottom + 12)) : 114
        const settings = [...(document.querySelectorAll?.('button') || [])].find(button => button.textContent.trim() === '设置')
        const settingsRect = settings?.getBoundingClientRect?.()
        const dockBottom = settingsRect && settingsRect.top > top + 120 ? settingsRect.top - 8 : window.innerHeight - 100
        const bottom = Math.max(24, Math.round(window.innerHeight - dockBottom))
        const hostToggleCluster = document.querySelector(HOST_RIGHT_TOGGLE_SELECTOR)
        const hostToggleRect = hostToggleCluster?.getBoundingClientRect?.()
        const hostRightPanel = document.querySelector(HOST_RIGHT_PANEL_SELECTOR)
        const hostRightPanelRect = hostRightPanel?.getBoundingClientRect?.()
        const hostRightPanelStyle = hostRightPanel ? getComputedStyle(hostRightPanel) : null
        const rightPanelHidden = HOST_RIGHT_PANEL_HIDDEN_CLASSES.some(className => hostRightPanel?.classList?.contains?.(className))
        const rightPanelVisible = Boolean(!rightPanelHidden && hostRightPanelRect && hostRightPanelStyle && hostRightPanelStyle.visibility !== 'hidden' && hostRightPanelStyle.display !== 'none' && hostRightPanelRect.width > 0)
        const rightPanelWidth = rightPanelVisible
          ? Math.max(0, Math.round(Math.min(window.innerWidth, hostRightPanelRect.right) - Math.max(0, hostRightPanelRect.left)))
          : 0
        const rightPanelNeedsInset = Boolean(rightPanelVisible && hostFrame && hostRightPanel && !hostDetails?.contains(hostRightPanel))
        const toggleWidth = hostToggleRect && hostToggleRect.width > 0 ? Math.round(hostToggleRect.width) : 0
        const style = document.documentElement.style
        document.documentElement.dataset.dshSidebarCollapsed = collapsed ? 'true' : 'false'
        style.setProperty('--dsh-resource-center-left-width', `${width}px`)
        style.setProperty('--dsh-resource-center-top', `${top}px`)
        style.setProperty('--dsh-resource-center-bottom', `${bottom}px`)
        style.setProperty('--dsh-resource-center-rail-width', '48px')
        style.setProperty('--dsh-resource-center-right-width', `${rightPanelWidth}px`)
        style.setProperty('--dsh-host-toggle-width', `${toggleWidth}px`)
        hostFrame?.classList.toggle('dsh-resource-center-right-inset', rightPanelNeedsInset)
        hostFrame?.style.setProperty('--dsh-resource-center-right-width', `${rightPanelNeedsInset ? rightPanelWidth : 0}px`)
        if (hostFrame && !hostFrame.querySelector(HOST_CENTER_SELECTOR)) hostFrame.classList.remove('dsh-resource-center-right-inset')
      }

      function setDockLayoutOpen() {
        syncHostLayoutMetrics()
      }

      function installHostLayoutMetrics() {
        if (typeof document === 'undefined' || typeof window === 'undefined' || !document.documentElement) return undefined
        let hostRootObserver
        let observedHostRoot
        let hostRightPanelObserver
        let observedHostRightPanel
        const refreshHostRootObserver = () => {
          const hostRoot = document.querySelector('.hHd-Xa_root')
          if (hostRoot === observedHostRoot) return
          hostRootObserver?.disconnect()
          observedHostRoot = hostRoot
          if (hostRoot && typeof MutationObserver === 'function') {
            hostRootObserver = new MutationObserver(update)
            hostRootObserver.observe(hostRoot, { attributes: true, attributeFilter: ['class', 'style'] })
          }
        }
        const refreshHostRightPanelObserver = () => {
          const hostRightPanel = document.querySelector(HOST_RIGHT_PANEL_SELECTOR)
          if (hostRightPanel === observedHostRightPanel) return
          hostRightPanelObserver?.disconnect()
          observedHostRightPanel = hostRightPanel
          if (hostRightPanel && typeof MutationObserver === 'function') {
            hostRightPanelObserver = new MutationObserver(update)
            hostRightPanelObserver.observe(hostRightPanel, { attributes: true, attributeFilter: ['class', 'style'] })
          }
        }
        const update = () => {
          refreshHostRootObserver()
          refreshHostRightPanelObserver()
          syncHostLayoutMetrics()
        }
        update()
        window.addEventListener('resize', update)
        const hostToggleClick = event => {
          const target = event.target
          if (!target || typeof target.closest !== 'function' || !target.closest(HOST_RIGHT_TOGGLE_SELECTOR)) return
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(update)
          else setTimeout(update, 0)
        }
        document.addEventListener('click', hostToggleClick, true)
        const observers = []
        const observe = node => {
          if (!node || typeof ResizeObserver !== 'function') return
          const observer = new ResizeObserver(update)
          observer.observe(node)
          observers.push(observer)
        }
        const hostRoot = document.querySelector('.hHd-Xa_root')
        const hostColumn = document.querySelector('.pI_x6G_sidebarCol') || hostRoot
        observe(hostColumn)
        observe(hostRoot)
        observe(document.querySelector('.hHd-Xa_newSession'))
        const settings = [...(document.querySelectorAll?.('button') || [])].find(button => button.textContent.trim() === '设置')
        observe(settings)
        observe(document.querySelector(HOST_RIGHT_TOGGLE_SELECTOR))
        observe(document.querySelector(HOST_RIGHT_PANEL_SELECTOR))
        let hostStructureObserver
        if (document.body && typeof MutationObserver === 'function') {
          hostStructureObserver = new MutationObserver(update)
          hostStructureObserver.observe(hostRoot || document.body, { childList: true })
        }
        return () => {
          window.removeEventListener('resize', update)
          document.removeEventListener('click', hostToggleClick, true)
          observers.forEach(observer => observer.disconnect())
          hostRootObserver?.disconnect()
          hostRightPanelObserver?.disconnect()
          hostStructureObserver?.disconnect()
        }
      }

      // Client extension point. A plugin registers a descriptor once and gets
      // a disposer back; the activity rail reacts to registry changes without
      // coupling the contributed panel to the workspace implementation.
      function createActivityRegistry() {
        const activities = new Map()
        const listeners = new Set()
        const notify = () => listeners.forEach(listener => listener())
        const normalize = descriptor => {
          if (!descriptor || typeof descriptor.id !== 'string' || !descriptor.id.trim()) {
            throw new Error('resourceCenter.registerActivity: id is required')
          }
          const component = descriptor.component || descriptor.render
          if (typeof component !== 'function') {
            throw new Error('resourceCenter.registerActivity: component or render is required')
          }
          return Object.freeze({
            id: descriptor.id.trim(),
            label: String(descriptor.label || descriptor.id),
            order: Number.isFinite(descriptor.order) ? descriptor.order : 100,
            icon: descriptor.icon,
            component,
          })
        }
        return {
          registerActivity(descriptor) {
            const activity = normalize(descriptor)
            activities.set(activity.id, activity)
            notify()
            return () => {
              if (activities.get(activity.id) !== activity) return
              activities.delete(activity.id)
              notify()
            }
          },
          getActivities() {
            return Array.from(activities.values()).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
          },
          subscribe(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
          },
        }
      }

      function createResourceCenterService() {
        const registry = createActivityRegistry()
        const rightSidebarListeners = new Set()
        let rightSidebar
        const notifyRightSidebar = () => rightSidebarListeners.forEach(listener => listener())
        registry.registerActivity({
          id: 'workspace',
          label: '工作区',
          order: 0,
          icon: ActivityIcon,
          component: WorkspaceActivityPanel,
        })
        return Object.freeze({
          registerActivity: registry.registerActivity,
          getActivities: registry.getActivities,
          subscribe: registry.subscribe,
          open(id) {
            if (registry.getActivities().some(activity => activity.id === id)) panelStore.set(id)
          },
          close() { panelStore.set(null) },
          toggle(id) {
            if (!registry.getActivities().some(activity => activity.id === id)) return
            panelStore.set(panelStore.get() === id ? null : id)
          },
          getActive() { return panelStore.get() },
          registerRightSidebar(bridge) {
            if (!bridge || typeof bridge.open !== 'function' || typeof bridge.close !== 'function') {
              throw new Error('resourceCenter.registerRightSidebar: invalid bridge')
            }
            rightSidebar = bridge
            notifyRightSidebar()
            return () => {
              if (rightSidebar !== bridge) return
              rightSidebar = undefined
              notifyRightSidebar()
            }
          },
          getRightSidebar() { return rightSidebar },
          subscribeRightSidebar(listener) {
            if (typeof listener !== 'function') return () => {}
            rightSidebarListeners.add(listener)
            return () => rightSidebarListeners.delete(listener)
          },
          openRightSidebar() { return rightSidebar?.open?.() || false },
          closeRightSidebar() { return rightSidebar?.close?.() || false },
          toggleRightSidebar() { return rightSidebar?.toggle?.() || false },
          isRightSidebarOpen() { return Boolean(rightSidebar?.isOpen?.()) },
        })
      }

      function useActivityList(sidebar) {
        const read = () => sidebar ? sidebar.getActivities() : []
        const [activities, setActivities] = React.useState(read)
        React.useEffect(() => {
          if (!sidebar) return undefined
          setActivities(read())
          return sidebar.subscribe(() => setActivities(read()))
        }, [sidebar])
        return activities
      }

      function ActivityIconView(props) {
        const Icon = props.activity.icon
        if (typeof Icon === 'function') return h(Icon, { active: props.active, activity: props.activity })
        return Icon || h(ActivityIcon)
      }

      function WorkspaceDock(props) {
        const [active, setActive] = usePanelState()
        const activities = useActivityList(props.sidebar)
        const activeActivity = activities.find(activity => activity.id === active)
        const open = Boolean(activeActivity)
        React.useEffect(() => {
          if (active && !activeActivity) setActive(null)
        }, [active, activeActivity])
        React.useEffect(() => {
          setDockLayoutOpen(open)
          return () => { if (open) setDockLayoutOpen(false) }
        }, [open])
        return h('div', { className: 'drc-dock' + (open ? ' drc-open' : '') },
          h('nav', { className: 'drc-rail', 'aria-label': '功能导航' },
            activities.map(activity => h('button', {
              key: activity.id,
              className: 'drc-rail-button' + (active === activity.id ? ' drc-active' : ''),
              title: activity.label, 'aria-label': activity.label, 'aria-pressed': active === activity.id,
              onClick: () => setActive(active === activity.id ? null : activity.id),
            }, h(ActivityIconView, { activity, active: active === activity.id }))),
          ),
          open ? h('aside', { className: 'drc-panel', 'aria-label': activeActivity.label },
            h(activeActivity.component, {
              active: activeActivity,
              sidebar: props.sidebar,
              close: () => setActive(null),
              sessions: props.sessions,
              workspaces: props.workspaces,
              slotProps: props.slotProps,
            }),
          ) : null,
        )
      }

      const inject = ['slots', 'sessions', 'workspaces', 'inputTriggers']

      function apply(ctx) {
        const sidebar = createResourceCenterService()
        ctx.provide('resourceCenter', sidebar)
        ctx.provide('dshResourceCenter', sidebar)
        ctx.effect(installDocumentBranding, 'dsh-resource-center: document branding')
        const inputTriggers = ctx.get('inputTriggers')
        if (inputTriggers) ctx.effect(() => inputTriggers.registerSource(createSessionInputSource(ctx.get('sessions'), ctx.get('workspaces'))), 'dsh-resource-center: @conversation source')
        if (serviceManager && typeof serviceManager.apply === 'function') {
          serviceManager.apply(ctx, { sidebar })
        }
        if (testModule && typeof testModule.apply === 'function') {
          testModule.apply(ctx, { sidebar })
        }
        if (usageStatsModule && typeof usageStatsModule.apply === 'function') {
          usageStatsModule.apply(ctx, { sidebar })
        }
        if (rightSidebarModule && typeof rightSidebarModule.apply === 'function') {
          rightSidebarModule.apply(ctx, { sidebar })
        }
        ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(
          { name: 'conversation.session.header.utilities', id: 'dsh-resource-center-session-cost', order: 100, label: '当前会话费用' },
          props => h(CurrentSessionCost, props),
        ))
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.plugin = 'dsh-resource-center'
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        }, 'dsh-resource-center: styles')
        ctx.effect(installHostLayoutMetrics, 'dsh-resource-center: host layout metrics')
        ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register(
          { name: 'sidebar.workspaces', id: 'dsh-resource-center', priority: -20 },
          props => h(WorkspaceDock, {
            sidebar,
            sessions: ctx.get('sessions'),
            workspaces: ctx.get('workspaces'),
            slotProps: props,
          }),
        ))
      }

      return { inject, apply }
      }
    })
  }
})(typeof window === "undefined" ? globalThis : window);
