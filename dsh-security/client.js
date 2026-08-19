(function registerDshSecurity(global) {
  const loader = global.__ModuleLoader__
  if (!loader || typeof loader.load !== 'function') throw new Error('dsh-security: client module loader is unavailable')

  loader.load({
    id: 'dsh-security',
    factory(require) {
      const React = require('react')
      const h = React.createElement
      const MarkdownText = require('@deepseek-ai/dsh-client-ui-primitives').MarkdownText
      const pendingAuditReportFocus = new Map()
      const auditFindingAnchor = (reportId, findingId) => `dsec-audit-finding-${encodeURIComponent(String(reportId || ''))}-${encodeURIComponent(String(findingId || ''))}`
      const focusAuditFinding = (sessionId, reportId, findingId) => {
        pendingAuditReportFocus.set(String(sessionId), { reportId: String(reportId || ''), findingId: String(findingId || '') })
        if (typeof window === 'undefined') return
        window.setTimeout(() => {
          const tab = [...document.querySelectorAll('[role="tab"]')].find(item => String(item.textContent || '').trim() === '报告')
          tab?.click()
        }, 0)
      }

      const CSS = `
.dsec-view{display:flex;flex-direction:column;width:100%;max-width:100%;min-width:0;min-height:0;overflow:hidden;color:var(--dsw-alias-label-primary,#25282d);font-size:12px;background:var(--dsw-alias-bg-layer-1,#fff)}
.dsec-view *{box-sizing:border-box;min-width:0}.dsec-head{display:flex;align-items:center;gap:8px;width:100%;min-width:0;padding:11px 14px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb);flex:0 0 auto;flex-wrap:wrap}.dsec-title{font-weight:650;min-width:0;flex:1 1 140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsec-meta{min-width:0;color:var(--dsw-alias-label-tertiary,#969da7);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsec-body{display:flex;width:100%;max-width:100%;min-width:0;min-height:0;overflow:auto;overflow-x:hidden;flex:1;flex-direction:column;gap:9px;padding:12px 14px}.dsec-btn{flex:0 0 auto;border:1px solid var(--dsw-alias-border-l2,#d8dce2);border-radius:6px;padding:5px 9px;background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;cursor:pointer;font:inherit;font-size:11px}.dsec-btn:hover{background:var(--dsw-alias-bg-layer-2,#f1f3f6)}.dsec-btn:disabled{opacity:.5;cursor:default}.dsec-warning,.dsec-error{max-width:100%;padding:9px 10px;border-radius:6px;line-height:1.5;overflow-wrap:anywhere}.dsec-warning{background:#fff8e6;color:#8a621c}.dsec-error{background:#fff0f0;color:#bd4747}.dsec-list{display:flex;flex-direction:column;gap:5px;width:100%;max-width:100%;min-height:0;overflow:auto;overflow-x:hidden}.dsec-flow{display:grid;width:100%;max-width:100%;min-width:0;grid-template-columns:48px 54px minmax(0,1fr) auto;gap:7px;align-items:center;text-align:left;padding:7px 8px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:6px;background:transparent;color:inherit;cursor:pointer;font:inherit}.dsec-flow:hover,.dsec-flow.active{background:var(--dsw-alias-bg-layer-2,#f1f3f6)}.dsec-flow-url{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsec-flow-meta{min-width:72px;text-align:right;color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px;white-space:nowrap}.dsec-pass{color:#32864b}.dsec-fail{color:#c04b4b}.dsec-detail{display:grid;width:100%;max-width:100%;min-width:0;grid-template-columns:minmax(0,1fr);gap:9px}.dsec-card{min-width:0;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:6px;overflow:hidden}.dsec-card-title{padding:7px 9px;background:var(--dsw-alias-bg-layer-2,#f5f6f8);font-weight:600}.dsec-pre{width:100%;max-width:100%;margin:0;padding:9px;max-height:290px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.dsec-report{width:100%;max-width:100%;min-width:0;padding:2px 0 14px;overflow-wrap:anywhere}.dsec-report-head{display:flex;align-items:center;gap:8px;min-width:0}.dsec-report-title{font-weight:650;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsec-markdown{width:100%;max-width:100%;min-width:0;padding-top:6px;overflow-wrap:anywhere}.dsec-markdown :where(pre,table){display:block;max-width:100%;overflow:auto}.dsec-markdown :where(img,video){max-width:100%;height:auto}.dsec-markdown :where(code,a){overflow-wrap:anywhere}.dsec-report-list{width:100%;max-width:100%;min-width:0}.dsec-empty{max-width:100%;color:var(--dsw-alias-label-tertiary,#969da7);overflow-wrap:anywhere}
@media (min-width:800px){.dsec-detail{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.dsec-body{overflow:hidden}.dsec-report-list{overflow:auto}}.dsec-mode{display:inline-flex;align-items:center;gap:5px;max-width:280px;padding:3px 8px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:999px;color:var(--dsw-alias-label-secondary,#5f6670);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dsec-mode-pentest{border-color:#f0c36a;background:#fff8e6;color:#8a621c}.dsec-mode-audit{border-color:#a9c7f4;background:#f1f6ff;color:#275c9e}.dsec-mode-standard{background:var(--dsw-alias-bg-layer-2,#f5f6f8)}.dsec-mode-name{overflow:hidden;text-overflow:ellipsis}.dsec-mode-policy{color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px}
@media (max-width:560px){.dsec-head{align-items:flex-start}.dsec-title{flex-basis:calc(100% - 92px)}.dsec-meta{order:3;flex:1 1 100%;white-space:normal}.dsec-flow{grid-template-columns:42px 48px minmax(0,1fr)}.dsec-flow-meta{grid-column:2 / -1;min-width:0;text-align:left}}.dsec-api-toolbar{display:flex;align-items:center;gap:8px;width:100%;min-width:0}.dsec-api-search{width:min(320px,100%);height:34px;padding:7px 10px;border:1px solid #cfe0f1;border-radius:6px;background:#fff;color:inherit;font:inherit;outline:none}.dsec-api-search:focus{border-color:#6aa7df;box-shadow:0 0 0 2px rgba(73,145,214,.12)}.dsec-api-scroll{flex:1;min-height:0;width:100%;overflow:auto;padding-bottom:2px}.dsec-api-grid{display:grid;grid-template-columns:90px minmax(210px,1.6fr) 130px 72px 110px 170px 100px minmax(190px,1.4fr) 130px;min-width:1180px;border:1px solid #dbe8f4;border-radius:7px;overflow:hidden;background:#fff}.dsec-api-cell{min-height:50px;padding:10px 9px;border-bottom:1px solid #e7eef6;overflow:hidden;text-overflow:ellipsis;white-space:normal;display:flex;align-items:center;gap:5px}.dsec-api-head{position:sticky;top:0;z-index:1;background:#f1f6fb;color:#315b7e;font-weight:650;min-height:36px;white-space:nowrap}.dsec-api-row{display:contents}.dsec-api-row:last-child .dsec-api-cell{border-bottom:0}.dsec-api-row:hover .dsec-api-cell{background:#f8fbfe}.dsec-api-button{width:100%;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}.dsec-api-button:hover{background:#f2f8fd}.dsec-api-primary{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsec-api-secondary{display:block;min-width:0;color:var(--dsw-alias-label-tertiary,#8a96a3);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsec-api-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#183452}.dsec-tags{display:flex;flex-wrap:wrap;gap:4px;min-width:0}.dsec-tag{padding:2px 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2,#f1f3f6);font-size:10px}.dsec-badge{display:inline-flex;align-items:center;max-width:100%;padding:3px 7px;border-radius:999px;font-size:10px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dsec-badge-good{background:#e5f7ed;color:#21854d}.dsec-badge-warn{background:#fff3db;color:#a66b13}.dsec-badge-risk{background:#fff0f0;color:#c94545}.dsec-badge-neutral{background:#edf1f5;color:#647181}.dsec-api-risk-cell{align-items:flex-start;flex-wrap:wrap}.dsec-summary{display:flex;flex-wrap:wrap;gap:6px}.dsec-summary-card{min-width:78px;padding:8px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#fff)}.dsec-summary-number{display:block;font-size:16px;font-weight:650}.dsec-summary-label{color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px}.dsec-finding{padding:9px 0;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb)}.dsec-finding:last-child{border-bottom:0}.dsec-finding-title{font-weight:650}.dsec-finding-meta{color:var(--dsw-alias-label-tertiary,#969da7);font-size:11px}.dsec-code-report{display:flex;flex-direction:column;gap:10px}
 .dsec-understanding{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid #cfe1f5;border-radius:10px;background:linear-gradient(135deg,#fbfdff,#f4f9ff)}.dsec-eyebrow{color:#1769c2;font-size:10px;font-weight:700;letter-spacing:.16em}.dsec-section-title{font-size:16px;font-weight:700}.dsec-section-subtitle{color:#6f87a2;line-height:1.5}.dsec-understanding-summary{padding:9px 10px;border-radius:7px;background:#eef7ff;color:#496783;line-height:1.55}.dsec-understanding-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.dsec-understanding-card{min-width:0;padding:10px;border:1px solid #d5e4f3;border-radius:7px;background:rgba(255,255,255,.8)}.dsec-understanding-card-title{font-weight:650;margin-bottom:6px;color:#2d587e}.dsec-understanding-list{margin:0;padding-left:17px;color:#526b84;line-height:1.55}.dsec-understanding-list li{overflow-wrap:anywhere}.dsec-stack{padding-top:4px}.dsec-stack-title{font-weight:650;margin-bottom:7px}.dsec-stack-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.dsec-stack-card{min-width:0;border:1px solid #d5e4f3;border-top:3px solid #4d9ce8;border-radius:7px;background:#fff;overflow:hidden}.dsec-stack-card-title{padding:8px 9px;font-weight:650;background:#f4f9ff}.dsec-stack-row{display:grid;grid-template-columns:minmax(72px,.7fr) minmax(0,1.3fr);gap:8px;padding:7px 9px;border-top:1px solid #e7eef6;color:#526b84}.dsec-stack-row span:first-child{color:#89a0b7}.dsec-stack-row span:last-child{overflow-wrap:anywhere}@media (max-width:800px){.dsec-understanding-grid,.dsec-stack-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:560px){.dsec-understanding-grid,.dsec-stack-grid{grid-template-columns:minmax(0,1fr)}}
 .dsec-api-scroll{flex:1;min-height:0;width:100%;max-width:100%;min-width:0;overflow:auto;padding-bottom:2px}.dsec-api-grid{overflow:hidden}
.dsec-policy-form{display:flex;flex-direction:column;gap:10px;max-width:720px}.dsec-checkbox-row{display:flex;align-items:center;gap:7px;font-weight:600}.dsec-policy-note{color:var(--dsw-alias-label-tertiary,#969da7);line-height:1.5}.dsec-policy-textarea{min-height:130px;width:100%;resize:vertical;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.dsec-policy-actions{display:flex;align-items:center;gap:8px}.dsec-policy-status{color:#32864b;font-size:11px}
.dsec-view{background:linear-gradient(180deg,#fbfcfe 0%,#f6f8fb 100%)}.dsec-head{background:rgba(255,255,255,.86);backdrop-filter:blur(10px)}.dsec-body{padding:16px 18px;gap:12px}.dsec-api-toolbar{padding:12px 14px;border:1px solid #dfe7f0;border-radius:10px;background:rgba(255,255,255,.92);box-shadow:0 4px 16px rgba(34,64,96,.06);justify-content:space-between}.dsec-api-toolbar:before{content:'API 入口';font-size:12px;font-weight:700;color:#24415e;letter-spacing:.02em;order:-1}.dsec-api-search{width:min(420px,100%);height:36px;border-color:#d4e0ec;background:#fbfdff}.dsec-api-scroll{border-radius:10px;box-shadow:0 6px 22px rgba(34,64,96,.07)}.dsec-api-grid{grid-template-columns:88px minmax(280px,1.9fr) 132px 70px 96px minmax(166px,1.25fr) 104px minmax(230px,1.6fr) minmax(156px,1.1fr);min-width:1320px;border-color:#d8e3ee;box-shadow:0 0 0 1px rgba(216,227,238,.35);overflow:hidden}.dsec-api-cell{min-height:64px;padding:11px 12px;border-bottom-color:#e8eef5;line-height:1.35}.dsec-api-head{min-height:42px;background:#edf4fa;color:#375b7b;font-size:11px;letter-spacing:.02em}.dsec-api-button{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px}.dsec-api-button:hover{background:#f4f9fd}.dsec-api-primary{width:100%;font-weight:600;color:#173b5d}.dsec-api-secondary{width:100%;font-size:10px;color:#8092a5}.dsec-api-code{font-size:11px}.dsec-api-method{display:inline-flex;align-items:center;justify-content:center;min-width:52px;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:750;letter-spacing:.04em}.dsec-api-method-get{background:#e8f5ed;color:#267449}.dsec-api-method-post{background:#fff2dc;color:#a96812}.dsec-api-method-put,.dsec-api-method-patch{background:#f0eaff;color:#6944a6}.dsec-api-method-delete{background:#ffebeb;color:#b84141}.dsec-api-method-mixed,.dsec-api-method-default{background:#edf1f5;color:#536578}.dsec-api-type,.dsec-api-language{color:#35556f;font-weight:550}.dsec-api-risk-cell{align-content:center;gap:5px}.dsec-risk-list,.dsec-domain-list{display:flex;flex-wrap:wrap;align-items:center;gap:5px}.dsec-risk-list .dsec-badge{font-size:9px;padding:3px 6px}.dsec-domain{display:inline-flex;max-width:100%;padding:3px 6px;border:1px solid #dce7f1;border-radius:5px;background:#f8fbfe;color:#58728b;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsec-api-grid .dsec-api-row:hover .dsec-api-cell{background:#f7fbff}.dsec-api-grid .dsec-api-row:last-child .dsec-api-cell{border-bottom:0}.dsec-card{border-color:#dce6ef;box-shadow:0 4px 14px rgba(34,64,96,.05);background:rgba(255,255,255,.9)}
@media (max-width:900px){.dsec-api-toolbar{align-items:stretch;flex-wrap:wrap}.dsec-api-toolbar:before{width:100%}.dsec-api-search{width:100%}}@media (max-width:560px){.dsec-body{padding:12px}.dsec-api-grid{min-width:1180px}.dsec-api-cell{padding-left:9px;padding-right:9px}}
.dsec-report-list{gap:16px;padding:18px 20px 30px}.dsec-code-report{gap:14px;padding:18px 0 28px;border-top:1px solid #e3ebf3}.dsec-code-report:first-of-type{border-top:0}.dsec-report-head{align-items:flex-start;padding:2px 0 4px}.dsec-report-title{font-size:18px;color:#173b5d}.dsec-code-report>.dsec-meta{max-width:100%;line-height:1.6;color:#718499;white-space:normal;overflow-wrap:anywhere}.dsec-code-report>.dsec-summary{gap:8px;padding:2px 0}.dsec-code-report>.dsec-summary .dsec-summary-card{min-width:96px;padding:10px 12px;border-color:#d8e5f0;box-shadow:0 3px 9px rgba(34,64,96,.05)}.dsec-code-report>.dsec-summary .dsec-summary-number{font-size:20px;color:#173b5d}.dsec-report-section{border:1px solid #dce6ef;border-radius:10px;background:rgba(255,255,255,.92);box-shadow:0 4px 14px rgba(34,64,96,.05);overflow:hidden}.dsec-report-section-title{display:flex;align-items:center;gap:8px;padding:11px 14px;background:#f2f7fb;color:#254a67;font-size:13px;font-weight:700}.dsec-report-section-title:before{content:'';width:3px;height:16px;border-radius:3px;background:#4d9ce8}.dsec-report-content{padding:0 14px}.dsec-report-content .dsec-finding{padding:13px 0}.dsec-finding-title{line-height:1.45;color:#24445e}.dsec-finding-meta{line-height:1.55;overflow-wrap:anywhere}.dsec-report-impact{margin-top:6px;padding:8px 10px;border-radius:7px;background:#f7fafc;color:#4b6174;line-height:1.55;overflow-wrap:anywhere}.dsec-coverage-bar{height:7px;margin:0 14px 10px;border-radius:99px;background:#e9eff5;overflow:hidden}.dsec-coverage-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#4d9ce8,#55b989)}.dsec-coverage-label{padding:0 14px 8px;color:#718499;font-size:11px}.dsec-coverage-list{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 13px}.dsec-coverage-entry{max-width:100%;padding:4px 7px;border-radius:5px;background:#fff3db;color:#98651b;font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.dsec-markdown{max-width:100%;padding:18px 16px;border:1px solid #e1e9f0;border-radius:10px;background:rgba(255,255,255,.95);box-shadow:0 4px 14px rgba(34,64,96,.04);line-height:1.7}.dsec-markdown :where(h1,h2,h3){color:#173b5d;line-height:1.35}.dsec-markdown :where(h1){font-size:24px;margin:0 0 16px}.dsec-markdown :where(h2){font-size:18px;margin:22px 0 10px;padding-bottom:7px;border-bottom:1px solid #e3ebf3}.dsec-markdown :where(h3){font-size:15px;margin:16px 0 8px}.dsec-markdown :where(p,li){line-height:1.7}.dsec-markdown :where(table){width:100%;border-collapse:collapse}.dsec-markdown :where(th,td){padding:7px 9px;border:1px solid #dfe8f0;text-align:left;vertical-align:top;overflow-wrap:anywhere}.dsec-markdown :where(th){background:#f2f7fb;color:#315b7e}.dsec-markdown :where(blockquote){margin:10px 0;padding:8px 12px;border-left:3px solid #7bb2e4;background:#f5f9fc;color:#526b84}.dsec-markdown :where(pre){max-width:100%;padding:10px;border-radius:7px;background:#f5f7fa;overflow:auto}.dsec-understanding{padding:18px 18px 14px}.dsec-understanding-grid{grid-template-columns:repeat(4,minmax(0,1fr))}@media (max-width:1100px){.dsec-understanding-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width:560px){.dsec-report-list{padding:12px}.dsec-understanding-grid{grid-template-columns:minmax(0,1fr)}.dsec-code-report>.dsec-summary .dsec-summary-card{flex:1 1 82px}.dsec-markdown{padding:14px 12px}.dsec-markdown :where(table){display:block;overflow:auto}}
.dsec-summary-card-critical{border-top:3px solid #b42318!important;background:#fff3f2}.dsec-summary-card-high{border-top:3px solid #d94841!important;background:#fff7f6}.dsec-summary-card-medium{border-top:3px solid #d98922!important;background:#fffaf1}.dsec-summary-card-low{border-top:3px solid #6c9b32!important;background:#f7fbf2}.dsec-summary-card-none,.dsec-summary-card-unknown{border-top:3px solid #94a0ad!important;background:#f8fafc}.dsec-summary-card-info{border-top:3px solid #4d91c9!important;background:#f4f9fd}.dsec-summary-card-critical .dsec-summary-number,.dsec-severity-critical{color:#b42318}.dsec-summary-card-high .dsec-summary-number,.dsec-severity-high{color:#d13f38}.dsec-summary-card-medium .dsec-summary-number,.dsec-severity-medium{color:#b86d0f}.dsec-summary-card-low .dsec-summary-number,.dsec-severity-low{color:#568326}.dsec-summary-card-none .dsec-summary-number,.dsec-summary-card-unknown .dsec-summary-number,.dsec-severity-none,.dsec-severity-unknown{color:#667383}.dsec-summary-card-info .dsec-summary-number,.dsec-severity-info{color:#3978b7}.dsec-finding{border-left:3px solid #d8e1ea;padding-left:10px}.dsec-finding-critical{border-left-color:#b42318}.dsec-finding-high{border-left-color:#d94841}.dsec-finding-medium{border-left-color:#d98922}.dsec-finding-low{border-left-color:#6c9b32}.dsec-finding-none,.dsec-finding-unknown{border-left-color:#94a0ad}.dsec-finding-info{border-left-color:#4d91c9}.dsec-severity-label{display:inline-flex;align-items:center;margin-right:3px;padding:2px 6px;border-radius:5px;background:#f1f4f7;font-size:10px;letter-spacing:.04em}.dsec-severity-critical{background:#ffe5e2}.dsec-severity-high{background:#ffebe9}.dsec-severity-medium{background:#fff0d5}.dsec-severity-low{background:#edf7e4}.dsec-severity-none,.dsec-severity-unknown{background:#edf1f4}.dsec-severity-info{background:#e7f2fb}
`

      function installStyle() {
        if (typeof document === 'undefined' || document.querySelector('style[data-plugin="dsh-security"]')) return () => {}
        const style = document.createElement('style')
        style.dataset.plugin = 'dsh-security'
        style.textContent = `${CSS}\n.dsec-api-grid{grid-template-columns:100px minmax(300px,1fr) minmax(130px,.45fr) minmax(180px,.7fr);min-width:760px}.dsec-vulnerability-ids{align-items:center;flex-wrap:wrap}.dsec-vulnerability-link{border:0;padding:3px 6px;border-radius:5px;background:#fff0f0;color:#c94545;cursor:pointer;font:650 10px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace}.dsec-vulnerability-link:hover{background:#ffe0e0;text-decoration:underline}.dsec-finding-focus{animation:dsec-finding-focus 1.8s ease-out;background:#fff8df;border-radius:7px;padding-left:8px!important;padding-right:8px!important}@keyframes dsec-finding-focus{0%{box-shadow:0 0 0 3px rgba(232,166,39,.45)}100%{box-shadow:0 0 0 0 rgba(232,166,39,0)}}.dsec-report-poc-wrap{margin-top:10px}.dsec-report-poc-label{margin-bottom:5px;color:#718499;font-size:12px;font-weight:700}.dsec-report-poc{max-height:240px;border:1px solid #cbd8e5;border-radius:7px;background:#172536;color:#e7f1fb;font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.dsec-finding-title{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:17px;line-height:1.45}.dsec-finding-name{font-weight:750;color:#173b5d}.dsec-finding-cvss{display:inline-flex;align-items:center;padding:4px 9px;border-radius:6px;background:#fff0d5;color:#9a5d08;font-size:15px;font-weight:800;letter-spacing:.02em}.dsec-finding-api{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;margin-top:9px;padding:9px 11px;border:1px solid #d5e4f1;border-radius:7px;background:#f5faff;color:#214b6d;font-size:14px}.dsec-finding-api-label{font-size:12px;font-weight:800;color:#557b99;text-transform:uppercase}.dsec-finding-api code{font:700 14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#123b60;overflow-wrap:anywhere}.dsec-finding-handler{font-size:13px;color:#55738c;overflow-wrap:anywhere}.dsec-finding-meta{margin-top:7px;font-size:13px;line-height:1.65;overflow-wrap:anywhere}.dsec-report-impact{font-size:14px;line-height:1.7}.dsec-report-impact strong{color:#315b7e;margin-right:5px}.dsec-finding-detail{margin-top:11px;padding:10px 12px;border:1px solid #dfe8f0;border-radius:8px;background:#fbfdff;font-size:13px;line-height:1.65}.dsec-finding-detail-title{margin-bottom:5px;color:#234d6e;font-size:14px;font-weight:750}.dsec-finding-detail-body{overflow-wrap:anywhere}.dsec-chain-list,.dsec-file-list,.dsec-evidence-grid ul{margin:0;padding-left:21px}.dsec-chain-list li,.dsec-file-list li,.dsec-evidence-grid li{margin:3px 0;overflow-wrap:anywhere}.dsec-file-list code{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#244b6c}.dsec-evidence-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.dsec-evidence-grid strong{color:#315b7e;font-size:12px}@media (max-width:650px){.dsec-evidence-grid{grid-template-columns:minmax(0,1fr)}}`
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
        const [policy, setPolicy] = React.useState({ requireAllowlist: false, allowedHosts: [], privateTargetAccess: 'prompt' })
        const [hostsText, setHostsText] = React.useState('')
        const [loading, setLoading] = React.useState(true)
        const [saving, setSaving] = React.useState(false)
        const [error, setError] = React.useState('')
        const [saved, setSaved] = React.useState(false)
        const load = React.useCallback(async () => {
          setLoading(true)
          try {
            const result = await api(`config?sessionId=${encodeURIComponent(props.sessionId)}`)
            setPolicy({ requireAllowlist: result.requireAllowlist === true, allowedHosts: result.allowedHosts || [], privateTargetAccess: result.privateTargetAccess || 'prompt' })
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
            setPolicy({ requireAllowlist: result.requireAllowlist === true, allowedHosts: result.allowedHosts || [], privateTargetAccess: result.privateTargetAccess || 'prompt' })
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
              h('div', { className: 'dsec-policy-note' }, `白名单仅控制公网主机匹配。渗透会话开始时会单独审批是否允许 LLM 探测任意内网、回环和云元数据地址；当前状态：${policy.privateTargetAccess === 'session' ? '本会话已允许' : policy.privateTargetAccess === 'once' ? '仅允许下一次受保护目标请求' : policy.privateTargetAccess === 'denied' ? '本会话已拒绝' : '等待会话开始审批'}。每行一个主机名，也支持逗号分隔。`),
              h('textarea', { className: 'dsec-policy-textarea', value: hostsText, disabled: loading || saving, onChange: event => { setHostsText(event.target.value); setSaved(false) }, placeholder: 'example.com\n*.authorized.example' }),
              h('div', { className: 'dsec-policy-actions' }, h('button', { className: 'dsec-btn', onClick: save, disabled: loading || saving }, saving ? '保存中…' : '保存策略'), saved ? h('span', { className: 'dsec-policy-status' }, '已保存') : null),
            ),
          ),
        )
      }

      function RequestDetail(props) {
        if (!props.flow) return h('div', { className: 'dsec-empty' }, '选择一条记录查看请求包和响应包。')
        const risk = props.flow.riskAssessment
        return h('div', { className: 'dsec-detail' },
          h('section', { className: 'dsec-card' }, h('div', { className: 'dsec-card-title' }, '请求包'), h('pre', { className: 'dsec-pre' }, props.flow.requestPacket || '')),
          h('section', { className: 'dsec-card' }, h('div', { className: 'dsec-card-title' }, '响应包'), h('pre', { className: 'dsec-pre' }, props.flow.responsePacket || props.flow.error || '无响应包')),
          risk ? h('section', { className: 'dsec-card' }, h('div', { className: 'dsec-card-title' }, '发送前风险评估'), h('pre', { className: 'dsec-pre' }, JSON.stringify({ ...risk, approvalScope: props.flow.approvalScope || null, requestFingerprint: props.flow.requestFingerprint || null }, null, 2))) : null,
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

      // History rows keep the HTTP status under response.status. Tool return
      // values expose a top-level status, but the history API returns the
      // persisted exchange shape. Prefer the nested value so successful
      // responses are not rendered as ERR merely because the top-level field
      // is absent.
      function historyStatus(flow) {
        const value = flow?.response?.status ?? flow?.status
        if (value == null || value === '') return null
        const status = typeof value === 'number' ? value : /^\d{3}$/.test(String(value).trim()) ? Number(value) : NaN
        return Number.isFinite(status) ? status : null
      }

      function historyStatusLabel(flow) {
        if (flow?.response?.truncated) return '截断'
        const status = historyStatus(flow)
        return status == null ? 'ERR' : String(status)
      }

      function historyStatusClass(flow) {
        const status = historyStatus(flow)
        return flow?.error || flow?.response?.truncated || (status != null && status >= 400) ? 'dsec-fail' : 'dsec-pass'
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
            h('div', { className: 'dsec-list' }, history.length ? history.map(flow => h('button', { key: flow.id, className: 'dsec-flow' + (selected?.id === flow.id ? ' active' : ''), onClick: () => setSelected(flow) }, h('span', null, flow.protocol.toUpperCase()), h('span', { className: historyStatusClass(flow) }, historyStatusLabel(flow)), h('span', { className: 'dsec-flow-url', title: flow.target }, flow.target), h('span', { className: 'dsec-flow-meta' }, `${flow.durationMs || 0} ms`))) : h('div', { className: 'dsec-empty' }, '尚未记录渗透模式发起的请求。')),
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
        const [run, setRun] = React.useState(null)
        const [query, setQuery] = React.useState('')
        const [error, setError] = React.useState('')
        const [hasMore, setHasMore] = React.useState(false)
        const [nextCursor, setNextCursor] = React.useState(null)
        const [loading, setLoading] = React.useState(false)
        const requestInFlight = React.useRef(false)
        const requestGeneration = React.useRef(0)
        const loadedMore = React.useRef(false)
        const badge = (value, label, tone) => h('span', { className: `dsec-badge dsec-badge-${tone}`, title: value || label }, label)
        const refresh = React.useCallback(async () => {
          if (requestInFlight.current) return
          const generation = ++requestGeneration.current
          requestInFlight.current = true
          setLoading(true)
          try {
            const [result, state] = await Promise.all([
              api(`audit/apis?sessionId=${encodeURIComponent(props.sessionId)}&limit=100`),
              api(`audit/state?sessionId=${encodeURIComponent(props.sessionId)}`),
            ])
            if (generation !== requestGeneration.current) return
            setApis(previous => loadedMore.current ? mergeRows(result.apis || [], previous, 'id') : (result.apis || []))
            setHasMore(Boolean(result.hasMore))
            setNextCursor(result.nextCursor || null)
            setRun(state.state?.run || null)
            setError('')
          } catch (cause) { if (generation === requestGeneration.current) setError(cause?.message || String(cause)) } finally { if (generation === requestGeneration.current) { requestInFlight.current = false; setLoading(false) } }
        }, [props.sessionId])
        React.useEffect(() => {
          requestGeneration.current += 1; requestInFlight.current = false
          setApis([]); setRun(null); setQuery(''); setHasMore(false); setNextCursor(null); loadedMore.current = false; setError('')
          void refresh()
          const timer = window.setInterval(refresh, 1800)
          return () => { window.clearInterval(timer); requestGeneration.current += 1; requestInFlight.current = false }
        }, [refresh])
        const loadMore = async () => {
          if (loading || requestInFlight.current || !hasMore || !nextCursor) return
          requestInFlight.current = true
          setLoading(true)
          const generation = requestGeneration.current
          try { const result = await api(`audit/apis?sessionId=${encodeURIComponent(props.sessionId)}&limit=100&cursor=${encodeURIComponent(nextCursor)}`); if (generation !== requestGeneration.current) return; loadedMore.current = true; setApis(previous => mergeRows(previous, result.apis || [], 'id')); setHasMore(Boolean(result.hasMore)); setNextCursor(result.nextCursor || null) } catch (cause) { if (generation === requestGeneration.current) setError(cause?.message || String(cause)) } finally { if (generation === requestGeneration.current) { requestInFlight.current = false; setLoading(false) } }
        }
        const clear = async () => {
          if (typeof window !== 'undefined' && !window.confirm('确定清空当前代码审计的 API 清单、候选和报告吗？此操作不可撤销。')) return
          try { await api(`clear?sessionId=${encodeURIComponent(props.sessionId)}`, { method: 'POST', body: '{}' }); loadedMore.current = false; setApis([]); setHasMore(false); setNextCursor(null); await refresh() } catch (cause) { setError(cause?.message || String(cause)) }
        }
        const normalizedQuery = query.trim().toLocaleLowerCase()
        const filteredApis = normalizedQuery ? apis.filter(item => [item.method, item.path, item.entryId, item.handler].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalizedQuery)) : apis
        return h('section', { className: 'dsec-view' },
          h('header', { className: 'dsec-head' }, h('span', { className: 'dsec-title' }, 'API 清单'), h('span', { className: 'dsec-meta' }, `${normalizedQuery ? `${filteredApis.length}/${apis.length}` : apis.length} 个入口 · 静态提取${run?.language ? ` · ${run.language}` : ''}`), h('button', { className: 'dsec-btn', onClick: refresh }, '刷新'), h('button', { className: 'dsec-btn', onClick: clear, disabled: loading }, '清空')),
          h('div', { className: 'dsec-body' }, error ? h('div', { className: 'dsec-error' }, error) : null,
            h('div', { className: 'dsec-api-toolbar' }, h('input', { className: 'dsec-api-search', value: query, onChange: event => setQuery(event.target.value), placeholder: '搜索路径或方法...', 'aria-label': '搜索路径或方法' })),
            filteredApis.length ? h('div', { className: 'dsec-api-scroll' }, h('div', { className: 'dsec-api-grid' },
              ['方法', '路径', '漏洞', '漏洞 ID'].map(label => h('div', { className: 'dsec-api-cell dsec-api-head', key: label }, label)),
              filteredApis.map(item => {
                const methodValue = String(item.method || '—').toLowerCase()
                const methodClass = methodValue.includes('/') ? 'mixed' : ['get', 'post', 'put', 'patch', 'delete'].includes(methodValue) ? methodValue : 'default'
                const vulnerabilityIds = Array.isArray(item.vulnerabilityIds) ? item.vulnerabilityIds : []
                return h('div', { className: 'dsec-api-row', key: item.id },
                  h('div', { className: 'dsec-api-cell dsec-api-code' }, h('span', { className: `dsec-api-method dsec-api-method-${methodClass}` }, item.method || '—')),
                  h('div', { className: 'dsec-api-cell dsec-api-button' }, h('span', { className: 'dsec-api-primary dsec-api-code', title: item.path || item.entryId }, item.path || item.entryId), item.handler ? h('span', { className: 'dsec-api-secondary', title: item.handler }, item.handler) : null),
                  h('div', { className: 'dsec-api-cell' }, badge(item.hasVulnerability ? 'confirmed' : 'none', item.hasVulnerability ? '存在漏洞' : '未发现漏洞', item.hasVulnerability ? 'risk' : 'good')),
                  h('div', { className: 'dsec-api-cell dsec-vulnerability-ids' }, vulnerabilityIds.length ? vulnerabilityIds.map(id => h('button', { type: 'button', className: 'dsec-vulnerability-link', key: id, onClick: () => focusAuditFinding(props.sessionId, item.reportId, id), title: `跳转到报告 ${id}` }, id)) : h('span', { className: 'dsec-meta' }, '—')),
                )
              }),
            )) : h('div', { className: 'dsec-empty' }, normalizedQuery ? '没有匹配的 API 入口。' : '尚未提取 API 入口。请先运行 dsh_code_audit_start，再按入口点调用 dsh_code_audit_add_api。'),
            hasMore ? h('button', { className: 'dsec-btn', onClick: loadMore, disabled: loading }, loading ? '加载中…' : '加载更多 API') : null,
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
        function displayAuditSummary(report) {
          const counts = Object.entries(report?.counts || {}).filter(([, count]) => Number(count) > 0).map(([severity, count]) => `${labels[severity] || severity} ${count}`)
          return `报告状态：${report?.status || 'unknown'} · 已确认漏洞：${Array.isArray(report?.findings) ? report.findings.length : 0} 项${counts.length ? ` · ${counts.join(' / ')}` : ''}`
        }
        function auditSeverityClass(value) {
          const normalized = String(value || 'unknown').trim().toLowerCase()
          return ['critical', 'high', 'medium', 'low', 'none', 'unknown', 'info'].includes(normalized) ? normalized : 'unknown'
        }
        React.useEffect(() => {
          const target = pendingAuditReportFocus.get(String(props.sessionId))
          if (!target || !reports.length || typeof document === 'undefined') return undefined
          const report = reports.find(item => item.id === target.reportId)
          if (!report) return undefined
          const timer = window.setTimeout(() => {
            const element = document.getElementById(auditFindingAnchor(report.id, target.findingId))
            if (!element) return
            element.scrollIntoView({ block: 'center', behavior: 'smooth' })
            element.classList.add('dsec-finding-focus')
            window.setTimeout(() => element.classList.remove('dsec-finding-focus'), 1800)
            pendingAuditReportFocus.delete(String(props.sessionId))
          }, 0)
          return () => window.clearTimeout(timer)
        }, [props.sessionId, reports])
        function ListCard({ title, values }) {
          const items = Array.isArray(values) ? values : []
          return h('section', { className: 'dsec-understanding-card' }, h('div', { className: 'dsec-understanding-card-title' }, title), items.length ? h('ul', { className: 'dsec-understanding-list' }, items.map((item, index) => h('li', { key: `${title}-${index}` }, item))) : h('div', { className: 'dsec-meta' }, '未记录'))
        }
        function ProductUnderstanding({ understanding }) {
          const incomplete = !understanding || (understanding.status === 'pending' && !understanding.productSummary && !understanding.productPurpose && !(understanding.coreCapabilities || []).length && !(understanding.boundaries || []).length && !(understanding.assumptions || []).length && !(understanding.techStack || []).length)
          if (incomplete) return h('div', { className: 'dsec-warning' }, '尚未提交产品理解。请先完成产品用途、核心能力、功能边界、运行假设和技术栈分析。')
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
        function FindingDetail({ title, children }) {
          return h('div', { className: 'dsec-finding-detail' }, h('div', { className: 'dsec-finding-detail-title' }, title), h('div', { className: 'dsec-finding-detail-body' }, children))
        }
        function evidenceLocationLabel(location) {
          const file = String(location?.file || '未记录')
          const start = location?.lineStart == null ? '' : `:${location.lineStart}${location.lineEnd != null && location.lineEnd !== location.lineStart ? `-${location.lineEnd}` : ''}`
          const symbol = location?.symbol ? ` · ${location.symbol}` : ''
          return `${file}${start}${symbol}`
        }
        return h('section', { className: 'dsec-view' },
          h('header', { className: 'dsec-head' }, h('span', { className: 'dsec-title' }, '代码审计报告'), h('span', { className: 'dsec-meta' }, `${reports.length} 份结构化报告`), h('button', { className: 'dsec-btn', onClick: refresh, disabled: loading }, '刷新')),
          h('div', { className: 'dsec-body dsec-report-list' }, error ? h('div', { className: 'dsec-error' }, error) : null,
            h(ProductUnderstanding, { understanding: run?.productUnderstanding || reports[0]?.productUnderstanding }),
            reports.length ? reports.map((report, index) => {
              const coveragePercentage = Math.max(0, Math.min(100, Number(report.coverage?.percentage) || 0))
              return h(React.Fragment, { key: report.id }, index ? h('hr', { style: { width: '100%', border: 0, borderTop: '1px solid var(--dsw-alias-border-l1,#e5e7eb)' } }) : null,
                h('article', { className: 'dsec-code-report' },
                h('div', { className: 'dsec-report-head' }, h('span', { className: 'dsec-report-title' }, report.title), h('span', { className: 'dsec-meta' }, report.status)),
                h('div', { className: 'dsec-meta' }, displayAuditSummary(report)),
                h('div', { className: 'dsec-summary' }, Object.entries(report.counts || {}).map(([severity, count]) => { const severityClass = auditSeverityClass(severity); return h('div', { className: `dsec-summary-card dsec-summary-card-${severityClass}`, key: severity }, h('span', { className: 'dsec-summary-number' }, count), h('span', { className: 'dsec-summary-label' }, labels[severity] || severity)) })),
                report.findings?.length ? h('section', { className: 'dsec-report-section' }, h('div', { className: 'dsec-report-section-title' }, '结构化发现（按 CVSS 3.1 降序）'), h('div', { className: 'dsec-report-content' }, report.findings.map(finding => {
                  const severity = auditSeverityClass(finding.cvssSeverity || finding.severity)
                  const chain = Array.isArray(finding.chain) ? finding.chain.filter(Boolean) : []
                  const affectedFiles = Array.isArray(finding.affectedFiles) ? finding.affectedFiles.filter(Boolean) : []
                  const evidenceLocations = Array.isArray(finding.evidenceLocations) ? finding.evidenceLocations : []
                  const source = Array.isArray(finding.source) ? finding.source.filter(Boolean) : []
                  const sink = Array.isArray(finding.sink) ? finding.sink.filter(Boolean) : []
                  return h('div', { id: auditFindingAnchor(report.id, finding.candidateId || finding.id), className: `dsec-finding dsec-finding-${severity}`, key: finding.id || finding.title },
                    h('div', { className: 'dsec-finding-title' }, h('span', { className: `dsec-severity-label dsec-severity-${severity}` }, severity.toUpperCase()), finding.cvssScore == null ? null : h('span', { className: 'dsec-finding-cvss' }, `CVSS ${finding.cvssScore}`), h('span', { className: 'dsec-finding-name' }, finding.title || finding.id)),
                    h('div', { className: 'dsec-finding-api' }, h('span', { className: 'dsec-finding-api-label' }, 'API'), h('code', null, finding.entry || finding.entryId || '未记录'), finding.handler ? h('span', { className: 'dsec-finding-handler' }, `Handler: ${finding.handler}`) : null),
                    h('div', { className: 'dsec-finding-meta' }, `${finding.status || 'candidate'} · 置信度 ${finding.confidence || 'unknown'}${finding.cvssVector ? ` · ${finding.cvssVector}` : ''}`),
                    finding.impact ? h('div', { className: 'dsec-report-impact' }, h('strong', null, '影响：'), finding.impact) : null,
                    chain.length ? h(FindingDetail, { title: '调用链路' }, h('ol', { className: 'dsec-chain-list' }, chain.map((item, index) => h('li', { key: `${index}-${item}` }, item)))) : null,
                    (affectedFiles.length || evidenceLocations.length) ? h(FindingDetail, { title: '受影响文件' }, h('ul', { className: 'dsec-file-list' }, (affectedFiles.length ? affectedFiles : evidenceLocations.map(evidenceLocationLabel)).map((item, index) => h('li', { key: `${index}-${item}` }, h('code', null, typeof item === 'string' ? item : evidenceLocationLabel(item)))))) : null,
                    (source.length || sink.length) ? h(FindingDetail, { title: '数据流证据' }, h('div', { className: 'dsec-evidence-grid' }, source.length ? h('div', null, h('strong', null, 'Source'), h('ul', null, source.map((item, index) => h('li', { key: `source-${index}` }, item)))) : null, sink.length ? h('div', null, h('strong', null, 'Sink'), h('ul', null, sink.map((item, index) => h('li', { key: `sink-${index}` }, item)))) : null)) : null,
                    finding.remediation ? h(FindingDetail, { title: '修复建议' }, h('div', null, finding.remediation)) : null,
                    finding.requestPoc ? h('div', { className: 'dsec-report-poc-wrap' }, h('div', { className: 'dsec-report-poc-label' }, 'Request PoC（未执行）'), h('pre', { className: 'dsec-pre dsec-report-poc' }, finding.requestPoc)) : null,
                  )
                }))) : null,
                report.coverage ? h('section', { className: 'dsec-report-section' }, h('div', { className: 'dsec-report-section-title' }, `API 覆盖率 ${coveragePercentage}%`), h('div', { className: 'dsec-summary dsec-report-content' }, h('div', { className: 'dsec-summary-card' }, h('span', { className: 'dsec-summary-number' }, report.coverage.total || 0), h('span', { className: 'dsec-summary-label' }, 'API 总数')), h('div', { className: 'dsec-summary-card' }, h('span', { className: 'dsec-summary-number' }, report.coverage.covered || 0), h('span', { className: 'dsec-summary-label' }, '已覆盖')), h('div', { className: 'dsec-summary-card' }, h('span', { className: 'dsec-summary-number' }, report.coverage.uncovered || 0), h('span', { className: 'dsec-summary-label' }, '未覆盖'))), h('div', { className: 'dsec-coverage-bar', title: `已覆盖 ${coveragePercentage}%` }, h('div', { className: 'dsec-coverage-fill', style: { width: `${coveragePercentage}%` } })), report.coverage.uncoveredEntries?.length ? h('div', null, h('div', { className: 'dsec-coverage-label' }, '未覆盖入口'), h('div', { className: 'dsec-coverage-list' }, report.coverage.uncoveredEntries.map((item, itemIndex) => h('span', { className: 'dsec-coverage-entry', key: `${item.entryId || item.path || 'entry'}-${itemIndex}` }, `${item.method || '—'} ${item.path || item.entryId || '未记录'}`)))) : null) : null,
                ),
              )
            }) : h('div', { className: 'dsec-empty' }, '尚未提交代码审计最终报告。完成入口分析和候选整理后调用 dsh_code_audit_report。'),
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
