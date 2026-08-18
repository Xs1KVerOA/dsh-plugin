(function defineDshResourceCenterModule_usageStats(global) {
  const registry = global.__dshResourceCenterModuleRegistry || (global.__dshResourceCenterModuleRegistry = {})
  if (registry.usageStats) return
  registry.usageStats = function registerDshResourceCenterUsageStats(global) {
    const loader = global.__ModuleLoader__
    if (!loader || typeof loader.load !== 'function') throw new Error('dsh-resource-center-usage-stats: client module loader is unavailable')

    loader.load({
      id: 'dsh-resource-center-usage-stats',
      factory(require) {
        const React = require('react')
        const h = React.createElement
        const { useEffect, useMemo, useState } = React

        const EMPTY_BUCKET = { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 }
        const BAND_LABELS = {
          before: '调价前',
          afterPeak: '调价后 · 高峰',
          afterOffPeak: '调价后 · 空闲',
        }
        const MODEL_LABELS = { flash: 'v4-flash', pro: 'v4-pro', other: '其他模型' }
        const BAND_KEYS = ['before', 'afterPeak', 'afterOffPeak']
        const USAGE_STATS_PATH = '/api/dsh-resource-center/usage-stats'

        const CSS = `
.dus-panel{display:flex;flex-direction:column;min-height:100%;overflow:auto;background:linear-gradient(180deg,#fbfdff 0%,#f6f9fc 100%);color:var(--dsw-alias-label-primary,#25282d);font-size:11px}
.dus-panel *{box-sizing:border-box}.dus-head{display:flex;align-items:center;gap:8px;padding:12px 10px 10px;border-bottom:1px solid #e3e9f1;background:rgba(255,255,255,.92)}
.dus-head-copy{min-width:0;flex:1}.dus-kicker{color:#7b8ba2;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.dus-title{margin-top:4px;font-size:14px;font-weight:700}.dus-subtitle{margin-top:3px;color:#8b98aa;font-size:10px;line-height:1.4}
.dus-head-actions{display:flex;align-items:center;gap:3px}.dus-icon-btn{width:25px;height:25px;border:1px solid #dbe3ee;border-radius:7px;background:#fff;color:#65748a;cursor:pointer;font:inherit}.dus-icon-btn:hover{border-color:#b9cce7;background:#f5f9ff;color:#3578e5}.dus-icon-btn:disabled{opacity:.5;cursor:default}.dus-text-btn{padding:2px 4px;border:0;background:transparent;color:#3578e5;font:inherit;font-size:9px;cursor:pointer}.dus-text-btn:hover{text-decoration:underline}
.dus-body{display:flex;flex-direction:column;gap:9px;padding:10px}.dus-error,.dus-notice{padding:8px 9px;border-radius:8px;line-height:1.45}.dus-error{border:1px solid #f0caca;background:#fff6f6;color:#b44444}.dus-notice{border:1px solid #cfe9d9;background:#f2fbf5;color:#388650}
.dus-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.dus-card{min-width:0;padding:9px 8px;border:1px solid #dfe7f1;border-radius:9px;background:rgba(255,255,255,.84);box-shadow:0 2px 8px rgba(41,75,120,.035)}.dus-card-label{color:#8290a3;font-size:9px}.dus-card-value{margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:750;font-variant-numeric:tabular-nums}.dus-card-value.cost{color:#3578e5}.dus-card-sub{margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#98a3b1;font-size:9px}
.dus-section{padding:10px;border:1px solid #dfe7f1;border-radius:9px;background:rgba(255,255,255,.78);box-shadow:0 2px 8px rgba(41,75,120,.025)}.dus-section-head{display:flex;align-items:center;gap:7px;margin-bottom:8px}.dus-section-title{min-width:0;flex:1;font-size:11px;font-weight:700}.dus-section-meta{color:#98a3b1;font-size:9px}
.dus-band{display:flex;height:9px;overflow:hidden;border:1px solid #dce5ef;border-radius:999px;background:#f1f4f8}.dus-band-seg{min-width:2px;height:100%}.dus-band-before{background:#94a3b8}.dus-band-afterPeak{background:#3578e5}.dus-band-afterOffPeak{background:#8dbcf4}.dus-legend{display:flex;flex-direction:column;gap:4px;margin-top:8px}.dus-legend-row{display:flex;align-items:center;gap:6px;color:#6f7e91;font-size:9px}.dus-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%}.dus-legend-value{margin-left:auto;color:#526174;font-variant-numeric:tabular-nums}
.dus-bars{display:flex;align-items:flex-end;gap:4px;height:94px;padding:6px 2px 0;border-bottom:1px solid #dfe7f1}.dus-bar-col{display:flex;min-width:0;flex:1;height:100%;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px}.dus-bar-value{max-width:100%;overflow:hidden;color:#6f7e91;font-size:8px;white-space:nowrap;text-overflow:ellipsis}.dus-bar{width:100%;min-height:2px;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#6aa0ee,#3578e5)}.dus-bar-empty{background:#e9eef5}.dus-bar-label{color:#98a3b1;font-size:8px}.dus-empty{padding:17px 8px;text-align:center;color:#98a3b1;font-size:10px;line-height:1.5}.dus-row-list{display:flex;flex-direction:column;gap:5px}.dus-session,.dus-model-row{display:flex;align-items:center;gap:7px;min-width:0;padding:7px 0;border-bottom:1px solid #edf1f5}.dus-session:last-child,.dus-model-row:last-child{border-bottom:0}.dus-session-rank{width:17px;color:#98a3b1;font-size:9px;text-align:center}.dus-session-copy,.dus-model-copy{min-width:0;flex:1}.dus-session-title,.dus-model-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#4f5e71;font-size:10px}.dus-session-meta,.dus-model-meta{margin-top:2px;color:#98a3b1;font-size:9px}.dus-session-cost,.dus-model-cost{color:#3578e5;font-size:10px;font-weight:650;white-space:nowrap}
.dus-actions{display:flex;gap:6px;flex-wrap:wrap}.dus-btn{padding:6px 8px;border:1px solid #dbe3ee;border-radius:7px;background:#fff;color:#516176;font:inherit;font-size:10px;cursor:pointer}.dus-btn:hover{border-color:#b9cce7;background:#f5f9ff;color:#3578e5}.dus-btn.primary{border-color:#3578e5;background:#3578e5;color:#fff}.dus-btn.primary:hover{background:#2864c7}.dus-btn.danger{border-color:#efc2c2;background:#fff7f7;color:#b44444}.dus-btn:disabled{opacity:.5;cursor:default}.dus-details{border-top:1px solid #e3e9f1;padding-top:9px}.dus-details summary{cursor:pointer;color:#6f7e91;font-size:10px}.dus-price-table{width:100%;margin-top:7px;border-collapse:collapse;color:#6f7e91;font-size:9px}.dus-price-table th,.dus-price-table td{padding:5px 3px;border-bottom:1px solid #edf1f5;text-align:left}.dus-price-table th{color:#8b98aa;font-weight:600}.dus-num{text-align:right!important;font-variant-numeric:tabular-nums}.dus-footnote{padding:3px 2px 10px;color:#98a3b1;font-size:9px;line-height:1.45}
`

        function fmtTokens(value) {
          const n = Number(value) || 0
          if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
          if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
          return String(Math.round(n))
        }

        function fmtCost(value) {
          return '¥' + (Number(value) || 0).toFixed(4)
        }

        function safeBucket(value) {
          return value && typeof value === 'object' ? { ...EMPTY_BUCKET, ...value } : EMPTY_BUCKET
        }

        function dateKey(offsetDays) {
          const date = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400000)
          const pad = value => value < 10 ? '0' + value : String(value)
          return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate())
        }

        function shortDate(key) {
          return typeof key === 'string' && key.length >= 10 ? key.slice(5) : key
        }

        function requestStats() {
          return fetch(USAGE_STATS_PATH).then(async response => {
            const body = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(body.error || '用量统计服务不可用')
            return body
          })
        }

        function StatCard(props) {
          return h('div', { className: 'dus-card' },
            h('div', { className: 'dus-card-label' }, props.label),
            h('div', { className: 'dus-card-value' + (props.cost ? ' cost' : '') }, props.value),
            props.sub ? h('div', { className: 'dus-card-sub', title: props.sub }, props.sub) : null,
          )
        }

        function BandBreakdown({ stats }) {
          const values = BAND_KEYS.map(key => safeBucket(stats.byBand && stats.byBand[key]))
          const total = values.reduce((sum, item) => sum + (Number(item.cost) || 0), 0)
          return h('section', { className: 'dus-section' },
            h('div', { className: 'dus-section-head' }, h('div', { className: 'dus-section-title' }, '计费时段'), h('div', { className: 'dus-section-meta' }, '元 / 百万 tokens')),
            h('div', { className: 'dus-band' }, BAND_KEYS.map((key, index) => h('div', {
              key,
              className: 'dus-band-seg dus-band-' + key,
              style: { width: total > 0 ? Math.max(1, values[index].cost / total * 100) + '%' : '0%' },
              title: BAND_LABELS[key] + ' · ' + fmtCost(values[index].cost),
            }))),
            h('div', { className: 'dus-legend' }, BAND_KEYS.map((key, index) => h('div', { className: 'dus-legend-row', key },
              h('span', { className: 'dus-dot dus-band-' + key }),
              h('span', null, BAND_LABELS[key] + ' · ' + values[index].calls + ' 次 · ' + fmtTokens(values[index].input + values[index].output) + ' tokens'),
              h('span', { className: 'dus-legend-value' }, fmtCost(values[index].cost)),
            ))),
          )
        }

        function DailyTrend({ stats }) {
          const days = Array.from({ length: 14 }, (_, index) => dateKey(index - 13))
          const values = days.map(key => safeBucket(stats.byDay && stats.byDay[key]))
          const max = Math.max(0, ...values.map(item => Number(item.cost) || 0))
          return h('section', { className: 'dus-section' },
            h('div', { className: 'dus-section-head' }, h('div', { className: 'dus-section-title' }, '近 14 天用量'), h('div', { className: 'dus-section-meta' }, '按北京时间')),
            max > 0 ? h('div', { className: 'dus-bars' }, days.map((key, index) => {
              const value = Number(values[index].cost) || 0
              return h('div', { className: 'dus-bar-col', key },
                h('div', { className: 'dus-bar-value' }, value > 0 ? fmtCost(value) : ''),
                h('div', { className: 'dus-bar' + (value <= 0 ? ' dus-bar-empty' : ''), style: { height: Math.max(value > 0 ? 5 : 2, value / max * 62) + 'px' } }),
                h('div', { className: 'dus-bar-label' }, shortDate(key)),
              )
            })) : h('div', { className: 'dus-empty' }, '暂无按日用量记录'),
          )
        }

        function SessionBreakdown({ stats }) {
          const [expanded, setExpanded] = useState(false)
          const allRows = Object.keys(stats.bySession || {}).map(id => ({ id, ...safeBucket(stats.bySession[id]), title: stats.bySession[id]?.title }))
            .sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0))
          const rows = expanded ? allRows : allRows.slice(0, 5)
          return h('section', { className: 'dus-section' },
            h('div', { className: 'dus-section-head' }, h('div', { className: 'dus-section-title' }, expanded ? '会话用量' : '会话用量 Top 5'), h('div', { className: 'dus-section-meta' }, Object.keys(stats.bySession || {}).length + ' 个会话'), allRows.length > 5 ? h('button', { className: 'dus-text-btn', onClick: () => setExpanded(!expanded) }, expanded ? '收起' : '查看全部') : null),
            rows.length ? h('div', { className: 'dus-row-list' }, rows.map((row, index) => h('div', { className: 'dus-session', key: row.id },
              h('div', { className: 'dus-session-rank' }, String(index + 1)),
              h('div', { className: 'dus-session-copy' },
                h('div', { className: 'dus-session-title', title: row.id }, row.title || row.id.slice(0, 12)),
                h('div', { className: 'dus-session-meta' }, row.calls + ' 次 · 输入 ' + fmtTokens(row.input) + ' · 输出 ' + fmtTokens(row.output)),
              ),
              h('div', { className: 'dus-session-cost' }, fmtCost(row.cost)),
            ))) : h('div', { className: 'dus-empty' }, '暂无会话用量记录'),
          )
        }

        function ModelBreakdown({ stats }) {
          const modelSource = stats.byModelName && Object.keys(stats.byModelName).length ? stats.byModelName : stats.byModel
          const rows = Object.keys(modelSource || {}).map(key => ({ key, label: MODEL_LABELS[key] || key, ...safeBucket(modelSource[key]) }))
            .filter(row => row.calls > 0 || row.input > 0 || row.output > 0)
            .sort((a, b) => (Number(b.cost) || 0) - (Number(a.cost) || 0))
          return h('section', { className: 'dus-section' },
            h('div', { className: 'dus-section-head' }, h('div', { className: 'dus-section-title' }, '模型用量'), h('div', { className: 'dus-section-meta' }, '按调用模型汇总')),
            rows.length ? h('div', { className: 'dus-row-list' }, rows.map(row => h('div', { className: 'dus-model-row', key: row.key },
              h('div', { className: 'dus-model-copy' },
                h('div', { className: 'dus-model-name', title: row.label }, row.label),
                h('div', { className: 'dus-model-meta' }, row.calls + ' 次 · 输入 ' + fmtTokens(row.input) + ' · 输出 ' + fmtTokens(row.output)),
              ),
              h('div', { className: 'dus-model-cost' }, fmtCost(row.cost)),
            ))) : h('div', { className: 'dus-empty' }, '暂无模型用量记录'),
          )
        }

        function PricingDetails({ data }) {
          const rows = BAND_KEYS.flatMap(key => ['flash', 'pro'].map(model => {
            const price = data.pricing && data.pricing[key] && data.pricing[key][model]
            return price ? { key: key + model, band: BAND_LABELS[key], model: MODEL_LABELS[model], price } : null
          }).filter(Boolean))
          return h('details', { className: 'dus-details' },
            h('summary', null, '查看计费规则'),
            h('div', { className: 'dus-subtitle' }, data.boundaryText || '计费规则由资源中心提供'),
            rows.length ? h('table', { className: 'dus-price-table' },
              h('thead', null, h('tr', null, h('th', null, '时段'), h('th', null, '模型'), h('th', { className: 'dus-num' }, '命中'), h('th', { className: 'dus-num' }, '未命中'), h('th', { className: 'dus-num' }, '输出'))),
              h('tbody', null, rows.map(row => h('tr', { key: row.key }, h('td', null, row.band), h('td', null, row.model), h('td', { className: 'dus-num' }, row.price.hit), h('td', { className: 'dus-num' }, row.price.miss), h('td', { className: 'dus-num' }, row.price.out)))),
            ) : null,
          )
        }

        function UsageStatsPanel() {
          const [data, setData] = useState(null)
          const [error, setError] = useState('')
          const [busy, setBusy] = useState(false)
          const [notice, setNotice] = useState('')
          const [confirmClear, setConfirmClear] = useState(false)

          const load = () => requestStats().then(value => { setData(value); setError('') }).catch(reason => setError(reason?.message || String(reason)))
          useEffect(() => {
            let alive = true
            const refresh = () => requestStats().then(value => { if (alive) { setData(value); setError('') } }).catch(reason => { if (alive) setError(reason?.message || String(reason)) })
            refresh()
            const timer = window.setInterval(refresh, 10000)
            return () => { alive = false; window.clearInterval(timer) }
          }, [])

          const action = (name, successText) => {
            setBusy(true)
            fetch(USAGE_STATS_PATH + '?action=' + name, { method: 'POST' }).then(async response => {
              const body = await response.json().catch(() => ({}))
              if (!response.ok || body.ok === false) throw new Error(body.error || '操作失败')
              setNotice(successText)
              window.setTimeout(() => setNotice(''), 3500)
              return load()
            }).catch(reason => setError(reason?.message || String(reason))).finally(() => setBusy(false))
          }

          const stats = data?.stats && data.stats.total ? data.stats : null
          const total = safeBucket(stats?.total)
          const meta = stats?.meta || {}
          const backfillText = meta.lastBackfillAt ? '已回填 ' + (meta.lastBackfillFound || 0) + ' 条历史调用' : '首次启用后自动记录'

          return h('div', { className: 'dus-panel' },
            h('header', { className: 'dus-head' },
              h('div', { className: 'dus-head-copy' }, h('div', { className: 'dus-kicker' }, 'RESOURCE CENTER'), h('div', { className: 'dus-title' }, '用量统计'), h('div', { className: 'dus-subtitle' }, '汇总所有会话的模型调用、Token 与费用')),
              h('div', { className: 'dus-head-actions' }, h('button', { className: 'dus-icon-btn', title: '刷新', onClick: load, disabled: busy }, '↻')),
            ),
            h('div', { className: 'dus-body' },
              error ? h('div', { className: 'dus-error' }, error === '用量统计服务不可用' ? '资源中心用量统计服务不可用，请检查 Host 模块是否已加载。' : error) : null,
              notice ? h('div', { className: 'dus-notice' }, notice) : null,
              !stats ? h('div', { className: 'dus-section' }, h('div', { className: 'dus-empty' }, error ? '无法读取统计数据' : '正在读取统计数据…')) : h(React.Fragment, null,
                h('div', { className: 'dus-card-grid' },
                  h(StatCard, { label: '总费用', value: fmtCost(total.cost), sub: backfillText, cost: true }),
                  h(StatCard, { label: '调用次数', value: String(total.calls), sub: '全部会话' }),
                  h(StatCard, { label: '输入 tokens', value: fmtTokens(total.input), sub: '命中 ' + fmtTokens(total.cacheHit) + ' · 未命中 ' + fmtTokens(total.cacheMiss) }),
                  h(StatCard, { label: '输出 tokens', value: fmtTokens(total.output), sub: '含模型输出' }),
                ),
                h(BandBreakdown, { stats }),
                h(DailyTrend, { stats }),
                h(ModelBreakdown, { stats }),
                h(SessionBreakdown, { stats }),
                h('section', { className: 'dus-section' },
                  h('div', { className: 'dus-section-head' }, h('div', { className: 'dus-section-title' }, '数据维护'), h('div', { className: 'dus-section-meta' }, meta.sessionAttribution ? '已关联会话' : '待回填')),
                  h('div', { className: 'dus-actions' },
                    h('button', { className: 'dus-btn primary', onClick: () => action('backfill', '历史用量已重新统计'), disabled: busy }, busy ? '处理中…' : '回填历史'),
                    h('button', { className: 'dus-btn', onClick: () => setConfirmClear(!confirmClear), disabled: busy }, confirmClear ? '再次点击确认清空' : '清空统计'),
                    confirmClear ? h('button', { className: 'dus-btn danger', onClick: () => { setConfirmClear(false); action('clear', '统计已清空') }, disabled: busy }, '确认清空') : null,
                  ),
                ),
                h(PricingDetails, { data }),
              ),
              h('div', { className: 'dus-footnote' }, '数据来源：dsh-resource-center · 统计文件由资源中心按工作区策略持久化。'),
            ),
          )
        }

        function UsageStatsIcon() {
          return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
            h('path', { d: 'M4 19V5' }), h('path', { d: 'M4 19h16' }),
            h('path', { d: 'M7 16v-3' }), h('path', { d: 'M11 16V9' }), h('path', { d: 'M15 16V6' }), h('path', { d: 'M19 16v-5' }),
          )
        }

        function installStyle() {
          if (document.querySelector('style[data-plugin="dsh-resource-center-usage-stats"]')) return
          const style = document.createElement('style')
          style.dataset.plugin = 'dsh-resource-center-usage-stats'
          style.textContent = CSS
          document.head.appendChild(style)
        }

        return {
          inject: [],
          apply(ctx, options = {}) {
            installStyle()
            const sidebar = options.sidebar || ctx.get('resourceCenter') || ctx.get('dshResourceCenter')
            if (!sidebar || typeof sidebar.registerActivity !== 'function') throw new Error('dsh-resource-center-usage-stats: resourceCenter service unavailable')
            ctx.effect(() => sidebar.registerActivity({
              id: 'usage-stats',
              label: '用量统计',
              order: 9999,
              icon: UsageStatsIcon,
              component: UsageStatsPanel,
            }), 'dsh-resource-center-usage-stats: activity')
          },
        }
      },
    })
  }
})(typeof window === 'undefined' ? globalThis : window)
