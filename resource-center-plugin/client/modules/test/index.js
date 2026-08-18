(function defineDshResourceCenterModule_test(global) {
  const registry = global.__dshResourceCenterModuleRegistry || (global.__dshResourceCenterModuleRegistry = {})
  if (registry.test) return
  registry.test = function registerDshResourceCenterTest(global) {
  const loader = global.__ModuleLoader__
  if (!loader || typeof loader.load !== 'function') throw new Error('dsh-resource-center-test: client module loader is unavailable')

  loader.load({
    id: 'dsh-resource-center-test',
    factory(require) {
      const React = require('react')
      const h = React.createElement

      const CSS = `
.dwt-panel{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#25282d);font-size:12px}
.dwt-panel *{box-sizing:border-box}
.dwt-sub{color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px}
.dwt-body{display:flex;flex:1;min-height:0;flex-direction:column;gap:8px;padding:9px;overflow:auto}
.dwt-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dwt-label{color:var(--dsw-alias-label-secondary,#727983);font-size:10.5px}
.dwt-input,.dwt-textarea,.dwt-select{width:100%;min-width:0;border:1px solid var(--dsw-alias-border-l2,#d8dce2);border-radius:5px;padding:6px 7px;background:var(--dsw-alias-input-fill,#fff);color:inherit;font:inherit;font-size:11px;outline:0}
.dwt-input:focus,.dwt-textarea:focus,.dwt-select:focus{border-color:var(--dsw-alias-state-business-primary,#3578e5)}
.dwt-textarea{resize:vertical;line-height:1.45;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px}
.dwt-raw{min-height:185px}
.dwt-json{min-height:70px}
.dwt-btn{border:1px solid var(--dsw-alias-border-l2,#d8dce2);border-radius:5px;padding:5px 9px;background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font:inherit;font-size:11px;cursor:pointer}
.dwt-btn:hover{background:var(--dsw-alias-bg-layer-2,#f1f3f6)}
.dwt-btn.primary{border-color:#df7a36;background:#f08a3d;color:#fff}
.dwt-btn.danger{color:#c84a4a}
.dwt-btn:disabled{opacity:.5;cursor:default}
.dwt-error{padding:7px 8px;border-radius:5px;background:#fff0f0;color:#c34444;line-height:1.45;word-break:break-word}
.dwt-ok{padding:7px 8px;border-radius:5px;background:#eefaf1;color:#388650;line-height:1.45}
.dwt-split{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}
.dwt-result{border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:5px;overflow:auto;max-height:260px}
.dwt-table{width:100%;border-collapse:collapse;font-size:10px}
.dwt-table th,.dwt-table td{padding:5px 6px;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);text-align:left;white-space:nowrap}
.dwt-table th{position:sticky;top:0;background:var(--dsw-alias-bg-layer-2,#f5f6f8);color:var(--dsw-alias-label-secondary,#727983);font-weight:600}
.dwt-pass{color:#31874a}.dwt-fail{color:#c54b4b}
.dwt-flow-list{display:flex;flex-direction:column;gap:4px;min-height:0;overflow:auto}
.dwt-flow{display:grid;grid-template-columns:48px 48px minmax(0,1fr) 42px;gap:5px;align-items:center;padding:6px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:5px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}
.dwt-flow:hover,.dwt-flow.active{background:var(--dsw-alias-bg-layer-2,#f1f3f6)}
.dwt-flow-url{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dwt-flow-meta{color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px;text-align:right}
.dwt-mitm-config{display:flex;flex:1;min-height:0;flex-direction:column;gap:9px;padding:10px 9px;overflow:auto}.dwt-mitm-config .dwt-config-section{padding:9px 0}.dwt-mitm-config .dwt-config-content{gap:7px}.dwt-mitm-config .dwt-textarea{min-height:58px}.dwt-mitm-config .dwt-json{min-height:92px}.dwt-mitm-status{display:flex;align-items:center;gap:6px;padding:7px 8px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:6px;background:var(--dsw-alias-bg-layer-2,#f7f8fa)}.dwt-mitm-status-dot{width:7px;height:7px;border-radius:50%;background:#a4aab3}.dwt-mitm-status-dot.live{background:#3abf72}.dwt-mitm-status-text{min-width:0;flex:1;font-size:10px}.dwt-mitm-status-port{color:var(--dsw-alias-label-tertiary,#969da7);font:9px ui-monospace,SFMono-Regular,Menlo,monospace}.dwt-mitm-config .dwt-checkbox-row{display:flex;align-items:flex-start;gap:6px;color:var(--dsw-alias-label-secondary,#727983);font-size:10px;line-height:1.4}.dwt-mitm-config .dwt-checkbox-row input{margin:1px 0 0;accent-color:var(--dsw-alias-state-business-primary,#3578e5)}
.dwt-pre{margin:0;max-height:230px;overflow:auto;white-space:pre-wrap;word-break:break-word;font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
.dwt-tabs{display:flex;gap:2px;padding:7px 9px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb);flex:0 0 auto}
.dwt-tab{border:0;border-radius:5px;padding:5px 9px;background:transparent;color:var(--dsw-alias-label-secondary,#727983);font:inherit;font-size:11px;cursor:pointer}
.dwt-tab:hover{background:var(--dsw-alias-bg-layer-2,#f1f3f6)}
.dwt-tab.active{background:#eef4ff;color:var(--dsw-alias-state-business-primary,#3578e5);font-weight:650}
.dwt-sidebar-panel{display:flex;flex-direction:column;min-height:100%;background:var(--dsw-alias-bg-layer-1,#fff)}.dwt-mitm-sidebar{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#fff)}
.dwt-sidebar-head{display:flex;align-items:center;min-height:42px;padding:0 9px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb)}
.dwt-sidebar-title{font-size:12px;font-weight:650;flex:1}
.dwt-sidebar-copy{padding:10px 9px;color:var(--dsw-alias-label-tertiary,#969da7);font-size:10.5px;line-height:1.5}
.dwt-sidebar-fuzzer-config{display:flex;flex:1;min-height:0;flex-direction:column;gap:8px;padding:10px 9px;overflow:auto;background:var(--dsw-alias-bg-layer-1,#fff)}
.dwt-sidebar-fuzzer-config .dwt-fuzzer-config-head{margin:0}.dwt-sidebar-fuzzer-config .dwt-config-section{padding:9px 0}.dwt-sidebar-fuzzer-config .dwt-config-content{gap:7px}.dwt-sidebar-fuzzer-config .dwt-textarea{min-height:76px}.dwt-sidebar-fuzzer-config .dwt-config-note{font-size:10px}.dwt-sidebar-fuzzer-config .dwt-network-pem{min-height:58px;font-size:9px}.dwt-sidebar-fuzzer-config .dwt-checkbox-row{display:flex;align-items:flex-start;gap:6px;color:var(--dsw-alias-label-secondary,#727983);font-size:10px;line-height:1.4}.dwt-sidebar-fuzzer-config .dwt-checkbox-row input{margin:1px 0 0;accent-color:var(--dsw-alias-state-business-primary,#3578e5)}
.dwt-center-pane-layer{position:fixed;left:min(var(--dsh-resource-center-left-width,280px),100vw);right:var(--dsh-resource-center-right-width,0px);top:0;bottom:0;z-index:24;display:flex;pointer-events:none}
.dwt-center-pane-grid{width:100%;height:100%;min-width:0;box-sizing:border-box;pointer-events:auto;background:var(--dsw-alias-bg-layer-1,#fff);border-left:1px solid var(--dsw-alias-border-l1,#e5e7eb);box-shadow:-12px 0 30px rgba(15,23,42,.04)}
.dwt-center-pane{display:flex;width:100%;height:100%;min-width:0;min-height:0;flex-direction:column;background:var(--dsw-alias-bg-layer-1,#fff);overflow:hidden;color:var(--dsw-alias-label-primary,#25282d)}
.dwt-center-pane-head{display:flex;align-items:center;gap:8px;flex:0 0 48px;padding:0 calc(12px + var(--dsh-host-toggle-width,0px)) 0 12px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff)}
.dwt-center-pane-title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:650}
.dwt-center-pane-kind{flex:0 0 auto;color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px}
.dwt-center-pane-action{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary,#969da7);cursor:pointer;font-size:15px}
.dwt-center-pane-action:hover{background:var(--dsw-alias-bg-layer-2,#f1f3f6);color:var(--dsw-alias-label-primary,#25282d)}
.dwt-center-pane-body{min-width:0;min-height:0;flex:1;overflow:auto;background:var(--dsw-alias-bg-layer-2,#f7f8fa);container-type:inline-size}
.dwt-center-pane-body>.dwt-panel{min-height:100%;height:auto;width:100%;max-width:1480px;margin:0 auto;background:transparent}
.dwt-fuzzer-page{display:flex;flex-direction:column;min-height:100%;background:var(--dsw-alias-bg-layer-2,#f7f8fa)}
.dwt-fuzzer-instance-tabs{display:flex;align-items:center;gap:2px;min-height:36px;padding:4px 10px;overflow:auto;border-top:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff);position:sticky;bottom:0;z-index:2}
.dwt-fuzzer-instance-tab{display:flex;align-items:center;gap:2px;flex:0 0 auto;border:1px solid transparent;border-bottom:0;border-radius:5px 5px 0 0;background:transparent;color:var(--dsw-alias-label-secondary,#727983)}
.dwt-fuzzer-instance-tab.active{border-color:var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-2,#f7f8fa);color:var(--dsw-alias-label-primary,#25282d)}
.dwt-fuzzer-instance-tab button{border:0;background:transparent;color:inherit;font:inherit;font-size:11px;cursor:pointer}.dwt-fuzzer-instance-tab button:first-child{padding:6px 9px}.dwt-fuzzer-instance-tab button:last-child{padding:4px 6px;color:var(--dsw-alias-label-tertiary,#969da7)}.dwt-fuzzer-instance-tab button:hover{color:var(--dsw-alias-state-business-primary,#3578e5)}
.dwt-fuzzer-instance-add{width:25px;height:25px;flex:0 0 auto;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary,#727983);font-size:19px;line-height:1;cursor:pointer}.dwt-fuzzer-instance-add:hover{background:var(--dsw-alias-bg-layer-2,#f1f3f6)}
.dwt-fuzzer-toolbar{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff)}
.dwt-fuzzer-toolbar-title{font-size:13px;font-weight:650}.dwt-fuzzer-toolbar-meta{color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px}.dwt-fuzzer-toolbar-spacer{flex:1}
.dwt-fuzzer-history{display:flex;flex:0 0 auto;max-height:330px;min-height:0;flex-direction:column;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff)}
.dwt-fuzzer-history-head{display:flex;align-items:center;gap:7px;padding:8px 11px;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3)}.dwt-fuzzer-history-title{font-weight:650}.dwt-fuzzer-history-count{color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px}.dwt-fuzzer-history-search{max-width:280px;margin-left:auto}.dwt-fuzzer-history-list{min-height:0;overflow:auto}.dwt-history-row{display:flex;align-items:center;gap:9px;padding:7px 11px;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3)}.dwt-history-row-main{display:flex;min-width:140px;flex-direction:column;gap:2px}.dwt-history-row-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.dwt-history-preview{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#727983);font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.dwt-history-result{flex:0 0 auto;font-size:10px}.dwt-history-actions{display:flex;flex:0 0 auto;gap:4px}.dwt-history-empty{padding:18px;text-align:center;color:var(--dsw-alias-label-tertiary,#969da7);font-size:11px}
.dwt-history-instance{color:var(--dsw-alias-state-business-primary,#3578e5);font-size:9px}
.dwt-fuzzer-workbench{display:grid;grid-template-columns:230px minmax(320px,1fr) minmax(340px,1fr);flex:1;min-height:0}
.dwt-fuzzer-workbench-central{grid-template-columns:minmax(320px,1fr) minmax(340px,1fr)}
.dwt-fuzzer-config{min-width:0;min-height:0;overflow:auto;padding:12px;border-right:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff)}
.dwt-fuzzer-config-head{display:flex;align-items:baseline;gap:7px;margin-bottom:9px}.dwt-fuzzer-config-title{font-size:12px;font-weight:650}.dwt-fuzzer-config-caption{color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px}
.dwt-config-section{padding:11px 0;border-top:1px solid var(--dsw-alias-border-l1,#eef0f3)}.dwt-config-section:first-of-type{border-top:0;padding-top:0}.dwt-config-section summary{cursor:pointer;list-style:none;font-size:11px;font-weight:600}.dwt-config-section summary::-webkit-details-marker{display:none}.dwt-config-section summary:before{content:'›';display:inline-block;width:15px;color:var(--dsw-alias-label-tertiary,#969da7)}.dwt-config-section[open] summary:before{content:'⌄'}
.dwt-config-content{display:flex;flex-direction:column;gap:8px;padding:9px 0 0}.dwt-config-content .dwt-textarea{min-height:86px}.dwt-config-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dwt-config-note{color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px;line-height:1.45}
.dwt-fuzzer-request,.dwt-fuzzer-response{display:flex;min-width:0;min-height:0;flex-direction:column;background:var(--dsw-alias-bg-layer-1,#fff)}.dwt-fuzzer-request{border-right:1px solid var(--dsw-alias-border-l1,#e5e7eb)}
.dwt-fuzzer-pane-head{display:flex;align-items:center;gap:7px;min-height:42px;padding:0 11px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb)}.dwt-fuzzer-pane-title{font-weight:650;font-size:12px;flex:1}.dwt-fuzzer-pane-caption{color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px}.dwt-fuzzer-pane-actions{display:flex;gap:4px}
.dwt-fuzzer-editor{display:flex;flex:1;min-height:0;flex-direction:column;padding:11px;gap:8px}.dwt-fuzzer-editor .dwt-raw{flex:1;min-height:300px;resize:none;padding:10px;font-size:11px;line-height:1.55}.dwt-fuzzer-editor .dwt-label{display:flex;flex:1;min-height:0;flex-direction:column;gap:5px}.dwt-fuzzer-hint{color:var(--dsw-alias-label-tertiary,#969da7);font-size:10px;line-height:1.45}
.dwt-fuzzer-response-summary{display:flex;align-items:center;gap:6px;padding:10px 11px;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);font-size:11px}.dwt-fuzzer-response-summary strong{font-size:12px}.dwt-fuzzer-results{min-height:0;max-height:42%;overflow:auto;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb)}.dwt-fuzzer-result-row{display:grid;grid-template-columns:34px 60px 58px minmax(0,1fr);gap:6px;width:100%;align-items:center;padding:7px 10px;border:0;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);background:transparent;color:inherit;text-align:left;font:inherit;font-size:10px;cursor:pointer}.dwt-fuzzer-result-row:hover,.dwt-fuzzer-result-row.active{background:var(--dsw-alias-bg-layer-2,#f1f3f6)}.dwt-fuzzer-result-url{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dwt-fuzzer-response-body{display:flex;flex:1;min-height:160px;flex-direction:column;gap:6px;padding:11px;overflow:auto}.dwt-fuzzer-response-body pre{margin:0;white-space:pre-wrap;word-break:break-word;font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.dwt-fuzzer-empty{display:flex;flex:1;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#969da7);font-size:11px}
.dwt-response-highlight{border-radius:2px;background:#ffe08a;color:#553300;box-shadow:0 0 0 1px rgba(220,150,20,.22)}.dwt-fuzzer-response-tools{min-width:0}.dwt-fuzzer-response-search{width:150px;max-width:22vw}.dwt-fuzzer-response-filter{width:86px;padding:5px 6px}.dwt-fuzzer-result-table{min-width:680px;overflow:auto}.dwt-fuzzer-result-header,.dwt-fuzzer-result-row{display:grid;grid-template-columns:34px minmax(120px,1fr) 52px 58px 72px 62px 92px 52px;gap:6px;align-items:center}.dwt-fuzzer-result-header{padding:7px 10px;background:var(--dsw-alias-bg-layer-2,#f5f6f8);border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb);color:var(--dsw-alias-label-secondary,#727983);font-size:10px}.dwt-fuzzer-result-row{width:100%;padding:7px 10px;border:0;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);background:transparent;color:inherit;text-align:left;font:inherit;font-size:10px;cursor:pointer}.dwt-fuzzer-result-row:hover,.dwt-fuzzer-result-row.active{background:var(--dsw-alias-bg-layer-2,#f1f3f6)}.dwt-fuzzer-result-cell{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dwt-fuzzer-result-payloads{color:var(--dsw-alias-label-secondary,#727983);font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.dwt-fuzzer-result-open{color:var(--dsw-alias-state-business-primary,#3578e5);text-align:right}
.dwt-mitm-page{display:flex;flex:1;min-height:0;flex-direction:column;background:var(--dsw-alias-bg-layer-2,#f7f8fa)}.dwt-mitm-toolbar{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff)}.dwt-mitm-toolbar-title{font-size:13px;font-weight:650}.dwt-mitm-toolbar-spacer{flex:1}.dwt-mitm-filter{width:220px}.dwt-mitm-table-wrap{min-height:0;flex:1;overflow:auto;padding:10px 12px}.dwt-mitm-table{min-width:760px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#fff)}.dwt-mitm-table-head,.dwt-mitm-table-row{display:grid;grid-template-columns:74px 58px 62px minmax(220px,1fr) 52px 86px;gap:6px;align-items:center}.dwt-mitm-table-head{padding:8px 10px;background:var(--dsw-alias-bg-layer-2,#f5f6f8);border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb);color:var(--dsw-alias-label-secondary,#727983);font-size:10px}.dwt-mitm-table-row{width:100%;padding:9px 10px;border:0;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);background:transparent;color:inherit;text-align:left;font:inherit;font-size:10px;cursor:pointer}.dwt-mitm-table-row:last-child{border-bottom:0}.dwt-mitm-table-row:hover,.dwt-mitm-table-row.active{background:var(--dsw-alias-bg-layer-2,#f1f3f6)}.dwt-mitm-cell{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dwt-mitm-cell.url{font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.dwt-mitm-stage{font-size:9px;color:var(--dsw-alias-label-tertiary,#969da7)}.dwt-mitm-stage.pending{color:#db7a32;font-weight:650}.dwt-mitm-detail{display:flex;min-height:280px;flex-direction:column;gap:8px;padding:10px 12px;border-top:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff)}.dwt-mitm-detail-head{display:flex;align-items:center;gap:8px}.dwt-mitm-detail-title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.dwt-mitm-packet-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;min-height:220px}.dwt-mitm-packet{display:flex;min-width:0;min-height:0;flex-direction:column;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:5px;overflow:hidden}.dwt-mitm-packet-title{padding:7px 9px;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);font-weight:650}.dwt-mitm-packet pre{flex:1;min-height:150px;margin:0;padding:9px;overflow:auto;white-space:pre-wrap;word-break:break-word;font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.dwt-mitm-response-editor{min-height:150px;flex:1;border:0;border-radius:0;resize:vertical;font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.dwt-mitm-actionbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.dwt-mitm-hae{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:7px 8px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:5px;background:var(--dsw-alias-bg-layer-2,#f7f8fa)}.dwt-mitm-hae-title{font-weight:650}.dwt-mitm-hae-item{padding:2px 5px;border-radius:3px;color:#3b3f46;font-size:10px}.dwt-mitm-empty{display:flex;min-height:240px;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#969da7);font-size:11px}
.dwt-panel-central{background:#f4f7fb}.dwt-fuzzer-page{background:linear-gradient(180deg,#f8fbff 0%,#f4f7fb 52%,#f7f9fc 100%)}
.dwt-fuzzer-toolbar{min-height:60px;padding:0 18px;gap:12px;background:rgba(255,255,255,.94);box-shadow:0 1px 0 rgba(148,163,184,.12)}.dwt-fuzzer-toolbar-brand{display:flex;align-items:center;gap:9px;min-width:0}.dwt-fuzzer-toolbar-mark{display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;border-radius:9px;background:linear-gradient(145deg,#eaf2ff,#d7e7ff);color:#3578e5;font-size:17px;font-weight:700;box-shadow:inset 0 0 0 1px rgba(53,120,229,.08)}.dwt-fuzzer-toolbar-copy{display:flex;min-width:0;flex-direction:column;gap:2px}.dwt-fuzzer-toolbar-kicker{color:#7c8aa0;font-size:9px;font-weight:650;letter-spacing:.08em;text-transform:uppercase}.dwt-fuzzer-toolbar-title{font-size:14px;line-height:1.1}.dwt-fuzzer-toolbar-meta{font-size:10px}.dwt-fuzzer-toolbar-status{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid #dbe8df;border-radius:999px;background:#f2fbf5;color:#388650;font-size:10px}.dwt-fuzzer-toolbar-status-dot{width:6px;height:6px;border-radius:50%;background:#43bb73}.dwt-fuzzer-toolbar-status.busy{border-color:#f2d8c1;background:#fff8f0;color:#bd6b2c}.dwt-fuzzer-toolbar-status.busy .dwt-fuzzer-toolbar-status-dot{background:#f08a3d}
.dwt-sidebar-fuzzer-config{padding:12px 10px 14px;background:linear-gradient(180deg,#fbfdff,#f7f9fc)}.dwt-fuzzer-sidebar-hero{padding:12px;border:1px solid #dce7f5;border-radius:10px;background:linear-gradient(145deg,#f4f8ff,#ffffff 72%);box-shadow:0 5px 16px rgba(51,91,145,.06)}.dwt-fuzzer-sidebar-hero-top{display:flex;align-items:center;justify-content:space-between;gap:6px}.dwt-fuzzer-sidebar-kicker{color:#7b8ba2;font-size:9px;font-weight:700;letter-spacing:.08em}.dwt-fuzzer-case-pill{padding:3px 6px;border-radius:999px;background:#edf4ff;color:#3578e5;font-size:9px;font-weight:650}.dwt-fuzzer-sidebar-hero-title{margin-top:8px;font-size:14px;font-weight:700;letter-spacing:-.01em}.dwt-fuzzer-sidebar-hero-subtitle{margin-top:4px;color:#8591a1;font-size:10px;line-height:1.45}.dwt-sidebar-fuzzer-config .dwt-config-section{margin:0;border:1px solid #e1e7ef;border-radius:9px;padding:0 10px;background:rgba(255,255,255,.76);box-shadow:0 2px 8px rgba(30,55,90,.025)}.dwt-sidebar-fuzzer-config .dwt-config-section:first-of-type{border-top:1px solid #e1e7ef;padding-top:0}.dwt-sidebar-fuzzer-config .dwt-config-section summary{padding:10px 0}.dwt-sidebar-fuzzer-config .dwt-config-content{padding:0 0 11px}.dwt-sidebar-fuzzer-config .dwt-textarea,.dwt-sidebar-fuzzer-config .dwt-input,.dwt-sidebar-fuzzer-config .dwt-select{background:#fbfcfe;border-color:#dce4ee}.dwt-sidebar-fuzzer-config .dwt-textarea:focus,.dwt-sidebar-fuzzer-config .dwt-input:focus,.dwt-sidebar-fuzzer-config .dwt-select:focus{background:#fff;box-shadow:0 0 0 3px rgba(53,120,229,.1)}
.dwt-fuzzer-workbench-central{padding:12px 14px 14px;gap:12px;background:transparent}.dwt-fuzzer-request,.dwt-fuzzer-response{border:1px solid #dbe3ee;border-radius:10px;box-shadow:0 8px 24px rgba(30,55,90,.045);overflow:hidden}.dwt-fuzzer-request{border-right:1px solid #dbe3ee}.dwt-fuzzer-pane-head{min-height:50px;padding:0 14px;background:linear-gradient(180deg,#ffffff,#fbfdff);border-bottom-color:#e1e8f1}.dwt-fuzzer-pane-heading{display:flex;align-items:center;gap:8px;min-width:0;flex:1}.dwt-fuzzer-pane-mark{display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:7px;background:#edf4ff;color:#3578e5;font-size:13px;font-weight:700}.dwt-fuzzer-pane-mark.response{background:#eefaf4;color:#3b9b68}.dwt-fuzzer-pane-heading-copy{display:flex;min-width:0;flex-direction:column;gap:2px}.dwt-fuzzer-pane-title{font-size:12px}.dwt-fuzzer-pane-caption{font-size:9px}.dwt-fuzzer-editor{padding:13px;gap:9px;background:#fcfdff}.dwt-fuzzer-editor .dwt-raw{border-color:#d7e1ec;border-radius:8px;background:#f8fafc;box-shadow:inset 0 1px 2px rgba(30,55,90,.025)}.dwt-fuzzer-hint{padding:0 2px}.dwt-fuzzer-response-body{padding:13px;background:#fcfdff}.dwt-fuzzer-empty{gap:7px;padding:28px}.dwt-fuzzer-empty-icon{display:inline-flex;width:38px;height:38px;align-items:center;justify-content:center;border:1px solid #d8e5f6;border-radius:12px;background:#eef5ff;color:#5b8fe4;font-size:18px;font-weight:700}.dwt-fuzzer-empty strong{font-size:12px;font-weight:650;color:#536277}.dwt-fuzzer-empty span{max-width:260px;color:#9aa5b4;font-size:10px;line-height:1.5;text-align:center}.dwt-fuzzer-instance-tabs{min-height:42px;padding:5px 14px;background:rgba(255,255,255,.96);box-shadow:0 -4px 12px rgba(30,55,90,.035)}.dwt-fuzzer-instance-label{padding:0 6px;color:#7c8aa0;font-size:9px;font-weight:650;letter-spacing:.04em}
.dwt-fuzzer-instance-tabs{position:sticky;top:0;bottom:auto;min-height:42px;padding:5px 14px;border-top:0;border-bottom:1px solid #dbe3ee;background:rgba(255,255,255,.98);box-shadow:0 4px 12px rgba(30,55,90,.035);z-index:3}.dwt-fuzzer-instance-label{margin-right:4px}.dwt-fuzzer-toolbar-context{display:flex;min-width:0;flex-direction:column;gap:2px}.dwt-fuzzer-toolbar-context .dwt-fuzzer-toolbar-title{font-size:12px}.dwt-fuzzer-toolbar-context .dwt-fuzzer-toolbar-kicker{font-size:9px}.dwt-fuzzer-toolbar-context .dwt-fuzzer-toolbar-meta{font-size:9px}.dwt-fuzzer-toolbar{min-height:48px;padding:0 18px}.dwt-fuzzer-pane-actions{align-items:center;flex-wrap:wrap}.dwt-fuzzer-run{box-shadow:0 4px 10px rgba(240,138,61,.18)}.dwt-fuzzer-result-table{min-width:0}.dwt-fuzzer-result-header,.dwt-fuzzer-result-row{grid-template-columns:30px minmax(120px,1.35fr) 48px 50px 68px 58px minmax(105px,1fr) 46px;gap:5px}.dwt-fuzzer-result-payloads{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dwt-fuzzer-result-open{font-weight:650}
.dwt-mitm-page{background:linear-gradient(180deg,#f8fbff 0%,#f4f7fb 100%)}
.dwt-mitm-sidebar{flex:1;min-height:0;overflow:hidden}.dwt-mitm-sidebar .dwt-sidebar-head{flex:0 0 42px}.dwt-mitm-sidebar .dwt-mitm-config{min-height:0;flex:1;overflow-y:auto;padding-bottom:28px}
.dwt-mitm-toolbar{min-height:62px;padding:0 18px;gap:11px;background:rgba(255,255,255,.96);box-shadow:0 1px 0 rgba(148,163,184,.12)}
.dwt-mitm-toolbar-brand{display:flex;align-items:center;gap:9px;min-width:0}.dwt-mitm-toolbar-mark{display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;border-radius:9px;background:linear-gradient(145deg,#eaf2ff,#d7e7ff);color:#3578e5;font-size:18px;font-weight:700;box-shadow:inset 0 0 0 1px rgba(53,120,229,.08)}.dwt-mitm-toolbar-copy{display:flex;min-width:0;flex-direction:column;gap:2px}.dwt-mitm-toolbar-kicker{color:#7c8aa0;font-size:9px;font-weight:650;letter-spacing:.08em}.dwt-mitm-toolbar-title{font-size:14px;line-height:1.1}.dwt-mitm-toolbar-meta{color:#8b98aa;font-size:10px}.dwt-mitm-toolbar-state{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid #e0e6ee;border-radius:999px;background:#f7f9fc;color:#8b98aa;font-size:10px}.dwt-mitm-toolbar-state.live{border-color:#dbe8df;background:#f2fbf5;color:#388650}.dwt-mitm-toolbar-state-dot{width:6px;height:6px;border-radius:50%;background:#aab4c1}.dwt-mitm-toolbar-state.live .dwt-mitm-toolbar-state-dot{background:#43bb73}.dwt-mitm-pending-toggle{white-space:nowrap}
.dwt-mitm-config{gap:10px;padding:11px 10px 14px;background:linear-gradient(180deg,#fbfdff,#f5f8fc)}.dwt-mitm-status-card{display:flex;flex-direction:column;gap:9px;padding:12px;border:1px solid #dce7f5;border-radius:10px;background:linear-gradient(145deg,#f4f8ff,#ffffff 72%);box-shadow:0 5px 16px rgba(51,91,145,.06)}.dwt-mitm-status-main{display:flex;align-items:center;gap:8px;min-width:0}.dwt-mitm-status-icon{display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:8px;background:#edf4ff;color:#3578e5;font-size:17px;font-weight:700}.dwt-mitm-status-copy{display:flex;min-width:0;flex-direction:column;gap:2px}.dwt-mitm-status-kicker,.dwt-mitm-section-kicker{color:#7b8ba2;font-size:9px;font-weight:700;letter-spacing:.08em}.dwt-mitm-status-title{font-size:12px}.dwt-mitm-status-badge{align-self:flex-start;padding:3px 7px;border-radius:999px;background:#f0f2f5;color:#8b95a3;font-size:9px;font-weight:700;letter-spacing:.05em}.dwt-mitm-status-badge.live{background:#eaf8ef;color:#388650}.dwt-mitm-endpoint{padding-top:8px;border-top:1px solid #e8eef6;color:#64748b;font:9px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dwt-mitm-actions{padding:0 1px}.dwt-mitm-note{padding:8px 9px;border:1px solid #e7edf5;border-radius:7px;background:rgba(255,255,255,.72)}.dwt-mitm-listen-card{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid #e1e7ef;border-radius:9px;background:rgba(255,255,255,.76);box-shadow:0 2px 8px rgba(30,55,90,.025)}.dwt-mitm-listen-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(76px,.75fr);gap:7px}.dwt-mitm-listen-grid .dwt-label{display:flex;flex-direction:column;gap:5px}.dwt-mitm-listen-hint{color:#8b98aa;font-size:9px;line-height:1.45}.dwt-mitm-config .dwt-input:disabled{background:#f3f6fa;color:#8b95a3;cursor:not-allowed}
.dwt-mitm-table-wrap{padding:12px 14px}.dwt-mitm-table{border-color:#dbe3ee;border-radius:10px;box-shadow:0 8px 24px rgba(30,55,90,.045)}.dwt-mitm-table-head{padding:9px 12px;background:#f7f9fc;border-bottom-color:#e1e8f1}.dwt-mitm-table-row{padding:10px 12px}.dwt-mitm-table-row:hover,.dwt-mitm-table-row.active{background:#f3f7fd}.dwt-mitm-table-row.active{box-shadow:inset 3px 0 0 #3578e5}.dwt-mitm-empty-card{min-height:260px;margin:12px 14px;border:1px dashed #d7e1ec;border-radius:10px;background:rgba(255,255,255,.72);box-shadow:0 8px 24px rgba(30,55,90,.035);flex-direction:column;gap:7px}.dwt-mitm-empty-icon{display:inline-flex;width:42px;height:42px;align-items:center;justify-content:center;border:1px solid #d8e5f6;border-radius:13px;background:#eef5ff;color:#5b8fe4;font-size:20px;font-weight:700}.dwt-mitm-empty-card strong{font-size:13px;color:#536277}.dwt-mitm-empty-card>span{max-width:330px;color:#9aa5b4;font-size:10px;line-height:1.5;text-align:center}.dwt-mitm-empty-hints{display:flex;gap:6px;margin-top:4px}.dwt-mitm-empty-hints span{padding:4px 7px;border-radius:999px;background:#f0f5fc;color:#7c8aa0;font-size:9px}
@media (max-width:1100px){.dwt-fuzzer-workbench{grid-template-columns:210px minmax(300px,1fr)}.dwt-fuzzer-response{grid-column:1/-1;min-height:300px;max-height:420px;border-top:1px solid var(--dsw-alias-border-l1,#e5e7eb)}}
@media (max-width:720px){.dwt-fuzzer-workbench{display:flex;flex-direction:column}.dwt-fuzzer-config{max-height:none;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb)}.dwt-fuzzer-request{min-height:420px;border-right:0}.dwt-fuzzer-response{max-height:none}.dwt-fuzzer-toolbar{flex-wrap:wrap;padding:8px 10px}}
@container (max-width:1100px){.dwt-fuzzer-workbench{grid-template-columns:210px minmax(0,1fr)}.dwt-fuzzer-response{grid-column:1/-1;min-height:300px;max-height:420px;border-top:1px solid var(--dsw-alias-border-l1,#e5e7eb)}}
@container (max-width:720px){.dwt-fuzzer-workbench{display:flex;flex-direction:column}.dwt-fuzzer-config{max-height:none;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb)}.dwt-fuzzer-request{min-height:420px;border-right:0}.dwt-fuzzer-response{max-height:none}}
@container (max-width:1100px){.dwt-fuzzer-workbench-central{grid-template-columns:minmax(300px,1fr)}.dwt-fuzzer-workbench-central .dwt-fuzzer-response{grid-column:auto;min-height:300px;max-height:420px}}
@container (max-width:720px){.dwt-fuzzer-toolbar{flex-wrap:wrap;min-height:48px;padding:8px 10px}.dwt-fuzzer-toolbar-spacer{display:none}.dwt-fuzzer-toolbar-title{margin-right:auto}.dwt-fuzzer-workbench-central{display:flex;flex-direction:column}.dwt-fuzzer-workbench-central .dwt-fuzzer-request{min-height:420px}.dwt-fuzzer-workbench-central .dwt-fuzzer-response{max-height:none}}
.dwt-mitm-sidebar .dwt-sidebar-head{background:#fff}.dwt-mitm-sidebar .dwt-sidebar-head .dwt-sidebar-title{font-size:12px}.dwt-mitm-config{padding:12px 10px 16px;background:linear-gradient(180deg,#fbfdff 0%,#f6f9fc 100%)}.dwt-mitm-hero{padding:12px;border:1px solid #dce7f5;border-radius:10px;background:linear-gradient(145deg,#f4f8ff,#fff 72%);box-shadow:0 5px 16px rgba(51,91,145,.06)}.dwt-mitm-hero-top{display:flex;align-items:center;justify-content:space-between;gap:6px}.dwt-mitm-hero-kicker{color:#7b8ba2;font-size:9px;font-weight:700;letter-spacing:.08em}.dwt-mitm-hero-pill{padding:3px 6px;border-radius:999px;background:#edf4ff;color:#3578e5;font-size:9px;font-weight:650}.dwt-mitm-hero-title{margin-top:8px;font-size:14px;font-weight:700;letter-spacing:-.01em}.dwt-mitm-hero-subtitle{margin-top:4px;color:#8591a1;font-size:10px;line-height:1.45}.dwt-mitm-status-card{gap:7px;padding:10px}.dwt-mitm-status-card .dwt-mitm-status-icon{display:none}.dwt-mitm-status-main{gap:0}.dwt-mitm-status-badge{order:-1;align-self:auto}.dwt-mitm-actions{gap:6px}.dwt-mitm-actions .dwt-btn{min-height:28px}.dwt-mitm-note{margin:0;padding:8px 9px}.dwt-mitm-listen-card{padding:10px;background:rgba(255,255,255,.8)}.dwt-mitm-config .dwt-config-section{margin:0;border:1px solid #e1e7ef;border-radius:9px;padding:0 10px;background:rgba(255,255,255,.78);box-shadow:0 2px 8px rgba(30,55,90,.025)}.dwt-mitm-config .dwt-config-section summary{padding:10px 0}.dwt-mitm-config .dwt-config-section:first-of-type{border-top:1px solid #e1e7ef;padding-top:0}.dwt-mitm-config .dwt-config-content{padding:0 0 11px}.dwt-mitm-config .dwt-textarea,.dwt-mitm-config .dwt-input,.dwt-mitm-config .dwt-select{background:#fbfcfe;border-color:#dce4ee}.dwt-mitm-config .dwt-textarea:focus,.dwt-mitm-config .dwt-input:focus,.dwt-mitm-config .dwt-select:focus{background:#fff;box-shadow:0 0 0 3px rgba(53,120,229,.1)}.dwt-mitm-section-meta{margin-left:5px;color:#8b98aa;font-size:9px;font-weight:400}.dwt-mitm-rule-actions{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.dwt-mitm-rule-actions .dwt-btn{padding:4px 7px;font-size:10px}.dwt-mitm-rule-status{color:#8b98aa;font-size:9px;line-height:1.4}.dwt-mitm-rule-status.invalid{color:#c54b4b}.dwt-mitm-config-error{margin:0}.dwt-mitm-config .dwt-checkbox-row{font-size:10px}.dwt-mitm-config .dwt-config-note{font-size:10px}
.dwt-confirm-backdrop{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.24);backdrop-filter:blur(2px)}.dwt-confirm-dialog{width:min(360px,calc(100vw - 32px));padding:18px;border:1px solid #dbe3ee;border-radius:12px;background:#fff;box-shadow:0 18px 52px rgba(15,23,42,.2)}.dwt-confirm-kicker{color:#7b8ba2;font-size:9px;font-weight:700;letter-spacing:.08em}.dwt-confirm-title{display:block;margin-top:7px;font-size:14px;line-height:1.35}.dwt-confirm-message{margin:7px 0 0;color:#667085;font-size:11px;line-height:1.55}.dwt-confirm-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:16px}.dwt-confirm-actions .dwt-btn.danger{border-color:#e6b8b8;background:#fff7f7;color:#b44444}.dwt-confirm-actions .dwt-btn.danger:hover{background:#ffeded}
@media (min-width:720px){.dwt-split{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.dwt-body{overflow:hidden}.dwt-fuzzer-body{overflow:hidden}.dwt-editor,.dwt-result-pane{min-height:0;overflow:auto}}
`

      function installStyle() {
        if (document.querySelector('style[data-plugin="dsh-web-testing"]')) return
        const style = document.createElement('style')
        style.dataset.plugin = 'dsh-web-testing'
        style.textContent = CSS
        document.head.appendChild(style)
      }

      async function api(path, options) {
        const response = await fetch('/api/dsh-web-testing/' + path.replace(/^\//, ''), {
          ...options,
          headers: { 'content-type': 'application/json', ...(options && options.headers) },
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || result.ok === false) throw new Error(result.error || `请求失败 (${response.status})`)
        return result
      }

      const testReferenceState = {
        history: [],
        historyListeners: new Set(),
      }

      function referenceXmlEscape(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character])
      }

      function referenceCdata(value) {
        return `<![CDATA[${String(value ?? '').replaceAll(']]>', ']]]]><![CDATA[>')}]]>`
      }

      function fuzzerReferenceLabel(entry) {
        const preview = historyPreview(entry?.raw).replace(/\s+/g, ' ').slice(0, 58)
        return `Fuzzer ${entry?.instanceLabel || '-'} · ${preview || '请求'}`
      }

      function fuzzerReferenceMarkup(entry) {
        return `<dsh-web-fuzzer-ref id="${referenceXmlEscape(entry?.id)}" instance="${referenceXmlEscape(entry?.instanceLabel || '')}">\n请求：\n${referenceCdata(entry?.raw || '')}\n\nPayloads：\n${referenceCdata(entry?.payloads || '{}')}\n\n结果：\n${referenceCdata(JSON.stringify({ status: entry?.status, result: entry?.result, error: entry?.error }, null, 2))}\n</dsh-web-fuzzer-ref>`
      }

      function createFuzzerHistoryInputSource() {
        const references = new Map()
        const rebuild = () => {
          references.clear()
          for (const entry of testReferenceState.history || []) references.set(fuzzerReferenceLabel(entry), entry)
        }
        const resolve = ref => (testReferenceState.history || []).find(entry => String(entry.id) === String(ref))
        return {
          trigger: '@',
          name: 'Web Fuzzer',
          order: 10,
          async candidates(_session, { query, signal }) {
            rebuild()
            if (signal.aborted) return []
            const needle = String(query || '').trim().toLocaleLowerCase()
            return [...references.entries()]
              .filter(([label, entry]) => !needle || `${label} ${entry.raw || ''} ${entry.payloads || ''} ${JSON.stringify(entry.result || {})}`.toLocaleLowerCase().includes(needle))
              .map(([label, entry]) => ({
                name: label,
                description: `${entry.status === 'failed' ? '失败' : entry.status === 'running' ? '执行中' : '已完成'} · ${historyTime(entry.createdAt)}`,
                icon: '↗',
                hint: '引用请求模板、Payload 和执行结果',
              }))
          },
          warm() { rebuild() },
          lexicon() { rebuild(); return [...references.keys()] },
          subscribeLexicon(_session, listener) {
            testReferenceState.historyListeners.add(listener)
            return () => testReferenceState.historyListeners.delete(listener)
          },
          matchSpace(_session, token) {
            const entry = resolve(String(token).replace(/^@fuzzer:/, ''))
            if (!entry) return undefined
            return { insert: { source: 'Web Fuzzer', ref: String(entry.id), label: fuzzerReferenceLabel(entry), clipboardText: `@fuzzer:${entry.id}` } }
          },
          onPick({ candidate }) {
            const entry = references.get(candidate.name)
            if (!entry) return undefined
            return { insert: { source: 'Web Fuzzer', ref: String(entry.id), label: fuzzerReferenceLabel(entry), clipboardText: `@fuzzer:${entry.id}` } }
          },
          codec: {
            clipboardText: ref => `@fuzzer:${ref}`,
            async serialize(ref) {
              const entry = resolve(ref)
              if (!entry) throw new Error('Web Fuzzer 历史记录不存在或已清空')
              return fuzzerReferenceMarkup(entry)
            },
          },
        }
      }

      function mitmReferenceLabel(flow) {
        const url = String(flow?.url || flow?.id || '').replace(/^https?:\/\//, '').slice(0, 68)
        return `MITM · ${flow?.method || 'HTTP'} ${url}`
      }

      function mitmReferenceMarkup(flow) {
        const request = flow?.request?.packet || ''
        const response = flow?.response?.packet || ''
        return `<dsh-mitm-ref id="${referenceXmlEscape(flow?.id)}" url="${referenceXmlEscape(flow?.url)}">\n请求：\n${referenceCdata(request)}\n\n响应：\n${referenceCdata(response)}\n</dsh-mitm-ref>`
      }

      function createMitmInputSource() {
        const references = new Map()
        let catalog = []
        let catalogExpiresAt = 0
        let catalogPromise = null
        const refresh = async () => {
          if (Date.now() < catalogExpiresAt) return catalog
          if (catalogPromise) return catalogPromise
          catalogPromise = api('flows?limit=200').then(result => {
            catalog = Array.isArray(result.flows) ? result.flows : []
            catalogExpiresAt = Date.now() + 1200
            return catalog
          }).catch(() => []).finally(() => { catalogPromise = null })
          return catalogPromise
        }
        const resolve = ref => catalog.find(flow => String(flow.id) === String(ref))
        return {
          trigger: '@',
          name: 'MITM',
          order: 20,
          async candidates(_session, { query, signal }) {
            const flows = await refresh()
            if (signal.aborted) return []
            references.clear()
            const needle = String(query || '').trim().toLocaleLowerCase()
            return flows
              .filter(flow => !needle || `${mitmReferenceLabel(flow)} ${flow.method || ''} ${flow.url || ''} ${flow.status || ''} ${flow.request?.packet || ''} ${flow.response?.packet || ''}`.toLocaleLowerCase().includes(needle))
              .map(flow => {
                const label = mitmReferenceLabel(flow)
                references.set(label, flow)
                return { name: label, description: `${flow.status || '-'} · ${flow.durationMs == null ? '-' : `${flow.durationMs}ms`}`, icon: '⌁', hint: flow.metadata?.haeCount ? `引用请求/响应 · HaE ${flow.metadata.haeCount} 项` : '引用请求和响应包' }
              })
          },
          warm() { void refresh() },
          lexicon() { return [...references.keys()] },
          matchSpace(_session, token) {
            const flow = resolve(String(token).replace(/^@mitm:/, ''))
            if (!flow) return undefined
            return { insert: { source: 'MITM', ref: String(flow.id), label: mitmReferenceLabel(flow), clipboardText: `@mitm:${flow.id}` } }
          },
          onPick({ candidate }) {
            const flow = references.get(candidate.name)
            if (!flow) return undefined
            return { insert: { source: 'MITM', ref: String(flow.id), label: mitmReferenceLabel(flow), clipboardText: `@mitm:${flow.id}` } }
          },
          codec: {
            clipboardText: ref => `@mitm:${ref}`,
            async serialize(ref, signal) {
              const response = await api(`flow/${encodeURIComponent(ref)}`, { signal })
              const flow = response.flow
              if (!flow) throw new Error('MITM 流量记录不存在或已清空')
              return mitmReferenceMarkup(flow)
            },
          },
        }
      }

      const DEFAULT_RAW = 'POST /login HTTP/1.1\nHost: example.com\nContent-Type: application/json\n\n{"name":"{{user}}"}'
      const DEFAULT_HAE_RULES = [
        { id: 'jwt', name: 'JWT', regex: '\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b', flags: 'g', color: '#ffe08a' },
        { id: 'email', name: 'Email', regex: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b', flags: 'gi', color: '#bde7ff' },
        { id: 'aws-access-key', name: 'AWS Access Key', regex: '\\bAKIA[0-9A-Z]{16}\\b', flags: 'g', color: '#ffc9c9' },
        { id: 'bearer-token', name: 'Bearer Token', regex: '\\bBearer\\s+[A-Za-z0-9._~+/=-]+', flags: 'gi', color: '#d8c8ff' },
      ]

      function Icon(props) {
        if (props.kind === 'test') return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }, h('path', { d: 'M9 3h6M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3' }), h('path', { d: 'M8 14h8M9 17h6' }))
        return h('span', { 'aria-hidden': 'true' }, '·')
      }

      function Field(props) {
        return h('label', { className: 'dwt-label', style: { display: 'block' } }, props.label, props.children)
      }

      function estimatePayloadCases(value, maxCases) {
        try {
          const parsed = JSON.parse(value || '{}')
          const lengths = Object.values(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}).map(item => Array.isArray(item) ? item.length : 1)
          return Math.min(Number(maxCases) || 500, lengths.reduce((total, length) => total * Math.max(1, length), 1))
        } catch {
          return null
        }
      }

      function formatRawHttp(value) {
        const text = String(value || '').replace(/\r\n/g, '\n').trim()
        const separator = text.indexOf('\n\n')
        if (separator < 0) return text
        const head = text.slice(0, separator).split('\n').map(line => line.trimEnd()).join('\n')
        const body = text.slice(separator + 2).trim()
        if (!body) return `${head}\n\n`
        try { return `${head}\n\n${JSON.stringify(JSON.parse(body), null, 2)}` } catch { return `${head}\n\n${body}` }
      }

      function FuzzerResultTable({ result, selectedIndex, onSelect, filter = 'all' }) {
        if (!result) return h('div', { className: 'dwt-fuzzer-empty' }, '执行 Fuzz 后，结果会显示在这里。')
        const allResults = result.results || []
        const successfulCount = allResults.filter(isFuzzerSuccess).length
        const failedCount = allResults.length - successfulCount
        const visibleResults = allResults.filter(item => filter === 'success' ? isFuzzerSuccess(item) : filter === 'failed' ? !isFuzzerSuccess(item) : true)
        return h(React.Fragment, null,
          h('div', { className: 'dwt-fuzzer-response-summary' },
            h('strong', { className: failedCount ? 'dwt-fail' : 'dwt-pass' }, `${successfulCount}/${result.total} 成功`),
            h('span', { className: 'dwt-sub' }, visibleResults.length === result.total ? (failedCount ? `${failedCount} 个失败` : '全部通过') : `筛选显示 ${visibleResults.length} 条`),
            result.truncated ? h('span', { className: 'dwt-sub' }, '· 已达到用例上限') : null,
          ),
          h('div', { className: 'dwt-fuzzer-results' }, h('div', { className: 'dwt-fuzzer-result-table' },
            h('div', { className: 'dwt-fuzzer-result-header', role: 'row' },
              h('span', null, '#'), h('span', null, '请求'), h('span', null, '方法'), h('span', null, '状态'), h('span', null, '响应大小'), h('span', null, '延迟'), h('span', null, 'Payloads'), h('span', null, '操作'),
            ),
            visibleResults.map(item => h('button', {
              key: item.index,
              className: 'dwt-fuzzer-result-row' + (selectedIndex === item.index ? ' active' : ''),
              onClick: () => onSelect(item),
              title: item.reasons?.join('; ') || '点击查看完整响应包',
            },
            h('span', { className: 'dwt-fuzzer-result-cell' }, `#${item.index + 1}`),
            h('span', { className: 'dwt-fuzzer-result-cell dwt-fuzzer-result-url' }, item.url || item.reasons?.[0] || '-'),
            h('span', { className: 'dwt-fuzzer-result-cell' }, item.method || '-'),
            h('span', { className: 'dwt-fuzzer-result-cell ' + (isFuzzerSuccess(item) ? 'dwt-pass' : 'dwt-fail') }, item.status || '失败'),
            h('span', { className: 'dwt-fuzzer-result-cell' }, item.size == null ? '-' : String(item.size)),
            h('span', { className: 'dwt-fuzzer-result-cell' }, item.durationMs == null ? '-' : `${item.durationMs}ms`),
            h('span', { className: 'dwt-fuzzer-result-cell dwt-fuzzer-result-payloads' }, item.payloads && Object.keys(item.payloads).length ? JSON.stringify(item.payloads) : '-'),
            h('span', { className: 'dwt-fuzzer-result-cell dwt-fuzzer-result-open' }, '查看'),
            )),
          )),
        )
      }

      function isFuzzerSuccess(item) {
        const status = Number(item?.status)
        return !!item?.matched && Number.isFinite(status) && status >= 200 && status < 400
      }

      function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      }

      function HighlightedText({ value, query }) {
        const text = String(value || '')
        const needle = String(query || '').trim()
        if (!needle) return text
        const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, 'ig'))
        const normalizedNeedle = needle.toLocaleLowerCase()
        return parts.map((part, index) => part.toLocaleLowerCase() === normalizedNeedle ? h('mark', { className: 'dwt-response-highlight', key: `${part}-${index}` }, part) : part)
      }

      function countMatches(value, query) {
        const text = String(value || '').toLocaleLowerCase()
        const needle = String(query || '').trim().toLocaleLowerCase()
        if (!needle) return 0
        let count = 0
        let cursor = 0
        while ((cursor = text.indexOf(needle, cursor)) >= 0) { count += 1; cursor += needle.length }
        return count
      }

      function hasPayloadDictionary(value) {
        try {
          const parsed = JSON.parse(value || '{}')
          return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.values(parsed).some(item => Array.isArray(item) ? item.length > 0 : item != null && String(item) !== '')
        } catch { return false }
      }

      function useFuzzerState(historyStore, historyMeta) {
        const [raw, setRaw] = React.useState(DEFAULT_RAW)
        const [payloads, setPayloads] = React.useState('{\n  "user": ["admin", "guest"]\n}')
        const [maxCases, setMaxCases] = React.useState('100')
        const [concurrency, setConcurrency] = React.useState('4')
        const [timeoutMs, setTimeoutMs] = React.useState('30000')
        const [proxyUrl, setProxyUrl] = React.useState('')
        const [ca, setCa] = React.useState('')
        const [cert, setCert] = React.useState('')
        const [key, setKey] = React.useState('')
        const [rejectUnauthorized, setRejectUnauthorized] = React.useState(true)
        const [forceHttps, setForceHttps] = React.useState(false)
        const [interceptHttps, setInterceptHttps] = React.useState(false)
        const [result, setResult] = React.useState(null)
        const [selectedIndex, setSelectedIndex] = React.useState(null)
        const [selectedFlow, setSelectedFlow] = React.useState(null)
        const [error, setError] = React.useState('')
        const [busy, setBusy] = React.useState(false)
        const [loadingFlow, setLoadingFlow] = React.useState(false)
        const [localHistory, setLocalHistory] = React.useState([])
        const [historyQuery, setHistoryQuery] = React.useState('')
        const [historyOpen, setHistoryOpen] = React.useState(false)
        const flowRequestId = React.useRef(0)
        const history = historyStore?.history || localHistory
        const setHistory = historyStore?.setHistory || setLocalHistory
        const historyInstanceId = historyMeta?.id || ''
        const historyInstanceLabel = historyMeta?.label || ''

        const loadResult = React.useCallback(async item => {
          const requestId = ++flowRequestId.current
          setSelectedIndex(item?.index ?? null)
          setSelectedFlow(null)
          if (!item?.flowId) return
          setLoadingFlow(true)
          try {
            const response = await api(`flow/${encodeURIComponent(item.flowId)}`)
            if (requestId === flowRequestId.current) setSelectedFlow(response.flow)
          } catch (cause) { if (requestId === flowRequestId.current) setError(cause?.message || String(cause)) } finally { if (requestId === flowRequestId.current) setLoadingFlow(false) }
        }, [])

        const execute = React.useCallback(async spec => {
          const rawValue = String(spec?.raw || DEFAULT_RAW)
          const payloadsValue = typeof spec?.payloads === 'string' ? spec.payloads : JSON.stringify(spec?.payloads || {}, null, 2)
          const maxCasesValue = String(spec?.maxCases ?? '100')
          const concurrencyValue = String(spec?.concurrency ?? '4')
          const timeoutValue = String(spec?.timeoutMs ?? '30000')
          const networkValue = {
            proxyUrl: String(spec?.proxyUrl ?? proxyUrl ?? ''),
            ca: String(spec?.ca ?? ca ?? ''),
            cert: String(spec?.cert ?? cert ?? ''),
            key: String(spec?.key ?? key ?? ''),
            rejectUnauthorized: spec?.rejectUnauthorized ?? rejectUnauthorized,
            forceHttps: spec?.forceHttps ?? forceHttps,
            interceptHttps: spec?.interceptHttps ?? interceptHttps,
          }
          const historyId = `history_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
          const createdAt = Date.now()
          setHistory(current => [{ id: historyId, createdAt, instanceId: historyInstanceId, instanceLabel: historyInstanceLabel, raw: rawValue, payloads: payloadsValue, maxCases: maxCasesValue, concurrency: concurrencyValue, timeoutMs: timeoutValue, network: networkValue, replayOf: spec?.replayOf, status: 'running', result: { total: 0, matched: 0, failed: 0 }, flowIds: [] }, ...current].slice(0, 200))
          setBusy(true); setError(''); setResult(null); setSelectedIndex(null); setSelectedFlow(null)
          try {
            const parsedPayloads = JSON.parse(payloadsValue || '{}')
            const response = await api('fuzz', { method: 'POST', body: JSON.stringify({ request: { raw: rawValue }, payloads: parsedPayloads, maxCases: Number(maxCasesValue), concurrency: Number(concurrencyValue), timeoutMs: Number(timeoutValue), network: networkValue }) })
            setResult(response.result)
            const first = (response.result.results || []).find(item => item.flowId)
            if (first) void loadResult(first)
            setHistory(current => current.map(entry => entry.id === historyId ? { ...entry, status: 'completed', result: { total: response.result.total, matched: response.result.matched, failed: response.result.failed, truncated: response.result.truncated }, flowIds: (response.result.results || []).map(item => item.flowId).filter(Boolean) } : entry))
          } catch (cause) {
            const message = cause?.message || String(cause)
            setError(message)
            setHistory(current => current.map(entry => entry.id === historyId ? { ...entry, status: 'failed', error: message, result: { total: 0, matched: 0, failed: 1 } } : entry))
          } finally { setBusy(false) }
        }, [loadResult, historyInstanceId, historyInstanceLabel, setHistory])

        const run = React.useCallback(() => execute({ raw, payloads, maxCases, concurrency, timeoutMs, proxyUrl, ca, cert, key, rejectUnauthorized, forceHttps, interceptHttps }), [raw, payloads, maxCases, concurrency, timeoutMs, proxyUrl, ca, cert, key, rejectUnauthorized, forceHttps, interceptHttps, execute])

        const reset = React.useCallback(() => {
          setRaw(DEFAULT_RAW); setPayloads('{\n  "user": ["admin", "guest"]\n}'); setMaxCases('100'); setConcurrency('4'); setTimeoutMs('30000'); setProxyUrl(''); setCa(''); setCert(''); setKey(''); setRejectUnauthorized(true); setForceHttps(false); setInterceptHttps(false); setResult(null); setSelectedIndex(null); setSelectedFlow(null); setError('')
        }, [])
        const clearResult = React.useCallback(() => { setResult(null); setSelectedIndex(null); setSelectedFlow(null); setError('') }, [])
        const extractHistory = React.useCallback(entry => {
          setRaw(entry?.raw || DEFAULT_RAW)
          setPayloads(entry?.payloads || '{}')
          setMaxCases(String(entry?.maxCases ?? '100'))
          setConcurrency(String(entry?.concurrency ?? '4'))
          setTimeoutMs(String(entry?.timeoutMs ?? '30000'))
          setProxyUrl(entry?.network?.proxyUrl || '')
          setCa(entry?.network?.ca || '')
          setCert(entry?.network?.cert || '')
          setKey(entry?.network?.key || '')
          setRejectUnauthorized(entry?.network?.rejectUnauthorized !== false)
          setForceHttps(entry?.network?.forceHttps === true)
          setInterceptHttps(entry?.network?.interceptHttps === true)
          setResult(null); setSelectedIndex(null); setSelectedFlow(null); setError(''); setHistoryOpen(false); setHistoryQuery('')
        }, [])
        const replayHistory = React.useCallback(entry => {
          setRaw(entry?.raw || DEFAULT_RAW)
          setPayloads(entry?.payloads || '{}')
          setMaxCases(String(entry?.maxCases ?? '100'))
          setConcurrency(String(entry?.concurrency ?? '4'))
          setTimeoutMs(String(entry?.timeoutMs ?? '30000'))
          setProxyUrl(entry?.network?.proxyUrl || '')
          setCa(entry?.network?.ca || '')
          setCert(entry?.network?.cert || '')
          setKey(entry?.network?.key || '')
          setRejectUnauthorized(entry?.network?.rejectUnauthorized !== false)
          setForceHttps(entry?.network?.forceHttps === true)
          setInterceptHttps(entry?.network?.interceptHttps === true)
          setHistoryOpen(false); setHistoryQuery('')
          void execute({ ...entry, ...entry.network, replayOf: entry?.id })
        }, [execute])
        const restore = React.useCallback(snapshot => {
          setRaw(snapshot?.raw || DEFAULT_RAW)
          setPayloads(snapshot?.payloads || '{\n  "user": ["admin", "guest"]\n}')
          setMaxCases(String(snapshot?.maxCases ?? '100'))
          setConcurrency(String(snapshot?.concurrency ?? '4'))
          setTimeoutMs(String(snapshot?.timeoutMs ?? '30000'))
          setProxyUrl(snapshot?.proxyUrl || '')
          setCa(snapshot?.ca || '')
          setCert(snapshot?.cert || '')
          setKey(snapshot?.key || '')
          setRejectUnauthorized(snapshot?.rejectUnauthorized !== false)
          setForceHttps(snapshot?.forceHttps === true)
          setInterceptHttps(snapshot?.interceptHttps === true)
          setResult(snapshot?.result || null); setSelectedIndex(snapshot?.selectedIndex ?? null); setSelectedFlow(snapshot?.selectedFlow || null); setError('')
        }, [])
        const snapshot = React.useCallback(() => ({ raw, payloads, maxCases, concurrency, timeoutMs, proxyUrl, ca, cert, key, rejectUnauthorized, forceHttps, interceptHttps, result, selectedIndex, selectedFlow }), [raw, payloads, maxCases, concurrency, timeoutMs, proxyUrl, ca, cert, key, rejectUnauthorized, forceHttps, interceptHttps, result, selectedIndex, selectedFlow])
        const clearHistory = React.useCallback(() => setHistory([]), [])
        const toggleHistory = React.useCallback(() => setHistoryOpen(open => !open), [])
        return { raw, setRaw, payloads, setPayloads, maxCases, setMaxCases, concurrency, setConcurrency, timeoutMs, setTimeoutMs, proxyUrl, setProxyUrl, ca, setCa, cert, setCert, key, setKey, rejectUnauthorized, setRejectUnauthorized, forceHttps, setForceHttps, interceptHttps, setInterceptHttps, result, selectedIndex, selectedFlow, error, busy, loadingFlow, loadResult, run, reset, clearResult, history, historyQuery, setHistoryQuery, historyOpen, toggleHistory, clearHistory, extractHistory, replayHistory, restore, snapshot }
      }

      function FuzzerConfigSidebar({ state }) {
        const { payloads, setPayloads, maxCases, setMaxCases, concurrency, setConcurrency, timeoutMs, setTimeoutMs, proxyUrl, setProxyUrl, ca, setCa, cert, setCert, key, setKey, rejectUnauthorized, setRejectUnauthorized, forceHttps, setForceHttps, interceptHttps, setInterceptHttps } = state
        const caseCount = estimatePayloadCases(payloads, maxCases)
        return h('div', { className: 'dwt-sidebar-fuzzer-config', 'aria-label': 'Fuzzer 配置' },
          h('div', { className: 'dwt-fuzzer-sidebar-hero' },
            h('div', { className: 'dwt-fuzzer-sidebar-hero-top' }, h('span', { className: 'dwt-fuzzer-sidebar-kicker' }, 'TEST WORKBENCH'), h('span', { className: 'dwt-fuzzer-case-pill' }, caseCount == null ? 'JSON 无效' : `${caseCount} 个用例`)),
            h('div', { className: 'dwt-fuzzer-sidebar-hero-title' }, '请求编排'),
            h('div', { className: 'dwt-fuzzer-sidebar-hero-subtitle' }, '配置 Payload、网络链路和并发策略，快速构建可重复的请求矩阵。'),
          ),
          h('details', { className: 'dwt-config-section', open: true },
            h('summary', null, '请求包配置'),
            h('div', { className: 'dwt-config-content' },
              h('div', { className: 'dwt-config-note' }, '请求中使用 {{name}}，这里配置替换值。'),
              h(Field, { label: 'Payload JSON' }, h('textarea', { className: 'dwt-textarea dwt-json', value: payloads, onChange: event => setPayloads(event.target.value) })),
            ),
          ),
          h('details', { className: 'dwt-config-section' },
            h('summary', null, '网络配置'),
            h('div', { className: 'dwt-config-content' },
              h('div', { className: 'dwt-config-note' }, '支持 HTTP/HTTPS/SOCKS5 代理；证书内容使用 PEM 格式。配置会应用于本次 Fuzz 的全部请求。'),
              h(Field, { label: '代理地址' }, h('input', { className: 'dwt-input', value: proxyUrl, onChange: event => setProxyUrl(event.target.value), placeholder: 'http://127.0.0.1:8080 或 socks5://127.0.0.1:1080' })),
              h(Field, { label: 'CA 证书（PEM）' }, h('textarea', { className: 'dwt-textarea dwt-network-pem', value: ca, onChange: event => setCa(event.target.value), placeholder: '-----BEGIN CERTIFICATE-----' })),
              h(Field, { label: '客户端证书（PEM）' }, h('textarea', { className: 'dwt-textarea dwt-network-pem', value: cert, onChange: event => setCert(event.target.value), placeholder: '可选，用于双向 TLS（mTLS）' })),
              h(Field, { label: '客户端私钥（PEM）' }, h('textarea', { className: 'dwt-textarea dwt-network-pem', value: key, onChange: event => setKey(event.target.value), placeholder: '可选，与客户端证书同时配置' })),
              h('label', { className: 'dwt-checkbox-row' }, h('input', { type: 'checkbox', checked: !rejectUnauthorized, onChange: event => setRejectUnauthorized(!event.target.checked) }), '跳过 TLS 证书校验'),
              h('label', { className: 'dwt-checkbox-row' }, h('input', { type: 'checkbox', checked: forceHttps, onChange: event => setForceHttps(event.target.checked) }), '强制使用 HTTPS'),
              h('label', { className: 'dwt-checkbox-row' }, h('input', { type: 'checkbox', checked: interceptHttps, onChange: event => setInterceptHttps(event.target.checked) }), '启用 HTTPS 劫持 / MITM'),
              h('div', { className: 'dwt-config-note' }, 'HTTPS 劫持需要配置支持 CONNECT 和 HTTPS MITM 的 HTTP/HTTPS 代理，并信任该代理签发的 CA；内置 MITM 当前仅做 CONNECT 透传。'),
            ),
          ),
          h('details', { className: 'dwt-config-section', open: true },
            h('summary', null, '并发配置'),
            h('div', { className: 'dwt-config-content' },
              h('div', { className: 'dwt-config-grid' },
                h('label', { className: 'dwt-label' }, '最大用例', h('input', { className: 'dwt-input', type: 'number', min: 1, max: 500, value: maxCases, onChange: event => setMaxCases(event.target.value) })),
                h('label', { className: 'dwt-label' }, '并发', h('input', { className: 'dwt-input', type: 'number', min: 1, max: 16, value: concurrency, onChange: event => setConcurrency(event.target.value) })),
              ),
              h('label', { className: 'dwt-label' }, '超时（毫秒）', h('input', { className: 'dwt-input', type: 'number', min: 100, max: 120000, value: timeoutMs, onChange: event => setTimeoutMs(event.target.value) })),
            ),
          ),
        )
      }

      function historyPreview(raw) {
        return String(raw || '').split('\n').map(line => line.trim()).filter(Boolean).slice(0, 2).join(' · ')
      }

      function historyTime(value) {
        try { return new Date(value).toLocaleString() } catch { return '-' }
      }

      function ConfirmDialog({ request, onClose }) {
        React.useEffect(() => {
          if (!request) return undefined
          const handleKeyDown = event => { if (event.key === 'Escape') onClose(false) }
          document.addEventListener('keydown', handleKeyDown)
          return () => document.removeEventListener('keydown', handleKeyDown)
        }, [request, onClose])
        if (!request) return null
        return h('div', { className: 'dwt-confirm-backdrop', role: 'presentation', onClick: event => { if (event.target === event.currentTarget) onClose(false) } },
          h('div', { className: 'dwt-confirm-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dwt-confirm-title' },
            h('div', { className: 'dwt-confirm-kicker' }, '确认操作'),
            h('strong', { className: 'dwt-confirm-title', id: 'dwt-confirm-title' }, request.title || '确认继续？'),
            h('p', { className: 'dwt-confirm-message' }, request.message || '该操作可能会清除当前数据，是否继续？'),
            h('div', { className: 'dwt-confirm-actions' },
              h('button', { type: 'button', className: 'dwt-btn', onClick: () => onClose(false) }, '取消'),
              h('button', { type: 'button', className: 'dwt-btn danger', onClick: () => onClose(true) }, request.confirmLabel || '确认'),
            ),
          ),
        )
      }

      function FuzzerHistoryPanel({ state, onConfirm }) {
        const { history, historyQuery, setHistoryQuery, clearHistory, extractHistory, replayHistory } = state
        const needle = historyQuery.trim().toLowerCase()
        const entries = history.filter(entry => !needle || [entry.instanceLabel, entry.raw, entry.payloads, entry.assertions, JSON.stringify(entry.result), JSON.stringify(entry.flowIds)].join('\n').toLowerCase().includes(needle))
        return h('section', { className: 'dwt-fuzzer-history', 'aria-label': '请求历史' },
          h('div', { className: 'dwt-fuzzer-history-head' },
            h('span', { className: 'dwt-fuzzer-history-title' }, 'History'),
            h('span', { className: 'dwt-fuzzer-history-count' }, `${entries.length}/${history.length}`),
            h('input', { className: 'dwt-input dwt-fuzzer-history-search', type: 'search', placeholder: '搜索请求、URL、Body…', value: historyQuery, onChange: event => setHistoryQuery(event.target.value) }),
            h('button', { className: 'dwt-btn', disabled: !history.length, onClick: () => onConfirm({ title: '清空全部请求历史？', message: '这会删除所有 Web Fuzzer 实例共享的历史记录，且无法恢复。', confirmLabel: '确认清空' }, clearHistory) }, '清空'),
          ),
          h('div', { className: 'dwt-fuzzer-history-list' }, entries.length ? entries.map(entry => h('div', { className: 'dwt-history-row', key: entry.id },
            h('div', { className: 'dwt-history-row-main' }, h('strong', null, historyPreview(entry.raw).split(' · ')[0] || '请求'), h('span', { className: 'dwt-history-instance' }, entry.instanceLabel ? `Fuzzer ${entry.instanceLabel}` : 'Fuzzer'), h('span', { className: 'dwt-sub' }, historyTime(entry.createdAt))),
            h('div', { className: 'dwt-history-preview', title: historyPreview(entry.raw) }, historyPreview(entry.raw)),
            h('span', { className: 'dwt-history-result ' + (entry.status === 'failed' ? 'dwt-fail' : 'dwt-pass') }, entry.status === 'running' ? '执行中' : entry.status === 'failed' ? '失败' : `${entry.result?.matched ?? 0}/${entry.result?.total ?? 0}`),
            h('div', { className: 'dwt-history-actions' }, h('button', { className: 'dwt-btn', onClick: () => extractHistory(entry) }, '提取'), h('button', { className: 'dwt-btn primary', onClick: () => replayHistory(entry) }, '重放')),
          )) : h('div', { className: 'dwt-history-empty' }, history.length ? '没有匹配的请求。' : '执行请求后，这里会记录请求历史。')),
        )
      }

      function responsePacket(flow) {
        const body = flow?.response?.full || flow?.response
        const headers = flow?.responseHeaders ? Object.entries(flow.responseHeaders).map(([key, value]) => `${key}: ${value}`).join('\n') : ''
        const statusLine = `HTTP/1.1 ${flow?.status || '-'}${flow?.durationMs == null ? '' : ` · ${flow.durationMs}ms`}`
        return `${statusLine}\n${headers}\n\n${body?.text || flow?.error || '(空响应)'}`
      }

      function FuzzerInstanceTabs({ tabs, activeId, onSelect, onCreate, onClose }) {
        return h('div', { className: 'dwt-fuzzer-instance-tabs', role: 'tablist', 'aria-label': 'Web Fuzzer 实例' },
          h('span', { className: 'dwt-fuzzer-instance-label' }, '实例'),
          tabs.map(tab => h('div', { className: 'dwt-fuzzer-instance-tab' + (tab.id === activeId ? ' active' : ''), key: tab.id },
            h('button', { role: 'tab', 'aria-selected': tab.id === activeId, onClick: () => onSelect(tab.id) }, tab.label),
            tabs.length > 1 ? h('button', { title: `关闭 ${tab.label}`, 'aria-label': `关闭 ${tab.label}`, onClick: () => onClose(tab.id) }, '×') : null,
          )),
          h('button', { className: 'dwt-fuzzer-instance-add', title: '新建 Web Fuzzer', 'aria-label': '新建 Web Fuzzer', onClick: onCreate }, '+'),
        )
      }

      function FuzzerPanel({ state, tabs, activeId, onSelectTab, onCreateTab, onCloseTab, onConfirm }) {
        const controller = state
        const { raw, setRaw, payloads, result, selectedIndex, selectedFlow, error, busy, loadingFlow, loadResult, run, reset, clearResult, history, historyOpen, toggleHistory } = controller
        const [responseQuery, setResponseQuery] = React.useState('')
        const [responseFilter, setResponseFilter] = React.useState('all')
        React.useEffect(() => { setResponseQuery(''); setResponseFilter('all') }, [activeId])
        const dictionaryEnabled = hasPayloadDictionary(payloads)
        const packet = selectedFlow ? responsePacket(selectedFlow) : ''
        const filter = dictionaryEnabled ? responseFilter : 'all'

        return h('section', { className: 'dwt-panel dwt-panel-central' },
          h('div', { className: 'dwt-fuzzer-page' },
            h(FuzzerInstanceTabs, { tabs, activeId, onSelect: onSelectTab, onCreate: onCreateTab, onClose: onCloseTab }),
            h('div', { className: 'dwt-fuzzer-toolbar' },
              h('div', { className: 'dwt-fuzzer-toolbar-context' },
                h('span', { className: 'dwt-fuzzer-toolbar-kicker' }, 'REQUEST LAB'),
                h('span', { className: 'dwt-fuzzer-toolbar-title' }, '请求工作区'),
                h('span', { className: 'dwt-fuzzer-toolbar-meta' }, 'Yakit 风格 raw HTTP'),
              ),
              h('span', { className: 'dwt-fuzzer-toolbar-spacer' }),
              h('span', { className: 'dwt-fuzzer-toolbar-status' + (busy ? ' busy' : '') }, h('span', { className: 'dwt-fuzzer-toolbar-status-dot' }), busy ? '执行中' : '就绪'),
              h('button', { className: 'dwt-btn', onClick: toggleHistory }, `历史${history.length ? ` (${history.length})` : ''}`),
              h('button', { className: 'dwt-btn', onClick: () => onConfirm({ title: '重置 Web Fuzzer？', message: '请求、Payload、网络配置、并发配置和当前结果都会恢复默认值。', confirmLabel: '确认重置' }, reset) }, '重置'),
            ),
            error ? h('div', { className: 'dwt-error', style: { margin: '8px 12px 0' } }, error) : null,
            historyOpen ? h(FuzzerHistoryPanel, { state: controller }) : null,
            h('div', { className: 'dwt-fuzzer-workbench dwt-fuzzer-workbench-central' },
              h('main', { className: 'dwt-fuzzer-request' },
                h('div', { className: 'dwt-fuzzer-pane-head' }, h('div', { className: 'dwt-fuzzer-pane-heading' }, h('span', { className: 'dwt-fuzzer-pane-mark' }, '↗'), h('div', { className: 'dwt-fuzzer-pane-heading-copy' }, h('span', { className: 'dwt-fuzzer-pane-title' }, 'Request'), h('span', { className: 'dwt-fuzzer-pane-caption' }, 'Raw HTTP 请求模板'))), h('div', { className: 'dwt-fuzzer-pane-actions' }, h('button', { className: 'dwt-btn primary dwt-fuzzer-run', disabled: busy, onClick: run }, busy ? '执行中…' : '发送 / 开始 Fuzz'), h('button', { className: 'dwt-btn', onClick: () => setRaw(formatRawHttp(raw)) }, '美化'), h('button', { className: 'dwt-btn', onClick: () => onConfirm({ title: '清空请求模板？', message: '当前 Raw HTTP 请求内容会被清除，且无法恢复。', confirmLabel: '确认清空' }, () => setRaw('')) }, '清空'))),
                h('div', { className: 'dwt-fuzzer-editor' }, h('label', { className: 'dwt-label' }, '请求模板', h('textarea', { className: 'dwt-textarea dwt-raw', value: raw, onChange: event => setRaw(event.target.value), spellCheck: false })), h('div', { className: 'dwt-fuzzer-hint' }, '支持 Yakit 风格 raw HTTP；请求头、URL 和 Body 均可使用 {{name}}。')),
              ),
              h('section', { className: 'dwt-fuzzer-response' },
                h('div', { className: 'dwt-fuzzer-pane-head' },
                  h('div', { className: 'dwt-fuzzer-pane-heading' }, h('span', { className: 'dwt-fuzzer-pane-mark response' }, '↙'), h('div', { className: 'dwt-fuzzer-pane-heading-copy' }, h('span', { className: 'dwt-fuzzer-pane-title' }, 'Response'), h('span', { className: 'dwt-fuzzer-pane-caption' }, result ? `${result.total} 个请求 · 点击结果查看详情` : '等待执行结果'))),
                  h('div', { className: 'dwt-fuzzer-pane-actions dwt-fuzzer-response-tools' },
                    h('input', { className: 'dwt-input dwt-fuzzer-response-search', type: 'search', placeholder: '搜索响应包…', 'aria-label': '搜索响应包', value: responseQuery, onChange: event => setResponseQuery(event.target.value) }),
                    dictionaryEnabled ? h('select', { className: 'dwt-select dwt-fuzzer-response-filter', 'aria-label': '响应筛选', value: responseFilter, onChange: event => setResponseFilter(event.target.value) }, h('option', { value: 'all' }, '全部'), h('option', { value: 'success' }, '成功'), h('option', { value: 'failed' }, '失败')) : null,
                    result ? h('button', { className: 'dwt-btn', onClick: () => onConfirm({ title: '清空 Fuzz 结果？', message: '当前响应结果和选中的响应包会被清除，历史记录不会受影响。', confirmLabel: '确认清空' }, clearResult) }, '清空结果') : null,
                  ),
                ),
                h(FuzzerResultTable, { result, selectedIndex, onSelect: loadResult, filter }),
                h('div', { className: 'dwt-fuzzer-response-body' }, selectedFlow ? h(React.Fragment, null, h('div', { className: 'dwt-row' }, h('div', { className: 'dwt-sub' }, selectedFlow.url || ''), responseQuery ? h('span', { className: 'dwt-sub' }, `${countMatches(packet, responseQuery)} 处匹配`) : null), h('pre', { className: 'dwt-pre dwt-response-packet' }, h(HighlightedText, { value: packet, query: responseQuery }))) : h('div', { className: 'dwt-fuzzer-empty' }, h('div', { className: 'dwt-fuzzer-empty-icon' }, loadingFlow ? '…' : '↯'), h('strong', null, loadingFlow ? '正在读取响应包' : result ? '选择一个用例' : '准备执行 Fuzz'), h('span', null, loadingFlow ? '正在从 Host 读取完整响应内容。' : result ? '从上方结果列表选择请求，查看具体响应包。' : '执行 Fuzz 后，响应内容和匹配结果会显示在这里。'))),
              ),
            ),
          ),
        )
      }

      function splitMitmList(value) {
        return String(value || '').split(/[\n,]/).map(item => item.trim()).filter(Boolean)
      }

      function parseJsonText(value, fallback) {
        try {
          const parsed = JSON.parse(value || fallback)
          return { value: parsed, error: '' }
        } catch (cause) {
          return { value: null, error: cause?.message || 'JSON 格式无效' }
        }
      }

      function formatJsonText(value, fallback) {
        const parsed = parseJsonText(value, fallback)
        return parsed.error ? value : JSON.stringify(parsed.value, null, 2)
      }

      function mitmPacket(flow, side) {
        const packet = side === 'request' ? flow?.request?.packet : flow?.response?.packet
        if (packet != null) return String(packet)
        const headers = side === 'request' ? flow?.requestHeaders : flow?.responseHeaders
        const body = side === 'request' ? flow?.request?.full?.text : flow?.response?.full?.text
        const first = side === 'request' ? `${flow?.method || ''} ${flow?.url || ''}`.trim() : `HTTP/1.1 ${flow?.status || '-'}`
        const headerText = Object.entries(headers || {}).map(([key, value]) => `${key}: ${value}`).join('\n')
        return `${first}${headerText ? `\n${headerText}` : ''}${body ? `\n\n${body}` : ''}`
      }

      function mitmRequestToRaw(flow) {
        const packet = mitmPacket(flow, 'request').replace(/\r\n/g, '\n').trim()
        if (!packet) return DEFAULT_RAW
        const lines = packet.split('\n')
        const firstIndex = lines.findIndex(line => line.trim())
        if (firstIndex < 0) return DEFAULT_RAW
        const match = lines[firstIndex].trim().match(/^(\S+)\s+(\S+)(?:\s+HTTP\/\d(?:\.\d+)?)?$/i)
        if (!match) return packet
        const method = match[1].toUpperCase()
        let target = match[2]
        let host = ''
        try {
          const parsed = new URL(target)
          host = parsed.host
          target = `${parsed.pathname || '/'}${parsed.search || ''}${parsed.hash || ''}`
        } catch {}
        const headerEnd = lines.findIndex((line, index) => index > firstIndex && !line.trim())
        const headerLines = lines.slice(firstIndex + 1, headerEnd < 0 ? lines.length : headerEnd)
        const hasHost = headerLines.some(line => /^host\s*:/i.test(line))
        if (host && !hasHost) headerLines.unshift(`Host: ${host}`)
        const bodyLines = headerEnd < 0 ? [] : lines.slice(headerEnd + 1)
        lines.splice(firstIndex, lines.length - firstIndex, `${method} ${target || '/'} HTTP/1.1`, ...headerLines, '', ...bodyLines)
        return lines.join('\n').trim()
      }

      function HighlightedPacket({ value, highlights }) {
        const text = String(value || '')
        const items = Array.isArray(highlights) ? highlights.filter(item => item && item.end > item.start).sort((left, right) => left.start - right.start || right.end - left.end) : []
        if (!items.length) return text
        const nodes = []
        let cursor = 0
        for (const item of items) {
          if (item.start < cursor) continue
          if (item.start > cursor) nodes.push(text.slice(cursor, item.start))
          nodes.push(h('mark', { key: `${item.ruleId}-${item.start}`, className: 'dwt-response-highlight', style: { background: item.color || '#ffe08a' }, title: item.name || item.ruleId }, text.slice(item.start, item.end)))
          cursor = item.end
        }
        if (cursor < text.length) nodes.push(text.slice(cursor))
        return nodes
      }

      function useMitmState() {
        const [status, setStatus] = React.useState(null)
        const [flows, setFlows] = React.useState([])
        const [selected, setSelected] = React.useState(null)
        const [error, setError] = React.useState('')
        const [busy, setBusy] = React.useState(false)
        const [config, setConfig] = React.useState({ listenHost: '127.0.0.1', listenPort: 0, enabled: true, mode: 'manual', interceptRoutes: [], interceptSuffixes: [], autoReleaseRules: [], holdResponse: true, haeEnabled: true, haeRules: DEFAULT_HAE_RULES })
        const [routesText, setRoutesText] = React.useState('')
        const [suffixesText, setSuffixesText] = React.useState('')
        const [autoRulesText, setAutoRulesText] = React.useState('[]')
        const [haeRulesText, setHaeRulesText] = React.useState(JSON.stringify(DEFAULT_HAE_RULES, null, 2))
        const [responseOverride, setResponseOverride] = React.useState('')
        const [responseStatus, setResponseStatus] = React.useState('200')
        const [responseHeadersText, setResponseHeadersText] = React.useState('{}')
        const loadedRef = React.useRef(false)
        const refreshInFlight = React.useRef(false)
        const flowActionInFlight = React.useRef(false)
        const [savingConfig, setSavingConfig] = React.useState(false)

        const applyRemoteConfig = React.useCallback(next => {
          const value = next || config
          setConfig(value)
          setRoutesText((value.interceptRoutes || []).join('\n'))
          setSuffixesText((value.interceptSuffixes || []).join('\n'))
          setAutoRulesText(JSON.stringify(value.autoReleaseRules || [], null, 2))
          setHaeRulesText(JSON.stringify(value.haeRules || [], null, 2))
        }, [config])
        const refresh = React.useCallback(async () => {
          if (refreshInFlight.current) return
          refreshInFlight.current = true
          try {
            const [nextStatus, nextFlows] = await Promise.all([api('status'), api('flows?limit=200')])
            setStatus(nextStatus); setFlows(nextFlows.flows || [])
            if (!loadedRef.current && nextStatus.mitm) { applyRemoteConfig(nextStatus.mitm); loadedRef.current = true }
          } catch (cause) { setError(cause?.message || String(cause)) } finally { refreshInFlight.current = false }
        }, [applyRemoteConfig])
        React.useEffect(() => { refresh(); const timer = window.setInterval(refresh, 1600); return () => window.clearInterval(timer) }, [refresh])

        const updateConfig = (key, value) => setConfig(current => ({ ...current, [key]: value }))
        const saveConfig = async () => {
          if (savingConfig) return
          setSavingConfig(true)
          try {
            const next = { ...config, interceptRoutes: splitMitmList(routesText), interceptSuffixes: splitMitmList(suffixesText), autoReleaseRules: JSON.parse(autoRulesText || '[]'), haeRules: JSON.parse(haeRulesText || '[]') }
            const response = await api('config', { method: 'POST', body: JSON.stringify(next) })
            applyRemoteConfig(response.mitm); setError('')
          } catch (cause) { setError(cause?.message || String(cause)) } finally { setSavingConfig(false) }
        }
        const toggleProxy = async () => {
          setBusy(true); setError('')
          try {
            await api(status?.proxy ? 'proxy/stop' : 'proxy/start', { method: 'POST', body: JSON.stringify({ host: config.listenHost, port: Number(config.listenPort) || 0 }) })
            await refresh()
          } catch (cause) { setError(cause?.message || String(cause)) } finally { setBusy(false) }
        }
        const clear = async () => { try { await api('clear', { method: 'POST', body: '{}' }); setSelected(null); await refresh() } catch (cause) { setError(cause?.message || String(cause)) } }
        const select = async flow => {
          try {
            const response = await api(`flow/${encodeURIComponent(flow.id)}`)
            setSelected(response.flow); setResponseOverride(response.flow?.response?.full?.text || ''); setResponseStatus(String(response.flow?.status || 200)); setResponseHeadersText(JSON.stringify(response.flow?.responseHeaders || {}, null, 2)); setError('')
          } catch (cause) { setError(cause?.message || String(cause)) }
        }
        const flowAction = async (action, payload = {}) => {
          if (!selected || flowActionInFlight.current) return
          flowActionInFlight.current = true
          try {
            const response = await api(`flow/${encodeURIComponent(selected.id)}/action`, { method: 'POST', body: JSON.stringify({ action, ...payload }) })
            setSelected(response.flow); await refresh(); setError('')
          } catch (cause) { setError(cause?.message || String(cause)) } finally { flowActionInFlight.current = false }
        }
        return { status, flows, selected, error, setError, busy, savingConfig, config, routesText, setRoutesText, suffixesText, setSuffixesText, autoRulesText, setAutoRulesText, haeRulesText, setHaeRulesText, responseOverride, setResponseOverride, responseStatus, setResponseStatus, responseHeadersText, setResponseHeadersText, updateConfig, saveConfig, toggleProxy, clear, refresh, select, flowAction }
      }

      function MitmConfigSidebar({ state }) {
        const { status, busy, savingConfig, config, error, routesText, setRoutesText, suffixesText, setSuffixesText, autoRulesText, setAutoRulesText, haeRulesText, setHaeRulesText, updateConfig, saveConfig, toggleProxy } = state
        const autoRules = parseJsonText(autoRulesText, '[]')
        const haeRules = parseJsonText(haeRulesText, '[]')
        const haeRuleCount = Array.isArray(haeRules.value) ? haeRules.value.length : 0
        const formatAutoRules = () => setAutoRulesText(formatJsonText(autoRulesText, '[]'))
        const formatHaeRules = () => setHaeRulesText(formatJsonText(haeRulesText, '[]'))
        const loadDefaultHaeRules = () => setHaeRulesText(JSON.stringify(DEFAULT_HAE_RULES, null, 2))
        const interceptSection = h('details', { className: 'dwt-config-section', open: true },
          h('summary', null, '拦截范围', h('span', { className: 'dwt-mitm-section-meta' }, config.mode === 'observe' ? '仅观察' : '手动劫持')),
          h('div', { className: 'dwt-config-content' },
            h('label', { className: 'dwt-label' }, '模式', h('select', { className: 'dwt-select', value: config.mode, onChange: event => updateConfig('mode', event.target.value) }, h('option', { value: 'manual' }, '手动劫持'), h('option', { value: 'observe' }, '自动放行 / 仅观察'))),
            h('div', { className: 'dwt-config-note' }, '路由和后缀同时配置时，必须同时满足；都为空时匹配全部 HTTP 请求。'),
            h('label', { className: 'dwt-label' }, '指定路由（每行一个）', h('textarea', { className: 'dwt-textarea', value: routesText, onChange: event => setRoutesText(event.target.value), placeholder: '/api/\n/login' })),
            h('label', { className: 'dwt-label' }, '只匹配后缀（每行一个）', h('textarea', { className: 'dwt-textarea', value: suffixesText, onChange: event => setSuffixesText(event.target.value), placeholder: '.json\n/graphql' })),
            h('label', { className: 'dwt-checkbox-row' }, h('input', { type: 'checkbox', checked: config.enabled, onChange: event => updateConfig('enabled', event.target.checked) }), '启用手动拦截'),
            h('label', { className: 'dwt-checkbox-row' }, h('input', { type: 'checkbox', checked: config.holdResponse, onChange: event => updateConfig('holdResponse', event.target.checked) }), '放行请求后继续等待响应劫持'),
          ),
        )
        const autoReleaseSection = h('details', { className: 'dwt-config-section' },
          h('summary', null, '自动放行规则', h('span', { className: 'dwt-mitm-section-meta' }, Array.isArray(autoRules.value) ? `${autoRules.value.length} 条` : 'JSON 无效')),
          h('div', { className: 'dwt-config-content' },
            h('div', { className: 'dwt-config-note' }, '匹配的请求直接放行，不进入手动队列。支持 method、urlContains、pathContains、suffix、header。'),
            h('textarea', { className: 'dwt-textarea dwt-json', value: autoRulesText, onChange: event => setAutoRulesText(event.target.value) }),
            h('div', { className: 'dwt-mitm-rule-actions' }, h('button', { className: 'dwt-btn', onClick: formatAutoRules }, '格式化'), autoRules.error ? h('span', { className: 'dwt-mitm-rule-status invalid' }, autoRules.error) : h('span', { className: 'dwt-mitm-rule-status' }, '保存时校验规则')),
          ),
        )
        const haeSection = h('details', { className: 'dwt-config-section' },
          h('summary', null, 'HaE 敏感数据', h('span', { className: 'dwt-mitm-section-meta' }, haeRules.error ? 'JSON 无效' : `${haeRuleCount} 条规则`)),
          h('div', { className: 'dwt-config-content' },
            h('label', { className: 'dwt-checkbox-row' }, h('input', { type: 'checkbox', checked: config.haeEnabled, onChange: event => updateConfig('haeEnabled', event.target.checked) }), '启用敏感数据高亮和提取'),
            h('div', { className: 'dwt-config-note' }, '对请求头、请求体、响应头和响应体执行正则匹配；匹配结果会在流量详情中高亮，并在列表中统计。'),
            h('textarea', { className: 'dwt-textarea dwt-json', value: haeRulesText, onChange: event => setHaeRulesText(event.target.value) }),
            h('div', { className: 'dwt-mitm-rule-actions' }, h('button', { className: 'dwt-btn', onClick: formatHaeRules }, '格式化'), h('button', { className: 'dwt-btn', onClick: loadDefaultHaeRules }, '载入常用规则'), haeRules.error ? h('span', { className: 'dwt-mitm-rule-status invalid' }, haeRules.error) : h('span', { className: 'dwt-mitm-rule-status' }, `${haeRuleCount} 条规则 · flags 自动补全 g`)),
          ),
        )
        return h('section', { className: 'dwt-mitm-sidebar', 'aria-label': 'MITM 配置' },
          h('header', { className: 'dwt-sidebar-head' }, h('span', { className: 'dwt-sidebar-title' }, 'MITM 配置')),
          h('div', { className: 'dwt-mitm-config' },
            h('div', { className: 'dwt-mitm-hero' },
              h('div', { className: 'dwt-mitm-hero-top' }, h('span', { className: 'dwt-mitm-hero-kicker' }, 'TEST WORKBENCH'), h('span', { className: 'dwt-mitm-hero-pill' }, `${status?.flowCount || 0} 条流量`)),
              h('div', { className: 'dwt-mitm-hero-title' }, '代理控制'),
              h('div', { className: 'dwt-mitm-hero-subtitle' }, '配置本地代理、拦截范围和敏感数据规则，统一管理测试流量。'),
            ),
            h('div', { className: 'dwt-mitm-status-card' },
              h('div', { className: 'dwt-mitm-status-main' },
                h('span', { className: 'dwt-mitm-status-icon', 'aria-hidden': 'true' }, '⌁'),
                h('div', { className: 'dwt-mitm-status-copy' },
                  h('span', { className: 'dwt-mitm-status-kicker' }, 'LOCAL PROXY'),
                  h('strong', { className: 'dwt-mitm-status-title' }, status?.proxy ? '代理运行中' : '代理未启动'),
                ),
              ),
              h('span', { className: 'dwt-mitm-status-badge' + (status?.proxy ? ' live' : '') }, status?.proxy ? 'LIVE' : 'OFFLINE'),
              h('div', { className: 'dwt-mitm-endpoint' }, status?.proxy ? `当前运行端点  ${status.proxy.host}:${status.proxy.port}` : '启动后自动分配本地端口'),
            ),
            h('div', { className: 'dwt-row dwt-mitm-actions' }, h('button', { className: 'dwt-btn primary', disabled: busy || savingConfig, onClick: toggleProxy }, status?.proxy ? '停止代理' : '启动代理'), h('button', { className: 'dwt-btn', disabled: busy || savingConfig, onClick: saveConfig }, savingConfig ? '保存中…' : '保存配置')),
            error ? h('div', { className: 'dwt-error dwt-mitm-config-error' }, error) : null,
            h('div', { className: 'dwt-config-note dwt-mitm-note' }, '内置代理的 HTTPS CONNECT 目前为透传；要解密 HTTPS，请配置支持 MITM 的外部代理并信任其 CA。'),
            h('div', { className: 'dwt-mitm-listen-card' },
              h('div', { className: 'dwt-mitm-section-kicker' }, 'LISTENING'),
              h('div', { className: 'dwt-mitm-listen-grid' },
                h('label', { className: 'dwt-label' }, '监听地址', h('input', { className: 'dwt-input', value: config.listenHost, disabled: Boolean(status?.proxy), onChange: event => updateConfig('listenHost', event.target.value), placeholder: '127.0.0.1' })),
                h('label', { className: 'dwt-label' }, '启动端口', h('input', { className: 'dwt-input', type: 'number', min: 0, max: 65535, value: config.listenPort, disabled: Boolean(status?.proxy), onChange: event => updateConfig('listenPort', event.target.value) })),
              ),
              h('div', { className: 'dwt-mitm-listen-hint' }, status?.proxy ? '代理运行期间配置已锁定；当前端点以状态卡为准。' : '0 = 自动分配。修改监听参数后点击“保存配置”，再启动代理。'),
            ),
            interceptSection,
            autoReleaseSection,
            haeSection,
          ),
        )
      }

      function FlowDetail({ flow, responseOverride, setResponseOverride, responseStatus, setResponseStatus, responseHeadersText, setResponseHeadersText, onAction, onSendToFuzzer }) {
        if (!flow) return h('div', { className: 'dwt-mitm-empty' }, '选择一条流量查看请求、响应和 HaE 提取结果。')
        const stage = flow.metadata?.pendingStage
        const responsePending = stage === 'response'
        const hae = flow.highlights?.response || []
        const responseText = mitmPacket(flow, 'response') || flow.error || '(空响应)'
        const replaceResponse = () => {
          try { onAction('replace-response', { status: Number(responseStatus) || 200, headers: JSON.parse(responseHeadersText || '{}'), body: responseOverride }) } catch (cause) { onAction('error', { message: cause.message }) }
        }
        return h('div', { className: 'dwt-mitm-detail' },
          h('div', { className: 'dwt-mitm-detail-head' }, h('strong', { className: 'dwt-mitm-detail-title' }, `${flow.method || ''} ${flow.url || ''}`), h('span', { className: 'dwt-mitm-stage' + (stage ? ' pending' : '') }, stage === 'request' ? '等待放行请求' : stage === 'response' ? '等待放行响应' : `${flow.status || '-'} · ${flow.durationMs == null ? '-' : `${flow.durationMs}ms`}`)),
          h('div', { className: 'dwt-mitm-packet-grid' },
            h('section', { className: 'dwt-mitm-packet' }, h('div', { className: 'dwt-mitm-packet-title' }, 'Request'), h('pre', null, h(HighlightedPacket, { value: mitmPacket(flow, 'request'), highlights: flow.highlights?.request }))),
            h('section', { className: 'dwt-mitm-packet' }, h('div', { className: 'dwt-mitm-packet-title' }, 'Response'), responsePending ? h('textarea', { className: 'dwt-textarea dwt-mitm-response-editor', value: responseOverride, onChange: event => setResponseOverride(event.target.value) }) : h('pre', null, h(HighlightedPacket, { value: responseText, highlights: hae }))),
          ),
          responsePending ? h('div', { className: 'dwt-config-grid' }, h('label', { className: 'dwt-label' }, '状态码', h('input', { className: 'dwt-input', value: responseStatus, onChange: event => setResponseStatus(event.target.value) })), h('label', { className: 'dwt-label' }, '响应头 JSON', h('textarea', { className: 'dwt-textarea dwt-json', value: responseHeadersText, onChange: event => setResponseHeadersText(event.target.value) }))) : null,
          h('div', { className: 'dwt-mitm-actionbar' }, h('button', { className: 'dwt-btn primary dwt-mitm-to-fuzzer', onClick: () => onSendToFuzzer(flow) }, '发送到 Web Fuzzer'), stage === 'request' ? h(React.Fragment, null, h('button', { className: 'dwt-btn primary', onClick: () => onAction('release-request') }, '放行请求'), h('button', { className: 'dwt-btn danger', onClick: () => onAction('drop-request') }, '丢弃请求')) : responsePending ? h(React.Fragment, null, h('button', { className: 'dwt-btn primary', onClick: () => onAction('release-response') }, '放行原响应'), h('button', { className: 'dwt-btn primary', onClick: replaceResponse }, '替换并放行'), h('button', { className: 'dwt-btn danger', onClick: () => onAction('drop-response') }, '丢弃响应')) : null),
          hae.length ? h('div', { className: 'dwt-mitm-hae' }, h('span', { className: 'dwt-mitm-hae-title' }, `HaE 提取 ${hae.length} 项`), hae.map((item, index) => h('span', { className: 'dwt-mitm-hae-item', key: `${item.ruleId}-${item.start}-${index}`, style: { background: item.color || '#ffe08a' }, title: item.value }, `${item.name}: ${item.value}`))) : null,
        )
      }

      function MitmPanel({ state, onSendToFuzzer, onConfirm }) {
        const { status, flows, selected, error, clear, refresh, select, flowAction, responseOverride, setResponseOverride, responseStatus, setResponseStatus, responseHeadersText, setResponseHeadersText } = state
        const [query, setQuery] = React.useState('')
        const [pendingOnly, setPendingOnly] = React.useState(false)
        const needle = query.trim().toLowerCase()
        const visibleFlows = flows.filter(flow => (!pendingOnly || flow.metadata?.pendingStage) && (!needle || `${flow.method} ${flow.url} ${flow.status} ${flow.metadata?.haeCount || ''}`.toLowerCase().includes(needle)))
        const action = (name, payload) => name === 'error' ? state.setError?.(payload.message) : flowAction(name, payload)
        return h('section', { className: 'dwt-panel dwt-panel-central' },
          h('div', { className: 'dwt-mitm-page' },
            h('div', { className: 'dwt-mitm-toolbar' },
              h('div', { className: 'dwt-mitm-toolbar-brand' },
                h('span', { className: 'dwt-mitm-toolbar-mark', 'aria-hidden': 'true' }, '⌁'),
                h('div', { className: 'dwt-mitm-toolbar-copy' },
                  h('span', { className: 'dwt-mitm-toolbar-kicker' }, 'TRAFFIC INSPECTOR'),
                  h('span', { className: 'dwt-mitm-toolbar-title' }, 'MITM 流量'),
                  h('span', { className: 'dwt-mitm-toolbar-meta' }, `${flows.length} 条记录${status?.pendingCount ? ` · ${status.pendingCount} 条待处理` : ''}`),
                ),
              ),
              h('span', { className: 'dwt-mitm-toolbar-state' + (status?.proxy ? ' live' : '') }, h('span', { className: 'dwt-mitm-toolbar-state-dot' }), status?.proxy ? '监听中' : '等待启动'),
              h('span', { className: 'dwt-mitm-toolbar-spacer' }),
              h('input', { className: 'dwt-input dwt-mitm-filter', type: 'search', placeholder: '搜索 URL、方法、状态…', value: query, onChange: event => setQuery(event.target.value) }),
              h('label', { className: 'dwt-checkbox-row dwt-mitm-pending-toggle' }, h('input', { type: 'checkbox', checked: pendingOnly, onChange: event => setPendingOnly(event.target.checked) }), '仅待处理'),
              h('button', { className: 'dwt-btn', onClick: refresh }, '刷新'), h('button', { className: 'dwt-btn', onClick: () => onConfirm({ title: '清空全部 MITM 流量？', message: '当前捕获流量、待处理请求和响应详情都会被删除，且无法恢复。', confirmLabel: '确认清空' }, clear) }, '清空'),
            ),
            error ? h('div', { className: 'dwt-error', style: { margin: '8px 12px 0' } }, error) : null,
            h('div', { className: 'dwt-mitm-table-wrap' }, visibleFlows.length ? h('div', { className: 'dwt-mitm-table' }, h('div', { className: 'dwt-mitm-table-head' }, h('span', null, '阶段'), h('span', null, '方法'), h('span', null, '状态'), h('span', null, 'URL'), h('span', null, 'HaE'), h('span', null, '耗时')), visibleFlows.map(flow => h('button', { key: flow.id, className: 'dwt-mitm-table-row' + (selected?.id === flow.id ? ' active' : ''), onClick: () => select(flow) }, h('span', { className: 'dwt-mitm-cell dwt-mitm-stage' + (flow.metadata?.pendingStage ? ' pending' : '') }, flow.metadata?.pendingStage === 'request' ? '待放行请求' : flow.metadata?.pendingStage === 'response' ? '待放行响应' : '已完成'), h('span', { className: 'dwt-mitm-cell' }, flow.method || '-'), h('span', { className: 'dwt-mitm-cell ' + (flow.status >= 400 ? 'dwt-fail' : 'dwt-pass') }, flow.status || '-'), h('span', { className: 'dwt-mitm-cell url', title: flow.url }, flow.url), h('span', { className: 'dwt-mitm-cell' }, flow.metadata?.haeCount || 0), h('span', { className: 'dwt-mitm-cell' }, flow.durationMs == null ? '-' : `${flow.durationMs}ms`)))) : h('div', { className: 'dwt-mitm-empty dwt-mitm-empty-card' }, h('div', { className: 'dwt-mitm-empty-icon', 'aria-hidden': 'true' }, '⌁'), h('strong', null, '等待流量进入'), h('span', null, '启动左侧代理，并将客户端 HTTP 代理指向当前端点。'), h('div', { className: 'dwt-mitm-empty-hints' }, h('span', null, 'HTTP 记录'), h('span', null, '手动劫持'), h('span', null, 'HaE 提取')))),
            h(FlowDetail, { flow: selected, responseOverride, setResponseOverride, responseStatus, setResponseStatus, responseHeadersText, setResponseHeadersText, onAction: action, onSendToFuzzer }),
          ),
        )
      }

      function TestCenterPane({ tab, onClose, fuzzer, mitm, fuzzerTabs, activeFuzzerId, onSelectFuzzer, onCreateFuzzer, onCloseFuzzer, onSendToFuzzer, onConfirm }) {
        const title = tab === 'fuzzer' ? 'Web Fuzzer' : 'MITM 流量'
        return h('div', { className: 'dwt-center-pane-layer', 'aria-label': '中间区域测试工具' },
          h('div', { className: 'dwt-center-pane-grid' },
            h('section', { className: 'dwt-center-pane', 'aria-label': title },
              h('header', { className: 'dwt-center-pane-head' },
                h('span', { className: 'dwt-center-pane-title' }, title),
                h('span', { className: 'dwt-center-pane-kind' }, '测试工具'),
                h('button', { className: 'dwt-center-pane-action', title: '返回会话', 'aria-label': '返回会话', onClick: onClose }, '×'),
              ),
              h('div', { className: 'dwt-center-pane-body' }, tab === 'fuzzer' ? h(FuzzerPanel, { state: fuzzer, tabs: fuzzerTabs, activeId: activeFuzzerId, onSelectTab: onSelectFuzzer, onCreateTab: onCreateFuzzer, onCloseTab: onCloseFuzzer, onConfirm }) : h(MitmPanel, { state: mitm, onSendToFuzzer, onConfirm })),
            ),
          ),
        )
      }

      function TestPanel(props) {
        const [tab, setTab] = React.useState('fuzzer')
        const [confirmRequest, setConfirmRequest] = React.useState(null)
        const [fuzzerTabs, setFuzzerTabs] = React.useState([{ id: 'fuzzer-1', label: '1', snapshot: null }])
        const [activeFuzzerId, setActiveFuzzerId] = React.useState('fuzzer-1')
        const [history, setHistory] = React.useState(() => testReferenceState.history || [])
        const activeFuzzer = fuzzerTabs.find(item => item.id === activeFuzzerId) || fuzzerTabs[0]
        const fuzzer = useFuzzerState({ history, setHistory }, activeFuzzer)
        const mitm = useMitmState()
        const requestConfirm = React.useCallback((request, action) => setConfirmRequest({ ...request, action }), [])
        const closeConfirm = React.useCallback(accepted => {
          const action = confirmRequest?.action
          setConfirmRequest(null)
          if (accepted && typeof action === 'function') action()
        }, [confirmRequest])
        React.useEffect(() => {
          testReferenceState.history = history
          testReferenceState.historyListeners.forEach(listener => listener())
        }, [history])
        const saveActiveFuzzer = () => fuzzerTabs.map(item => item.id === activeFuzzerId ? { ...item, snapshot: fuzzer.snapshot() } : item)
        const selectFuzzer = id => {
          if (id === activeFuzzerId) return
          const next = fuzzerTabs.find(item => item.id === id)
          if (!next) return
          setFuzzerTabs(saveActiveFuzzer())
          setActiveFuzzerId(id)
          fuzzer.restore(next.snapshot)
        }
        const createFuzzer = () => {
          const saved = saveActiveFuzzer()
          const nextNumber = Math.max(0, ...saved.map(item => Number(item.label) || 0)) + 1
          const next = { id: `fuzzer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, label: String(nextNumber), snapshot: null }
          setFuzzerTabs([...saved, next])
          setActiveFuzzerId(next.id)
          fuzzer.restore(null)
        }
        const closeFuzzer = id => {
          if (fuzzerTabs.length <= 1) return
          const saved = saveActiveFuzzer()
          const closingIndex = saved.findIndex(item => item.id === id)
          const remaining = saved.filter(item => item.id !== id)
          setFuzzerTabs(remaining)
          if (id !== activeFuzzerId) return
          const next = remaining[Math.min(Math.max(0, closingIndex), remaining.length - 1)]
          setActiveFuzzerId(next.id)
          fuzzer.restore(next.snapshot)
        }
        const sendMitmToFuzzer = flow => {
          const saved = saveActiveFuzzer()
          const nextNumber = Math.max(0, ...saved.map(item => Number(item.label) || 0)) + 1
          const next = { id: `fuzzer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, label: String(nextNumber), snapshot: null }
          setFuzzerTabs([...saved, next])
          setActiveFuzzerId(next.id)
          setTab('fuzzer')
          fuzzer.restore({ raw: mitmRequestToRaw(flow), payloads: '{}', result: null, selectedIndex: null, selectedFlow: null })
        }
        return h(React.Fragment, null,
          h('section', { className: 'dwt-sidebar-panel' },
            h('header', { className: 'dwt-sidebar-head' }, h('span', { className: 'dwt-sidebar-title' }, 'Test')),
            h('nav', { className: 'dwt-tabs', 'aria-label': '测试工具' },
              h('button', { className: 'dwt-tab' + (tab === 'fuzzer' ? ' active' : ''), onClick: () => setTab('fuzzer'), 'aria-selected': tab === 'fuzzer' }, 'Web Fuzzer'),
              h('button', { className: 'dwt-tab' + (tab === 'mitm' ? ' active' : ''), onClick: () => setTab('mitm'), 'aria-selected': tab === 'mitm' }, 'MITM'),
            ),
            tab === 'fuzzer' ? h(FuzzerConfigSidebar, { state: fuzzer }) : h(MitmConfigSidebar, { state: mitm }),
          ),
          h(TestCenterPane, { tab, onClose: props.close, fuzzer, mitm, fuzzerTabs, activeFuzzerId, onSelectFuzzer: selectFuzzer, onCreateFuzzer: createFuzzer, onCloseFuzzer: closeFuzzer, onSendToFuzzer: sendMitmToFuzzer, onConfirm: requestConfirm }),
          h(ConfirmDialog, { request: confirmRequest, onClose: closeConfirm }),
        )
      }

      return {
        inject: [],
        apply(ctx, options = {}) {
          installStyle()
          const sidebar = options.sidebar || ctx.get('resourceCenter') || ctx.get('dshResourceCenter')
          if (!sidebar || typeof sidebar.registerActivity !== 'function') throw new Error('dsh-resource-center-test: resourceCenter service unavailable')
          ctx.effect(() => sidebar.registerActivity({ id: 'test', label: 'Test', order: 40, icon: props => h(Icon, { kind: 'test', ...props }), component: TestPanel }), 'dsh-resource-center-test: activity')
          const inputTriggers = ctx.get('inputTriggers')
          if (inputTriggers) ctx.effect(() => {
            const unregisterFuzzer = inputTriggers.registerSource(createFuzzerHistoryInputSource())
            const unregisterMitm = inputTriggers.registerSource(createMitmInputSource())
            return () => { unregisterFuzzer?.(); unregisterMitm?.() }
          }, 'dsh-resource-center-test: @ testing sources')
        },
      }
    },
  })
  }
})(typeof window === 'undefined' ? globalThis : window);
