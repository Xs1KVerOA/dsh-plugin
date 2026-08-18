(function defineDshResourceCenterModule_rightSidebar(global) {
  const registry = global.__dshResourceCenterModuleRegistry || (global.__dshResourceCenterModuleRegistry = {})
  if (registry.rightSidebar) return
  registry.rightSidebar = function registerDshResourceCenterRightSidebar(global) {
    const loader = global.__ModuleLoader__
    if (!loader || typeof loader.load !== 'function') {
      throw new Error('dsh-resource-center-right-sidebar: client module loader is unavailable')
    }

    loader.load({
      id: 'dsh-resource-center-right-sidebar',
      factory() {
        const MITM_API_BASE = '/api/dsh-web-testing'
        const MITM_BROWSER_ROUTE = `${MITM_API_BASE}/browser`
        const MITM_CONTROL_ATTR = 'data-dsh-resource-center-mitm-browser'
        const MITM_TARGET_ATTR = 'data-dsh-resource-center-mitm-target'
        const MITM_STYLE_ATTR = 'data-dsh-resource-center-mitm-style'

        function rightPanelElement() {
          return typeof document === 'undefined' ? null : document.querySelector('.W-zNGW_panel')
        }

        function rightPanelToggle() {
          if (typeof document === 'undefined') return null
          const cluster = document.querySelector('.W-zNGW_toggleCluster')
          if (!cluster) return null
          const buttons = [...cluster.querySelectorAll('button')]
          return buttons[buttons.length - 1] || null
        }

        function isRightSidebarOpen() {
          const panel = rightPanelElement()
          if (!panel) return false
          const style = typeof getComputedStyle === 'function' ? getComputedStyle(panel) : null
          return !panel.classList.contains('W-zNGW_panelHidden')
            && style?.visibility !== 'hidden'
            && style?.display !== 'none'
            && panel.getBoundingClientRect().width > 0
        }

        function browserElement() {
          return typeof document === 'undefined' ? null : document.querySelector('.W-zNGW_browser')
        }

        function browserBarElement() {
          return browserElement()?.querySelector('.W-zNGW_browserBar') || null
        }

        function browserFrameElement() {
          const browser = browserElement()
          return browser?.querySelector('iframe.W-zNGW_browserFrame, iframe[title]') || null
        }

        function browserTarget(raw) {
          const value = String(raw || '').trim()
          if (!value || typeof URL !== 'function') return ''
          try {
            const parsed = new URL(value, typeof location === 'undefined' ? 'http://dsh-resource-center.local' : location.href)
            if (!['http:', 'https:'].includes(parsed.protocol)) return ''
            return parsed.href
          } catch {
            return ''
          }
        }

        function browserProxyTarget(raw) {
          if (typeof URL !== 'function') return ''
          try {
            const parsed = new URL(String(raw || ''), typeof location === 'undefined' ? 'http://dsh-resource-center.local' : location.href)
            if (parsed.pathname !== MITM_BROWSER_ROUTE) return ''
            return browserTarget(parsed.searchParams.get('url'))
          } catch {
            return ''
          }
        }

        function browserProxyUrl(target) {
          return `${MITM_BROWSER_ROUTE}?url=${encodeURIComponent(target)}`
        }

        function installBrowserMitmStyle() {
          if (typeof document === 'undefined' || document.querySelector(`style[${MITM_STYLE_ATTR}]`)) return
          const style = document.createElement('style')
          style.setAttribute(MITM_STYLE_ATTR, '')
          style.textContent = `
.dsh-resource-center-mitm-browser-toggle{display:inline-flex;align-items:center;gap:5px;min-width:0;height:26px;margin-left:4px;padding:0 8px;border:1px solid #d9e1eb;border-radius:6px;background:#fff;color:#667085;font:inherit;font-size:11px;line-height:1;cursor:pointer;transition:background .15s,border-color .15s,color .15s,box-shadow .15s}
.dsh-resource-center-mitm-browser-toggle:hover{background:#f4f7fb;border-color:#b9c9df;color:#3578e5}
.dsh-resource-center-mitm-browser-toggle.active{border-color:#b9e0c6;background:#f0fbf4;color:#2f8b50}
.dsh-resource-center-mitm-browser-toggle.busy{opacity:.7;cursor:wait}
.dsh-resource-center-mitm-browser-toggle:disabled{cursor:wait}
.dsh-resource-center-mitm-browser-toggle .dsh-resource-center-mitm-browser-dot{width:6px;height:6px;border-radius:50%;background:#aab4c1;box-shadow:0 0 0 2px rgba(170,180,193,.12)}
.dsh-resource-center-mitm-browser-toggle.active .dsh-resource-center-mitm-browser-dot{background:#40b96d;box-shadow:0 0 0 2px rgba(64,185,109,.14)}
`
          document.head?.appendChild(style)
        }

        function createRightSidebarBridge(ctx) {
          const listeners = new Set()
          let bodyObserver
          let panelObserver
          let resizeObserver
          let browserObserver
          let browserPollTimer
          let disposed = false
          let observedPanel
          let observedBrowser
          let browserControlBar
          let browserControlButton
          let browserControlText
          let browserStyle
          let mitmSnapshot
          let mitmRefreshPromise
          let mitmBusy = false
          let mitmError = ''

          const notify = () => {
            if (disposed) return
            listeners.forEach(listener => {
              try { listener() } catch (error) { console.error('[dsh-resource-center] right sidebar listener error:', error) }
            })
          }

          const requestMitm = async (path, options = {}) => {
            if (typeof fetch !== 'function') throw new Error('浏览器不支持 fetch')
            const response = await fetch(`${MITM_API_BASE}/${String(path).replace(/^\/+/, '')}`, {
              ...options,
              headers: { 'content-type': 'application/json', ...(options.headers || {}) },
            })
            const result = await response.json().catch(() => ({}))
            if (!response.ok || result.ok === false) throw new Error(result.error || `MITM 请求失败 (${response.status})`)
            return result
          }

          const browserMitmEnabled = () => Boolean(mitmSnapshot?.proxy)

          const targetFromFrame = frame => {
            const stored = browserTarget(frame?.getAttribute(MITM_TARGET_ATTR))
            if (stored) return stored
            const proxied = browserProxyTarget(frame?.getAttribute('src'))
            if (proxied) return proxied
            return browserTarget(frame?.getAttribute('src'))
          }

          const rewriteBrowserFrame = () => {
            const frame = browserFrameElement()
            if (!frame) return
            const target = targetFromFrame(frame)
            if (!target) return
            if (browserMitmEnabled()) {
              frame.setAttribute(MITM_TARGET_ATTR, target)
              const expected = browserProxyUrl(target)
              if (frame.getAttribute('src') !== expected) frame.setAttribute('src', expected)
              return
            }
            const original = browserTarget(frame.getAttribute(MITM_TARGET_ATTR))
            if (original && frame.getAttribute('src') !== original) frame.setAttribute('src', original)
            if (original) frame.removeAttribute(MITM_TARGET_ATTR)
          }

          const updateBrowserControl = () => {
            if (!browserControlButton) return
            const active = browserMitmEnabled()
            const endpoint = mitmSnapshot?.proxy
            const endpointLabel = endpoint ? ` · ${endpoint.host}:${endpoint.port}` : ''
            browserControlButton.classList.toggle('active', active)
            browserControlButton.classList.toggle('busy', mitmBusy)
            browserControlButton.disabled = mitmBusy
            browserControlButton.setAttribute('aria-pressed', String(active))
            browserControlButton.title = mitmError
              ? `MITM 监听错误：${mitmError}`
              : active
                ? `已跟随资源中心 MITM 监听${endpointLabel}；点击停止`
                : '跟随资源中心左侧 MITM 配置启动监听'
            if (browserControlText) browserControlText.textContent = mitmBusy ? '连接中…' : active ? 'MITM 已开' : 'MITM 监听'
          }

          const refreshMitmStatus = async ({ silent = false } = {}) => {
            if (mitmRefreshPromise) return mitmRefreshPromise
            mitmRefreshPromise = requestMitm('status').then(result => {
              mitmSnapshot = result
              mitmError = ''
              updateBrowserControl()
              rewriteBrowserFrame()
              notify()
              return result
            }).catch(error => {
              mitmError = error?.message || String(error)
              updateBrowserControl()
              if (!silent) notify()
              return null
            }).finally(() => { mitmRefreshPromise = undefined })
            return mitmRefreshPromise
          }

          const toggleMitm = async () => {
            if (mitmBusy) return false
            mitmBusy = true
            mitmError = ''
            updateBrowserControl()
            try {
              const current = await requestMitm('status')
              mitmSnapshot = current
              const running = Boolean(current.proxy)
              const config = current.mitm || {}
              await requestMitm(running ? 'proxy/stop' : 'proxy/start', {
                method: 'POST',
                body: JSON.stringify(running ? {} : {
                  host: config.listenHost,
                  port: Number(config.listenPort) || 0,
                }),
              })
              await refreshMitmStatus()
              return true
            } catch (error) {
              mitmError = error?.message || String(error)
              updateBrowserControl()
              notify()
              return false
            } finally {
              mitmBusy = false
              updateBrowserControl()
              notify()
            }
          }

          const mountBrowserMitmControl = () => {
            const bar = browserBarElement()
            if (!bar) return
            const changedBar = browserControlBar !== bar
            browserControlBar = bar
            installBrowserMitmStyle()
            browserStyle = document.querySelector(`style[${MITM_STYLE_ATTR}]`) || browserStyle
            let button = bar.querySelector(`button[${MITM_CONTROL_ATTR}]`)
            if (!button) {
              button = document.createElement('button')
              button.type = 'button'
              button.className = 'dsh-resource-center-mitm-browser-toggle'
              button.setAttribute(MITM_CONTROL_ATTR, '')
              button.setAttribute('aria-label', 'MITM 监听')
              const dot = document.createElement('span')
              dot.className = 'dsh-resource-center-mitm-browser-dot'
              dot.setAttribute('aria-hidden', 'true')
              const text = document.createElement('span')
              text.className = 'dsh-resource-center-mitm-browser-text'
              button.append(dot, text)
              button.addEventListener('click', () => { void toggleMitm() })
              bar.appendChild(button)
            }
            browserControlButton = button
            browserControlText = button.querySelector('.dsh-resource-center-mitm-browser-text')
            updateBrowserControl()
            rewriteBrowserFrame()
            if (changedBar || !mitmSnapshot) void refreshMitmStatus({ silent: true })
          }

          const observeBrowser = () => {
            const browser = browserElement()
            if (browser === observedBrowser) {
              mountBrowserMitmControl()
              return
            }
            browserObserver?.disconnect()
            if (browserPollTimer) clearInterval(browserPollTimer)
            browserObserver = undefined
            browserPollTimer = undefined
            observedBrowser = browser
            browserControlBar = undefined
            browserControlButton = undefined
            browserControlText = undefined
            if (!browser) return
            if (typeof MutationObserver === 'function') {
              browserObserver = new MutationObserver(() => {
                mountBrowserMitmControl()
                rewriteBrowserFrame()
              })
              browserObserver.observe(browser, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
            }
            mountBrowserMitmControl()
            browserPollTimer = setInterval(() => { void refreshMitmStatus({ silent: true }); mountBrowserMitmControl() }, 1600)
          }

          const observePanel = () => {
            const panel = rightPanelElement()
            if (panel !== observedPanel) {
              panelObserver?.disconnect()
              resizeObserver?.disconnect()
              observedPanel = panel
              if (panel && typeof MutationObserver === 'function') {
                panelObserver = new MutationObserver(() => { observeBrowser(); notify() })
                panelObserver.observe(panel, { attributes: true, attributeFilter: ['class', 'style'], childList: true, subtree: true })
              }
              if (panel && typeof ResizeObserver === 'function') {
                resizeObserver = new ResizeObserver(notify)
                resizeObserver.observe(panel)
              }
            }
            observeBrowser()
          }

          const bridge = {
            id: 'dsh-better-sidebar',
            label: '右侧工作台',
            getService() {
              try { return ctx?.get?.('betterSidebar') || ctx?.betterSidebar } catch { return undefined }
            },
            isAvailable() {
              return Boolean(rightPanelElement() || rightPanelToggle())
            },
            isOpen: isRightSidebarOpen,
            toggle() {
              const button = rightPanelToggle()
              if (!button || typeof button.click !== 'function') return false
              button.click()
              notify()
              return true
            },
            open() {
              if (isRightSidebarOpen()) return true
              return bridge.toggle()
            },
            close() {
              if (!isRightSidebarOpen()) return true
              return bridge.toggle()
            },
            openTab(seed, scope) {
              const service = bridge.getService()
              if (!service || typeof service.openTab !== 'function') return false
              service.openTab(seed, scope)
              return true
            },
            openFile(scope, path, title) {
              const service = bridge.getService()
              if (!service || typeof service.openFile !== 'function') return false
              service.openFile(scope, path, title)
              return true
            },
            getSnapshot() {
              const service = bridge.getService()
              return service && typeof service.getSnapshot === 'function'
                ? service.getSnapshot()
                : { available: bridge.isAvailable(), open: bridge.isOpen() }
            },
            getMitmStatus() { return mitmSnapshot },
            getMitmConfig() { return mitmSnapshot?.mitm || null },
            isMitmListening() { return browserMitmEnabled() },
            refreshMitmStatus,
            toggleMitm,
            subscribe(listener) {
              if (typeof listener !== 'function') return () => {}
              listeners.add(listener)
              observePanel()
              return () => listeners.delete(listener)
            },
            subscribeMitm(listener) {
              if (typeof listener !== 'function') return () => {}
              listeners.add(listener)
              observeBrowser()
              void refreshMitmStatus({ silent: true })
              return () => listeners.delete(listener)
            },
            dispose() {
              disposed = true
              listeners.clear()
              bodyObserver?.disconnect()
              panelObserver?.disconnect()
              resizeObserver?.disconnect()
              browserObserver?.disconnect()
              if (browserPollTimer) clearInterval(browserPollTimer)
              browserControlButton?.remove()
              browserStyle?.remove()
              bodyObserver = undefined
              panelObserver = undefined
              resizeObserver = undefined
              browserObserver = undefined
              browserPollTimer = undefined
              observedPanel = undefined
              observedBrowser = undefined
              browserControlBar = undefined
              browserControlButton = undefined
              browserControlText = undefined
            },
          }

          if (typeof document !== 'undefined' && document.body && typeof MutationObserver === 'function') {
            bodyObserver = new MutationObserver(() => { observePanel(); notify() })
            bodyObserver.observe(document.body, { childList: true, subtree: true })
          }
          if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('resize', notify)
          const originalDispose = bridge.dispose
          bridge.dispose = () => {
            if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') window.removeEventListener('resize', notify)
            originalDispose()
          }
          observePanel()
          return bridge
        }

        function apply(ctx, options = {}) {
          const sidebar = options.sidebar || ctx?.get?.('resourceCenter')
          const bridge = createRightSidebarBridge(ctx)
          ctx.provide('resourceCenterRightSidebar', bridge)
          const unregister = sidebar && typeof sidebar.registerRightSidebar === 'function'
            ? sidebar.registerRightSidebar(bridge)
            : undefined
          if (typeof ctx.effect === 'function') {
            ctx.effect(() => () => {
              unregister?.()
              bridge.dispose()
            }, 'dsh-resource-center: right sidebar bridge')
          }
          return bridge
        }

        return { apply, createRightSidebarBridge }
      },
    })
  }
})(typeof window === 'undefined' ? globalThis : window)
