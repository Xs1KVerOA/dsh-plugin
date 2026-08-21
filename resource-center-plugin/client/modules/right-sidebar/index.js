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
      factory(require) {
        // The workbench is owned by resource-center. This module only adapts
        // the browser/MITM controls to the independently vendored workbench.
        let coreModule
        const MITM_API_BASE = '/api/dsh-web-testing'
        const MITM_BROWSER_ROUTE = `${MITM_API_BASE}/browser`
        const MITM_CONTROL_ATTR = 'data-dsh-resource-center-mitm-browser'
        const MITM_PANEL_ATTR = 'data-dsh-resource-center-mitm-panel'
        const MITM_TARGET_ATTR = 'data-dsh-resource-center-mitm-target'
        const BROWSER_COMPAT_ATTR = 'data-dsh-resource-center-browser-compat'
        const BROWSER_COMPATIBILITY_HOOK = '__DSH_RESOURCE_CENTER_BROWSER_COMPATIBILITY_URL'
        const MITM_STYLE_ATTR = 'data-dsh-resource-center-mitm-style'
        const RIGHT_PANEL_SELECTOR = '.W-zNGW_panel, .nArs4W_panel'
        const RIGHT_TOGGLE_SELECTOR = '.W-zNGW_toggleCluster, .nArs4W_toggleCluster'
        const RIGHT_PANEL_HIDDEN_CLASSES = ['W-zNGW_panelHidden', 'nArs4W_panelHidden']
        const RIGHT_BROWSER_SELECTOR = '.W-zNGW_browser, .nArs4W_browser'
        const RIGHT_BROWSER_BAR_SELECTOR = '.W-zNGW_browserBar, .nArs4W_browserBar'
        const RIGHT_BROWSER_SANDBOX_SELECTOR = '.W-zNGW_sandboxStatus, .nArs4W_sandboxStatus'
        const RIGHT_BROWSER_FRAME_SELECTOR = 'iframe.W-zNGW_browserFrame, iframe.nArs4W_browserFrame, iframe[title]'

        function rightPanelElement() {
          if (typeof document === 'undefined') return null
          const panels = [...(document.querySelectorAll?.(RIGHT_PANEL_SELECTOR) || [])]
          return panels.find(panel => {
            const style = typeof getComputedStyle === 'function' ? getComputedStyle(panel) : null
            const rect = panel.getBoundingClientRect?.()
            return !RIGHT_PANEL_HIDDEN_CLASSES.some(className => panel.classList.contains(className))
              && style?.visibility !== 'hidden'
              && style?.display !== 'none'
              && rect?.width > 0
          }) || panels[0] || null
        }

        function rightPanelToggle() {
          if (typeof document === 'undefined') return null
          const cluster = document.querySelector(RIGHT_TOGGLE_SELECTOR)
          if (!cluster) return null
          const buttons = [...cluster.querySelectorAll('button')]
          return buttons[buttons.length - 1] || null
        }

        function isRightSidebarOpen() {
          const panel = rightPanelElement()
          if (!panel) return false
          const style = typeof getComputedStyle === 'function' ? getComputedStyle(panel) : null
          return !RIGHT_PANEL_HIDDEN_CLASSES.some(className => panel.classList.contains(className))
            && style?.visibility !== 'hidden'
            && style?.display !== 'none'
            && panel.getBoundingClientRect().width > 0
        }

        function browserElement() {
          return typeof document === 'undefined' ? null : document.querySelector(RIGHT_BROWSER_SELECTOR)
        }

        function browserBarElement() {
          return browserElement()?.querySelector(RIGHT_BROWSER_BAR_SELECTOR) || null
        }

        function browserSandboxElement() {
          return browserElement()?.querySelector(RIGHT_BROWSER_SANDBOX_SELECTOR) || null
        }

        function browserFrameElement() {
          const browser = browserElement()
          return browser?.querySelector(RIGHT_BROWSER_FRAME_SELECTOR) || null
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

        let previousBrowserCompatibilityHook
        let installedBrowserCompatibilityHook

        function installBrowserCompatibilityHook() {
          if (typeof window === 'undefined') return
          if (installedBrowserCompatibilityHook && window[BROWSER_COMPATIBILITY_HOOK] === installedBrowserCompatibilityHook) return
          previousBrowserCompatibilityHook = window[BROWSER_COMPATIBILITY_HOOK]
          installedBrowserCompatibilityHook = target => {
            const normalized = browserTarget(target)
            return normalized ? browserProxyUrl(normalized) : target
          }
          window[BROWSER_COMPATIBILITY_HOOK] = installedBrowserCompatibilityHook
        }

        function uninstallBrowserCompatibilityHook() {
          if (typeof window === 'undefined' || !installedBrowserCompatibilityHook) return
          if (window[BROWSER_COMPATIBILITY_HOOK] === installedBrowserCompatibilityHook) {
            window[BROWSER_COMPATIBILITY_HOOK] = previousBrowserCompatibilityHook
          }
          previousBrowserCompatibilityHook = undefined
          installedBrowserCompatibilityHook = undefined
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
.dsh-resource-center-mitm-browser-panel{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:0 0 auto;min-height:56px;padding:8px 12px;border-bottom:1px solid #e6ebf2;background:linear-gradient(180deg,#fbfcfe,#f5f8fc);color:#344054;font:inherit}
.dsh-resource-center-mitm-browser-panel .dsh-resource-center-mitm-browser-panel-copy{display:flex;align-items:center;gap:8px;min-width:0}
.dsh-resource-center-mitm-browser-panel .dsh-resource-center-mitm-browser-panel-dot{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#aab4c1;box-shadow:0 0 0 3px rgba(170,180,193,.12)}
.dsh-resource-center-mitm-browser-panel.active .dsh-resource-center-mitm-browser-panel-dot{background:#40b96d;box-shadow:0 0 0 3px rgba(64,185,109,.14)}
.dsh-resource-center-mitm-browser-panel .dsh-resource-center-mitm-browser-panel-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.dsh-resource-center-mitm-browser-panel .dsh-resource-center-mitm-browser-panel-title{font-size:12px;font-weight:600;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-resource-center-mitm-browser-panel .dsh-resource-center-mitm-browser-panel-meta{font-size:10px;line-height:14px;color:#8a96a6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-resource-center-mitm-browser-panel .dsh-resource-center-mitm-browser-panel-action{height:28px;flex:0 0 auto;padding:0 10px;border:1px solid #cbd7e6;border-radius:6px;background:#fff;color:#3578e5;font:inherit;font-size:11px;line-height:26px;cursor:pointer;transition:background .15s,border-color .15s,color .15s,box-shadow .15s}
.dsh-resource-center-mitm-browser-panel .dsh-resource-center-mitm-browser-panel-action:hover{background:#edf4ff;border-color:#8eb4ef}
.dsh-resource-center-mitm-browser-panel.active .dsh-resource-center-mitm-browser-panel-action{border-color:#f0b6b6;background:#fff7f7;color:#c24141}
.dsh-resource-center-mitm-browser-panel.active .dsh-resource-center-mitm-browser-panel-action:hover{background:#fff0f0;border-color:#e78b8b}
.dsh-resource-center-mitm-browser-panel.busy{opacity:.75}
.dsh-resource-center-mitm-browser-panel.error .dsh-resource-center-mitm-browser-panel-meta{color:#c24141}
.dsh-resource-center-mitm-browser-panel .dsh-resource-center-mitm-browser-panel-action:disabled{cursor:wait;opacity:.7}
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
          let browserControlPanel
          let browserControlPanelButton
          let browserControlPanelTitle
          let browserControlPanelMeta
          let browserStyle
          let mitmSnapshot
          let mitmRefreshPromise
          let mitmRefreshController
          let mitmBusy = false
          let mitmError = ''
          let browserOpenEventHandler

          const notify = () => {
            if (disposed) return
            listeners.forEach(listener => {
              try { listener() } catch (error) { console.error('[dsh-resource-center] right sidebar listener error:', error) }
            })
          }

          const fetchWithTimeout = async (input, options = {}, timeoutMs = 10000) => {
            const controller = typeof AbortController === 'function' ? new AbortController() : null
            const parentSignal = options.signal
            let timer
            const abort = () => controller?.abort()
            if (parentSignal?.aborted) abort()
            else parentSignal?.addEventListener?.('abort', abort, { once: true })
            if (controller) timer = setTimeout(() => controller.abort(), timeoutMs)
            try {
              return await fetch(input, { ...options, ...(controller ? { signal: controller.signal } : {}) })
            } finally {
              if (timer) clearTimeout(timer)
              parentSignal?.removeEventListener?.('abort', abort)
            }
          }

          const requestMitm = async (path, options = {}) => {
            if (typeof fetch !== 'function') throw new Error('浏览器不支持 fetch')
            const response = await fetchWithTimeout(`${MITM_API_BASE}/${String(path).replace(/^\/+/, '')}`, {
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
            const compatibilityMode = frame.getAttribute(BROWSER_COMPAT_ATTR) === 'true'
            if (browserMitmEnabled() || compatibilityMode) {
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
            if (!browserControlButton && !browserControlPanelButton) return
            const active = browserMitmEnabled()
            const endpoint = mitmSnapshot?.proxy
            const endpointLabel = endpoint ? ` · ${endpoint.host}:${endpoint.port}` : ''
            const title = mitmError
              ? `MITM 监听错误：${mitmError}`
              : active
                ? `已跟随资源中心 MITM 监听${endpointLabel}；点击停止`
                : '跟随资源中心左侧 MITM 配置启动监听'
            const label = mitmBusy ? '连接中…' : active ? 'MITM 已开' : 'MITM 监听'
            const panelTitle = mitmError ? 'MITM 监听启动失败' : mitmBusy ? (active ? '正在停止 MITM 监听…' : '正在启动 MITM 监听…') : active ? 'MITM 监听已启动' : '启动共享 MITM 监听'
            const panelMeta = mitmError || (active ? `跟随左侧配置${endpointLabel}` : '启动后自动使用左侧 MITM 配置')
            const panelLabel = mitmBusy ? (active ? '停止中…' : '启动中…') : active ? '停止监听' : '启动监听'
            const updateButton = (button, text, buttonTitle) => {
              if (!button) return
              if (button.classList.contains('active') !== active) button.classList.toggle('active', active)
              if (button.classList.contains('busy') !== mitmBusy) button.classList.toggle('busy', mitmBusy)
              if (button.disabled !== mitmBusy) button.disabled = mitmBusy
              if (button.getAttribute('aria-pressed') !== String(active)) button.setAttribute('aria-pressed', String(active))
              if (button.title !== buttonTitle) button.title = buttonTitle
              const textNode = button.querySelector('.dsh-resource-center-mitm-browser-text')
              if (textNode && textNode.textContent !== text) textNode.textContent = text
            }
            updateButton(browserControlButton, label, title)
            if (browserControlPanel) {
              if (browserControlPanel.classList.contains('active') !== active) browserControlPanel.classList.toggle('active', active)
              if (browserControlPanel.classList.contains('busy') !== mitmBusy) browserControlPanel.classList.toggle('busy', mitmBusy)
              if (browserControlPanel.classList.contains('error') !== Boolean(mitmError)) browserControlPanel.classList.toggle('error', Boolean(mitmError))
            }
            if (browserControlPanelTitle && browserControlPanelTitle.textContent !== panelTitle) browserControlPanelTitle.textContent = panelTitle
            if (browserControlPanelMeta && browserControlPanelMeta.textContent !== panelMeta) browserControlPanelMeta.textContent = panelMeta
            if (browserControlPanelButton) {
              if (browserControlPanelButton.textContent !== panelLabel) browserControlPanelButton.textContent = panelLabel
              if (browserControlPanelButton.disabled !== mitmBusy) browserControlPanelButton.disabled = mitmBusy
              if (browserControlPanelButton.title !== title) browserControlPanelButton.title = title
              if (browserControlPanelButton.getAttribute('aria-pressed') !== String(active)) browserControlPanelButton.setAttribute('aria-pressed', String(active))
            }
          }

          const refreshMitmStatus = async ({ silent = false } = {}) => {
            if (mitmRefreshPromise) return mitmRefreshPromise
            const shared = typeof window !== 'undefined' ? window.__dshResourceCenterMitmStatusCache : undefined
            if (shared && Date.now() - Number(shared.at) < 1200 && shared.value) {
              mitmSnapshot = shared.value
              mitmError = ''
              updateBrowserControl()
              rewriteBrowserFrame()
              notify()
              return shared.value
            }
            const controller = typeof AbortController === 'function' ? new AbortController() : null
            mitmRefreshController = controller
            mitmRefreshPromise = requestMitm('status', controller ? { signal: controller.signal } : undefined).then(result => {
              mitmSnapshot = result
              if (typeof window !== 'undefined') window.__dshResourceCenterMitmStatusCache = { value: result, at: Date.now() }
              mitmError = ''
              updateBrowserControl()
              rewriteBrowserFrame()
              notify()
              return result
            }).catch(error => {
              if (error?.name === 'AbortError') return null
              mitmError = error?.message || String(error)
              updateBrowserControl()
              if (!silent) notify()
              return null
            }).finally(() => {
              if (mitmRefreshController === controller) mitmRefreshController = undefined
              mitmRefreshPromise = undefined
            })
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
            const browser = browserElement()
            const bar = browserBarElement()
            if (!browser || !bar) return
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
            let panel = browser.querySelector(`[${MITM_PANEL_ATTR}]`)
            if (!panel) {
              panel = document.createElement('section')
              panel.className = 'dsh-resource-center-mitm-browser-panel'
              panel.setAttribute(MITM_PANEL_ATTR, '')
              panel.setAttribute('aria-label', 'MITM 监听控制')
              const copy = document.createElement('div')
              copy.className = 'dsh-resource-center-mitm-browser-panel-copy'
              const dot = document.createElement('span')
              dot.className = 'dsh-resource-center-mitm-browser-panel-dot'
              dot.setAttribute('aria-hidden', 'true')
              const text = document.createElement('div')
              text.className = 'dsh-resource-center-mitm-browser-panel-text'
              const title = document.createElement('strong')
              title.className = 'dsh-resource-center-mitm-browser-panel-title'
              const meta = document.createElement('span')
              meta.className = 'dsh-resource-center-mitm-browser-panel-meta'
              text.append(title, meta)
              copy.append(dot, text)
              const action = document.createElement('button')
              action.type = 'button'
              action.className = 'dsh-resource-center-mitm-browser-panel-action'
              action.addEventListener('click', () => { void toggleMitm() })
              panel.append(copy, action)
              const sandbox = browserSandboxElement()
              if (sandbox?.parentElement === browser) sandbox.after(panel)
              else bar.after(panel)
            }
            browserControlPanel = panel
            browserControlPanelButton = panel.querySelector('.dsh-resource-center-mitm-browser-panel-action')
            browserControlPanelTitle = panel.querySelector('.dsh-resource-center-mitm-browser-panel-title')
            browserControlPanelMeta = panel.querySelector('.dsh-resource-center-mitm-browser-panel-meta')
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
            browserControlPanel?.remove()
            browserControlBar = undefined
            browserControlButton = undefined
            browserControlText = undefined
            browserControlPanel = undefined
            browserControlPanelButton = undefined
            browserControlPanelTitle = undefined
            browserControlPanelMeta = undefined
            if (!browser) return
            if (typeof MutationObserver === 'function') {
              browserObserver = new MutationObserver(() => {
                mountBrowserMitmControl()
                rewriteBrowserFrame()
              })
              browserObserver.observe(browser, { childList: true, attributes: true, attributeFilter: ['src', BROWSER_COMPAT_ATTR] })
            }
            mountBrowserMitmControl()
            browserPollTimer = setInterval(() => { void refreshMitmStatus({ silent: true }); mountBrowserMitmControl() }, 4000)
          }

          const observePanel = () => {
            const panel = rightPanelElement()
            if (panel !== observedPanel) {
              panelObserver?.disconnect()
              resizeObserver?.disconnect()
              observedPanel = panel
              if (panel && typeof MutationObserver === 'function') {
                panelObserver = new MutationObserver(() => { observeBrowser(); notify() })
                panelObserver.observe(panel, { attributes: true, attributeFilter: ['class', 'style'], childList: true })
              }
              if (panel && typeof ResizeObserver === 'function') {
                resizeObserver = new ResizeObserver(notify)
                resizeObserver.observe(panel)
              }
            }
            observeBrowser()
          }

          const bridge = {
            id: 'dsh-resource-center-right-sidebar',
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
            openBrowser(rawTarget, scope) {
              const target = browserTarget(rawTarget)
              const service = bridge.getService()
              if (!target || !service || typeof service.openTab !== 'function') return false
              let title = target
              try { title = new URL(target).hostname || target } catch { /* use normalized URL */ }
              service.openTab({ type: 'browser', url: target, title }, scope)
              observePanel()
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
              mitmRefreshController?.abort()
              mitmRefreshController = undefined
              bodyObserver?.disconnect()
              panelObserver?.disconnect()
              resizeObserver?.disconnect()
              browserObserver?.disconnect()
              if (browserPollTimer) clearInterval(browserPollTimer)
              browserControlButton?.remove()
              browserControlPanel?.remove()
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
              browserControlPanel = undefined
              browserControlPanelButton = undefined
              browserControlPanelTitle = undefined
              browserControlPanelMeta = undefined
              if (browserOpenEventHandler && typeof window !== 'undefined') window.removeEventListener('dsh-resource-center:open-browser', browserOpenEventHandler)
              browserOpenEventHandler = undefined
              uninstallBrowserCompatibilityHook()
            },
          }

          if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            browserOpenEventHandler = event => {
              const target = event?.detail?.url
              if (!bridge.openBrowser(target, event?.detail?.scope)) console.warn('[dsh-resource-center] unable to open Hunter asset in the right browser')
            }
            window.addEventListener('dsh-resource-center:open-browser', browserOpenEventHandler)
          }

          if (typeof document !== 'undefined' && document.body && typeof MutationObserver === 'function') {
            bodyObserver = new MutationObserver(() => { observePanel(); notify() })
            bodyObserver.observe(document.querySelector('.hHd-Xa_root') || document.body, { childList: true })
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

        // The migrated workbench was originally a standalone Cordis client
        // plugin. Its apply() function therefore reads injected services from
        // context properties (ctx.locale, ctx.sessions, ...), while the
        // resource-center module invokes it from inside its own apply() and
        // only exposes the services through ctx.get(). Passing the raw context
        // makes Cordis throw "cannot get property locale without inject" and
        // leaves the right workbench absent even though the bundle loaded.
        function createRightSidebarCoreContext(ctx) {
          // Keep this a plain object. Cordis contexts expose injected services
          // through prototype accessors; inheriting from one would route
          // assignments through its fiber setter and fail with "cannot set
          // property ... in multiple fibers".
          const coreContext = {}
          const injectedServices = ['slots', 'sessions', 'connection', 'workspaces', 'locale']
          for (const name of injectedServices) {
            try {
              coreContext[name] = typeof ctx?.get === 'function' ? ctx.get(name) : undefined
            } catch {
              coreContext[name] = undefined
            }
          }
          if (typeof ctx?.get === 'function') coreContext.get = ctx.get.bind(ctx)
          if (typeof ctx?.effect === 'function') coreContext.effect = ctx.effect.bind(ctx)
          if (typeof ctx?.provide === 'function') {
            coreContext.provide = (name, value) => {
              coreContext[name] = value
              return ctx.provide(name, value)
            }
          }
          return coreContext
        }

        function apply(ctx, options = {}) {
          const sidebar = options.sidebar || ctx?.get?.('resourceCenter')
          installBrowserCompatibilityHook()
          if (typeof document !== 'undefined' && document.body) {
            try {
              coreModule = require('dsh-resource-center-right-sidebar-core')
              if (coreModule && typeof coreModule.apply === 'function') {
                coreModule.apply(createRightSidebarCoreContext(ctx))
              }
            } catch (error) {
              console.error('[dsh-resource-center] right sidebar core failed to load:', error)
            }
          }
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
