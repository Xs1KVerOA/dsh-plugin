(function defineDshResourceCenterModule_hunter(global) {
  const registry = global.__dshResourceCenterModuleRegistry || (global.__dshResourceCenterModuleRegistry = {})
  if (registry.hunter) return
  registry.hunter = function registerDshResourceCenterHunter(global) {
    const loader = global.__ModuleLoader__
    if (!loader || typeof loader.load !== 'function') throw new Error('dsh-resource-center-hunter: client module loader is unavailable')
    loader.load({
      id: 'dsh-resource-center-hunter',
      factory(require) {
        const React = require('react')
        const h = React.createElement
        const API = '/api/dsh-resource-center/hunter'
        const BATCH_API = API + '/batch'
        const LIGHT_FIELDS = 'ip,port,domain,url,web_title,status_code,province,city,updated_at'
        const HUNTER_FIELDS = [
          'is_risk', 'ip', 'port', 'domain', 'ip_tag', 'url', 'web_title', 'is_risk_protocol', 'protocol', 'base_protocol',
          'status_code', 'os', 'company', 'number', 'icp_exception', 'country', 'province', 'city', 'is_web', 'isp',
          'as_org', 'cert_sha256', 'ssl_certificate', 'component', 'asset_tag', 'updated_at', 'header', 'header_server',
          'banner', 'whois', 'body', 'vul_list',
        ]
        const LARGE_FIELDS = new Set(['header', 'banner', 'body', 'whois', 'ssl_certificate', 'vul_list'])
        const FIELD_LABELS = {
          ip: 'IP', port: '端口', domain: '域名', url: 'URL', protocol: '协议', base_protocol: '传输协议', is_web: 'Web 资产',
          web_title: '网站标题', status_code: '状态码', header_server: 'Server', component: '组件', asset_tag: '资产标签', updated_at: '探查时间',
          country: '国家', province: '省份', city: '城市', company: '备案单位', isp: '运营商', as_org: '注册机构', number: '备案号',
          is_risk: '风险资产', is_risk_protocol: '高危协议', vul_list: '历史漏洞', cert_sha256: '证书 SHA256', ssl_certificate: '证书',
          header: '响应头', banner: 'Banner', body: '响应正文', whois: 'WHOIS', ip_tag: 'IP 标签', icp_exception: '备案异常', os: '操作系统',
        }
        const FIELD_GROUPS = [
          { id: 'asset', label: '资产定位', description: 'IP、域名与访问入口', fields: ['ip', 'port', 'domain', 'url', 'protocol', 'base_protocol', 'is_web'] },
          { id: 'web', label: 'Web 指纹', description: '标题、组件与状态信息', fields: ['web_title', 'status_code', 'header_server', 'component', 'asset_tag', 'updated_at'] },
          { id: 'org', label: '归属位置', description: '地域、单位与运营商', fields: ['country', 'province', 'city', 'company', 'isp', 'as_org', 'number'] },
          { id: 'risk', label: '风险研判', description: '风险协议、漏洞与证书', fields: ['is_risk', 'is_risk_protocol', 'vul_list', 'cert_sha256', 'ssl_certificate'] },
          { id: 'raw', label: '原始响应', description: '响应正文与原始数据', fields: ['header', 'banner', 'body', 'whois', 'ip_tag', 'icp_exception', 'os'] },
        ]
        const QUERY_TEMPLATES = [
          { label: '登录页', value: 'title="登录"' },
          { label: '高风险协议', value: 'is_risk_protocol="是"' },
          { label: '组件定位', value: 'component.name="nginx"' },
          { label: '证书检索', value: 'cert=""' },
        ]

        const CSS = '.dhunter-panel{display:flex;flex-direction:column;height:100%;min-height:0;background:#f6f8fb;color:#20242b;font-size:12px}' +
          '.dhunter-panel *{box-sizing:border-box}.dhunter-sidebar{display:flex;flex:1;min-height:0;flex-direction:column;overflow:auto;padding:10px 9px 14px;background:linear-gradient(180deg,#fbfdff,#f4f7fb)}' +
          '.dhunter-head{display:flex;align-items:center;gap:8px;padding:10px 9px;border-bottom:1px solid #e5eaf1;background:#fff}.dhunter-head-mark{display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:8px;background:#edf5ff;color:#3578e5}' +
          '.dhunter-head-copy{min-width:0;flex:1}.dhunter-head-title{display:block;font-weight:700;font-size:13px}.dhunter-head-sub{display:block;margin-top:2px;color:#8a95a5;font-size:9px}' +
          '.dhunter-section{margin-bottom:8px;padding:10px;border:1px solid #dfe7f2;border-radius:10px;background:#fff;box-shadow:0 2px 10px rgba(45,77,120,.035)}.dhunter-section-title{display:flex;align-items:center;gap:5px;margin-bottom:8px;font-weight:700;font-size:11px}.dhunter-section-title small{margin-left:auto;color:#8b98aa;font-size:9px;font-weight:400}' +
          '.dhunter-label{display:block;margin:7px 0 4px;color:#69778a;font-size:10px}.dhunter-input,.dhunter-select,.dhunter-textarea{width:100%;min-width:0;border:1px solid #d8e1ec;border-radius:6px;padding:7px 8px;background:#fbfcfe;color:inherit;font:inherit;font-size:11px;outline:0}.dhunter-input:focus,.dhunter-select:focus,.dhunter-textarea:focus{border-color:#75a8f5;box-shadow:0 0 0 3px rgba(53,120,229,.1);background:#fff}.dhunter-textarea{min-height:84px;resize:vertical;line-height:1.45;font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}' +
          '.dhunter-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.dhunter-btn{border:1px solid #d6dfeb;border-radius:6px;padding:6px 9px;background:#fff;color:inherit;font:inherit;font-size:10.5px;cursor:pointer}.dhunter-btn:hover{background:#f4f7fb}.dhunter-btn.primary{border-color:#3578e5;background:linear-gradient(180deg,#438cf2,#3578e5);color:#fff;box-shadow:0 4px 10px rgba(53,120,229,.18)}.dhunter-btn.danger{color:#bd4b4b}.dhunter-btn:disabled{opacity:.5;cursor:default}' +
          '.dhunter-feedback{margin:0 0 8px;padding:7px 8px;border:1px solid #f2d4d4;border-radius:8px;background:#fff8f8;color:#a85050;font-size:10px;line-height:1.45}.dhunter-feedback.notice,.dhunter-notice{border-color:#d6ebdc;background:#f4fbf6;color:#37844d}.dhunter-notice{margin:7px 0 0;padding:7px 8px;border:1px solid #d6ebdc;border-radius:8px;font-size:10px;line-height:1.45}' +
          '.dhunter-status{display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:8px;border:1px solid #dfe7f2;border-radius:8px;background:#f7faff}.dhunter-status-dot{width:7px;height:7px;border-radius:50%;background:#b1bbc8}.dhunter-status-dot.live{background:#35bd72}.dhunter-status-copy{min-width:0;flex:1}.dhunter-status-title{display:block;font-weight:650;font-size:11px}.dhunter-status-meta{display:block;margin-top:2px;color:#8a95a5;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
          '.dhunter-quota{display:grid;grid-template-columns:1fr 1fr;gap:6px}.dhunter-quota-card{padding:7px;border:1px solid #e5ebf3;border-radius:7px;background:#fbfcfe}.dhunter-quota-card span{display:block;color:#8491a3;font-size:9px}.dhunter-quota-card strong{display:block;margin-top:3px;font-size:13px}.dhunter-quota-trend{display:flex;gap:7px;align-items:center;padding:5px 0;border-bottom:1px solid #edf1f6;font-size:9.5px}.dhunter-quota-trend:last-child{border-bottom:0}.dhunter-quota-trend span{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#738196}.dhunter-quota-trend strong{color:#3578e5;font-weight:650;white-space:nowrap}.dhunter-hint{margin-top:7px;color:#8995a5;font-size:9.5px;line-height:1.45}' +
          '.dhunter-center-layer{position:fixed;left:var(--dsh-resource-center-left-width,280px);right:var(--dsh-resource-center-right-width,0px);top:var(--dsh-resource-center-top,0px);bottom:var(--dsh-resource-center-bottom,0px);z-index:24;display:flex;pointer-events:none}.dhunter-center{display:flex;width:100%;height:100%;min-width:0;min-height:0;flex-direction:column;border-left:1px solid #e3e8ef;background:#fff;box-shadow:-12px 0 30px rgba(15,23,42,.04);pointer-events:auto}' +
          '.dhunter-center-head{display:flex;align-items:center;gap:8px;min-height:50px;padding:0 14px;border-bottom:1px solid #e5eaf1;background:#fff}.dhunter-center-title{min-width:0;flex:1;font-size:14px;font-weight:700}.dhunter-center-sub{color:#8a95a5;font-size:10px}.dhunter-close{width:26px;height:26px;border:0;border-radius:6px;background:transparent;color:#8a95a5;font-size:17px;cursor:pointer}.dhunter-close:hover{background:#f1f4f8;color:#26303d}' +
          '.dhunter-toolbar{display:flex;align-items:center;gap:7px;min-height:45px;padding:0 14px;border-bottom:1px solid #e8edf3;background:#fff}.dhunter-tabs{display:flex;gap:3px}.dhunter-tab{border:0;border-radius:6px;padding:6px 10px;background:transparent;color:#788698;font:inherit;font-size:11px;cursor:pointer}.dhunter-tab.active{background:#edf4ff;color:#3578e5;font-weight:650}.dhunter-spacer{flex:1}.dhunter-content{display:flex;flex:1;min-height:0;flex-direction:column;overflow:auto;background:#f6f8fb}' +
          '.dhunter-workbench{display:flex;min-height:100%;flex-direction:column;gap:10px;padding:12px}.dhunter-card{min-width:0;border:1px solid #dde6f0;border-radius:10px;background:#fff;box-shadow:0 2px 12px rgba(35,63,97,.035)}.dhunter-card-head{display:flex;align-items:center;gap:7px;min-width:0;padding:10px 12px;border-bottom:1px solid #e9eef4}.dhunter-card-title{flex:0 0 auto;white-space:nowrap;font-weight:700;font-size:12px}.dhunter-card-meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8a95a5;font-size:9px}.dhunter-card-body{padding:11px 12px}.dhunter-ai-assist{margin-bottom:10px;padding:9px 10px;border:1px solid #d6e6ff;border-radius:8px;background:linear-gradient(135deg,#f4f8ff,#fbfdff)}.dhunter-ai-assist-head{display:flex;align-items:center;gap:7px}.dhunter-ai-assist-mark{display:inline-flex;width:19px;height:19px;align-items:center;justify-content:center;border-radius:6px;background:#e2efff;color:#3578e5;font-size:12px}.dhunter-ai-assist-copy{min-width:0;flex:1}.dhunter-ai-assist-title{display:block;color:#35445a;font-size:10.5px;font-weight:700}.dhunter-ai-assist-sub{display:block;margin-top:1px;color:#8090a4;font-size:9px}.dhunter-ai-assist-form{display:flex;gap:7px;margin-top:8px}.dhunter-ai-assist-form .dhunter-input{flex:1;background:#fff}.dhunter-ai-assist-note{margin-top:6px;color:#8290a1;font-size:9px;line-height:1.4}@media (max-width:700px){.dhunter-ai-assist-form{flex-direction:column}.dhunter-ai-assist-form .dhunter-btn{width:100%}}' +
          '.dhunter-form-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,180px) minmax(130px,180px);gap:8px}.dhunter-form-grid.two{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.dhunter-form-actions{display:flex;align-items:center;gap:7px;margin-top:9px}.dhunter-result-card{display:flex;min-height:300px;flex:1;flex-direction:column}.dhunter-result-scroll{min-height:0;flex:1;overflow:auto}' +
          '.dhunter-table{width:100%;border-collapse:collapse;font-size:10px}.dhunter-table th,.dhunter-table td{padding:8px 9px;border-bottom:1px solid #edf0f4;text-align:left;vertical-align:top;white-space:nowrap}.dhunter-table th{position:sticky;top:0;background:#f7f9fc;color:#738196;font-weight:650;z-index:1}.dhunter-table tbody tr{cursor:pointer}.dhunter-table tbody tr:hover,.dhunter-table tbody tr.active{background:#f3f7ff}.dhunter-table td.wrap{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dhunter-table td.status-ok{color:#269354}.dhunter-table td.status-fail{color:#c14d4d}' +
          '.dhunter-empty{display:flex;min-height:220px;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:#95a0ae}.dhunter-empty strong{color:#667386;font-size:12px}.dhunter-empty span{font-size:10px}.dhunter-detail{margin:0 12px 12px;padding:10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc}.dhunter-detail pre{max-height:250px;margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word;color:#536174;font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}' +
          '.dhunter-batch-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,360px);gap:10px}.dhunter-task-row{display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid #edf0f4}.dhunter-task-row:last-child{border-bottom:0}.dhunter-task-id{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;color:#3578e5}.dhunter-task-meta{min-width:0;flex:1;color:#6f7d90;font-size:10px}.dhunter-task-actions{display:flex;gap:5px}.dhunter-download{color:#3578e5;text-decoration:none;font-size:10px}.dhunter-file{font-size:10px;color:#748196}.dhunter-select-check{width:14px;height:14px;accent-color:#3578e5}.dhunter-footer-note{padding:8px 12px;color:#8b97a6;font-size:9.5px;line-height:1.45}' +
          '.dhunter-config{margin-bottom:8px;border:1px solid #dfe7f2;border-radius:10px;background:#fff;box-shadow:0 2px 10px rgba(45,77,120,.035)}.dhunter-config summary{display:flex;align-items:center;gap:6px;padding:10px;cursor:pointer;list-style:none;font-weight:700;font-size:11px}.dhunter-config summary::-webkit-details-marker{display:none}.dhunter-config summary:before{content:"›";color:#7e91aa}.dhunter-config[open] summary:before{content:"⌄"}.dhunter-config-body{padding:0 10px 10px;border-top:1px solid #edf0f4}.dhunter-field-groups{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.dhunter-chip{border:1px solid #d6e2f0;border-radius:999px;padding:4px 7px;background:#fff;color:#617187;font:10px/1 inherit;cursor:pointer}.dhunter-chip:hover,.dhunter-chip.active{border-color:#9ec0f6;background:#edf5ff;color:#2870d9}.dhunter-field-summary{display:flex;align-items:center;gap:5px;min-height:32px;margin-top:7px;padding:5px 7px;border:1px solid #e4eaf2;border-radius:7px;background:#fbfcfe;color:#6e7c8f;font-size:10px;overflow:hidden}.dhunter-field-summary strong{flex:0 0 auto;color:#3d4c60}.dhunter-field-summary span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dhunter-field-editor{margin-top:7px;border-top:1px solid #edf0f4}.dhunter-field-editor summary{padding:7px 0;cursor:pointer;color:#6d7c90;font-size:10px}.dhunter-field-editor-body{display:flex;flex-wrap:wrap;gap:5px;padding:0 0 4px}.dhunter-field-option{display:inline-flex;align-items:center;gap:4px;padding:4px 6px;border:1px solid #e1e7ef;border-radius:6px;background:#fff;color:#59697d;font-size:9px;cursor:pointer}.dhunter-field-option input{width:12px;height:12px;margin:0;accent-color:#3578e5}.dhunter-warning{margin-top:8px;padding:7px 8px;border-left:3px solid #efa85d;border-radius:5px;background:#fff8ed;color:#8b5b24;font-size:10px;line-height:1.45}.dhunter-result-tools{display:flex;align-items:center;gap:6px;min-width:0;margin-left:auto}.dhunter-result-tools .dhunter-input,.dhunter-card-filter{width:clamp(180px,22vw,280px);flex:0 1 280px}.dhunter-detail-tabs{display:flex;gap:3px;margin-bottom:8px}.dhunter-detail-tab{border:0;border-radius:5px;padding:5px 7px;background:transparent;color:#718096;font:10px/1 inherit;cursor:pointer}.dhunter-detail-tab.active{background:#e7f0ff;color:#2f78df;font-weight:650}.dhunter-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.dhunter-detail-kv{min-width:0;padding:7px;border:1px solid #e2e8f0;border-radius:6px;background:#fff}.dhunter-detail-kv span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8491a3;font-size:9px}.dhunter-detail-kv strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px;color:#374151;font-size:10px}.dhunter-badge{display:inline-flex;align-items:center;border-radius:999px;padding:3px 6px;background:#edf5ff;color:#2870d9;font-size:9px}.dhunter-badge.risk{background:#fff0f0;color:#be4848}.dhunter-history-row{display:grid;grid-template-columns:minmax(170px,1.5fr) 70px 80px 100px auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #edf0f4;font-size:10px}.dhunter-history-row:last-child{border-bottom:0}.dhunter-history-query{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.dhunter-asset-actions{display:flex;gap:5px;flex-wrap:wrap}.dhunter-table-sort{border:0;background:transparent;color:inherit;font:inherit;font-weight:650;cursor:pointer}.dhunter-table-sort:hover{color:#2870d9}@media (max-width:900px){.dhunter-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dhunter-history-row{grid-template-columns:minmax(160px,1fr) 80px auto}.dhunter-history-row>*:nth-child(3),.dhunter-history-row>*:nth-child(4){display:none}}@media (max-width:700px){.dhunter-form-grid,.dhunter-form-grid.two,.dhunter-batch-grid{grid-template-columns:1fr}.dhunter-toolbar{flex-wrap:wrap;padding:8px 10px}.dhunter-spacer{display:none}.dhunter-result-tools{width:100%;margin-left:0}.dhunter-result-tools .dhunter-input,.dhunter-card-filter{width:100%;flex:1 1 100%}.dhunter-detail-grid{grid-template-columns:1fr}.dhunter-history-row{grid-template-columns:1fr auto}.dhunter-history-row>*:nth-child(2){display:none}}'
          '.dhunter-field-picker{margin-top:10px;border:1px solid #dce6f2;border-radius:9px;background:#fbfcff}.dhunter-field-picker-head{display:flex;align-items:center;gap:8px;padding:8px 9px;border-bottom:1px solid #e8edf4}.dhunter-field-picker-title{min-width:0;flex:1}.dhunter-field-picker-title strong{display:block;color:#3b4a5f;font-size:10.5px}.dhunter-field-picker-title span{display:block;margin-top:2px;color:#8491a3;font-size:9px}.dhunter-field-count{display:inline-flex;align-items:center;border-radius:999px;padding:3px 6px;background:#eaf3ff;color:#2870d9;font-size:9px;font-weight:650;white-space:nowrap}.dhunter-field-picker-actions{display:flex;gap:5px}.dhunter-field-picker-actions .dhunter-btn{padding:5px 7px;font-size:9.5px}.dhunter-field-selected{display:flex;flex-wrap:wrap;gap:5px;padding:8px 9px}.dhunter-field-selected.empty{color:#8c98a8;font-size:10px}.dhunter-field-token{display:inline-flex;align-items:center;gap:4px;border:1px solid #cfe0f8;border-radius:999px;padding:4px 7px;background:#f5f9ff;color:#3d70ae;font:10px/1 inherit;cursor:pointer}.dhunter-field-token:hover{border-color:#8db6ec;background:#eaf3ff}.dhunter-field-token .remove{color:#6b88af;font-size:12px;line-height:8px}.dhunter-field-manage{border-top:1px solid #e8edf4}.dhunter-field-manage summary{display:flex;align-items:center;gap:5px;padding:8px 9px;cursor:pointer;list-style:none;color:#607287;font-size:10px}.dhunter-field-manage summary::-webkit-details-marker{display:none}.dhunter-field-manage summary:before{content:"›";color:#7a91ad;font-size:14px}.dhunter-field-manage[open] summary:before{content:"⌄"}.dhunter-field-manage-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:0 9px 9px}.dhunter-field-group{min-width:0;border:1px solid #e1e8f1;border-radius:7px;background:#fff}.dhunter-field-group-head{display:flex;align-items:flex-start;gap:6px;padding:7px;border-bottom:1px solid #edf1f5}.dhunter-field-group-copy{min-width:0;flex:1}.dhunter-field-group-copy strong{display:block;color:#46566b;font-size:9.5px}.dhunter-field-group-copy span{display:block;margin-top:2px;color:#8a96a7;font-size:8.5px;line-height:1.3}.dhunter-field-group-count{color:#7d8fa6;font-size:8.5px;white-space:nowrap}.dhunter-field-group-toggle{border:0;background:transparent;color:#2f78df;font:9px/1 inherit;cursor:pointer;white-space:nowrap}.dhunter-field-options{display:flex;flex-wrap:wrap;gap:4px;padding:6px}.dhunter-field-option{display:inline-flex;align-items:center;gap:4px;padding:3px 5px;border:1px solid #e1e7ef;border-radius:5px;background:#fff;color:#59697d;font-size:8.8px;cursor:pointer}.dhunter-field-option.selected{border-color:#bcd5f5;background:#f2f7ff;color:#316faf}.dhunter-field-option.large{border-color:#f1d5ae;background:#fffaf2;color:#9a6a2b}.dhunter-field-option input{width:11px;height:11px;margin:0;accent-color:#3578e5}.dhunter-warning{margin-top:8px;padding:7px 8px;border-left:3px solid #efa85d;border-radius:5px;background:#fff8ed;color:#8b5b24;font-size:10px;line-height:1.45}.dhunter-result-tools{display:flex;align-items:center;gap:6px;min-width:0;margin-left:auto}.dhunter-result-tools .dhunter-input,.dhunter-card-filter{width:clamp(180px,22vw,280px);flex:0 1 280px}.dhunter-detail-tabs{display:flex;gap:3px;margin-bottom:8px}.dhunter-detail-tab{border:0;border-radius:5px;padding:5px 7px;background:transparent;color:#718096;font:10px/1 inherit;cursor:pointer}.dhunter-detail-tab.active{background:#e7f0ff;color:#2f78df;font-weight:650}.dhunter-detail-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.dhunter-detail-kv{min-width:0;padding:7px;border:1px solid #e2e8f0;border-radius:6px;background:#fff}.dhunter-detail-kv span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8491a3;font-size:9px}.dhunter-detail-kv strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px;color:#374151;font-size:10px}.dhunter-badge{display:inline-flex;align-items:center;border-radius:999px;padding:3px 6px;background:#edf5ff;color:#2870d9;font-size:9px}.dhunter-badge.risk{background:#fff0f0;color:#be4848}.dhunter-history-row{display:grid;grid-template-columns:minmax(170px,1.5fr) 70px 80px 100px auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #edf0f4;font-size:10px}.dhunter-history-row:last-child{border-bottom:0}.dhunter-history-query{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.dhunter-asset-actions{display:flex;gap:5px;flex-wrap:wrap}.dhunter-table-sort{border:0;background:transparent;color:inherit;font:inherit;font-weight:650;cursor:pointer}.dhunter-table-sort:hover{color:#2870d9}@media (max-width:900px){.dhunter-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dhunter-history-row{grid-template-columns:minmax(160px,1fr) 80px auto}.dhunter-history-row>*:nth-child(3),.dhunter-history-row>*:nth-child(4){display:none}}@media (max-width:700px){.dhunter-form-grid,.dhunter-form-grid.two,.dhunter-batch-grid,.dhunter-field-manage-body{grid-template-columns:1fr}.dhunter-toolbar{flex-wrap:wrap;padding:8px 10px}.dhunter-spacer{display:none}.dhunter-result-tools{width:100%;margin-left:0}.dhunter-result-tools .dhunter-input,.dhunter-card-filter{width:100%;flex:1 1 100%}.dhunter-detail-grid{grid-template-columns:1fr}.dhunter-history-row{grid-template-columns:1fr auto}.dhunter-history-row>*:nth-child(2){display:none}}'

        function installStyle() {
          if (document.querySelector('style[data-plugin="dsh-resource-center-hunter"]')) return
          const style = document.createElement('style')
          style.dataset.plugin = 'dsh-resource-center-hunter'
          style.textContent = CSS
          document.head.appendChild(style)
        }

        function fetchWithTimeout(input, options = {}, timeoutMs = 15000) {
          const controller = typeof AbortController === 'function' ? new AbortController() : null
          const parentSignal = options.signal
          const abort = () => controller?.abort(parentSignal?.reason)
          if (parentSignal?.aborted) abort()
          else parentSignal?.addEventListener?.('abort', abort, { once: true })
          const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined
          return fetch(input, { ...options, ...(controller ? { signal: controller.signal } : {}) }).finally(() => {
            if (timer) clearTimeout(timer)
            parentSignal?.removeEventListener?.('abort', abort)
          })
        }

        async function readJson(response) {
          const body = await response.json().catch(() => ({}))
          if (!response.ok || body?.ok === false) {
            const error = new Error(body?.error || 'Hunter 请求失败')
            error.code = body?.code
            throw error
          }
          return body
        }

        async function api(action, payload = {}, signal, timeoutMs) {
          const response = await fetchWithTimeout(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...payload }), signal }, timeoutMs)
          return readJson(response)
        }

        function messageOf(cause) {
          const code = cause?.code || ''
          const message = cause?.message || String(cause || '')
          if (code === 'api-key-required' || /请先配置.*ApiKey/.test(message)) return '请先在左侧配置并验证 Hunter ApiKey。'
          if (code === 'api-key-invalid') return 'ApiKey 无效或已过期，请在 Hunter 个人中心复制新的密钥后重新验证。'
          if (code === 'quota-exhausted') return 'Hunter 当前额度不足，请查看左侧额度卡片或调整查询范围。'
          if (code === 'upstream-timeout') return 'Hunter 请求超时。请缩小时间范围、减少字段后重试。'
          if (code === 'upstream-unavailable') return 'Hunter 服务暂时不可用，请稍后再试。'
          return message || 'Hunter 请求失败，请稍后重试。'
        }

        function fieldsFrom(value) {
          return new Set(String(value || '').split(',').map(item => item.trim()).filter(Boolean))
        }

        function preflightWarning(startTime, endTime, fields) {
          const selected = fieldsFrom(fields)
          const large = ['whois', 'body', 'banner', 'header', 'vul_list'].filter(item => selected.has(item))
          const start = startTime ? Date.parse(startTime) : NaN
          const end = endTime ? Date.parse(endTime) : NaN
          const olderThan30Days = Number.isFinite(start) && Date.now() - start > 30 * 24 * 60 * 60 * 1000
          const messages = []
          if (olderThan30Days) messages.push('开始时间超过近 30 天，Hunter 可能扣除权益积分。')
          if (Number.isFinite(start) && Number.isFinite(end) && end < start) messages.push('结束时间早于开始时间，请调整时间范围。')
          if (large.length) messages.push(`已选择大字段 ${large.join('、')}，建议先用轻量字段确认命中后再展开。`)
          return messages
        }

        async function validateBatchCsv(file, searchType) {
          if (!file) return { ok: true, count: 0, message: '' }
          if (file.size > 20 * 1024 * 1024) return { ok: false, count: 0, message: 'CSV 文件不能超过 20 MB。' }
          if (!/\.csv$/i.test(file.name || '')) return { ok: false, count: 0, message: '仅支持 CSV 文件。' }
          const text = await file.slice(0, 2 * 1024 * 1024).text()
          const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
          const values = lines.slice(1)
          if (!values.length) return { ok: false, count: 0, message: 'CSV 至少需要表头和一条检索目标。' }
          const limit = searchType === 'all' ? 10 : 100
          if (values.length > limit) return { ok: false, count: values.length, message: `${searchType === 'all' ? '混合检索' : '当前检索类型'}最多支持 ${limit} 条目标。` }
          return { ok: true, count: values.length, message: `已预检 ${values.length} 条目标，提交时原文件会直接发送至 Hunter。` }
        }

        function Icon() {
          return h('svg', { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'aria-hidden': 'true' },
            h('circle', { cx: 11, cy: 11, r: 6.5 }), h('path', { d: 'm16 16 5 5M8.5 11h5M11 8.5v5' }),
          )
        }

        function escapeMarkup(value) {
          return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character])
        }

        function hunterAssetMarkup(asset) {
          return `<dsh-hunter-asset-ref asset-id="${escapeMarkup(asset.id)}" ip="${escapeMarkup(asset.ip)}" port="${escapeMarkup(asset.port)}" domain="${escapeMarkup(asset.domain)}" url="${escapeMarkup(asset.url)}" title="${escapeMarkup(asset.webTitle)}" source="hunter" content-scope="untrusted-asset">Hunter asset: ${escapeMarkup(asset.url || asset.domain || asset.ip)}</dsh-hunter-asset-ref>`
        }

        function createHunterAssetInputSource() {
          const cache = new Map()
          const refreshAssets = async signal => {
            const response = await fetchWithTimeout(API, { signal })
            const body = await readJson(response)
            const assets = Array.isArray(body?.state?.assets) ? body.state.assets : []
            assets.forEach(asset => cache.set(asset.id, asset))
            return assets
          }
          return {
            trigger: '@', name: 'Hunter 资产', order: 33,
            async candidates(_session, { query, signal }) {
              if (signal?.aborted) return []
              const needle = String(query || '').toLowerCase()
              const assets = await refreshAssets(signal)
              return assets.filter(asset => [asset.ip, asset.domain, asset.url, asset.webTitle].join(' ').toLowerCase().includes(needle)).slice(0, 30).map(asset => ({ name: `hunter:${asset.id}`, description: [asset.url || asset.domain || asset.ip, asset.webTitle].filter(Boolean).join(' · '), icon: '🔎', hint: 'Hunter 资产' }))
            },
            onPick({ candidate }) {
              const id = String(candidate?.name || '').replace(/^hunter:/, '')
              const asset = cache.get(id)
              return asset ? { insert: { source: 'Hunter 资产', ref: asset.id, label: asset.domain || asset.url || asset.ip, clipboardText: `@hunter:${asset.id}` } } : undefined
            },
            codec: {
              clipboardText(ref) { return `@hunter:${ref}` },
              async serialize(ref, signal) {
                const asset = cache.get(String(ref)) || (await refreshAssets(signal)).find(item => item.id === String(ref))
                if (!asset) throw new Error('Hunter 资产引用已失效，请在 Hunter 资产库中重新选择。')
                return hunterAssetMarkup(asset)
              },
            },
          }
        }

        function fmtNumber(value) {
          return value == null || value === '' ? '-' : Number(value).toLocaleString()
        }

        function quotaPoints(value) {
          const match = String(value || '').match(/(?:消耗积分|积分)\s*[：:]?\s*(\d+(?:\.\d+)?)/)
          return match ? Number(match[1]) : 0
        }

        function HunterStatus({ configured, userInfo, loading }) {
          const username = userInfo?.personalInfo?.username || userInfo?.type || '尚未验证'
          return h('div', { className: 'dhunter-status' },
            h('span', { className: 'dhunter-status-dot' + (configured ? ' live' : '') }),
            h('div', { className: 'dhunter-status-copy' },
              h('span', { className: 'dhunter-status-title' }, loading ? '正在验证 ApiKey…' : configured ? 'Hunter 已连接' : 'Hunter 未配置'),
              h('span', { className: 'dhunter-status-meta' }, configured ? username + ' · 网络空间搜索' : '配置 ApiKey 后可进行检索'),
            ),
          )
        }

        function HunterSidebar({ state }) {
          const config = state.config
          const info = config?.userInfo
          return h('section', { className: 'dhunter-panel', 'aria-label': 'Hunter' },
            h('header', { className: 'dhunter-head' }, h('span', { className: 'dhunter-head-mark' }, h(Icon)), h('div', { className: 'dhunter-head-copy' }, h('span', { className: 'dhunter-head-title' }, 'Hunter'), h('span', { className: 'dhunter-head-sub' }, '网络空间搜索辅助')), h('button', { className: 'dhunter-btn', onClick: state.refresh, disabled: state.busy, title: '刷新账号信息' }, '↻')),
            h('div', { className: 'dhunter-sidebar' },
              h(HunterStatus, { configured: config?.configured, userInfo: info, loading: state.busy }),
              state.error ? h('div', { className: 'dhunter-feedback' }, state.error) : null,
              state.notice ? h('div', { className: 'dhunter-feedback notice' }, state.notice) : null,
              config?.configured && info ? h('section', { className: 'dhunter-section' },
                h('div', { className: 'dhunter-section-title' }, '账号额度', h('small', null, info.type || 'Hunter')),
                h('div', { className: 'dhunter-quota' },
                  h('div', { className: 'dhunter-quota-card' }, h('span', null, '剩余权益积分'), h('strong', null, fmtNumber(info.restEquityPoint))),
                  h('div', { className: 'dhunter-quota-card' }, h('span', null, '今日免费积分'), h('strong', null, fmtNumber(info.restFreePoint))),
                  h('div', { className: 'dhunter-quota-card' }, h('span', null, '今日导出额度'), h('strong', null, info.restExportQuota == null || info.restExportQuota < 0 ? '不限' : fmtNumber(info.restExportQuota))),
                  h('div', { className: 'dhunter-quota-card' }, h('span', null, '单次导出上限'), h('strong', null, info.onceExportQuota == null || info.onceExportQuota < 0 ? '不限' : fmtNumber(info.onceExportQuota))),
                ),
              ) : null,
              state.history.length || state.tasks.length ? h('section', { className: 'dhunter-section' },
                h('div', { className: 'dhunter-section-title' }, '本工作区额度记录', h('small', null, `已记录 ${fmtNumber(state.quotaSpent)} 积分`)),
                h('div', { className: 'dhunter-hint', style: { marginTop: 0 } }, [...state.history.map(item => ({ at: item.createdAt, label: item.search, quota: item.consumeQuota })), ...state.tasks.map(item => ({ at: item.createdAt, label: `批量任务 #${item.id}`, quota: item.consumeQuota }))].sort((left, right) => Number(right.at) - Number(left.at)).slice(0, 4).map(item => h('div', { key: String(item.at) + item.label, className: 'dhunter-quota-trend' }, h('span', { title: item.label }, item.label), h('strong', null, item.quota || '未返回消耗'))),
                ),
              ) : null,
              h('details', { className: 'dhunter-config', open: !config?.configured },
                h('summary', null, 'ApiKey 配置', h('small', { style: { marginLeft: 'auto', color: '#8b98aa', fontWeight: 400 } }, config?.apiKeyMasked || '未配置')),
                h('div', { className: 'dhunter-config-body' },
                h('input', { className: 'dhunter-input', type: 'password', value: state.keyDraft, placeholder: config?.configured ? '输入新 ApiKey 以替换' : '粘贴 Hunter ApiKey', onChange: event => state.setKeyDraft(event.target.value) }),
                h('div', { className: 'dhunter-row', style: { marginTop: '8px' } }, h('button', { className: 'dhunter-btn primary', disabled: state.busy || !state.keyDraft.trim(), onClick: state.save }, state.busy ? '验证中…' : '保存并验证'), config?.configured ? h('button', { className: 'dhunter-btn danger', disabled: state.busy, onClick: state.clear }, '清除') : null),
                h('p', { className: 'dhunter-hint' }, 'ApiKey 只用于服务端访问 hunter.qianxin.com，不会回显完整密钥，也不会写入工作区文件。'),
                ),
              ),
              h('details', { className: 'dhunter-config' }, h('summary', null, '数据与审计', h('small', { style: { marginLeft: 'auto', color: '#8b98aa', fontWeight: 400 } }, state.workspacePersistent ? '工作区持久化' : '当前运行内存')),
                h('div', { className: 'dhunter-config-body' }, h('div', { className: 'dhunter-hint' }, `查询历史 ${state.history.length} 条 · 资产 ${state.assets.length} 个 · 任务 ${state.tasks.length} 个。`, h('br'), '历史记录不保存 ApiKey；大字段在写入工作区前会被截断。'))),
              h('p', { className: 'dhunter-hint' }, '在中间区域输入查询语法，支持小批量检索、批量任务进度和 CSV 导出。'),
            ),
          )
        }

        function useHunterState(sessionId) {
          const [config, setConfig] = React.useState({ configured: false })
          const [workspaceState, setWorkspaceState] = React.useState({ queries: [], tasks: [], assets: [], audits: [] })
          const [workspacePersistent, setWorkspacePersistent] = React.useState(false)
          const [keyDraft, setKeyDraft] = React.useState('')
          const [busy, setBusy] = React.useState(false)
          const [error, setError] = React.useState('')
          const [notice, setNotice] = React.useState('')
          const [query, setQuery] = React.useState('title="登录"')
          const [startTime, setStartTime] = React.useState('')
          const [endTime, setEndTime] = React.useState('')
          const [pageSize, setPageSize] = React.useState('10')
          const [isWeb, setIsWeb] = React.useState('1')
          const [statusCode, setStatusCode] = React.useState('')
          const [fields, setFields] = React.useState(LIGHT_FIELDS)
          const [searchType, setSearchType] = React.useState('all')
          const [assetsLimit, setAssetsLimit] = React.useState('1000')
          const [result, setResult] = React.useState(null)
          const [selected, setSelected] = React.useState(null)
          const [batchResult, setBatchResult] = React.useState(null)
          const [assistantRequirement, setAssistantRequirement] = React.useState('')
          const [assistantBusy, setAssistantBusy] = React.useState(false)
          const controllerRef = React.useRef(null)
          const assistantControllerRef = React.useRef(null)

          const applyResponse = React.useCallback(response => {
            if (response && Object.prototype.hasOwnProperty.call(response, 'configured')) setConfig(response)
            if (response && Object.prototype.hasOwnProperty.call(response, 'persistent')) setWorkspacePersistent(Boolean(response.persistent))
            if (response?.persisted && Object.prototype.hasOwnProperty.call(response.persisted, 'ok')) setWorkspacePersistent(Boolean(response.persisted.ok))
            if (response?.state && typeof response.state === 'object') {
              setWorkspaceState({
                queries: Array.isArray(response.state.queries) ? response.state.queries : [],
                tasks: Array.isArray(response.state.tasks) ? response.state.tasks : [],
                assets: Array.isArray(response.state.assets) ? response.state.assets : [],
                audits: Array.isArray(response.state.audits) ? response.state.audits : [],
                updatedAt: Number(response.state.updatedAt) || 0,
              })
            }
          }, [])

          const refresh = React.useCallback(async () => {
            setBusy(true); setError('')
            try {
              const response = await fetchWithTimeout(API + '?refresh=1')
              applyResponse(await readJson(response))
            } catch (cause) {
              if (cause?.name !== 'AbortError') {
                if (!config?.configured) setNotice('Hunter 尚未连接。配置 ApiKey 后将自动验证账号与额度。')
                else setError(messageOf(cause))
              }
            }
            finally { setBusy(false) }
          }, [applyResponse, config?.configured])
          React.useEffect(() => { refresh(); return () => { controllerRef.current?.abort(); assistantControllerRef.current?.abort() } }, [refresh])
          const save = React.useCallback(async () => {
            setBusy(true); setError(''); setNotice('')
            try {
              const response = await api('save', { apiKey: keyDraft })
              applyResponse(response); setKeyDraft(''); setNotice('ApiKey 已验证并安全保存')
            } catch (cause) { setError(messageOf(cause)) }
            finally { setBusy(false) }
          }, [applyResponse, keyDraft])
          const clear = React.useCallback(async () => {
            if (!global.confirm?.('确定清除 Hunter ApiKey？清除后将无法继续搜索。')) return
            setBusy(true); setError(''); setNotice('')
            try { applyResponse(await api('clear')); setNotice('ApiKey 已清除') } catch (cause) { setError(messageOf(cause)) }
            finally { setBusy(false) }
          }, [applyResponse])
          const search = React.useCallback(async () => {
            controllerRef.current?.abort()
            const controller = new AbortController()
            controllerRef.current = controller
            setBusy(true); setError(''); setNotice(''); setSelected(null)
            try {
              const response = await api('search', { search: query, startTime, endTime, pageSize: Number(pageSize) || 10, isWeb, statusCode, fields }, controller.signal)
              applyResponse(response); setResult(response.result)
            } catch (cause) { if (cause?.name !== 'AbortError') setError(messageOf(cause)) }
            finally { if (!controller.signal.aborted) setBusy(false) }
          }, [applyResponse, query, startTime, endTime, pageSize, isWeb, statusCode, fields])
          const generateSyntax = React.useCallback(async () => {
            const requirement = assistantRequirement.trim()
            if (!requirement) {
              setError('请输入要检索的网络空间资产条件。')
              return
            }
            assistantControllerRef.current?.abort()
            const controller = new AbortController()
            assistantControllerRef.current = controller
            setAssistantBusy(true); setError(''); setNotice('')
            try {
              const response = await api('assistQuery', { sessionId, requirement }, controller.signal, 25_000)
              applyResponse(response)
              setQuery(response.syntax || '')
              setNotice(response.summary ? `已生成并回填语法：${response.summary}` : '已生成并回填 Hunter 搜索语法，请确认后手动开始查询。')
            } catch (cause) {
              if (cause?.name === 'AbortError' && !controller.signal.aborted) setError('生成 Hunter 语法超时，请缩短描述后重试。')
              else if (cause?.name !== 'AbortError') setError(messageOf(cause))
            } finally {
              if (assistantControllerRef.current === controller) {
                assistantControllerRef.current = null
                setAssistantBusy(false)
              }
            }
          }, [applyResponse, assistantRequirement, sessionId])
          const submitBatch = React.useCallback(async file => {
            setBusy(true); setError(''); setNotice(''); setBatchResult(null)
            try {
              let response
              if (file) {
                const form = new FormData()
                form.append('file', file)
                form.append('is_web', isWeb === '3' ? '1' : isWeb)
                form.append('start_time', startTime); form.append('end_time', endTime); form.append('fields', fields)
                form.append('search_type', searchType); form.append('assets_limit', assetsLimit)
                const raw = await fetchWithTimeout(BATCH_API, { method: 'POST', body: form })
                response = await readJson(raw)
              } else {
                response = await api('batch', { search: query, startTime, endTime, isWeb, fields, searchType, assetsLimit: Number(assetsLimit) || 1000, statusCode, hasFile: false })
              }
              applyResponse(response)
              setBatchResult(response.result)
            } catch (cause) { setError(messageOf(cause)) }
            finally { setBusy(false) }
          }, [applyResponse, query, startTime, endTime, isWeb, fields, searchType, assetsLimit, statusCode])
          const refreshTask = React.useCallback(async (id, signal) => {
            try {
              const response = await api('batchStatus', { taskId: id }, signal)
              applyResponse(response)
            } catch (cause) { if (cause?.name !== 'AbortError') setError(messageOf(cause)) }
          }, [applyResponse])
          const retryTask = React.useCallback(async id => {
            setBusy(true); setError('')
            try {
              const response = await api('retryTask', { taskId: id })
              applyResponse(response)
              setNotice(`已重新查询任务 #${id} 的执行状态`)
            } catch (cause) { setError(messageOf(cause)) }
            finally { setBusy(false) }
          }, [applyResponse])
          const tasks = workspaceState.tasks || []
          const pendingTaskIds = tasks.filter(task => !/已完成|完成|失败|取消|终止/.test(String(task.status || ''))).map(task => task.id).filter(Boolean).join(',')
          React.useEffect(() => {
            if (!pendingTaskIds) return undefined
            const controller = new AbortController()
            const tick = () => Promise.all(pendingTaskIds.split(',').slice(0, 6).map(id => refreshTask(id, controller.signal)))
            void tick()
            const timer = setInterval(tick, 15_000)
            return () => { controller.abort(); clearInterval(timer) }
          }, [pendingTaskIds, refreshTask])
          const clearHistory = React.useCallback(async () => {
            if (!global.confirm?.('确定清空 Hunter 查询历史？此操作不会删除已保存的资产和批量任务。')) return
            setBusy(true); setError('')
            try { applyResponse(await api('clearHistory')); setNotice('查询历史已清空') } catch (cause) { setError(messageOf(cause)) }
            finally { setBusy(false) }
          }, [applyResponse])
          const saveAssets = React.useCallback(async (assets, source = 'manual') => {
            setBusy(true); setError('')
            try {
              const response = await api('saveAssets', { assets, source })
              applyResponse(response)
              setNotice(`已保存 ${response.saved || 0} 个资产到当前工作区`)
              return response
            } catch (cause) { setError(messageOf(cause)); return undefined }
            finally { setBusy(false) }
          }, [applyResponse])
          const toggleFavorite = React.useCallback(async assetId => {
            setBusy(true); setError('')
            try { applyResponse(await api('toggleFavorite', { assetId })) } catch (cause) { setError(messageOf(cause)) }
            finally { setBusy(false) }
          }, [applyResponse])
          const history = workspaceState.queries || []
          const assets = workspaceState.assets || []
          const quotaSpent = [...history, ...tasks].reduce((total, item) => total + quotaPoints(item.consumeQuota), 0)
          return { config, setConfig, keyDraft, setKeyDraft, busy, error, notice, setNotice, save, clear, refresh, query, setQuery, startTime, setStartTime, endTime, setEndTime, pageSize, setPageSize, isWeb, setIsWeb, statusCode, setStatusCode, fields, setFields, searchType, setSearchType, assetsLimit, setAssetsLimit, result, setResult, selected, setSelected, batchResult, assistantRequirement, setAssistantRequirement, assistantBusy, generateSyntax, tasks, history, assets, audits: workspaceState.audits || [], quotaSpent, workspacePersistent, submitBatch, refreshTask, retryTask, clearHistory, saveAssets, toggleFavorite }
        }

        function resultData(result) { return Array.isArray(result?.data?.arr) ? result.data.arr : [] }
        function fmtTime(value) {
          const timestamp = Number(value)
          return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toLocaleString('zh-CN', { hour12: false }) : '-'
        }
        function SearchPane({ state, openInBrowser }) {
          const [filter, setFilter] = React.useState('')
          const [sort, setSort] = React.useState({ key: 'updated_at', direction: 'desc' })
          const [detailTab, setDetailTab] = React.useState('overview')
          const selectedFields = fieldsFrom(state.fields)
          const selectedFieldNames = HUNTER_FIELDS.filter(field => selectedFields.has(field))
          const warnings = preflightWarning(state.startTime, state.endTime, state.fields)
          const invalidRange = warnings.some(item => item.includes('结束时间早于'))
          const toggleGroup = group => {
            const next = fieldsFrom(state.fields)
            const enabled = group.fields.every(field => next.has(field))
            group.fields.forEach(field => enabled ? next.delete(field) : next.add(field))
            state.setFields([...next].filter(field => HUNTER_FIELDS.includes(field)).join(','))
          }
          const toggleField = (field, enabled) => {
            const next = fieldsFrom(state.fields)
            if (enabled) next.add(field)
            else next.delete(field)
            state.setFields([...next].filter(item => HUNTER_FIELDS.includes(item)).join(','))
          }
          const rows = resultData(state.result)
            .filter(row => !filter.trim() || [row.ip, row.port, row.domain, row.url, row.web_title, row.company].join(' ').toLowerCase().includes(filter.trim().toLowerCase()))
            .sort((left, right) => {
              const a = left?.[sort.key] ?? ''
              const b = right?.[sort.key] ?? ''
              const result = typeof a === 'number' || typeof b === 'number' ? Number(a) - Number(b) : String(a).localeCompare(String(b), 'zh-CN')
              return sort.direction === 'asc' ? result : -result
            })
          const setSortKey = key => setSort(current => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })
          const sortHead = (label, key) => h('th', { key }, h('button', { className: 'dhunter-table-sort', onClick: () => setSortKey(key) }, label, sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''))
          const selected = state.selected
          return h('div', { className: 'dhunter-workbench' },
            h('section', { className: 'dhunter-card' },
              h('div', { className: 'dhunter-card-head' }, h('span', { className: 'dhunter-card-title' }, '语法检索'), h('span', { className: 'dhunter-card-meta' }, 'RFC 4648 base64url 由服务端自动编码')),
              h('div', { className: 'dhunter-card-body' },
                h('section', { className: 'dhunter-ai-assist', 'aria-label': 'LLM 辅助查询' },
                  h('div', { className: 'dhunter-ai-assist-head' }, h('span', { className: 'dhunter-ai-assist-mark', 'aria-hidden': 'true' }, '✦'), h('div', { className: 'dhunter-ai-assist-copy' }, h('span', { className: 'dhunter-ai-assist-title' }, 'LLM 辅助查询'), h('span', { className: 'dhunter-ai-assist-sub' }, '根据当前会话模型生成可编辑的 Hunter 语法'))),
                  h('div', { className: 'dhunter-ai-assist-form' }, h('input', { className: 'dhunter-input', value: state.assistantRequirement, onChange: event => state.setAssistantRequirement(event.target.value), onKeyDown: event => { if (event.key === 'Enter' && !event.nativeEvent?.isComposing) { event.preventDefault(); state.generateSyntax() } }, placeholder: '例如：查找中国境内使用 Nginx 的登录页', 'aria-label': 'LLM 查询需求' }), h('button', { className: 'dhunter-btn primary', type: 'button', disabled: state.assistantBusy || !state.assistantRequirement.trim(), onClick: state.generateSyntax }, state.assistantBusy ? '生成中…' : '生成 Hunter 语法')),
                  h('div', { className: 'dhunter-ai-assist-note' }, '仅生成并回填下方语法，不会自动发起 Hunter 查询。'),
                ),
                h('label', { className: 'dhunter-label' }, 'Hunter 搜索语法'),
                h('textarea', { className: 'dhunter-textarea', value: state.query, onChange: event => state.setQuery(event.target.value), placeholder: '例如：title="登录" && country="中国"' }),
                h('div', { className: 'dhunter-row', style: { marginTop: '7px' } }, QUERY_TEMPLATES.map(template => h('button', { key: template.label, className: 'dhunter-chip' + (state.query === template.value ? ' active' : ''), type: 'button', onClick: () => state.setQuery(template.value) }, template.label))),
                h('div', { className: 'dhunter-form-grid' },
                  h('div', null, h('label', { className: 'dhunter-label' }, '开始时间'), h('input', { className: 'dhunter-input', type: 'date', value: state.startTime, onChange: event => state.setStartTime(event.target.value) })),
                  h('div', null, h('label', { className: 'dhunter-label' }, '结束时间'), h('input', { className: 'dhunter-input', type: 'date', value: state.endTime, onChange: event => state.setEndTime(event.target.value) })),
                  h('div', null, h('label', { className: 'dhunter-label' }, '每页数量'), h('input', { className: 'dhunter-input', type: 'number', min: 1, max: 100, value: state.pageSize, onChange: event => state.setPageSize(event.target.value) })),
                ),
                h('div', { className: 'dhunter-form-grid two' },
                  h('div', null, h('label', { className: 'dhunter-label' }, '资产类型'), h('select', { className: 'dhunter-select', value: state.isWeb, onChange: event => state.setIsWeb(event.target.value) }, h('option', { value: '' }, '不限制'), h('option', { value: '1' }, 'Web 资产'), h('option', { value: '2' }, '非 Web 资产'), h('option', { value: '3' }, '全部资产'))),
                  h('div', null, h('label', { className: 'dhunter-label' }, '状态码'), h('input', { className: 'dhunter-input', value: state.statusCode, onChange: event => state.setStatusCode(event.target.value), placeholder: '例如 200,401' })),
                ),
                h('section', { className: 'dhunter-field-picker', 'aria-label': '返回字段' },
                  h('div', { className: 'dhunter-field-picker-head' },
                    h('div', { className: 'dhunter-field-picker-title' }, h('strong', null, '返回字段'), h('span', null, '选择 Hunter 返回的资产属性；原始响应字段按需开启')),
                    h('span', { className: 'dhunter-field-count' }, `已选 ${selectedFieldNames.length} 项`),
                    h('div', { className: 'dhunter-field-picker-actions' }, h('button', { className: 'dhunter-btn', type: 'button', onClick: () => state.setFields(LIGHT_FIELDS) }, '推荐'), h('button', { className: 'dhunter-btn', type: 'button', onClick: () => state.setFields(HUNTER_FIELDS.join(',')) }, '全部')),
                  ),
                  h('div', { className: 'dhunter-field-selected' + (selectedFieldNames.length ? '' : ' empty') }, selectedFieldNames.length
                    ? selectedFieldNames.map(field => h('button', { key: field, className: 'dhunter-field-token', type: 'button', title: `移除 ${FIELD_LABELS[field] || field}`, 'aria-label': `移除返回字段 ${FIELD_LABELS[field] || field}`, onClick: () => toggleField(field, false) }, FIELD_LABELS[field] || field, h('span', { className: 'remove', 'aria-hidden': 'true' }, '×')))
                    : '未选择字段。建议先使用“推荐”字段集。'),
                  h('details', { className: 'dhunter-field-manage' },
                    h('summary', null, '管理字段与原始响应'),
                    h('div', { className: 'dhunter-field-manage-body' }, FIELD_GROUPS.map(group => {
                      const activeCount = group.fields.filter(field => selectedFields.has(field)).length
                      const allActive = activeCount === group.fields.length
                      return h('section', { className: 'dhunter-field-group', key: group.id },
                        h('div', { className: 'dhunter-field-group-head' },
                          h('div', { className: 'dhunter-field-group-copy' }, h('strong', null, group.label), h('span', null, group.description)),
                          h('span', { className: 'dhunter-field-group-count' }, `${activeCount}/${group.fields.length}`),
                          h('button', { type: 'button', className: 'dhunter-field-group-toggle', onClick: () => toggleGroup(group) }, allActive ? '清除此组' : '选择此组'),
                        ),
                        h('div', { className: 'dhunter-field-options' }, group.fields.map(field => h('label', { className: 'dhunter-field-option' + (selectedFields.has(field) ? ' selected' : '') + (LARGE_FIELDS.has(field) ? ' large' : ''), key: field }, h('input', { type: 'checkbox', checked: selectedFields.has(field), onChange: event => toggleField(field, event.target.checked) }), FIELD_LABELS[field] || field, LARGE_FIELDS.has(field) ? h('span', { title: '该字段可能较大' }, '大') : null))),
                      )
                    })),
                  ),
                ),
                warnings.length ? h('div', { className: 'dhunter-warning' }, warnings.map((item, index) => h('div', { key: index }, item))) : null,
                h('div', { className: 'dhunter-form-actions' }, h('button', { className: 'dhunter-btn primary', onClick: state.search, disabled: state.busy || !state.config?.configured || !state.query.trim() || invalidRange }, state.busy ? '查询中…' : '开始查询'), h('span', { className: 'dhunter-card-meta' }, state.config?.configured ? '查询会消耗 Hunter 额度，并写入当前工作区历史' : '请先在左侧配置 ApiKey')),
              ),
            ),
            h('section', { className: 'dhunter-card dhunter-result-card' },
              h('div', { className: 'dhunter-card-head' }, h('span', { className: 'dhunter-card-title' }, '检索结果'), h('span', { className: 'dhunter-card-meta' }, state.result?.data ? fmtNumber(state.result.data.total) + ' 条 · ' + (state.result.data.consume_quota || '') : '等待查询'), h('div', { className: 'dhunter-result-tools' }, h('input', { className: 'dhunter-input', value: filter, onChange: event => setFilter(event.target.value), placeholder: '筛选 IP、域名、标题…' }), rows.length ? h('button', { className: 'dhunter-btn', onClick: () => state.saveAssets(rows, 'search-result'), disabled: state.busy }, '保存当前结果') : null)),
              rows.length ? h('div', { className: 'dhunter-result-scroll' },
                h('table', { className: 'dhunter-table' },
                  h('thead', null, h('tr', null, [sortHead('IP', 'ip'), sortHead('端口', 'port'), sortHead('域名', 'domain'), sortHead('标题', 'web_title'), sortHead('状态', 'status_code'), sortHead('位置', 'province'), sortHead('更新时间', 'updated_at')])),
                  h('tbody', null, rows.map((row, index) => h('tr', { key: String(row.ip || row.domain || index) + '-' + index, className: state.selected === row ? 'active' : '', onClick: () => state.setSelected(row) },
                    h('td', null, row.ip || '-'), h('td', null, row.port || '-'), h('td', { className: 'wrap', title: row.domain || row.url }, row.domain || row.url || '-'), h('td', { className: 'wrap', title: row.web_title }, row.web_title || '-'), h('td', { className: Number(row.status_code) >= 400 ? 'status-fail' : 'status-ok' }, row.status_code || '-'), h('td', null, [row.province, row.city].filter(Boolean).join(' ') || '-'), h('td', null, row.updated_at || '-'),
                  ))),
                ),
              ) : h('div', { className: 'dhunter-empty' }, h(Icon), h('strong', null, state.result ? '没有匹配结果' : '等待检索结果'), h('span', null, state.result ? '请调整语法或时间范围后重试' : '执行查询后，Hunter 返回的资产会显示在这里')),
              selected ? h('div', { className: 'dhunter-detail' },
                h('div', { className: 'dhunter-row', style: { justifyContent: 'space-between' } }, h('div', { className: 'dhunter-detail-tabs' }, [['overview', '资产概览'], ['risk', '风险与组件'], ['raw', '原始数据']].map(([id, label]) => h('button', { key: id, className: 'dhunter-detail-tab' + (detailTab === id ? ' active' : ''), onClick: () => setDetailTab(id) }, label))), h('div', { className: 'dhunter-asset-actions' }, h('button', { className: 'dhunter-btn', onClick: () => openInBrowser?.(selected) }, '右侧浏览器打开'), h('button', { className: 'dhunter-btn', onClick: () => state.saveAssets([selected], 'search-detail'), disabled: state.busy }, '保存资产'))),
                detailTab === 'overview' ? h('div', { className: 'dhunter-detail-grid' }, [['IP', selected.ip], ['端口', selected.port], ['域名', selected.domain], ['URL', selected.url], ['标题', selected.web_title], ['状态码', selected.status_code], ['协议', selected.protocol], ['归属', [selected.country, selected.province, selected.city].filter(Boolean).join(' ')], ['更新时间', selected.updated_at]].map(([label, value]) => h('div', { className: 'dhunter-detail-kv', key: label, title: String(value || '-') }, h('span', null, label), h('strong', null, value || '-')))) : null,
                detailTab === 'risk' ? h('div', { className: 'dhunter-row', style: { alignItems: 'flex-start' } }, h('div', { className: 'dhunter-detail-kv', style: { flex: 1 } }, h('span', null, '风险'), h('strong', null, selected.is_risk || selected.is_risk_protocol || '未标记')), h('div', { className: 'dhunter-detail-kv', style: { flex: 2 } }, h('span', null, '组件'), h('strong', null, Array.isArray(selected.component) && selected.component.length ? selected.component.map(item => item.name + (item.version ? ' ' + item.version : '')).join(' · ') : '-')), h('div', { className: 'dhunter-detail-kv', style: { flex: 2 } }, h('span', null, '历史漏洞'), h('strong', null, selected.vul_list || '-')), h('div', { className: 'dhunter-detail-kv', style: { flex: 2 } }, h('span', null, '证书 SHA256'), h('strong', null, selected.cert_sha256 || '-'))) : null,
                detailTab === 'raw' ? h('pre', null, JSON.stringify(selected, null, 2)) : null,
              ) : null,
            ),
          )
        }

        function BatchPane({ state }) {
          const [file, setFile] = React.useState(null)
          const [fileCheck, setFileCheck] = React.useState({ ok: true, count: 0, message: '' })
          const [checkingFile, setCheckingFile] = React.useState(false)
          const selectFile = async event => {
            const next = event.target.files?.[0] || null
            setFile(next)
            if (!next) return setFileCheck({ ok: true, count: 0, message: '' })
            setCheckingFile(true)
            try { setFileCheck(await validateBatchCsv(next, state.searchType)) }
            catch { setFileCheck({ ok: false, count: 0, message: '无法读取 CSV 文件，请检查文件编码或内容。' }) }
            finally { setCheckingFile(false) }
          }
          const revalidateForType = async nextType => {
            state.setSearchType(nextType)
            if (!file) return
            setCheckingFile(true)
            try { setFileCheck(await validateBatchCsv(file, nextType)) }
            finally { setCheckingFile(false) }
          }
          const submit = async () => {
            const validation = await validateBatchCsv(file, state.searchType)
            setFileCheck(validation)
            if (!validation.ok) return
            state.submitBatch(file)
          }
          return h('div', { className: 'dhunter-workbench' },
            h('div', { className: 'dhunter-batch-grid' },
              h('section', { className: 'dhunter-card' },
                h('div', { className: 'dhunter-card-head' }, h('span', { className: 'dhunter-card-title' }, '批量查询'), h('span', { className: 'dhunter-card-meta' }, '异步生成导出任务')),
                h('div', { className: 'dhunter-card-body' },
                  h('label', { className: 'dhunter-label' }, '搜索语法（可选）'), h('textarea', { className: 'dhunter-textarea', value: state.query, onChange: event => state.setQuery(event.target.value), placeholder: '不上传文件时使用搜索语法' }),
                  h('label', { className: 'dhunter-label' }, 'CSV 文件（可选）'), h('input', { className: 'dhunter-input', type: 'file', accept: '.csv,text/csv', onChange: selectFile }), h('span', { className: 'dhunter-file' }, file ? file.name : '支持 CSV；文件查询会通过 multipart 转发'), fileCheck.message ? h('div', { className: fileCheck.ok ? 'dhunter-notice' : 'dhunter-warning', style: { margin: '7px 0 0' } }, checkingFile ? '正在预检 CSV…' : fileCheck.message) : null,
                  h('div', { className: 'dhunter-form-grid two' }, h('div', null, h('label', { className: 'dhunter-label' }, '资产类型'), h('select', { className: 'dhunter-select', value: state.isWeb, onChange: event => state.setIsWeb(event.target.value) }, h('option', { value: '' }, '不限制'), h('option', { value: '1' }, 'Web 资产'), h('option', { value: '2' }, '非 Web 资产'))), h('div', null, h('label', { className: 'dhunter-label' }, 'CSV 检索类型'), h('select', { className: 'dhunter-select', value: state.searchType, onChange: event => revalidateForType(event.target.value) }, h('option', { value: 'all' }, '混合检索（最多 10 条）'), h('option', { value: 'ip' }, 'IP / IP 段（最多 100 条）'), h('option', { value: 'domain' }, '域名（最多 100 条）'), h('option', { value: 'company' }, '企业名称（最多 100 条）')))),
                  h('div', { className: 'dhunter-form-grid two' }, h('div', null, h('label', { className: 'dhunter-label' }, '状态码'), h('input', { className: 'dhunter-input', value: state.statusCode, onChange: event => state.setStatusCode(event.target.value), placeholder: '例如 200,401' })), h('div', null, h('label', { className: 'dhunter-label' }, '预期导出数量'), h('input', { className: 'dhunter-input', type: 'number', min: 1, max: 1000000, value: state.assetsLimit, onChange: event => state.setAssetsLimit(event.target.value) }))),
                  h('label', { className: 'dhunter-label' }, '返回字段'), h('input', { className: 'dhunter-input', value: state.fields, onChange: event => state.setFields(event.target.value), placeholder: 'ip,port,domain,url…' }),
                  h('div', { className: 'dhunter-form-actions' }, h('button', { className: 'dhunter-btn primary', onClick: submit, disabled: state.busy || checkingFile || !fileCheck.ok || !state.config?.configured || (!file && !state.query.trim()) }, state.busy ? '提交中…' : '提交批量任务'), h('a', { className: 'dhunter-download', download: 'hunter-batch-template.csv', href: 'data:text/csv;charset=utf-8,' + encodeURIComponent('target\nexample.com\n') }, '下载 CSV 模板')),
                  state.batchResult ? h('div', { className: 'dhunter-notice', style: { margin: '10px 0 0' } }, '任务已提交：' + (state.batchResult.data?.task_id || '-') + ' · ' + (state.batchResult.data?.consume_quota || '')) : null,
                ),
              ),
              h('section', { className: 'dhunter-card' }, h('div', { className: 'dhunter-card-head' }, h('span', { className: 'dhunter-card-title' }, '任务说明')), h('div', { className: 'dhunter-card-body' }, h('p', { className: 'dhunter-hint', style: { marginTop: 0 } }, 'Hunter 批量检索是异步任务。提交后保留 task_id，可查询进度并下载 CSV。时间范围超出近 30 天可能消耗权益积分。'), h('p', { className: 'dhunter-hint' }, '上传文件时只接受 CSV，文件内容会原样发送到 Hunter，不会保存到资源中心。'))),
            ),
          )
        }

        function TasksPane({ state }) {
          return h('div', { className: 'dhunter-workbench' }, h('section', { className: 'dhunter-card' },
            h('div', { className: 'dhunter-card-head' }, h('span', { className: 'dhunter-card-title' }, '批量任务'), h('span', { className: 'dhunter-card-meta' }, state.tasks.length + ' 个任务')),
            h('div', { className: 'dhunter-card-body' }, state.tasks.length ? state.tasks.map(task => h('div', { className: 'dhunter-task-row', key: task.id }, h('span', { className: 'dhunter-task-id' }, '#' + task.id), h('div', { className: 'dhunter-task-meta' }, h('strong', null, task.status), h('span', { style: { marginLeft: '8px' } }, task.progress), task.filename ? h('span', { style: { marginLeft: '8px' } }, task.filename) : null, task.restTime ? h('span', { style: { marginLeft: '8px' } }, '预计 ' + task.restTime) : null, task.downloads ? h('span', { style: { marginLeft: '8px' } }, `已下载 ${task.downloads} 次`) : null), h('div', { className: 'dhunter-task-actions' }, h('button', { className: 'dhunter-btn', onClick: () => state.refreshTask(task.id), disabled: state.busy }, '刷新'), h('button', { className: 'dhunter-btn', onClick: () => state.retryTask(task.id), disabled: state.busy }, '重试刷新'), task.status === '已完成' ? h('a', { className: 'dhunter-download', href: BATCH_API + '/download/' + encodeURIComponent(task.id), download: true }, '下载 CSV') : null))) : h('div', { className: 'dhunter-empty' }, h(Icon), h('strong', null, '暂无批量任务'), h('span', null, '在“批量查询”中提交任务后，这里会记录 task_id'))),
          ))
        }

        function HistoryPane({ state }) {
          const useQuery = item => {
            state.setQuery(item.search || '')
            state.setStartTime(item.startTime || '')
            state.setEndTime(item.endTime || '')
            state.setPageSize(String(item.pageSize || 10))
            state.setIsWeb(item.isWeb || '')
            state.setStatusCode(item.statusCode || '')
            state.setFields(item.fields || LIGHT_FIELDS)
          }
          return h('div', { className: 'dhunter-workbench' }, h('section', { className: 'dhunter-card' },
            h('div', { className: 'dhunter-card-head' }, h('span', { className: 'dhunter-card-title' }, '查询历史'), h('span', { className: 'dhunter-card-meta' }, state.history.length + ' 条，按当前工作区和账号隔离'), h('span', { className: 'dhunter-spacer' }), state.history.length ? h('button', { className: 'dhunter-btn danger', onClick: state.clearHistory, disabled: state.busy }, '清空历史') : null),
            h('div', { className: 'dhunter-card-body' }, state.history.length ? state.history.map(item => h('div', { className: 'dhunter-history-row', key: item.id }, h('span', { className: 'dhunter-history-query', title: item.search }, item.search), h('span', null, item.resultCount + '/' + item.total), h('span', null, item.consumeQuota || '-'), h('span', null, fmtTime(item.createdAt)), h('button', { className: 'dhunter-btn', onClick: () => useQuery(item) }, '复用'))) : h('div', { className: 'dhunter-empty' }, h(Icon), h('strong', null, '暂无查询历史'), h('span', null, '执行语法检索后会在这里保留可复用的查询参数')),
          )))
        }

        function AssetsPane({ state, sendToFuzzer, openInBrowser }) {
          const [filter, setFilter] = React.useState('')
          const [selectedIds, setSelectedIds] = React.useState(() => new Set())
          const rows = state.assets.filter(item => !filter.trim() || [item.ip, item.domain, item.url, item.webTitle, item.company].join(' ').toLowerCase().includes(filter.trim().toLowerCase()))
          const selectedRows = rows.filter(item => selectedIds.has(item.id))
          const toggle = assetId => setSelectedIds(current => {
            const next = new Set(current)
            if (next.has(assetId)) next.delete(assetId)
            else next.add(assetId)
            return next
          })
          const toggleAll = () => setSelectedIds(current => {
            const next = new Set(current)
            const allSelected = rows.length > 0 && rows.every(item => next.has(item.id))
            rows.forEach(item => allSelected ? next.delete(item.id) : next.add(item.id))
            return next
          })
          const table = h('table', { className: 'dhunter-table' },
            h('thead', null, h('tr', null, h('th', null, h('input', { className: 'dhunter-select-check', type: 'checkbox', checked: rows.length > 0 && rows.every(item => selectedIds.has(item.id)), onChange: toggleAll, 'aria-label': '选择当前筛选结果' })), ['资产', '标题', '风险', '来源', '操作'].map(label => h('th', { key: label }, label)))),
            h('tbody', null, rows.map(asset => h('tr', { key: asset.id },
              h('td', null, h('input', { className: 'dhunter-select-check', type: 'checkbox', checked: selectedIds.has(asset.id), onChange: () => toggle(asset.id), 'aria-label': `选择 ${asset.domain || asset.ip || asset.id}` })),
              h('td', { className: 'wrap', title: asset.url || asset.domain || asset.ip }, asset.url || asset.domain || asset.ip || '-'),
              h('td', { className: 'wrap', title: asset.webTitle }, asset.webTitle || '-'),
              h('td', null, asset.isRisk || asset.isRiskProtocol ? h('span', { className: 'dhunter-badge risk' }, asset.isRisk || asset.isRiskProtocol) : h('span', { className: 'dhunter-badge' }, '未标记')),
              h('td', { className: 'wrap' }, (asset.sources || []).join(', ') || '-'),
              h('td', null, h('div', { className: 'dhunter-asset-actions' },
                h('button', { className: 'dhunter-btn', onClick: () => state.toggleFavorite(asset.id), disabled: state.busy }, asset.favorite ? '取消收藏' : '收藏'),
                h('button', { className: 'dhunter-btn', onClick: () => openInBrowser?.(asset) }, '浏览器打开'),
                h('button', { className: 'dhunter-btn', onClick: () => sendToFuzzer?.(asset) }, '发送到 Fuzzer'),
              )),
            ))),
          )
          return h('div', { className: 'dhunter-workbench' },
            h('section', { className: 'dhunter-card dhunter-result-card' },
              h('div', { className: 'dhunter-card-head' }, h('span', { className: 'dhunter-card-title' }, '已保存资产'), h('span', { className: 'dhunter-card-meta' }, state.assets.length + ' 个资产'), h('span', { className: 'dhunter-spacer' }), selectedRows.length ? h('button', { className: 'dhunter-btn primary', onClick: () => sendToFuzzer?.(selectedRows) }, `发送所选到 Fuzzer (${selectedRows.length})`) : null, h('input', { className: 'dhunter-input dhunter-card-filter', value: filter, onChange: event => setFilter(event.target.value), placeholder: '筛选已保存资产', 'aria-label': '筛选已保存资产' })),
              rows.length ? h('div', { className: 'dhunter-result-scroll' }, table) : h('div', { className: 'dhunter-empty' }, h(Icon), h('strong', null, '暂无保存资产'), h('span', null, '检索结果会自动写入资产库，也可以在结果区手动保存')),
            ),
          )
        }

        function AuditPane({ state }) {
          const rows = state.audits.length
            ? state.audits.map(item => h('div', { className: 'dhunter-history-row', key: item.id },
              h('span', { className: 'dhunter-history-query' }, item.action),
              h('span', null, item.taskId || item.queryId || '-'),
              h('span', null, item.consumeQuota || item.status || '-'),
              h('span', null, fmtTime(item.at)),
            ))
            : h('div', { className: 'dhunter-empty' }, h(Icon), h('strong', null, '暂无操作审计'), h('span', null, '执行检索、提交任务或保存资产后会在这里记录'))
          return h('div', { className: 'dhunter-workbench' },
            h('section', { className: 'dhunter-card' },
              h('div', { className: 'dhunter-card-head' },
                h('span', { className: 'dhunter-card-title' }, '操作审计'),
                h('span', { className: 'dhunter-card-meta' }, state.audits.length + ' 条；不记录 ApiKey'),
              ),
              h('div', { className: 'dhunter-card-body' }, rows),
            ),
          )
        }

        function HunterCenter({ state, tab, setTab, close, sendToFuzzer, openInBrowser }) {
          const pane = tab === 'search' ? h(SearchPane, { state, openInBrowser })
            : tab === 'assets' ? h(AssetsPane, { state, sendToFuzzer, openInBrowser })
              : tab === 'history' ? h(HistoryPane, { state })
                : tab === 'batch' ? h(BatchPane, { state })
                  : tab === 'tasks' ? h(TasksPane, { state })
                    : h(AuditPane, { state })
          return h('div', { className: 'dhunter-center-layer', 'aria-label': 'Hunter 网络空间搜索' },
            h('section', { className: 'dhunter-center' },
              h('header', { className: 'dhunter-center-head' },
                h('span', { className: 'dhunter-center-title' }, 'Hunter 网络空间搜索'),
                h('span', { className: 'dhunter-center-sub' }, state.config?.configured ? 'ApiKey 已验证' : '需要配置 ApiKey'),
                h('button', { className: 'dhunter-close', onClick: close, title: '返回会话', 'aria-label': '返回会话' }, '×'),
              ),
              h('div', { className: 'dhunter-toolbar' },
                h('nav', { className: 'dhunter-tabs', 'aria-label': 'Hunter 功能' },
                  h('button', { className: 'dhunter-tab' + (tab === 'search' ? ' active' : ''), onClick: () => setTab('search') }, '语法检索'),
                  h('button', { className: 'dhunter-tab' + (tab === 'assets' ? ' active' : ''), onClick: () => setTab('assets') }, '资产' + (state.assets.length ? ' (' + state.assets.length + ')' : '')),
                  h('button', { className: 'dhunter-tab' + (tab === 'history' ? ' active' : ''), onClick: () => setTab('history') }, '历史'),
                  h('button', { className: 'dhunter-tab' + (tab === 'batch' ? ' active' : ''), onClick: () => setTab('batch') }, '批量查询'),
                  h('button', { className: 'dhunter-tab' + (tab === 'tasks' ? ' active' : ''), onClick: () => setTab('tasks') }, '任务' + (state.tasks.length ? ' (' + state.tasks.length + ')' : '')),
                  h('button', { className: 'dhunter-tab' + (tab === 'audit' ? ' active' : ''), onClick: () => setTab('audit') }, '审计'),
                ),
                h('span', { className: 'dhunter-spacer' }),
                h('span', { className: 'dhunter-card-meta' }, state.workspacePersistent ? '工作区持久化' : '运行内存'),
              ),
              h('main', { className: 'dhunter-content' }, pane),
            ),
          )
        }

        function HunterPanel(props) {
          const state = useHunterState(props.sessionId)
          const [tab, setTab] = React.useState('search')
          const sendToFuzzer = React.useCallback(input => {
            const requests = (Array.isArray(input) ? input : [input]).map(asset => {
              const raw = asset?.raw || asset || {}
              const url = raw.url || asset?.url || ((raw.protocol || asset?.protocol || 'https') + '://' + (raw.domain || asset?.domain || raw.ip || asset?.ip || ''))
              if (!url) return undefined
              let host = raw.domain || asset?.domain || raw.ip || asset?.ip || ''
              try { host = new URL(url).host || host } catch { /* keep the best available asset host */ }
              return { asset: raw, request: `GET ${url} HTTP/1.1\nHost: ${host}\n\n` }
            }).filter(Boolean).slice(0, 30)
            if (!requests.length || !global.CustomEvent) return
            const detail = { source: 'hunter', requests }
            global.__dshResourceCenterFuzzerHandoff = detail
            global.dispatchEvent(new CustomEvent('dsh-resource-center:open-fuzzer', { detail }))
            props.sidebar?.open?.('test')
          }, [props.sidebar])
          const openInBrowser = React.useCallback(asset => {
            const raw = asset?.raw || asset || {}
            const host = raw.domain || asset?.domain || raw.ip || asset?.ip || ''
            const target = raw.url || asset?.url || (host ? `${raw.protocol || asset?.protocol || 'https'}://${host}` : '')
            if (!target || !global.CustomEvent) {
              state.setNotice?.('该资产没有可在浏览器打开的 HTTP(S) 地址。')
              return false
            }
            global.dispatchEvent(new CustomEvent('dsh-resource-center:open-browser', { detail: { source: 'hunter', url: target } }))
            state.setNotice?.('已发送到右侧浏览器；若 MITM 监听已开启，流量会自动进入同一监听。')
            return true
          }, [state])
          return h(React.Fragment, null, h(HunterSidebar, { state }), h(HunterCenter, { state, tab, setTab, close: props.close, sendToFuzzer, openInBrowser }))
        }

        return {
          inject: [],
          apply(ctx, options = {}) {
            installStyle()
            const sidebar = options.sidebar || ctx.get('resourceCenter') || ctx.get('dshResourceCenter')
            if (!sidebar || typeof sidebar.registerActivity !== 'function') throw new Error('dsh-resource-center-hunter: resourceCenter service unavailable')
            ctx.effect(() => sidebar.registerActivity({ id: 'hunter', label: 'Hunter', order: 50, icon: props => h(Icon, props), component: props => h(HunterPanel, { ...props, sidebar }) }), 'dsh-resource-center-hunter: activity')
            const inputTriggers = ctx.get('inputTriggers')
            if (inputTriggers) ctx.effect(() => inputTriggers.registerSource(createHunterAssetInputSource()), 'dsh-resource-center-hunter: @ asset source')
          },
        }
      },
    })
  }
})(typeof window === 'undefined' ? globalThis : window)
