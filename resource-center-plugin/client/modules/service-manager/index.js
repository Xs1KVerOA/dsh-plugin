(function defineDshResourceCenterModule_serviceManager(global) {
  const registry = global.__dshResourceCenterModuleRegistry || (global.__dshResourceCenterModuleRegistry = {})
  if (registry.serviceManager) return
  registry.serviceManager = function registerDshResourceCenterServiceManager(global) {
  const loader = global.__ModuleLoader__
  if (!loader || typeof loader.load !== 'function') throw new Error('dsh-resource-center-service-manager: client module loader is unavailable')
  if (global.__dshResourceCenterServiceManagerRegistered) return

  loader.load({
    id: 'dsh-resource-center-service-manager',
    factory(require) {
      const React = require('react')
      const h = React.createElement
      const { useEffect, useMemo, useRef, useState } = React

      const TYPE_META = {
        ssh: { label: 'SSH', icon: '🔑', port: 22, secret: ['password', 'privateKey'] },
        ftp: { label: 'FTP', icon: '📁', port: 21, secret: ['password'] },
        redis: { label: 'Redis', icon: '🔺', port: 6379, secret: ['password'] },
        mysql: { label: 'MySQL', icon: '🐬', port: 3306, secret: ['password'] },
        mariadb: { label: 'MariaDB', icon: '🦭', port: 3306, secret: ['password'] },
        postgresql: { label: 'PostgreSQL', icon: '🐘', port: 5432, secret: ['password'] },
        mssql: { label: 'SQL Server', icon: '🧱', port: 1433, secret: ['password'] },
        elasticsearch: { label: 'Elasticsearch', icon: '🔎', port: 9200, secret: ['password'] },
        docker: { label: 'Docker', icon: '🐳', port: 0, secret: [] },
        mongodb: { label: 'MongoDB', icon: '🍃', port: 27017, secret: ['password'] },
        cassandra: { label: 'Cassandra', icon: '🛰️', port: 9042, secret: ['password'] },
        s3: { label: 'S3 / MinIO / R2', icon: '🪣', port: 0, secret: ['accessKey', 'secretKey', 'token'] },
      }
      const RELATIONAL_TYPES = new Set(['mysql', 'mariadb', 'postgresql', 'mssql'])
      const DATA_WORKSPACE_TYPES = new Set(['redis', 'elasticsearch', 'mongodb', 'cassandra'])
      const DEFAULT_RESULT_LIMIT = 10

      const OP_META = {
        ssh: ['test', 'listFiles', 'downloadFile', 'uploadFile', 'terminal'],
        ftp: ['test', 'listFiles', 'readFile', 'writeFile', 'deleteFile'],
        redis: ['test', 'info', 'listKeys', 'getKey', 'setKey', 'delKey', 'query'],
        mysql: ['test', 'listDatabases', 'listTables', 'query'],
        mariadb: ['test', 'listDatabases', 'listTables', 'query'],
        postgresql: ['test', 'listDatabases', 'listTables', 'query'],
        mssql: ['test', 'listDatabases', 'listTables', 'query'],
        elasticsearch: ['test', 'listIndices', 'query'],
        docker: ['test', 'listContainers', 'listImages', 'logs', 'start', 'stop', 'exec', 'query'],
        mongodb: ['test', 'listDatabases', 'listCollections', 'find', 'query'],
        cassandra: ['test', 'listKeyspaces', 'listTables', 'query'],
        s3: ['test', 'listBuckets', 'listObjects', 'readObject', 'writeObject', 'deleteObject'],
      }

      const OP_LABEL = {
        test: '测试连接', listFiles: '列出文件', readFile: '读取文件', writeFile: '写入文件', downloadFile: '下载文件', uploadFile: '上传文件', terminal: '远程终端', deleteFile: '删除文件',
        info: '服务器信息', listKeys: '扫描 Key', getKey: '读取 Key', setKey: '写入 Key', delKey: '删除 Key', query: '执行查询',
        listDatabases: '列出数据库', listTables: '列出表', listIndices: '列出索引', listContainers: '列出容器',
        listImages: '列出镜像', logs: '读取日志', start: '启动容器', stop: '停止容器', exec: '容器执行',
        listCollections: '列出集合', find: '查询集合', listKeyspaces: '列出 Keyspace', listBuckets: '列出 Bucket',
        listObjects: '列出对象', readObject: '读取对象', writeObject: '写入对象', deleteObject: '删除对象',
      }

      const SECRET_LABEL = {
        password: '密码', privateKey: '私钥 PEM', accessKey: 'Access Key', secretKey: 'Secret Key', token: 'Session Token',
        proxyPassword: '代理密码', proxyKey: '跳板机私钥 PEM',
      }

      const CSS = `
.dsm-action{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;font:inherit;text-align:left}
.dsm-action:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14))}.dsm-action-icon{width:20px;text-align:center}.dsm-action-label{font-size:12.5px;color:var(--dsw-alias-state-business-primary,#3578e5);font-weight:600}
.dsm-backdrop{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.45);display:flex;align-items:stretch;justify-content:flex-end}
.dsm-center-pane-layer{position:fixed;left:min(var(--dsh-resource-center-left-width,280px),100vw);right:var(--dsh-resource-center-right-width,0px);top:0;bottom:0;z-index:24;display:flex;pointer-events:none}
.dsm-center-pane-grid{--dsm-bg:#fff;--dsm-text:#1c1f26;--dsm-muted:#667085;--dsm-soft:#f6f8fb;--dsm-line:#e5e7eb;--dsm-accent:#3578e5;width:100%;height:100%;min-width:0;box-sizing:border-box;pointer-events:auto;background:var(--dsm-bg);border-left:1px solid var(--dsm-line);color:var(--dsm-text);box-shadow:-12px 0 30px rgba(15,23,42,.04)}
.dsm-center-pane{display:flex;width:100%;height:100%;min-width:0;min-height:0;flex-direction:column;background:var(--dsm-bg);overflow:hidden;color:var(--dsm-text)}
.dsm-center-pane-head{display:flex;align-items:center;gap:8px;flex:0 0 48px;padding:0 calc(12px + var(--dsh-host-toggle-width,0px)) 0 12px;border-bottom:1px solid var(--dsm-line,rgba(128,128,128,.18));background:var(--dsm-bg,#fff)}
.dsm-center-pane-title{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:650}
.dsm-center-pane-kind{flex:0 0 auto;color:var(--dsm-muted,#6b7280);font-size:10px}
.dsm-center-pane-action{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--dsm-muted,#6b7280);cursor:pointer;font-size:15px}
.dsm-center-pane-action:hover{background:var(--dsm-soft,rgba(128,128,128,.07));color:var(--dsm-text,#1c1f26)}
.dsm-center-pane-body{min-width:0;min-height:0;flex:1;overflow:auto;background:var(--dsm-bg)}
@media(max-width:900px){.dsm-center-pane-layer{left:min(var(--dsh-resource-center-left-width,280px),100vw);right:var(--dsh-resource-center-right-width,0px)}}
.dsm-panel{width:min(940px,94vw);height:100%;display:flex;flex-direction:column;background:var(--dsw-specific-sidebar-fill,#17191e);color:var(--dsw-alias-label-primary,#e8e8e8);box-shadow:-8px 0 36px rgba(0,0,0,.42)}
.dsm-head{display:flex;align-items:center;gap:10px;padding:13px 17px;border-bottom:1px solid rgba(128,128,128,.22);flex:0 0 auto}.dsm-title{font-weight:650;font-size:15px;flex:1}.dsm-sub{font-size:11px;opacity:.55}.dsm-btn{border:1px solid rgba(128,128,128,.30);background:var(--dsw-alias-button-secondary-fill,rgba(128,128,128,.12));color:inherit;border-radius:7px;padding:6px 11px;cursor:pointer;font:inherit;font-size:12px}.dsm-btn:hover{background:rgba(128,128,128,.22)}.dsm-btn.primary{background:var(--dsm-accent,#3578e5);border-color:var(--dsm-accent,#3578e5);color:white}.dsm-btn.danger{color:var(--dsw-alias-state-error-primary,#c2413b);border-color:rgba(194,65,59,.36)}.dsm-btn:disabled{opacity:.45;cursor:default}
.dsm-body{display:flex;min-height:0;flex:1}.dsm-list{width:270px;min-width:220px;border-right:1px solid rgba(128,128,128,.2);padding:10px;overflow:auto}.dsm-main{flex:1;min-width:0;overflow:auto;padding:15px 18px}.dsm-card{display:flex;align-items:center;gap:9px;width:100%;padding:9px;margin-bottom:7px;border:1px solid transparent;border-radius:9px;background:rgba(128,128,128,.08);color:inherit;cursor:pointer;text-align:left}.dsm-card:hover,.dsm-card.active{background:rgba(128,128,128,.16);border-color:rgba(53,120,229,.30)}.dsm-card-icon{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(53,120,229,.13);font-size:16px}.dsm-card-copy{min-width:0;flex:1}.dsm-card-name{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dsm-card-meta{font-size:10.5px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dsm-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;background:#44c878}.dsm-dot.bad{background:#ee6a62}
.dsm-empty{padding:28px 12px;text-align:center;opacity:.55;font-size:12px}.dsm-error{color:#bd3d36;background:rgba(194,65,59,.08);border:1px solid rgba(194,65,59,.16);padding:8px 10px;border-radius:7px;font-size:12px;margin-bottom:10px;white-space:pre-wrap}.dsm-section{font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.58;font-weight:650;margin:17px 0 9px}.dsm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px}.dsm-field{min-width:0}.dsm-field.wide{grid-column:1/-1}.dsm-label{display:block;font-size:11px;opacity:.67;margin-bottom:4px}.dsm-input,.dsm-select,.dsm-textarea{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid rgba(128,128,128,.3);border-radius:7px;background:rgba(128,128,128,.09);color:inherit;font:inherit;font-size:12px}.dsm-textarea{min-height:92px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.dsm-input:focus,.dsm-select:focus,.dsm-textarea:focus{outline:none;border-color:var(--dsm-accent,#3578e5)}.dsm-help{font-size:10px;opacity:.48;margin-top:4px;line-height:1.35}.dsm-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:17px}.dsm-operation{border-top:1px solid rgba(128,128,128,.2);margin-top:17px;padding-top:4px}.dsm-result{margin-top:13px;min-height:140px;padding:11px;border-radius:8px;background:rgba(0,0,0,.14);overflow:auto}.dsm-terminal-wrap{margin-top:13px}.dsm-terminal-output{height:300px;overflow:auto;margin:0 0 8px;padding:11px;border-radius:8px;background:#0b0d10;color:#d8e2d4;white-space:pre-wrap;word-break:break-word;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.dsm-terminal-input{min-height:58px}.dsm-pre{margin:0;white-space:pre-wrap;word-break:break-word;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.dsm-table{border-collapse:collapse;width:100%;font-size:11px}.dsm-table th,.dsm-table td{border:1px solid rgba(128,128,128,.22);padding:5px 7px;text-align:left;vertical-align:top;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsm-table th{position:sticky;top:0;background:#202228}.dsm-close{border:0;background:transparent;color:inherit;opacity:.7;cursor:pointer;font-size:17px;padding:3px 7px}.dsm-close:hover{opacity:1}
@media(max-width:700px){.dsm-body{display:block;overflow:auto}.dsm-list{width:auto;border-right:0;border-bottom:1px solid rgba(128,128,128,.2);max-height:220px}.dsm-main{padding:12px}.dsm-grid{grid-template-columns:1fr}.dsm-panel{width:100%}}
.dsm-panel{--dsm-bg:var(--dsw-specific-sidebar-fill,#fff);--dsm-text:var(--dsw-alias-label-primary,#1c1f26);--dsm-muted:var(--dsw-alias-label-secondary,#6b7280);--dsm-soft:rgba(128,128,128,.07);--dsm-line:rgba(128,128,128,.18);--dsm-accent:var(--dsw-alias-state-business-primary,#3578e5);background:var(--dsm-bg);color:var(--dsm-text);border:1px solid var(--dsm-line);border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(15,23,42,.24)}
.dsm-embedded-panel{width:100%;height:100%;min-width:0;border:0;border-radius:0;box-shadow:none}.dsm-embedded-panel .dsm-head{height:58px;padding:0 14px}.dsm-embedded-panel .dsm-body{display:flex;flex-direction:column;overflow:auto}.dsm-embedded-panel .dsm-list{width:auto;min-width:0;max-height:220px;border-right:0;border-bottom:1px solid var(--dsm-line);padding:12px 10px}.dsm-embedded-panel .dsm-main{padding:16px 14px}.dsm-embedded-panel .dsm-grid{grid-template-columns:1fr}.dsm-embedded-panel .dsm-operation-head{align-items:flex-start;flex-wrap:wrap;margin-bottom:18px!important;padding-bottom:14px}.dsm-embedded-panel .dsm-operation-head .dsm-sub{width:100%;margin-left:0}.dsm-embedded-panel .dsm-db-layout{display:block;min-height:0}.dsm-embedded-panel .dsm-db-sidebar{max-height:180px;border-right:0;border-bottom:1px solid var(--dsm-line)}.dsm-embedded-panel .dsm-db-content{padding:12px}
.dsm-center-main{height:100%;box-sizing:border-box;overflow:auto;padding:30px clamp(22px,5vw,72px);background:var(--dsm-bg)}
.dsm-center-main .dsm-operation-head{max-width:980px;margin-left:auto!important;margin-right:auto!important}
.dsm-center-main>.dsm-section,.dsm-center-main>.dsm-grid,.dsm-center-main>.dsm-actions,.dsm-center-main>.dsm-result,.dsm-center-main>.dsm-terminal-wrap,.dsm-center-main>.dsm-notice{max-width:980px;margin-left:auto;margin-right:auto}
.dsm-action{margin:3px 0;padding:9px 11px;border:1px solid transparent;border-radius:10px}.dsm-action:hover{border-color:rgba(53,120,229,.20);background:rgba(53,120,229,.07)}.dsm-action-icon{width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(53,120,229,.11)}.dsm-action-label{color:var(--dsm-accent);font-size:12.5px}
.dsm-backdrop{padding:18px;background:rgba(15,23,42,.34);backdrop-filter:blur(5px)}
.dsm-head{height:68px;box-sizing:border-box;padding:0 20px;background:var(--dsm-bg);border-bottom:1px solid var(--dsm-line)}.dsm-head .dsm-title{font-size:16px;letter-spacing:-.01em}.dsm-head .dsm-sub{padding:4px 8px;border:1px solid var(--dsm-line);border-radius:999px;color:var(--dsm-muted);opacity:1}.dsm-head .dsm-btn.primary{padding:8px 13px;border-radius:9px;box-shadow:0 4px 12px rgba(53,120,229,.20)}.dsm-close{width:30px;height:30px;border-radius:8px}.dsm-close:hover{background:var(--dsm-soft)}
.dsm-body{background:var(--dsm-bg)}.dsm-list{width:284px;min-width:250px;padding:18px 14px;background:var(--dsm-soft);border-right:1px solid var(--dsm-line)}.dsm-list:before{content:'已保存连接';display:block;margin:0 8px 13px;color:var(--dsm-muted);font-size:11px;font-weight:700;letter-spacing:.04em}.dsm-card{gap:11px;padding:11px 10px;margin-bottom:8px;border:1px solid transparent;border-radius:12px;background:transparent;transition:background .16s ease,border-color .16s ease,transform .16s ease}.dsm-card:hover{background:rgba(128,128,128,.10);border-color:var(--dsm-line);transform:translateY(-1px)}.dsm-card.active{background:var(--dsm-bg);border-color:rgba(53,120,229,.30);box-shadow:0 5px 14px rgba(15,23,42,.07)}.dsm-card-icon{width:38px;height:38px;border-radius:11px;background:rgba(53,120,229,.12);font-size:18px}.dsm-card-copy{gap:3px;display:flex;flex-direction:column}.dsm-card-name{font-size:13px;line-height:1.25}.dsm-card-meta{font-size:11px;color:var(--dsm-muted);opacity:1}.dsm-card-meta .dsm-dot{width:7px;height:7px;box-shadow:0 0 0 3px rgba(68,200,120,.12)}.dsm-card-meta .dsm-dot.bad{box-shadow:0 0 0 3px rgba(238,106,98,.12)}.dsm-list>.dsm-help{margin:18px 8px 0!important;padding-top:16px;border-top:1px solid var(--dsm-line);color:var(--dsm-muted);opacity:1;font-size:10.5px}.dsm-main{padding:24px 26px;background:var(--dsm-bg)}
.dsm-operation-head{gap:10px;margin:0 0 25px!important;padding-bottom:18px;border-bottom:1px solid var(--dsm-line)}.dsm-operation-head .dsm-title{font-size:18px;letter-spacing:-.02em}.dsm-operation-head .dsm-sub{margin-left:auto;color:var(--dsm-muted);opacity:1}.dsm-operation-head .dsm-btn:first-child{padding-left:9px;padding-right:9px}.dsm-section{margin:21px 0 10px;color:var(--dsm-muted);font-size:11px;letter-spacing:.08em}.dsm-grid{gap:14px 15px}.dsm-label{margin-bottom:6px;color:var(--dsm-muted);font-size:11px;opacity:1;font-weight:600}.dsm-input,.dsm-select,.dsm-textarea{min-height:40px;padding:9px 11px;border-color:var(--dsm-line);background:var(--dsm-soft);color:var(--dsm-text);border-radius:9px;font-size:12px;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease}.dsm-input:hover,.dsm-select:hover,.dsm-textarea:hover{background:rgba(128,128,128,.10)}.dsm-input:focus,.dsm-select:focus,.dsm-textarea:focus{border-color:rgba(53,120,229,.72);box-shadow:0 0 0 3px rgba(53,120,229,.14)}.dsm-help{color:var(--dsm-muted);opacity:1}.dsm-actions{gap:9px}.dsm-btn{padding:8px 12px;border-color:var(--dsm-line);border-radius:9px;background:var(--dsm-bg);font-size:12px;font-weight:600;transition:background .16s ease,border-color .16s ease,transform .16s ease}.dsm-btn:hover{background:var(--dsm-soft);border-color:rgba(128,128,128,.32);transform:translateY(-1px)}.dsm-btn.primary{background:var(--dsm-accent);border-color:var(--dsm-accent);box-shadow:0 4px 12px rgba(53,120,229,.18)}.dsm-btn.primary:hover{background:#2864c7;border-color:#2864c7}.dsm-error{color:#bd3d36;background:rgba(194,65,59,.08);border:1px solid rgba(194,65,59,.16);padding:10px 12px;border-radius:10px}.dsm-notice{display:flex;align-items:center;gap:8px;margin-bottom:16px}.dsm-notice .dsm-btn{margin-left:auto!important;flex:0 0 auto}.dsm-result{min-height:165px;margin-top:16px;padding:0;border:1px solid var(--dsm-line);background:var(--dsm-soft);border-radius:12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}.dsm-result-empty{min-height:165px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--dsm-muted)}.dsm-empty-icon{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:rgba(53,120,229,.11);color:var(--dsm-accent);font-size:18px}.dsm-empty-title{color:var(--dsm-text);font-size:12px;font-weight:650}.dsm-empty-copy{font-size:11px}.dsm-pre{padding:14px}.dsm-table{font-size:11px}.dsm-table th{background:var(--dsm-soft);color:var(--dsm-muted)}.dsm-table th,.dsm-table td{border-color:var(--dsm-line)}.dsm-terminal-output{border:1px solid rgba(0,0,0,.24);border-radius:11px;box-shadow:inset 0 1px 8px rgba(0,0,0,.20)}
.dsm-form-title{display:block;padding-bottom:18px;margin-bottom:24px;border-bottom:1px solid var(--dsm-line);font-size:18px;letter-spacing:-.02em}
.dsm-data-editor{min-height:150px}.dsm-doc-table{min-width:100%;border-collapse:collapse;font-size:11px}.dsm-doc-table th,.dsm-doc-table td{border:1px solid var(--dsm-line);padding:6px 8px;max-width:300px;text-align:left;vertical-align:top;white-space:pre-wrap;word-break:break-word}.dsm-doc-table th{position:sticky;top:0;background:var(--dsm-soft);color:var(--dsm-muted);white-space:nowrap}.dsm-db-sidebar .dsm-select{min-height:34px;margin:0 0 7px;padding:7px 8px;font-size:11px}.dsm-kv-title{display:flex;align-items:center;gap:8px;margin:14px 0 7px;color:var(--dsm-muted);font-size:11px;font-weight:700}.dsm-kv-title span{flex:1}.dsm-data-result{min-height:260px}
.dsm-ssh-overview{margin:0 0 18px;padding:14px;border:1px solid var(--dsm-line);border-radius:12px;background:var(--dsm-soft)}.dsm-ssh-overview-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.dsm-ssh-overview-copy{min-width:0;flex:1}.dsm-ssh-overview-title{color:var(--dsm-text);font-size:13px;font-weight:700}.dsm-ssh-overview-sub{margin-top:3px;color:var(--dsm-muted);font-size:10px}.dsm-ssh-overview-status{display:inline-flex;align-items:center;gap:5px;color:var(--dsm-muted);font-size:10px;white-space:nowrap}.dsm-ssh-status-dot{width:7px;height:7px;border-radius:50%;background:#2dbb78}.dsm-ssh-status-dot.busy{background:#3578e5;box-shadow:0 0 0 3px rgba(53,120,229,.13)}.dsm-ssh-overview-refresh{padding:6px 9px;font-size:11px}.dsm-ssh-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.dsm-ssh-metric{min-width:0;padding:10px;border:1px solid var(--dsm-line);border-radius:9px;background:var(--dsm-bg)}.dsm-ssh-metric-label{color:var(--dsm-muted);font-size:10px}.dsm-ssh-metric-value{margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsm-text);font-size:16px;font-weight:700;font-variant-numeric:tabular-nums}.dsm-ssh-metric-detail{margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsm-muted);font-size:10px}.dsm-ssh-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}.dsm-ssh-detail{min-width:0;padding:9px 10px;border-radius:8px;background:var(--dsm-bg)}.dsm-ssh-detail-label{color:var(--dsm-muted);font-size:10px}.dsm-ssh-detail-value{margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsm-text);font-size:11px}.dsm-ssh-ports{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.dsm-ssh-port{padding:3px 7px;border:1px solid rgba(53,120,229,.2);border-radius:999px;background:rgba(53,120,229,.07);color:var(--dsm-accent);font-size:10px;font-variant-numeric:tabular-nums}.dsm-ssh-error{margin-bottom:9px;padding:7px 9px;border-radius:7px;background:rgba(194,65,59,.08);color:#bd3d36;font-size:10px}
.dsm-ssh-workspace-tabs{display:flex;align-items:center;gap:4px;margin:0 0 14px;padding:4px;border:1px solid var(--dsm-line);border-radius:10px;background:var(--dsm-soft)}.dsm-ssh-workspace-tab{padding:7px 12px;border:0;border-radius:7px;background:transparent;color:var(--dsm-muted);font:inherit;font-size:11px;font-weight:650;cursor:pointer}.dsm-ssh-workspace-tab:hover{color:var(--dsm-text);background:rgba(128,128,128,.08)}.dsm-ssh-workspace-tab.active{background:var(--dsm-bg);color:var(--dsm-accent);box-shadow:0 2px 7px rgba(15,23,42,.08)}
.dsm-ssh-file-layout{display:grid;grid-template-columns:218px minmax(0,1fr);min-height:500px;border:1px solid var(--dsm-line);border-radius:13px;overflow:hidden;background:var(--dsm-soft)}.dsm-ssh-file-tree{min-width:0;padding:12px 8px;border-right:1px solid var(--dsm-line);overflow:auto;background:rgba(128,128,128,.035)}.dsm-ssh-file-tree-head{display:flex;align-items:center;gap:6px;padding:2px 7px 9px;color:var(--dsm-muted);font-size:11px;font-weight:700}.dsm-ssh-file-tree-head span{flex:1}.dsm-ssh-tree-node{display:flex;align-items:center;gap:4px;width:100%;min-width:0;padding:6px 6px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--dsm-text);font:inherit;font-size:11px;text-align:left;cursor:pointer}.dsm-ssh-tree-node:hover{background:rgba(128,128,128,.10)}.dsm-ssh-tree-node.active{border-color:rgba(53,120,229,.24);background:rgba(53,120,229,.09);color:var(--dsm-accent);font-weight:650}.dsm-ssh-tree-chevron{width:13px;flex:0 0 13px;color:var(--dsm-muted);text-align:center;font-size:10px}.dsm-ssh-tree-icon{width:18px;flex:0 0 18px;text-align:center}.dsm-ssh-tree-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsm-ssh-file-main{min-width:0;display:flex;flex-direction:column;background:var(--dsm-bg)}.dsm-ssh-file-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px;border-bottom:1px solid var(--dsm-line);background:var(--dsm-bg)}.dsm-ssh-file-toolbar .dsm-btn{padding:6px 9px;font-size:11px}.dsm-ssh-path-input{flex:1 1 180px;min-width:100px;height:34px;padding:7px 9px;border:1px solid var(--dsm-line);border-radius:8px;background:var(--dsm-soft);color:var(--dsm-text);font:inherit;font-size:11px}.dsm-ssh-path-input:focus{outline:none;border-color:rgba(53,120,229,.72);box-shadow:0 0 0 3px rgba(53,120,229,.12)}.dsm-ssh-file-table-wrap{min-width:0;flex:1;overflow:auto}.dsm-ssh-file-table{width:100%;min-width:560px;border-collapse:collapse;font-size:11px}.dsm-ssh-file-table th,.dsm-ssh-file-table td{padding:9px 10px;border-bottom:1px solid var(--dsm-line);text-align:left;white-space:nowrap}.dsm-ssh-file-table th{position:sticky;top:0;z-index:1;background:var(--dsm-soft);color:var(--dsm-muted);font-size:10px;font-weight:700}.dsm-ssh-file-table tbody tr{cursor:default}.dsm-ssh-file-table tbody tr:hover{background:rgba(53,120,229,.055)}.dsm-ssh-file-name{display:flex;align-items:center;gap:8px;min-width:180px;max-width:430px}.dsm-ssh-file-name-icon{width:20px;flex:0 0 20px;text-align:center;font-size:15px}.dsm-ssh-file-name-text{min-width:0;overflow:hidden;text-overflow:ellipsis}.dsm-ssh-file-muted{color:var(--dsm-muted)}.dsm-ssh-file-footer{padding:9px 11px;border-top:1px solid var(--dsm-line);color:var(--dsm-muted);font-size:10px}.dsm-ssh-file-state{padding:24px 14px;text-align:center;color:var(--dsm-muted);font-size:11px}.dsm-ssh-file-error{margin:10px;padding:8px 10px;border-radius:8px;background:rgba(194,65,59,.08);color:#bd3d36;font-size:11px}.dsm-ssh-context-backdrop{position:fixed;inset:0;z-index:3600}.dsm-ssh-context-menu{position:fixed;min-width:130px;padding:4px;border:1px solid var(--dsm-line);border-radius:8px;background:var(--dsm-bg);box-shadow:0 10px 26px rgba(15,23,42,.18)}.dsm-ssh-context-menu button{display:block;width:100%;padding:7px 10px;border:0;border-radius:5px;background:transparent;color:var(--dsm-text);font:inherit;font-size:11px;text-align:left;cursor:pointer}.dsm-ssh-context-menu button:hover{background:var(--dsm-soft)}.dsm-ssh-upload-input{display:none}.dsm-ssh-terminal-panel{min-height:500px;padding:12px;border:1px solid var(--dsm-line);border-radius:13px;background:var(--dsm-soft)}.dsm-ssh-terminal-panel .dsm-terminal-output{height:390px;background:#101318}.dsm-ssh-editor-backdrop{position:fixed;inset:0;z-index:3700;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,23,42,.34);backdrop-filter:blur(3px)}.dsm-ssh-editor{display:flex;flex-direction:column;width:min(980px,94vw);height:min(700px,90vh);border:1px solid var(--dsm-line);border-radius:14px;background:var(--dsm-bg);box-shadow:0 24px 70px rgba(15,23,42,.24);overflow:hidden}.dsm-ssh-editor-head,.dsm-ssh-editor-foot{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--dsm-line)}.dsm-ssh-editor-foot{justify-content:flex-end;border-top:1px solid var(--dsm-line);border-bottom:0}.dsm-ssh-editor-title{min-width:0;flex:1;font-size:13px;font-weight:700}.dsm-ssh-editor-body{min-height:0;flex:1;padding:0;background:#fbfcfe}.dsm-ssh-editor-textarea{width:100%;height:100%;padding:16px;border:0;outline:0;resize:none;background:transparent;color:var(--dsm-text);font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;tab-size:2}
.dsm-db-layout{display:grid;grid-template-columns:218px minmax(0,1fr);min-height:520px;border:1px solid var(--dsm-line);border-radius:13px;overflow:hidden;background:var(--dsm-soft)}.dsm-db-sidebar{min-width:0;padding:13px 10px;border-right:1px solid var(--dsm-line);background:rgba(128,128,128,.045);overflow:auto}.dsm-db-sidebar-head{display:flex;align-items:center;gap:7px;padding:2px 5px 10px;color:var(--dsm-muted);font-size:11px;font-weight:700;letter-spacing:.05em}.dsm-db-sidebar-head span{flex:1}.dsm-db-icon-btn{width:25px;height:25px;padding:0;border:1px solid var(--dsm-line);border-radius:7px;background:var(--dsm-bg);color:var(--dsm-muted);cursor:pointer}.dsm-db-icon-btn:hover{color:var(--dsm-text);background:var(--dsm-soft)}.dsm-db-node{display:flex;align-items:center;gap:6px;width:100%;padding:7px 8px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsm-text);font:inherit;font-size:11.5px;text-align:left;cursor:pointer}.dsm-db-node:hover{background:rgba(128,128,128,.10)}.dsm-db-node.active{border-color:rgba(53,120,229,.26);background:rgba(53,120,229,.09);color:var(--dsm-accent);font-weight:650}.dsm-db-node span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsm-db-node-icon{width:17px;text-align:center;flex:0 0 17px}.dsm-db-group{margin:9px 0 0;padding-top:9px;border-top:1px solid var(--dsm-line)}.dsm-db-group-title{padding:0 8px 5px;color:var(--dsm-muted);font-size:10px;font-weight:700}.dsm-db-content{min-width:0;padding:15px;background:var(--dsm-bg);overflow:auto}.dsm-db-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:12px}.dsm-db-toolbar .dsm-select{flex:1;min-width:0}.dsm-db-title{font-size:12px;font-weight:700}.dsm-db-query-head{display:flex;align-items:center;gap:8px;margin:15px 0 7px;color:var(--dsm-muted);font-size:11px;font-weight:700}.dsm-db-query-head span{flex:1}.dsm-db-query{min-height:130px;margin:0;font-size:12px;line-height:1.55}.dsm-db-result{min-height:220px;margin-top:13px}.dsm-db-result .dsm-table{min-width:100%;white-space:nowrap}.dsm-db-result .dsm-pre{max-height:360px;overflow:auto}
@media(max-width:700px){.dsm-backdrop{padding:0}.dsm-panel{width:100%;height:100%;border:0;border-radius:0}.dsm-main{padding:17px}.dsm-center-main{padding:20px 16px}.dsm-operation-head .dsm-sub{width:100%;margin-left:0}.dsm-operation-head{align-items:flex-start}.dsm-list{padding:14px}.dsm-list:before{margin-bottom:8px}}
@media(max-width:820px){.dsm-db-layout{grid-template-columns:180px minmax(0,1fr)}.dsm-ssh-file-layout{grid-template-columns:180px minmax(0,1fr)}.dsm-ssh-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.dsm-db-layout{display:block}.dsm-db-sidebar{max-height:230px;border-right:0;border-bottom:1px solid var(--dsm-line)}.dsm-db-content{padding:12px}.dsm-ssh-file-layout{display:block}.dsm-ssh-file-tree{max-height:220px;border-right:0;border-bottom:1px solid var(--dsm-line)}.dsm-ssh-metric-grid{grid-template-columns:1fr}.dsm-ssh-detail-grid{grid-template-columns:1fr}.dsm-ssh-overview-head{align-items:flex-start;flex-wrap:wrap}}
.dsm-embedded-panel .dsm-head{gap:5px;padding:0 7px}
.dsm-embedded-panel .dsm-head .dsm-title{flex:0 1 auto;min-width:0;font-size:13px;white-space:nowrap}
.dsm-embedded-panel .dsm-head .dsm-sub{padding:3px 5px;border:1px solid var(--dsm-line);border-radius:999px;font-size:9px;opacity:1}
.dsm-embedded-panel .dsm-head .dsm-btn.primary{padding:7px 7px;font-size:10px;white-space:nowrap}
.dsm-embedded-panel .dsm-head .dsm-close{width:24px;min-width:24px;padding:0;flex:0 0 24px}
.dsm-center-main .dsm-btn.primary{background:var(--dsm-accent);border-color:var(--dsm-accent);color:#fff}
.dsm-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:32px;line-height:1;white-space:nowrap;user-select:none;transition:background .16s ease,border-color .16s ease,color .16s ease,box-shadow .16s ease,transform .16s ease}.dsm-btn:focus-visible,.dsm-close:focus-visible,.dsm-ssh-workspace-tab:focus-visible,.dsm-db-icon-btn:focus-visible{outline:2px solid rgba(53,120,229,.55);outline-offset:2px}.dsm-btn.primary{background:linear-gradient(180deg,#3c83ee,#3578e5);box-shadow:0 3px 8px rgba(53,120,229,.18)}.dsm-btn.primary:hover{transform:translateY(-1px);box-shadow:0 5px 12px rgba(53,120,229,.24)}.dsm-btn.danger:hover{background:rgba(194,65,59,.08)}.dsm-btn:active{transform:translateY(0)}.dsm-btn:disabled{box-shadow:none;transform:none}.dsm-embedded-panel .dsm-head{gap:7px;padding:0 11px}.dsm-embedded-panel .dsm-head .dsm-title{font-size:12.5px}.dsm-embedded-panel .dsm-head .dsm-sub{font-size:9.5px;color:var(--dsm-muted);background:var(--dsm-soft)}.dsm-embedded-panel .dsm-head .dsm-btn.primary{min-height:30px;padding:7px 10px;font-size:11px;box-shadow:0 2px 7px rgba(53,120,229,.18)}.dsm-card{position:relative;min-height:62px}.dsm-card .dsm-sub{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;color:var(--dsm-muted);font-size:16px}.dsm-card:hover .dsm-sub,.dsm-card.active .dsm-sub{color:var(--dsm-accent);background:rgba(53,120,229,.08)}.dsm-ssh-terminal-panel>.dsm-actions{min-height:38px;margin-top:0;padding:3px 2px}.dsm-ssh-terminal-panel>.dsm-actions .dsm-btn{min-width:112px}
.dsm-embedded-panel .dsm-body{min-height:0;overflow:hidden}.dsm-embedded-panel .dsm-list{max-height:none;min-height:0;flex:1;display:flex;flex-direction:column;overflow:auto;padding-bottom:8px}.dsm-embedded-panel .dsm-list>.dsm-help{flex:0 0 auto;margin: auto 8px 0!important;padding:12px 0 2px;border-top:1px solid var(--dsm-line);line-height:1.45}
.dsm-embedded-panel .dsm-card{gap:8px;min-height:0;padding:8px;margin-bottom:5px;border-radius:9px}.dsm-embedded-panel .dsm-card-icon{width:30px;height:30px;border-radius:8px;font-size:15px}.dsm-embedded-panel .dsm-card-copy{gap:2px}.dsm-embedded-panel .dsm-card-name{font-size:12px;line-height:1.2}.dsm-embedded-panel .dsm-card-meta{font-size:10px}.dsm-embedded-panel .dsm-card-meta .dsm-dot{width:6px;height:6px;margin-right:4px;box-shadow:0 0 0 2px rgba(68,200,120,.12)}.dsm-embedded-panel .dsm-card-meta .dsm-dot.bad{box-shadow:0 0 0 2px rgba(238,106,98,.12)}.dsm-embedded-panel .dsm-card .dsm-sub{width:18px;height:18px;font-size:13px}
.dsm-embedded-panel .dsm-head .dsm-title{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis}.dsm-embedded-panel .dsm-head .dsm-sub{flex:0 0 auto;white-space:nowrap;line-height:1.2}
.dsm-embedded-panel .dsm-head{gap:4px;padding:0 8px}.dsm-embedded-panel .dsm-head .dsm-sub{padding:3px 4px;font-size:8.5px}.dsm-embedded-panel .dsm-head .dsm-btn.primary{padding:7px;font-size:10px}
`

      function installStyle() {
        if (typeof document === 'undefined' || document.querySelector('style[data-plugin="dsh-service-manage"]')) return
        const style = document.createElement('style')
        style.dataset.plugin = 'dsh-service-manage'
        style.textContent = CSS
        document.head.appendChild(style)
      }

      function apiRequest(body, signal) {
        return fetch('/api/dsh-service-manage', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal,
        }).then(async response => {
          const payload = await response.json().catch(() => ({}))
          if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`)
          return payload
        })
      }

      function typeLabel(type) { return TYPE_META[type]?.label || type }
      function normalizeTerminalText(value) {
        return String(value ?? '')
          .replace(/\\u001b/gi, '\x1b')
          .replace(/\\x1b/gi, '\x1b')
          .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
          .replace(/\x1b(?:P|X|\^|_|\x90|\x98|\x9e|\x9f)[\s\S]*?(?:\x1b\\|$)/g, '')
          .replace(/(?:\x1b\[[0-?]*[ -/]*[@-~]|\x1b[()][0-2A-Z]|\x1b.|\x9b[0-?]*[ -/]*[@-~])/g, '')
          .replace(/\r\n  /g, '\n  ')
          .replace(/\r/g, '\n  ')
          .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, character => character === '\t' ? '\t' : '')
      }
      function credentialIssue(connection) {
        const secrets = connection.secrets || {}
        if (connection.type === 'ssh') {
          const field = connection.authMode === 'key' ? 'privateKey' : 'password'
          return secrets[field] ? '' : (field === 'privateKey' ? '私钥 PEM' : '密码')
        }
        if (connection.type === 's3') {
          if (Boolean(secrets.accessKey) !== Boolean(secrets.secretKey)) return 'Access Key 和 Secret Key'
          return ''
        }
        if (connection.username && TYPE_META[connection.type]?.secret.includes('password') && !secrets.password) return '密码'
        return ''
      }
      function missingCredential(connection) {
        return Boolean(credentialIssue(connection))
      }
      function clone(value) { return JSON.parse(JSON.stringify(value)) }

      const serverByAlias = new Map()
      const serverById = new Map()
      const serverLexiconListeners = new Set()
      let serverCatalogPromise = null
      let serverCatalogExpiresAt = 0

      function serverAlias(connection, used = new Set()) {
        const name = String(connection.name || '').trim()
        const base = /^[A-Za-z0-9_-]+$/.test(name) ? name : String(connection.id)
        if (!used.has(base)) return base
        const suffix = String(connection.id || 'connection')
        let alias = `${base}_${suffix}`
        let index = 2
        while (used.has(alias)) alias = `${base}_${suffix}_${index++}`
        return alias
      }

      function escapeXml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character])
      }

      function cacheServers(connections) {
        serverByAlias.clear()
        serverById.clear()
        const used = new Set()
        for (const connection of connections || []) {
          const alias = serverAlias(connection, used)
          used.add(alias)
          const item = { ...connection, alias }
          serverByAlias.set(alias, item)
          serverById.set(String(connection.id), item)
        }
        for (const listener of serverLexiconListeners) listener()
        return [...serverByAlias.values()]
      }

      function refreshServers(force = false) {
        if (!force && Date.now() < serverCatalogExpiresAt) return Promise.resolve([...serverByAlias.values()])
        if (serverCatalogPromise) return serverCatalogPromise
        serverCatalogPromise = apiRequest({ op: 'list' }).then(payload => {
          serverCatalogExpiresAt = Date.now() + 3000
          return cacheServers(payload.connections || [])
        }).finally(() => { serverCatalogPromise = null })
        return serverCatalogPromise
      }

      function serverReferenceMarkup(connection) {
        const endpoint = connection.host ? `${connection.host}${connection.port ? ':' + connection.port : ''}` : '本机'
        const cached = serverById.get(String(connection.id))
        const alias = connection.alias || cached?.alias || serverAlias(connection, new Set(serverByAlias.keys()))
        return `<dsh-server-ref id="${escapeXml(connection.id)}" name="${escapeXml(connection.name)}" alias="${escapeXml(alias)}" type="${escapeXml(connection.type)}" transport="service-manager" tool="dsh_server_manage" credential-scope="dsh-credentials" endpoint="${escapeXml(endpoint)}" database="${escapeXml(connection.database || '')}" />`
      }

      function createServerInputSource() {
        const source = {
          trigger: '@',
          name: '服务连接',
          order: 30,
          async candidates(_session, { query, signal }) {
            const servers = await refreshServers()
            if (signal.aborted) return []
            const needle = String(query || '').toLowerCase()
            return servers
              .filter(connection => connection.alias.toLowerCase().startsWith(needle) || String(connection.name || '').toLowerCase().includes(needle))
              .map(connection => ({
                name: connection.alias,
                description: `${typeLabel(connection.type)} · ${connection.host || '本机'}${connection.port ? ':' + connection.port : ''}`,
                icon: TYPE_META[connection.type]?.icon || '🔌',
                hint: '服务管理通道',
              }))
          },
          warm() { void refreshServers().catch(() => {}) },
          lexicon() { return serverByAlias.size ? [...serverByAlias.keys()] : undefined },
          subscribeLexicon(_session, listener) {
            serverLexiconListeners.add(listener)
            return () => serverLexiconListeners.delete(listener)
          },
          matchSpace(_session, token) {
            const connection = serverByAlias.get(String(token).slice(1))
            if (!connection) return undefined
            return { insert: { source: '服务连接', ref: String(connection.id), label: connection.name, clipboardText: `@${connection.alias}` } }
          },
          onPick({ candidate }) {
            const connection = serverByAlias.get(candidate.name)
            if (!connection) return undefined
            return { insert: { source: '服务连接', ref: String(connection.id), label: connection.name, clipboardText: `@${connection.alias}` } }
          },
          codec: {
            clipboardText(ref) {
              const connection = serverById.get(String(ref))
              return `@${connection?.alias || ref}`
            },
            async serialize(ref, signal) {
              const payload = await apiRequest({ op: 'reference', id: String(ref) }, signal)
              const cached = serverById.get(String(payload.connection.id))
              const used = new Set([...serverByAlias.entries()].filter(([, item]) => String(item.id) !== String(payload.connection.id)).map(([alias]) => alias))
              const connection = { ...payload.connection, alias: cached?.alias || serverAlias(payload.connection, used) }
              serverByAlias.set(connection.alias, connection)
              serverById.set(String(connection.id), connection)
              return serverReferenceMarkup(connection)
            },
          },
        }
        return source
      }

      function downloadBase64(base64, filename) {
        if (typeof document === 'undefined' || typeof atob !== 'function') return
        const raw = atob(base64 || '')
        const bytes = Uint8Array.from(raw, character => character.charCodeAt(0))
        const blob = new Blob([bytes], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = filename || 'download.bin'
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url), 0)
      }
      function remoteJoin(parent, name) {
        const base = String(parent || '/').replace(/\/+$/, '') || '/'
        const child = String(name || '').replace(/^\/+/, '')
        return base === '/' ? `/${child}` : `${base}/${child}`
      }
      function remoteDirectoryPath(value) {
        const text = String(value || '/').trim()
        if (!text.startsWith('/')) return '/'
        const normalized = text.replace(/\/+/g, '/').replace(/\/\.\/?/g, '/').replace(/\/\/{2,}/g, '/')
        return normalized.length > 1 ? normalized.replace(/\/$/, '') : '/'
      }
      function normalizeSshEntry(item, parent) {
        const name = String(item?.filename || item?.name || item?.path || '').trim()
        const longname = String(item?.longname || '')
        const attrs = item?.attrs || {}
        const isDirectory = Boolean(item?.isDirectory || item?.type === 'directory' || attrs.isDirectory === true || longname.startsWith('d'))
        return {
          name: name || '(未命名)',
          path: remoteJoin(parent, name),
          isDirectory,
          size: Number(attrs.size ?? item?.size ?? 0) || 0,
          mode: longname.split(/\s+/)[0] || String(item?.mode || '—'),
          mtime: Number(attrs.mtime ?? item?.mtime ?? 0) || 0,
        }
      }
      function formatRemoteTime(value) {
        const timestamp = Number(value)
        if (!timestamp) return '—'
        const date = new Date(timestamp * 1000)
        return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
      }
      function decodeBase64Text(value) {
        if (typeof atob !== 'function') return ''
        const raw = atob(String(value || ''))
        const bytes = Uint8Array.from(raw, character => character.charCodeAt(0))
        try { return new TextDecoder().decode(bytes) } catch { return String.fromCharCode(...bytes) }
      }
      function blankConnection(type = 'ssh') {
        const meta = TYPE_META[type]
        return { id: '', name: '', type, host: '', port: meta.port, username: '', database: '', authMode: 'password', options: { compatibility: 'auto', apiVersion: '', ssl: false, scheme: type === 's3' ? 'https' : 'http', proxy: { type: 'none' } } }
      }

      function Field({ label, value, onChange, wide, type = 'text', placeholder, help }) {
        return h('div', { className: 'dsm-field' + (wide ? ' wide' : '') },
          h('label', { className: 'dsm-label' }, label),
          h('input', { className: 'dsm-input', type, value: value == null ? '' : value, placeholder, onChange: event => onChange(event.target.value) }),
          help ? h('div', { className: 'dsm-help' }, help) : null,
        )
      }

      function SecretField({ label, value, onChange, wide, multiline }) {
        const common = { className: multiline ? 'dsm-textarea' : 'dsm-input', value: value || '', placeholder: '已保存时留空表示保持不变', onChange: event => onChange(event.target.value) }
        return h('div', { className: 'dsm-field' + (wide ? ' wide' : '') }, h('label', { className: 'dsm-label' }, label), multiline ? h('textarea', common) : h('input', { ...common, type: 'password' }))
      }

      function ProxyFields({ proxy, setProxy, secrets, setSecret, touched, touch }) {
        const type = proxy?.type || 'none'
        return h(React.Fragment, null,
          h('div', { className: 'dsm-grid' },
            h('div', { className: 'dsm-field' }, h('label', { className: 'dsm-label' }, '代理模式'), h('select', { className: 'dsm-select', value: type, onChange: event => setProxy({ type: event.target.value }) },
              h('option', { value: 'none' }, '不使用代理'), h('option', { value: 'ssh' }, 'SSH 隧道'), h('option', { value: 'tcp' }, 'TCP 原始转发'), h('option', { value: 'socks5' }, 'SOCKS5 转发'),
            )),
            type !== 'none' ? h(Field, { label: type === 'ssh' ? '跳板机地址' : '代理地址', value: proxy.host || '', onChange: value => setProxy({ ...proxy, host: value }), placeholder: '127.0.0.1' }) : null,
            type !== 'none' ? h(Field, { label: '代理端口', value: proxy.port || '', onChange: value => setProxy({ ...proxy, port: value }), type: 'number' }) : null,
            type === 'ssh' ? h(Field, { label: '跳板机用户', value: proxy.username || '', onChange: value => setProxy({ ...proxy, username: value }), placeholder: 'root' }) : null,
            type === 'socks5' ? h(Field, { label: 'SOCKS5 用户名', value: proxy.username || '', onChange: value => setProxy({ ...proxy, username: value }) }) : null,
            (type === 'ssh' || type === 'socks5') ? h(SecretField, { label: type === 'ssh' ? '跳板机密码' : '代理密码', value: secrets.proxyPassword, onChange: value => { touch('proxyPassword'); setSecret('proxyPassword', value) } }) : null,
            type === 'ssh' ? h(SecretField, { label: '跳板机私钥', value: secrets.proxyKey, onChange: value => { touch('proxyKey'); setSecret('proxyKey', value) }, wide: true, multiline: true }) : null,
          ),
        )
      }

      function ConnectionForm({ value, onCancel, onSaved, api }) {
        const [form, setForm] = useState(() => clone(value))
        const [secrets, setSecrets] = useState({})
        const [touched, setTouched] = useState({})
        const [error, setError] = useState('')
        const [busy, setBusy] = useState(false)
        const type = form.type
        const meta = TYPE_META[type]
        const set = (key, next) => setForm(current => ({ ...current, [key]: next }))
        const setOption = (key, next) => setForm(current => ({ ...current, options: { ...(current.options || {}), [key]: next } }))
        const setProxy = proxy => setOption('proxy', proxy)
        const touch = key => setTouched(current => ({ ...current, [key]: true }))
        const setSecret = (key, next) => setSecrets(current => ({ ...current, [key]: next }))
        const changeType = next => {
          const nextMeta = TYPE_META[next]
          setForm(current => ({ ...current, type: next, port: nextMeta.port, database: next === 's3' ? '' : current.database }))
        }
        const save = () => {
          setBusy(true); setError('')
          const selectedSecrets = {}
          for (const key of Object.keys(touched)) if (touched[key]) selectedSecrets[key] = secrets[key] || ''
          api({ op: 'save', connection: form, secrets: selectedSecrets }).then(result => {
            if (result.warnings?.length) throw new Error(`凭据写入失败：${result.warnings.join('；')}`)
            onSaved(result.connection)
          }).catch(error => setError(error.message)).finally(() => setBusy(false))
        }
        return h(React.Fragment, null,
          h('div', { className: 'dsm-title dsm-form-title' }, value.id ? '编辑连接' : '新建连接'),
          error ? h('div', { className: 'dsm-error' }, error) : null,
          h('div', { className: 'dsm-section' }, '基本信息'),
          h('div', { className: 'dsm-grid' },
            h(Field, { label: '连接名称', value: form.name, onChange: value => set('name', value), placeholder: '例如：生产 Redis' }),
            h('div', { className: 'dsm-field' }, h('label', { className: 'dsm-label' }, '服务类型'), h('select', { className: 'dsm-select', value: type, onChange: event => changeType(event.target.value) }, Object.entries(TYPE_META).map(([key, item]) => h('option', { key, value: key }, item.label)))),
            h(Field, { label: '服务器地址', value: form.host, onChange: value => set('host', value), placeholder: type === 'docker' ? '留空使用本机 Docker' : 'db.example.com' }),
            h(Field, { label: '端口', value: form.port, onChange: value => set('port', value), type: 'number', help: type === 'docker' || type === 's3' ? '可为 0；S3 也可使用 endpoint' : '' }),
            type !== 's3' && type !== 'docker' ? h(Field, { label: '用户名', value: form.username, onChange: value => set('username', value) }) : null,
            type !== 's3' && type !== 'docker' ? h(Field, { label: type === 'redis' ? 'Redis DB 编号' : RELATIONAL_TYPES.has(type) ? '默认数据库（可选）' : '数据库 / Keyspace', value: form.database, onChange: value => set('database', value), type: type === 'redis' ? 'number' : 'text', placeholder: type === 'redis' ? '0' : RELATIONAL_TYPES.has(type) ? '不填也可在工作区选择' : '', help: RELATIONAL_TYPES.has(type) ? '连接后可从数据库树切换当前数据库。' : '' }) : null,
          ),
          h('div', { className: 'dsm-section' }, '认证密钥'),
          h('div', { className: 'dsm-grid' },
            h('div', { className: 'dsm-field' }, h('label', { className: 'dsm-label' }, '连接方式'), h('select', { className: 'dsm-select', value: type === 'ssh' ? (form.authMode || 'password') : 'password', onChange: event => set('authMode', event.target.value) }, h('option', { value: 'password' }, type === 's3' ? 'Access Key / Secret Key' : '密码'), type === 'ssh' ? h('option', { value: 'key' }, '私钥 PEM') : null)),
            meta.secret.includes('password') ? h(SecretField, { label: '密码', value: secrets.password, onChange: value => { touch('password'); setSecret('password', value) } }) : null,
            type === 'ssh' ? h(SecretField, { label: 'SSH 私钥 PEM', value: secrets.privateKey, onChange: value => { touch('privateKey'); setSecret('privateKey', value) }, wide: true, multiline: true }) : null,
            type === 's3' ? h(SecretField, { label: 'Access Key', value: secrets.accessKey, onChange: value => { touch('accessKey'); setSecret('accessKey', value) } }) : null,
            type === 's3' ? h(SecretField, { label: 'Secret Key', value: secrets.secretKey, onChange: value => { touch('secretKey'); setSecret('secretKey', value) } }) : null,
            type === 's3' ? h(SecretField, { label: 'Session Token', value: secrets.token, onChange: value => { touch('token'); setSecret('token', value) } }) : null,
          ),
          h('div', { className: 'dsm-section' }, '连接选项与版本兼容'),
          h('div', { className: 'dsm-grid' },
            h('div', { className: 'dsm-field' }, h('label', { className: 'dsm-label' }, '兼容模式'), h('select', { className: 'dsm-select', value: form.options?.compatibility || 'auto', onChange: event => setOption('compatibility', event.target.value) }, h('option', { value: 'auto' }, '自动'), h('option', { value: 'legacy' }, '旧版客户端 / API'), h('option', { value: 'modern' }, '新版客户端 / API'))),
            h(Field, { label: 'API / Client 版本（可选）', value: form.options?.apiVersion || '', onChange: value => setOption('apiVersion', value), placeholder: '例如：7、8、1.43' }),
            type === 'elasticsearch' ? h('div', { className: 'dsm-field' }, h('label', { className: 'dsm-label' }, '协议'), h('select', { className: 'dsm-select', value: form.options?.scheme || 'http', onChange: event => setOption('scheme', event.target.value) }, h('option', { value: 'http' }, 'HTTP'), h('option', { value: 'https' }, 'HTTPS'))) : null,
            ['ftp', 'redis', 'mysql', 'mariadb', 'postgresql', 'mssql', 'mongodb', 'cassandra'].includes(type) ? h('label', { className: 'dsm-label', style: { alignSelf: 'end', paddingBottom: 7 } }, h('input', { type: 'checkbox', checked: Boolean(form.options?.ssl), onChange: event => setOption('ssl', event.target.checked) }), ' 启用 TLS / SSL') : null,
            type === 's3' ? h(Field, { label: 'Endpoint（可选）', value: form.options?.endpoint || '', onChange: value => setOption('endpoint', value), placeholder: 'https://minio.example.com', wide: true }) : null,
            type === 's3' ? h(Field, { label: 'Region', value: form.options?.region || '', onChange: value => setOption('region', value), placeholder: 'us-east-1' }) : null,
            type === 's3' ? h(Field, { label: '默认 Bucket', value: form.options?.bucket || '', onChange: value => setOption('bucket', value) }) : null,
            type === 'docker' ? h(Field, { label: 'Docker Host / Context', value: form.options?.dockerHost || form.options?.context || '', onChange: value => setOption('dockerHost', value), placeholder: 'unix:///var/run/docker.sock' }) : null,
            type === 'mongodb' ? h(Field, { label: '认证数据库', value: form.options?.authDatabase || 'admin', onChange: value => setOption('authDatabase', value) }) : null,
            type === 'cassandra' ? h(Field, { label: 'Keyspace', value: form.options?.keyspace || '', onChange: value => setOption('keyspace', value) }) : null,
            type === 'cassandra' ? h(Field, { label: 'Local Datacenter', value: form.options?.localDataCenter || 'datacenter1', onChange: value => setOption('localDataCenter', value), placeholder: 'datacenter1' }) : null,
          ),
          h('div', { className: 'dsm-section' }, '代理模式'),
          h(ProxyFields, { proxy: form.options?.proxy, setProxy, secrets, setSecret, touched, touch }),
          h('div', { className: 'dsm-actions' }, h('button', { className: 'dsm-btn primary', disabled: busy, onClick: save }, busy ? '保存中…' : '保存连接'), h('button', { className: 'dsm-btn', onClick: onCancel }, '取消')),
        )
      }

      function Result({ value }) {
        if (!value) return h('div', { className: 'dsm-empty dsm-result-empty' }, h('div', { className: 'dsm-empty-icon' }, '✦'), h('div', { className: 'dsm-empty-title' }, '准备执行操作'), h('div', { className: 'dsm-empty-copy' }, '执行结果会显示在这里'))
        if (!value.ok) return h('pre', { className: 'dsm-pre', style: { color: '#ff918b' } }, value.error || '操作失败')
        if (value.kind === 'table') {
          const rows = (value.rows || []).slice(0, 500)
          const columns = value.columns?.length ? value.columns : (rows[0] || []).map((_, index) => `col${index + 1}`)
          return h('table', { className: 'dsm-table' }, h('thead', null, h('tr', null, columns.map((column, index) => h('th', { key: index }, String(column))))), h('tbody', null, rows.map((row, rowIndex) => h('tr', { key: rowIndex }, row.map((cell, cellIndex) => h('td', { key: cellIndex }, cell == null ? '' : String(cell)))))))
        }
        if (value.kind === 'json') return h('pre', { className: 'dsm-pre' }, JSON.stringify(value.data, null, 2))
        if (value.kind === 'list') return h('pre', { className: 'dsm-pre' }, (value.items || []).join('\n  '))
        return h('pre', { className: 'dsm-pre' }, value.text || '')
      }

      function resultColumnIndex(value, pattern, fallback = 0) {
        const columns = value?.columns || []
        const index = columns.findIndex(column => pattern.test(String(column)))
        return index >= 0 ? index : fallback
      }

      function resultDatabaseNames(value) {
        const index = resultColumnIndex(value, /database|datname|^name$/i)
        return (value?.rows || []).map(row => String(row?.[index] ?? '')).filter(Boolean)
      }

      function resultTableNames(value) {
        const columns = value?.columns || []
        const tableIndex = resultColumnIndex(value, /table.?name|tablename/i)
        const schemaIndex = resultColumnIndex(value, /table.?schema|schemaname/i, -1)
        return (value?.rows || []).map(row => {
          const table = String(row?.[tableIndex] ?? '').trim()
          const schema = schemaIndex >= 0 ? String(row?.[schemaIndex] ?? '').trim() : ''
          return schema && table ? `${schema}.${table}` : table
        }).filter(Boolean)
      }

      function tableQuery(type, table) {
        const parts = String(table || '').split('.')
        if (parts.some(part => !part || /[\0\r\n  ;`"\[\]]/.test(part))) return ''
        if (type === 'mysql' || type === 'mariadb') return `SELECT * FROM ${parts.map(part => `\`${part.replaceAll('`', '``')}\``).join('.')} LIMIT ${DEFAULT_RESULT_LIMIT}`
        if (type === 'mssql') return `SELECT TOP ${DEFAULT_RESULT_LIMIT} * FROM ${parts.map(part => `[${part.replaceAll(']', ']]')}]`).join('.')}`
        return `SELECT * FROM ${parts.map(part => `"${part.replaceAll('"', '""')}"`).join('.')} LIMIT ${DEFAULT_RESULT_LIMIT}`
      }

      function DatabaseWorkspace({ connection, api, onBack, onEdit }) {
        const [databases, setDatabases] = useState([])
        const [selectedDatabase, setSelectedDatabase] = useState(connection.database || '')
        const [tables, setTables] = useState([])
        const [selectedTable, setSelectedTable] = useState('')
        const [sql, setSql] = useState('')
        const [result, setResult] = useState(null)
        const [error, setError] = useState('')
        const [loading, setLoading] = useState(false)
        const [loadingTables, setLoadingTables] = useState(false)
        const [busy, setBusy] = useState(false)
        const databaseRequestRef = useRef(0)
        const tablesRequestRef = useRef(0)

        const loadDatabases = () => {
          const requestId = ++databaseRequestRef.current
          setLoading(true); setError('')
          api({ op: 'exec', id: connection.id, params: { op: 'listDatabases' } }).then(value => {
            if (requestId !== databaseRequestRef.current) return
            const items = resultDatabaseNames(value)
            setDatabases(items)
            setSelectedDatabase(current => current && (items.length === 0 || items.includes(current)) ? current : items[0] || connection.database || '')
          }).catch(loadError => { if (requestId === databaseRequestRef.current) setError(loadError.message) }).finally(() => { if (requestId === databaseRequestRef.current) setLoading(false) })
        }
        const loadTables = database => {
          const requestId = ++tablesRequestRef.current
          if (!database) { setTables([]); setLoadingTables(false); return }
          setLoadingTables(true); setError('')
          api({ op: 'exec', id: connection.id, params: { op: 'listTables', database } }).then(value => { if (requestId === tablesRequestRef.current) setTables(resultTableNames(value)) }).catch(loadError => { if (requestId === tablesRequestRef.current) { setTables([]); setError(loadError.message) } }).finally(() => { if (requestId === tablesRequestRef.current) setLoadingTables(false) })
        }
        const refreshSchema = () => { loadDatabases(); if (selectedDatabase) loadTables(selectedDatabase) }
        const run = params => {
          setBusy(true); setResult(null); setError('')
          api({ op: 'exec', id: connection.id, params: { database: selectedDatabase, ...params } }).then(setResult).catch(runError => setResult({ ok: false, error: runError.message })).finally(() => setBusy(false))
        }
        const selectTable = table => {
          setSelectedTable(table)
          const nextSql = tableQuery(connection.type, table)
          setSql(nextSql)
          run({ op: 'tableData', table, limit: DEFAULT_RESULT_LIMIT })
        }
        useEffect(() => { loadDatabases() }, [connection.id])
        useEffect(() => { setSelectedTable(''); setSql(''); setResult(null); loadTables(selectedDatabase) }, [selectedDatabase])

        return h(React.Fragment, null,
          h('div', { className: 'dsm-actions dsm-operation-head', style: { marginTop: 0 } }, h('button', { className: 'dsm-btn', onClick: onBack }, '← 返回连接列表'), h('span', { className: 'dsm-title' }, `${connection.name} · ${typeLabel(connection.type)}`), h('span', { className: 'dsm-sub' }, `${connection.host || '本机'}${connection.port ? ':' + connection.port : ''}`), onEdit ? h('button', { className: 'dsm-btn', onClick: onEdit }, '编辑连接') : null),
          h(ServiceOverview, { connection, api }),
          error ? h('div', { className: 'dsm-error' }, error) : null,
          h('div', { className: 'dsm-db-layout' },
            h('aside', { className: 'dsm-db-sidebar' },
              h('div', { className: 'dsm-db-sidebar-head' }, h('span', null, '数据库'), h('button', { className: 'dsm-db-icon-btn', title: '刷新数据库和表', onClick: refreshSchema }, loading || loadingTables ? '…' : '↻')),
              databases.length ? databases.map(database => h('button', { key: database, className: 'dsm-db-node' + (selectedDatabase === database ? ' active' : ''), onClick: () => setSelectedDatabase(database) }, h('span', { className: 'dsm-db-node-icon' }, '🗄️'), h('span', null, database))) : h('div', { className: 'dsm-empty' }, loading ? '加载数据库…' : '未发现可用数据库'),
              selectedDatabase ? h('div', { className: 'dsm-db-group' }, h('div', { className: 'dsm-db-group-title' }, loadingTables ? '表 · 加载中…' : `表 · ${tables.length}`), tables.length ? tables.map(table => h('button', { key: table, className: 'dsm-db-node' + (selectedTable === table ? ' active' : ''), onClick: () => selectTable(table) }, h('span', { className: 'dsm-db-node-icon' }, '▱'), h('span', null, table))) : h('div', { className: 'dsm-help', style: { padding: '4px 8px' } }, loadingTables ? '正在读取表…' : '选择数据库后显示表')) : null,
            ),
            h('section', { className: 'dsm-db-content' },
              h('div', { className: 'dsm-db-toolbar' }, h('span', { className: 'dsm-db-title' }, '当前数据库'), h('select', { className: 'dsm-select', value: selectedDatabase, onChange: event => setSelectedDatabase(event.target.value) }, h('option', { value: '' }, '请选择数据库'), databases.map(database => h('option', { key: database, value: database }, database)))),
              h('div', { className: 'dsm-db-query-head' }, h('span', null, selectedTable ? `查询表 · ${selectedTable}` : 'SQL 查询'), h('button', { className: 'dsm-btn', disabled: !selectedDatabase || busy, onClick: () => run({ op: 'query', sql }) }, busy ? '执行中…' : '执行 SQL')),
              h('textarea', { className: 'dsm-textarea dsm-db-query', value: sql, onChange: event => setSql(event.target.value), placeholder: selectedDatabase ? `输入 SQL 查询，例如 SELECT * FROM users LIMIT ${DEFAULT_RESULT_LIMIT}` : '先选择数据库，再输入 SQL' }),
              h('div', { className: 'dsm-actions', style: { marginTop: 9 } }, h('button', { className: 'dsm-btn primary', disabled: !selectedDatabase || !sql.trim() || busy, onClick: () => run({ op: 'query', sql }) }, busy ? '执行中…' : '执行查询'), selectedTable ? h('button', { className: 'dsm-btn', disabled: busy, onClick: () => run({ op: 'tableData', table: selectedTable, limit: DEFAULT_RESULT_LIMIT }) }, '刷新表数据') : null, h('span', { className: 'dsm-help' }, `表浏览默认读取 ${DEFAULT_RESULT_LIMIT} 行；SQL 查询按语句执行，写入前请确认目标数据库。`)),
              h('div', { className: 'dsm-result dsm-db-result' }, busy ? h('div', { className: 'dsm-empty' }, '正在读取…') : h(Result, { value: result })),
            ),
          ),
        )
      }

      function WorkspaceHeader({ connection, onBack, onEdit }) {
        return h('div', { className: 'dsm-actions dsm-operation-head', style: { marginTop: 0 } }, h('button', { className: 'dsm-btn', onClick: onBack }, '← 返回连接列表'), h('span', { className: 'dsm-title' }, `${connection.name} · ${typeLabel(connection.type)}`), h('span', { className: 'dsm-sub' }, `${connection.host || '本机'}${connection.port ? ':' + connection.port : ''}`), onEdit ? h('button', { className: 'dsm-btn', onClick: onEdit }, '编辑连接') : null)
      }

      function DocumentResult({ value }) {
        if (!value || value.kind !== 'json') return h(Result, { value })
        if (!value.ok) return h(Result, { value })
        const data = value.data
        const documents = Array.isArray(data) ? data : Array.isArray(data?.hits?.hits) ? data.hits.hits.map(hit => ({ _id: hit._id, _score: hit._score, ...(hit._source || {}) })) : null
        if (!documents) return h(Result, { value })
        if (!documents.length) return h('div', { className: 'dsm-empty' }, '没有匹配的数据')
        const columns = [...new Set(documents.flatMap(item => Object.keys(item || {})))].slice(0, 80)
        return h('table', { className: 'dsm-doc-table' }, h('thead', null, h('tr', null, columns.map(column => h('th', { key: column }, column)))), h('tbody', null, documents.slice(0, 500).map((item, rowIndex) => h('tr', { key: rowIndex }, columns.map(column => h('td', { key: column }, item?.[column] == null ? '' : typeof item[column] === 'object' ? JSON.stringify(item[column]) : String(item[column])))))))
      }

      function RedisWorkspace({ connection, api, onBack, onEdit }) {
        const configuredDatabase = connection.options?.db ?? connection.database
        const [database, setDatabase] = useState(String(configuredDatabase ?? '0'))
        const [pattern, setPattern] = useState('*')
        const [keys, setKeys] = useState([])
        const [selectedKey, setSelectedKey] = useState('')
        const [value, setValue] = useState('')
        const [command, setCommand] = useState('["GET","key"]')
        const [result, setResult] = useState(null)
        const [error, setError] = useState('')
        const [busy, setBusy] = useState(false)
        const keysRequestRef = useRef(0)
        const valueRequestRef = useRef(0)
        const databaseOptions = [...new Set([...Array.from({ length: 16 }, (_, index) => String(index)), database])].filter(Boolean)
        const loadKeys = () => {
          const requestId = ++keysRequestRef.current
          setBusy(true); setError('')
          api({ op: 'exec', id: connection.id, params: { op: 'listKeys', database, pattern } }).then(response => { if (requestId === keysRequestRef.current) setKeys(response.items || []) }).catch(loadError => { if (requestId === keysRequestRef.current) setError(loadError.message) }).finally(() => { if (requestId === keysRequestRef.current) setBusy(false) })
        }
        const selectKey = key => {
          const requestId = ++valueRequestRef.current
          setSelectedKey(key); setBusy(true); setError('')
          api({ op: 'exec', id: connection.id, params: { op: 'getKey', database, key } }).then(response => { if (requestId === valueRequestRef.current) { setResult(response); setValue(response.data == null ? '' : String(response.data)) } }).catch(loadError => { if (requestId === valueRequestRef.current) setError(loadError.message) }).finally(() => { if (requestId === valueRequestRef.current) setBusy(false) })
        }
        const execute = params => {
          setBusy(true); setResult(null); setError('')
          return api({ op: 'exec', id: connection.id, params: { database, ...params } }).then(setResult).catch(runError => setResult({ ok: false, error: runError.message })).finally(() => setBusy(false))
        }
        const saveKey = () => execute({ op: 'setKey', key: selectedKey, value })
        const deleteKey = () => execute({ op: 'delKey', key: selectedKey }).then(() => { setSelectedKey(''); setValue(''); loadKeys() })
        useEffect(() => { setSelectedKey(''); setValue(''); setResult(null); loadKeys() }, [database])
        return h(React.Fragment, null,
          h(WorkspaceHeader, { connection, onBack, onEdit }),
          h(ServiceOverview, { connection, api }),
          error ? h('div', { className: 'dsm-error' }, error) : null,
          h('div', { className: 'dsm-db-layout' },
            h('aside', { className: 'dsm-db-sidebar' },
              h('div', { className: 'dsm-db-sidebar-head' }, h('span', null, 'Redis DB'), h('button', { className: 'dsm-db-icon-btn', title: '刷新 Key', onClick: loadKeys }, busy ? '…' : '↻')),
              h('select', { className: 'dsm-select', value: database, onChange: event => setDatabase(event.target.value) }, databaseOptions.map(item => h('option', { key: item, value: item }, `DB ${item}`))),
              h('input', { className: 'dsm-input', value: pattern, onChange: event => setPattern(event.target.value), onKeyDown: event => { if (event.key === 'Enter') loadKeys() }, placeholder: 'Key Pattern，例如 user:*' }),
              keys.length ? keys.map(key => h('button', { key, className: 'dsm-db-node' + (selectedKey === key ? ' active' : ''), onClick: () => selectKey(key) }, h('span', { className: 'dsm-db-node-icon' }, '🔑'), h('span', null, key))) : h('div', { className: 'dsm-empty' }, busy ? '扫描 Key…' : '没有匹配的 Key'),
            ),
            h('section', { className: 'dsm-db-content' },
              h('div', { className: 'dsm-kv-title' }, h('span', null, selectedKey ? `Key · ${selectedKey}` : 'Redis 操作'), selectedKey ? h('button', { className: 'dsm-btn danger', disabled: busy, onClick: deleteKey }, '删除 Key') : null),
              selectedKey ? h('textarea', { className: 'dsm-textarea dsm-data-editor', value, onChange: event => setValue(event.target.value), placeholder: '字符串 Value' }) : null,
              selectedKey ? h('div', { className: 'dsm-actions', style: { marginTop: 9 } }, h('button', { className: 'dsm-btn primary', disabled: busy, onClick: saveKey }, '写入 Key'), h('button', { className: 'dsm-btn', disabled: busy, onClick: () => selectKey(selectedKey) }, '重新读取')) : null,
              h('div', { className: 'dsm-kv-title' }, h('span', null, 'Redis 命令（JSON 数组）')),
              h('textarea', { className: 'dsm-textarea dsm-data-editor', value: command, onChange: event => setCommand(event.target.value), placeholder: '["GET","user:1"]' }),
              h('div', { className: 'dsm-actions', style: { marginTop: 9 } }, h('button', { className: 'dsm-btn primary', disabled: busy || !command.trim(), onClick: () => execute({ op: 'query', text: command }) }, busy ? '执行中…' : '执行命令')),
              h('div', { className: 'dsm-result dsm-data-result' }, busy ? h('div', { className: 'dsm-empty' }, '正在读取…') : h(Result, { value: result })),
            ),
          ),
        )
      }

      function ElasticsearchWorkspace({ connection, api, onBack, onEdit }) {
        const [indices, setIndices] = useState([])
        const [index, setIndex] = useState('')
        const [path, setPath] = useState('/_search')
        const [body, setBody] = useState(`{\n    "from": 0,\n    "size": ${DEFAULT_RESULT_LIMIT},\n    "query": { "match_all": {} }\n  }`)
        const [result, setResult] = useState(null)
        const [error, setError] = useState('')
        const [busy, setBusy] = useState(false)
        const indicesRequestRef = useRef(0)
        const loadIndices = () => {
          const requestId = ++indicesRequestRef.current
          setBusy(true); setError('')
          api({ op: 'exec', id: connection.id, params: { op: 'listIndices' } }).then(response => {
            if (requestId !== indicesRequestRef.current) return
            const items = Array.isArray(response.data) ? response.data.map(item => String(item.index || '')).filter(Boolean) : []
            setIndices(items)
            if (!index && items[0]) { setIndex(items[0]); setPath(`/${encodeURIComponent(items[0])}/_search`) }
          }).catch(loadError => { if (requestId === indicesRequestRef.current) setError(loadError.message) }).finally(() => { if (requestId === indicesRequestRef.current) setBusy(false) })
        }
        const execute = () => {
          setBusy(true); setResult(null); setError('')
          api({ op: 'exec', id: connection.id, params: { op: 'query', path, method: 'POST', body } }).then(setResult).catch(runError => setResult({ ok: false, error: runError.message })).finally(() => setBusy(false))
        }
        const selectIndex = next => { setIndex(next); setPath(`/${encodeURIComponent(next)}/_search`); setResult(null) }
        useEffect(() => { loadIndices() }, [connection.id])
        return h(React.Fragment, null,
          h(WorkspaceHeader, { connection, onBack, onEdit }),
          h(ServiceOverview, { connection, api }),
          error ? h('div', { className: 'dsm-error' }, error) : null,
          h('div', { className: 'dsm-db-layout' },
            h('aside', { className: 'dsm-db-sidebar' },
              h('div', { className: 'dsm-db-sidebar-head' }, h('span', null, 'Elasticsearch Index'), h('button', { className: 'dsm-db-icon-btn', title: '刷新 Index', onClick: loadIndices }, busy ? '…' : '↻')),
              indices.length ? indices.map(item => h('button', { key: item, className: 'dsm-db-node' + (index === item ? ' active' : ''), onClick: () => selectIndex(item) }, h('span', { className: 'dsm-db-node-icon' }, '▦'), h('span', null, item))) : h('div', { className: 'dsm-empty' }, busy ? '加载 Index…' : '没有可用 Index'),
            ),
            h('section', { className: 'dsm-db-content' },
              h('div', { className: 'dsm-db-toolbar' }, h('span', { className: 'dsm-db-title' }, '当前 Index'), h('select', { className: 'dsm-select', value: index, onChange: event => selectIndex(event.target.value) }, h('option', { value: '' }, '全部 Index'), indices.map(item => h('option', { key: item, value: item }, item)))),
              h('div', { className: 'dsm-kv-title' }, h('span', null, 'API Path')),
              h('input', { className: 'dsm-input', value: path, onChange: event => setPath(event.target.value), placeholder: '/index/_search' }),
              h('div', { className: 'dsm-kv-title' }, h('span', null, 'Query DSL')),
              h('textarea', { className: 'dsm-textarea dsm-data-editor', value: body, onChange: event => setBody(event.target.value), placeholder: '{"query":{"match_all":{}}}' }),
              h('div', { className: 'dsm-actions', style: { marginTop: 9 } }, h('button', { className: 'dsm-btn primary', disabled: busy || !path.trim(), onClick: execute }, busy ? '查询中…' : '执行搜索'), h('span', { className: 'dsm-help' }, `默认返回 ${DEFAULT_RESULT_LIMIT} 条文档，可直接编辑 Query DSL。`)),
              h('div', { className: 'dsm-result dsm-data-result' }, busy ? h('div', { className: 'dsm-empty' }, '正在查询…') : h(DocumentResult, { value: result })),
            ),
          ),
        )
      }

      function MongoWorkspace({ connection, api, onBack, onEdit }) {
        const [databases, setDatabases] = useState([])
        const [database, setDatabase] = useState(connection.database || '')
        const [collections, setCollections] = useState([])
        const [collection, setCollection] = useState('')
        const [filter, setFilter] = useState('{}')
        const [advanced, setAdvanced] = useState('{"action":"find","collection":"users","filter":{}}')
        const [result, setResult] = useState(null)
        const [error, setError] = useState('')
        const [busy, setBusy] = useState(false)
        const databaseRequestRef = useRef(0)
        const collectionsRequestRef = useRef(0)
        const loadDatabases = () => {
          const requestId = ++databaseRequestRef.current
          setBusy(true); setError('')
          api({ op: 'exec', id: connection.id, params: { op: 'listDatabases' } }).then(response => {
            if (requestId !== databaseRequestRef.current) return
            const items = Array.isArray(response.data?.databases) ? response.data.databases.map(item => String(item.name || '')).filter(Boolean) : []
            setDatabases(items); setDatabase(current => current && (items.length === 0 || items.includes(current)) ? current : items[0] || connection.database || '')
          }).catch(loadError => { if (requestId === databaseRequestRef.current) setError(loadError.message) }).finally(() => { if (requestId === databaseRequestRef.current) setBusy(false) })
        }
        const loadCollections = db => {
          const requestId = ++collectionsRequestRef.current
          if (!db) { setCollections([]); setBusy(false); return }
          setBusy(true); setError('')
          api({ op: 'exec', id: connection.id, params: { op: 'listCollections', database: db } }).then(response => { if (requestId === collectionsRequestRef.current) setCollections(Array.isArray(response.data) ? response.data.map(item => String(item.name || '')).filter(Boolean) : []) }).catch(loadError => { if (requestId === collectionsRequestRef.current) { setCollections([]); setError(loadError.message) } }).finally(() => { if (requestId === collectionsRequestRef.current) setBusy(false) })
        }
        const executeFind = () => {
          if (!database || !collection) return
          setBusy(true); setResult(null); setError('')
          api({ op: 'exec', id: connection.id, params: { op: 'find', database, collection, filter, limit: DEFAULT_RESULT_LIMIT } }).then(setResult).catch(runError => setResult({ ok: false, error: runError.message })).finally(() => setBusy(false))
        }
        const executeAdvanced = () => {
          setBusy(true); setResult(null); setError('')
          api({ op: 'exec', id: connection.id, params: { op: 'query', database, text: advanced } }).then(setResult).catch(runError => setResult({ ok: false, error: runError.message })).finally(() => setBusy(false))
        }
        useEffect(() => { loadDatabases() }, [connection.id])
        useEffect(() => { setCollection(''); loadCollections(database) }, [database])
        return h(React.Fragment, null,
          h(WorkspaceHeader, { connection, onBack, onEdit }),
          h(ServiceOverview, { connection, api }),
          error ? h('div', { className: 'dsm-error' }, error) : null,
          h('div', { className: 'dsm-db-layout' },
            h('aside', { className: 'dsm-db-sidebar' },
              h('div', { className: 'dsm-db-sidebar-head' }, h('span', null, 'MongoDB Database'), h('button', { className: 'dsm-db-icon-btn', title: '刷新 Database 和 Collection', onClick: loadDatabases }, busy ? '…' : '↻')),
              databases.length ? databases.map(item => h('button', { key: item, className: 'dsm-db-node' + (database === item ? ' active' : ''), onClick: () => setDatabase(item) }, h('span', { className: 'dsm-db-node-icon' }, '🗄️'), h('span', null, item))) : h('div', { className: 'dsm-empty' }, busy ? '加载 Database…' : '没有可用 Database'),
              database ? h('div', { className: 'dsm-db-group' }, h('div', { className: 'dsm-db-group-title' }, `Collection · ${collections.length}`), collections.length ? collections.map(item => h('button', { key: item, className: 'dsm-db-node' + (collection === item ? ' active' : ''), onClick: () => { setCollection(item); setAdvanced(JSON.stringify({ action: 'find', collection: item, filter: {} }, null, 2)) } }, h('span', { className: 'dsm-db-node-icon' }, '▱'), h('span', null, item))) : h('div', { className: 'dsm-help', style: { padding: '4px 8px' } }, '没有 Collection')) : null,
            ),
            h('section', { className: 'dsm-db-content' },
              h('div', { className: 'dsm-db-toolbar' }, h('span', { className: 'dsm-db-title' }, '当前 Database'), h('select', { className: 'dsm-select', value: database, onChange: event => setDatabase(event.target.value) }, h('option', { value: '' }, '请选择 Database'), databases.map(item => h('option', { key: item, value: item }, item)))),
              h('div', { className: 'dsm-kv-title' }, h('span', null, collection ? `查询 Collection · ${collection}` : 'MongoDB 查询')),
              h('input', { className: 'dsm-input', value: collection, onChange: event => setCollection(event.target.value), placeholder: 'Collection 名称' }),
              h('textarea', { className: 'dsm-textarea dsm-data-editor', value: filter, onChange: event => setFilter(event.target.value), placeholder: '{"status":"active"}' }),
              h('div', { className: 'dsm-actions', style: { marginTop: 9 } }, h('button', { className: 'dsm-btn primary', disabled: busy || !database || !collection, onClick: executeFind }, busy ? '查询中…' : '查询文档')),
              h('div', { className: 'dsm-kv-title' }, h('span', null, '高级 JSON 操作')),
              h('textarea', { className: 'dsm-textarea dsm-data-editor', value: advanced, onChange: event => setAdvanced(event.target.value), placeholder: '{"action":"find","collection":"users","filter":{}}' }),
              h('div', { className: 'dsm-actions', style: { marginTop: 9 } }, h('button', { className: 'dsm-btn', disabled: busy || !database || !advanced.trim(), onClick: executeAdvanced }, '执行 JSON 操作')),
              h('div', { className: 'dsm-result dsm-data-result' }, busy ? h('div', { className: 'dsm-empty' }, '正在查询…') : h(DocumentResult, { value: result })),
            ),
          ),
        )
      }

      function CassandraWorkspace({ connection, api, onBack, onEdit }) {
        const [keyspaces, setKeyspaces] = useState([])
        const [keyspace, setKeyspace] = useState(connection.options?.keyspace || connection.database || '')
        const [tables, setTables] = useState([])
        const [table, setTable] = useState('')
        const [cql, setCql] = useState('')
        const [result, setResult] = useState(null)
        const [error, setError] = useState('')
        const [busy, setBusy] = useState(false)
        const keyspacesRequestRef = useRef(0)
        const tablesRequestRef = useRef(0)
        const loadKeyspaces = () => {
          const requestId = ++keyspacesRequestRef.current
          setBusy(true); setError('')
          api({ op: 'exec', id: connection.id, params: { op: 'listKeyspaces' } }).then(response => {
            if (requestId !== keyspacesRequestRef.current) return
            const items = resultColumnIndex(response, /keyspace/i) >= 0 ? (response.rows || []).map(row => String(row?.[resultColumnIndex(response, /keyspace/i)] || '')).filter(Boolean) : []
            setKeyspaces(items); setKeyspace(current => current && (items.length === 0 || items.includes(current)) ? current : items[0] || connection.database || '')
          }).catch(loadError => { if (requestId === keyspacesRequestRef.current) setError(loadError.message) }).finally(() => { if (requestId === keyspacesRequestRef.current) setBusy(false) })
        }
        const loadTables = ks => {
          const requestId = ++tablesRequestRef.current
          if (!ks) { setTables([]); setBusy(false); return }
          setBusy(true); setError('')
          api({ op: 'exec', id: connection.id, params: { op: 'listTables', keyspace: ks } }).then(response => { if (requestId === tablesRequestRef.current) setTables(resultTableNames(response)) }).catch(loadError => { if (requestId === tablesRequestRef.current) { setTables([]); setError(loadError.message) } }).finally(() => { if (requestId === tablesRequestRef.current) setBusy(false) })
        }
        const run = params => {
          setBusy(true); setResult(null); setError('')
          api({ op: 'exec', id: connection.id, params: { keyspace, ...params } }).then(setResult).catch(runError => setResult({ ok: false, error: runError.message })).finally(() => setBusy(false))
        }
        const selectTable = next => { setTable(next); const nextCql = tableQuery('postgresql', `${keyspace}.${next}`); setCql(nextCql); run({ op: 'tableData', table: next, limit: DEFAULT_RESULT_LIMIT }) }
        useEffect(() => { loadKeyspaces() }, [connection.id])
        useEffect(() => { setTable(''); setCql(''); loadTables(keyspace) }, [keyspace])
        return h(React.Fragment, null,
          h(WorkspaceHeader, { connection, onBack, onEdit }),
          h(ServiceOverview, { connection, api }),
          error ? h('div', { className: 'dsm-error' }, error) : null,
          h('div', { className: 'dsm-db-layout' },
            h('aside', { className: 'dsm-db-sidebar' },
              h('div', { className: 'dsm-db-sidebar-head' }, h('span', null, 'Cassandra Keyspace'), h('button', { className: 'dsm-db-icon-btn', title: '刷新 Keyspace 和 Table', onClick: loadKeyspaces }, busy ? '…' : '↻')),
              keyspaces.length ? keyspaces.map(item => h('button', { key: item, className: 'dsm-db-node' + (keyspace === item ? ' active' : ''), onClick: () => setKeyspace(item) }, h('span', { className: 'dsm-db-node-icon' }, '🗄️'), h('span', null, item))) : h('div', { className: 'dsm-empty' }, busy ? '加载 Keyspace…' : '没有可用 Keyspace'),
              keyspace ? h('div', { className: 'dsm-db-group' }, h('div', { className: 'dsm-db-group-title' }, `Table · ${tables.length}`), tables.length ? tables.map(item => h('button', { key: item, className: 'dsm-db-node' + (table === item ? ' active' : ''), onClick: () => selectTable(item) }, h('span', { className: 'dsm-db-node-icon' }, '▱'), h('span', null, item))) : h('div', { className: 'dsm-help', style: { padding: '4px 8px' } }, '没有 Table')) : null,
            ),
            h('section', { className: 'dsm-db-content' },
              h('div', { className: 'dsm-db-toolbar' }, h('span', { className: 'dsm-db-title' }, '当前 Keyspace'), h('select', { className: 'dsm-select', value: keyspace, onChange: event => setKeyspace(event.target.value) }, h('option', { value: '' }, '请选择 Keyspace'), keyspaces.map(item => h('option', { key: item, value: item }, item)))),
              h('div', { className: 'dsm-kv-title' }, h('span', null, table ? `查询 Table · ${table}` : 'CQL 查询')),
              h('textarea', { className: 'dsm-textarea dsm-data-editor', value: cql, onChange: event => setCql(event.target.value), placeholder: `SELECT * FROM keyspace.table LIMIT ${DEFAULT_RESULT_LIMIT}` }),
              h('div', { className: 'dsm-actions', style: { marginTop: 9 } }, h('button', { className: 'dsm-btn primary', disabled: busy || !keyspace || !cql.trim(), onClick: () => run({ op: 'query', cql }) }, busy ? '执行中…' : '执行 CQL'), table ? h('button', { className: 'dsm-btn', disabled: busy, onClick: () => run({ op: 'tableData', table, limit: DEFAULT_RESULT_LIMIT }) }, '刷新表数据') : null),
              h('div', { className: 'dsm-result dsm-data-result' }, busy ? h('div', { className: 'dsm-empty' }, '正在查询…') : h(Result, { value: result })),
            ),
          ),
        )
      }

      function DataWorkspace({ connection, api, onBack, onEdit }) {
        if (connection.type === 'redis') return h(RedisWorkspace, { connection, api, onBack, onEdit })
        if (connection.type === 'elasticsearch') return h(ElasticsearchWorkspace, { connection, api, onBack, onEdit })
        if (connection.type === 'mongodb') return h(MongoWorkspace, { connection, api, onBack, onEdit })
        return h(CassandraWorkspace, { connection, api, onBack, onEdit })
      }

      function formatBytes(value) {
        const bytes = Number(value)
        if (!Number.isFinite(bytes) || bytes <= 0) return '—'
        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
        const amount = bytes / (1024 ** index)
        return `${amount >= 10 || index === 0 ? Math.round(amount) : amount.toFixed(1)} ${units[index]}`
      }

      function SshOverview({ connection, api }) {
        const [snapshot, setSnapshot] = useState(null)
        const [error, setError] = useState('')
        const [busy, setBusy] = useState(false)
        const [updatedAt, setUpdatedAt] = useState(null)
        const inspectInFlight = useRef(false)
        const fetchSnapshot = active => {
          if (inspectInFlight.current) return Promise.resolve()
          inspectInFlight.current = true
          setBusy(true)
          setError('')
          return api({ op: 'exec', id: connection.id, params: { op: 'inspect' } }).then(value => {
            if (!active) return
            setSnapshot(value.data || value)
            setUpdatedAt(new Date())
          }).catch(loadError => {
            if (active) setError(loadError.message)
          }).finally(() => {
            inspectInFlight.current = false
            if (active) setBusy(false)
          })
        }
        useEffect(() => {
          let active = true
          const tick = () => {
            if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void fetchSnapshot(active)
          }
          tick()
          const timer = setInterval(tick, 10_000)
          return () => { active = false; clearInterval(timer) }
        }, [connection.id])
        const cpu = snapshot?.cpu || {}
        const memory = snapshot?.memory || {}
        const disk = snapshot?.disk || {}
        const memoryTotal = Number(memory.totalBytes) || 0
        const memoryUsed = Number(memory.usedBytes) || 0
        const memoryPercent = memoryTotal > 0 ? `${Math.round((memoryUsed / memoryTotal) * 100)}%` : '—'
        const cards = [
          { label: 'CPU', value: cpu.cores ? `${cpu.cores} 核` : '—', detail: cpu.load ? `负载 ${cpu.load}` : '负载不可用' },
          { label: '内存', value: formatBytes(memoryUsed), detail: memoryTotal ? `${memoryPercent} / ${formatBytes(memoryTotal)}` : '容量不可用' },
          { label: '根磁盘', value: formatBytes(disk.usedBytes), detail: disk.totalBytes ? `${disk.usagePercent || '—'} / ${formatBytes(disk.totalBytes)}` : '容量不可用' },
          { label: '监听端口', value: String(snapshot?.ports?.length || 0), detail: snapshot?.ports?.length ? 'SSH 实时扫描' : '未发现监听端口' },
        ]
        return h('section', { className: 'dsm-ssh-overview' },
          h('div', { className: 'dsm-ssh-overview-head' },
            h('div', { className: 'dsm-ssh-overview-copy' }, h('div', { className: 'dsm-ssh-overview-title' }, '服务器概览'), h('div', { className: 'dsm-ssh-overview-sub' }, '每 10 秒自动刷新；数据通过当前 SSH 连接采集')),
            h('span', { className: 'dsm-ssh-overview-status' }, h('span', { className: 'dsm-ssh-status-dot' + (busy ? ' busy' : '') }), busy ? '采集中' : updatedAt ? `更新于 ${updatedAt.toLocaleTimeString()}` : '等待采集'),
            h('button', { className: 'dsm-btn dsm-ssh-overview-refresh', disabled: busy, onClick: () => { void fetchSnapshot(true) } }, busy ? '刷新中…' : '刷新'),
          ),
          error ? h('div', { className: 'dsm-ssh-error' }, `采集失败：${error}`) : null,
          h('div', { className: 'dsm-ssh-metric-grid' }, cards.map(card => h('div', { key: card.label, className: 'dsm-ssh-metric' }, h('div', { className: 'dsm-ssh-metric-label' }, card.label), h('div', { className: 'dsm-ssh-metric-value' }, card.value), h('div', { className: 'dsm-ssh-metric-detail' }, card.detail)))),
          h('div', { className: 'dsm-ssh-detail-grid' },
            h('div', { className: 'dsm-ssh-detail' }, h('div', { className: 'dsm-ssh-detail-label' }, '主机 / 系统'), h('div', { className: 'dsm-ssh-detail-value', title: `${snapshot?.host || connection.host || '—'} · ${snapshot?.os || '—'}` }, `${snapshot?.host || connection.host || '—'} · ${snapshot?.os || '—'}`)),
            h('div', { className: 'dsm-ssh-detail' }, h('div', { className: 'dsm-ssh-detail-label' }, '内核 / 运行时间'), h('div', { className: 'dsm-ssh-detail-value', title: `${snapshot?.kernel || '—'} · ${snapshot?.uptime || '—'}` }, `${snapshot?.kernel || '—'} · ${snapshot?.uptime || '—'}`)),
          ),
          h('div', { className: 'dsm-ssh-ports', 'aria-label': '监听端口' }, snapshot?.ports?.length ? snapshot.ports.map(port => h('span', { key: port, className: 'dsm-ssh-port' }, `:${port}`)) : h('span', { className: 'dsm-ssh-detail-value' }, '暂无监听端口数据')),
        )
      }

      function ServiceOverview({ connection, api }) {
        const [snapshot, setSnapshot] = useState(null)
        const [error, setError] = useState('')
        const [busy, setBusy] = useState(false)
        const [updatedAt, setUpdatedAt] = useState(null)
        const load = () => {
          setBusy(true)
          setError('')
          return api({ op: 'exec', id: connection.id, params: { op: 'inspect' } }).then(value => {
            setSnapshot(value.data || value)
            setUpdatedAt(new Date())
          }).catch(loadError => setError(loadError.message)).finally(() => setBusy(false))
        }
        useEffect(() => { void load() }, [connection.id])
        const info = snapshot || {}
        const config = info.config && typeof info.config === 'object' ? info.config : {}
        const configEntries = Object.entries(config).filter(([, value]) => value !== undefined && value !== null && value !== '').slice(0, 8)
        const configLabels = { apiVersion: 'API 版本', minApiVersion: '最低 API', database: '数据库', user: '用户', cluster: '集群', node: '节点', server: '服务器', hostname: '主机名', port: '端口', charset: '字符集', collation: '排序规则', sqlMode: 'SQL 模式', encoding: '编码', os: '系统', arch: '架构', kernel: '内核', mode: '模式', uptime: '运行时间', connectedClients: '连接数', usedMemory: '已用内存', maxMemory: '最大内存', dataCenter: '数据中心', rack: '机架', region: '区域', bucketCount: 'Bucket 数', forcePathStyle: 'Path Style' }
        const display = value => typeof value === 'object' ? JSON.stringify(value) : String(value)
        const endpoint = info.endpoint || `${connection.host || '本机'}${connection.port ? ':' + connection.port : ''}`
        const cards = [
          { label: '服务版本', value: info.version || '—', detail: typeLabel(connection.type) },
          { label: '连接端点', value: endpoint, detail: info.config?.database || info.config?.cluster || info.config?.region || '当前连接' },
          { label: '配置项', value: String(configEntries.length), detail: '只读配置' },
          { label: '状态', value: error ? '读取失败' : snapshot ? '正常' : '读取中', detail: updatedAt ? `更新于 ${updatedAt.toLocaleTimeString()}` : '建立连接后读取' },
        ]
        return h('section', { className: 'dsm-ssh-overview dsm-service-overview' },
          h('div', { className: 'dsm-ssh-overview-head' },
            h('div', { className: 'dsm-ssh-overview-copy' }, h('div', { className: 'dsm-ssh-overview-title' }, '服务概览'), h('div', { className: 'dsm-ssh-overview-sub' }, '读取当前服务版本与关键配置；不会修改远端数据')),
            h('span', { className: 'dsm-ssh-overview-status' }, h('span', { className: 'dsm-ssh-status-dot' + (busy ? ' busy' : '') }), busy ? '读取中' : updatedAt ? `更新于 ${updatedAt.toLocaleTimeString()}` : '等待读取'),
            h('button', { className: 'dsm-btn dsm-ssh-overview-refresh', disabled: busy, onClick: () => { void load() } }, busy ? '读取中…' : '刷新'),
          ),
          error ? h('div', { className: 'dsm-ssh-error' }, `读取失败：${error}；不影响下方操作`) : null,
          h('div', { className: 'dsm-ssh-metric-grid' }, cards.map(card => h('div', { key: card.label, className: 'dsm-ssh-metric' }, h('div', { className: 'dsm-ssh-metric-label' }, card.label), h('div', { className: 'dsm-ssh-metric-value', title: card.value }, card.value), h('div', { className: 'dsm-ssh-metric-detail' }, card.detail)))),
          h('div', { className: 'dsm-ssh-detail-grid' }, configEntries.length ? configEntries.map(([key, value]) => h('div', { key, className: 'dsm-ssh-detail' }, h('div', { className: 'dsm-ssh-detail-label' }, configLabels[key] || key), h('div', { className: 'dsm-ssh-detail-value', title: display(value) }, display(value)))) : h('div', { className: 'dsm-ssh-detail' }, h('div', { className: 'dsm-ssh-detail-value' }, '暂无额外配置数据'))),
        )
      }

      function SshTerminalPanel({ connection, api }) {
        const [terminalId, setTerminalId] = useState('')
        const [terminalText, setTerminalText] = useState('')
        const [terminalInput, setTerminalInput] = useState('')
        const [terminalBusy, setTerminalBusy] = useState(false)
        const terminalOutputRef = useRef(null)
        const terminalIdRef = useRef('')
        useEffect(() => { terminalIdRef.current = terminalId }, [terminalId])
        const terminalRequest = (operation, extra = {}) => api({ op: 'exec', id: connection.id, params: { op: operation, terminalId, ...extra } })
        const appendTerminal = value => {
          const text = normalizeTerminalText(value?.text)
          if (text) setTerminalText(current => current + text)
        }
        const openTerminal = () => {
          setTerminalBusy(true)
          api({ op: 'exec', id: connection.id, params: { op: 'terminalOpen' } }).then(value => {
            setTerminalId(value.terminalId || '')
            setTerminalText(normalizeTerminalText(value.text))
          }).catch(error => setTerminalText(current => current + `\n  [连接失败] ${normalizeTerminalText(error.message)}\n  `)).finally(() => setTerminalBusy(false))
        }
        const sendTerminal = () => {
          if (!terminalId || !terminalInput) return
          const data = terminalInput + '\n  '
          setTerminalInput('')
          terminalRequest('terminalWrite', { data }).then(appendTerminal).catch(error => setTerminalText(current => current + `\n  [发送失败] ${normalizeTerminalText(error.message)}\n  `))
        }
        const closeTerminal = () => {
          if (!terminalId) return
          const id = terminalId
          api({ op: 'exec', id: connection.id, params: { op: 'terminalClose', terminalId: id } }).catch(() => {}).finally(() => {
            if (id === terminalId) setTerminalId('')
          })
        }
        useEffect(() => {
          if (!terminalId) return undefined
          const timer = setInterval(() => terminalRequest('terminalRead').then(appendTerminal).catch(() => {}), 500)
          return () => clearInterval(timer)
        }, [terminalId])
        useEffect(() => {
          const output = terminalOutputRef.current
          if (output) output.scrollTop = output.scrollHeight
        }, [terminalText])
        useEffect(() => () => {
          const activeTerminalId = terminalIdRef.current
          if (activeTerminalId) api({ op: 'exec', id: connection.id, params: { op: 'terminalClose', terminalId: activeTerminalId } }).catch(() => {})
        }, [connection.id])
        return h('section', { className: 'dsm-ssh-terminal-panel' },
          h('div', { className: 'dsm-actions', style: { marginTop: 0 } },
            !terminalId ? h('button', { className: 'dsm-btn primary', disabled: terminalBusy, onClick: openTerminal }, terminalBusy ? '连接中…' : '打开远程终端') : h('button', { className: 'dsm-btn danger', onClick: closeTerminal }, '关闭终端'),
            h('span', { className: 'dsm-help' }, terminalId ? '已连接；输入命令后按 Enter 执行。' : '通过 SSH shell 建立交互式终端，会话关闭后自动释放。'),
          ),
          h('pre', { ref: terminalOutputRef, className: 'dsm-terminal-output' }, terminalText || '终端输出将在这里显示'),
          h('textarea', { className: 'dsm-textarea dsm-terminal-input', disabled: !terminalId, value: terminalInput, onChange: event => setTerminalInput(event.target.value), onKeyDown: event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendTerminal() } }, placeholder: terminalId ? '输入远程命令，Enter 执行' : '请先打开终端' }),
        )
      }

      function SshFileManager({ connection, api }) {
        const [currentPath, setCurrentPath] = useState('/')
        const [pathDraft, setPathDraft] = useState('/')
        const [entries, setEntries] = useState([])
        const [tree, setTree] = useState({ '/': { path: '/', name: '/', children: [], loaded: false } })
        const [expanded, setExpanded] = useState({ '/': true })
        const [loading, setLoading] = useState(false)
        const [error, setError] = useState('')
        const [status, setStatus] = useState('')
        const [menu, setMenu] = useState(null)
        const [editor, setEditor] = useState(null)
        const uploadRef = useRef(null)
        const directoryCacheRef = useRef(new Map())
        const directoryPendingRef = useRef(new Map())
        const fileCacheRef = useRef(new Map())
        const filePendingRef = useRef(new Map())
        const DIRECTORY_CACHE_TTL = 15_000
        const FILE_CACHE_TTL = 30_000

        const applyDirectory = (normalized, nextEntries, navigate, cached = false) => {
          setTree(current => ({ ...current, [normalized]: { ...(current[normalized] || {}), path: normalized, name: normalized === '/' ? '/' : normalized.split('/').pop(), children: nextEntries.filter(item => item.isDirectory), loaded: true } }))
          if (navigate) {
            setCurrentPath(normalized)
            setPathDraft(normalized)
            setEntries(nextEntries)
          }
          setStatus(`${nextEntries.length} 项${cached ? ' · 缓存' : ''}`)
        }
        const loadDirectory = (path, navigate = true, force = false) => {
          const normalized = remoteDirectoryPath(path)
          const cached = directoryCacheRef.current.get(normalized)
          const fresh = cached && Date.now() - cached.updatedAt < DIRECTORY_CACHE_TTL
          if (cached) applyDirectory(normalized, cached.entries, navigate, true)
          if (cached && fresh && !force) return Promise.resolve(cached.entries)
          const pending = directoryPendingRef.current.get(normalized)
          if (pending) {
            if (navigate) pending.then(nextEntries => applyDirectory(normalized, nextEntries, true)).catch(() => {})
            return pending
          }
          setLoading(true)
          setError('')
          const request = api({ op: 'exec', id: connection.id, params: { op: 'listFiles', path: normalized } }).then(value => {
            const rawEntries = Array.isArray(value?.data) ? value.data : Array.isArray(value?.items) ? value.items : []
            const nextEntries = rawEntries.map(item => normalizeSshEntry(item, normalized)).filter(item => item.name !== '.' && item.name !== '..')
            directoryCacheRef.current.set(normalized, { entries: nextEntries, updatedAt: Date.now() })
            applyDirectory(normalized, nextEntries, navigate)
            return nextEntries
          }).catch(loadError => {
            if (navigate) setEntries([])
            setError(loadError.message || '目录读取失败')
            return []
          }).finally(() => {
            directoryPendingRef.current.delete(normalized)
            setLoading(false)
          })
          directoryPendingRef.current.set(normalized, request)
          return request
        }
        useEffect(() => {
          directoryCacheRef.current.clear()
          directoryPendingRef.current.clear()
          fileCacheRef.current.clear()
          filePendingRef.current.clear()
          setCurrentPath('/')
          setPathDraft('/')
          setEntries([])
          setTree({ '/': { path: '/', name: '/', children: [], loaded: false } })
          setExpanded({ '/': true })
          void loadDirectory('/', true)
        }, [connection.id])

        const openDirectory = path => {
          const normalized = remoteDirectoryPath(path)
          setExpanded(current => ({ ...current, [normalized]: true }))
          void loadDirectory(normalized, true)
        }
        const toggleDirectory = (event, path) => {
          event.stopPropagation()
          const next = !expanded[path]
          setExpanded(current => ({ ...current, [path]: next }))
          if (next && !tree[path]?.loaded) void loadDirectory(path, false)
        }
        const goParent = () => {
          if (currentPath === '/') return
          const parts = currentPath.split('/').filter(Boolean)
          parts.pop()
          openDirectory('/' + parts.join('/'))
        }
        const refresh = () => {
          directoryCacheRef.current.delete(currentPath)
          void loadDirectory(currentPath, true, true)
        }
        const openPath = () => openDirectory(pathDraft)
        const closeMenu = () => setMenu(null)
        const openContextMenu = (event, entry) => {
          event.preventDefault()
          event.stopPropagation()
          setMenu({ entry, x: Math.min(event.clientX, window.innerWidth - 150), y: Math.min(event.clientY, window.innerHeight - 150) })
        }
        const openEditor = entry => {
          setMenu(null)
          const cached = fileCacheRef.current.get(entry.path)
          const fresh = cached && Date.now() - cached.updatedAt < FILE_CACHE_TTL
          setEditor({ entry, text: cached?.text || '', loading: !fresh, saving: false, error: '' })
          if (fresh) return
          let request = filePendingRef.current.get(entry.path)
          if (!request) {
            request = api({ op: 'exec', id: connection.id, params: { op: 'readFile', path: entry.path } }).then(value => {
              const text = decodeBase64Text(value.text)
              fileCacheRef.current.set(entry.path, { text, updatedAt: Date.now() })
              return text
            }).then(text => {
              filePendingRef.current.delete(entry.path)
              return text
            }, readError => {
              filePendingRef.current.delete(entry.path)
              throw readError
            })
            filePendingRef.current.set(entry.path, request)
          }
          request.then(text => setEditor(current => current?.entry.path === entry.path ? { ...current, text, loading: false } : current)).catch(readError => setEditor(current => current?.entry.path === entry.path ? { ...current, loading: false, error: readError.message || '文件读取失败' } : current))
        }
        const downloadEntry = entry => {
          setMenu(null)
          setStatus(`正在下载 ${entry.name}…`)
          api({ op: 'exec', id: connection.id, params: { op: 'downloadFile', path: entry.path } }).then(value => {
            downloadBase64(value.text, value.filename || entry.name)
            setStatus(`${entry.name} 下载完成`)
          }).catch(downloadError => setError(downloadError.message || '下载失败'))
        }
        const saveEditor = () => {
          if (!editor || editor.loading || editor.saving) return
          const active = editor
          setEditor(current => ({ ...current, saving: true, error: '' }))
          api({ op: 'exec', id: connection.id, params: { op: 'writeFile', path: active.entry.path, content: active.text } }).then(() => {
            setStatus(`${active.entry.name} 已保存`)
            fileCacheRef.current.set(active.entry.path, { text: active.text, updatedAt: Date.now() })
            setEditor(null)
            refresh()
          }).catch(saveError => setEditor(current => current ? { ...current, saving: false, error: saveError.message || '保存失败' } : current))
        }
        const promptName = message => typeof window === 'undefined' ? '' : window.prompt(message, '')
        const createRemote = kind => {
          const name = String(promptName(kind === 'mkdir' ? '新建文件夹名称' : '新建文件名称') || '').trim()
          if (!name || name === '.' || name === '..' || name.includes('/')) return
          const path = remoteJoin(currentPath, name)
          setStatus(kind === 'mkdir' ? '正在创建文件夹…' : '正在创建文件…')
          api({ op: 'exec', id: connection.id, params: { op: kind, path, content: '' } }).then(() => { setStatus('创建成功'); directoryCacheRef.current.delete(currentPath); refresh() }).catch(createError => setError(createError.message || '创建失败'))
        }
        const uploadFile = event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = String(reader.result || '')
            setStatus(`正在上传 ${file.name}…`)
            api({ op: 'exec', id: connection.id, params: { op: 'uploadFile', path: remoteJoin(currentPath, file.name), contentBase64: dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl } }).then(() => { setStatus(`${file.name} 上传完成`); directoryCacheRef.current.delete(currentPath); refresh() }).catch(uploadError => setError(uploadError.message || '上传失败'))
          }
          reader.onerror = () => setError('本地文件读取失败')
          reader.readAsDataURL(file)
        }
        const renderTree = (path, depth = 0) => {
          const node = tree[path] || { path, name: path === '/' ? '/' : path.split('/').pop(), children: [] }
          const children = node.children || []
          return [
            h('button', { key: path, className: 'dsm-ssh-tree-node' + (currentPath === path ? ' active' : ''), style: { paddingLeft: 6 + depth * 14 }, onClick: () => openDirectory(path) },
              h('span', { className: 'dsm-ssh-tree-chevron', onClick: event => toggleDirectory(event, path) }, children.length || !node.loaded ? (expanded[path] ? '⌄' : '›') : ''),
              h('span', { className: 'dsm-ssh-tree-icon' }, '📁'),
              h('span', { className: 'dsm-ssh-tree-name', title: path }, path === '/' ? `根目录${connection.host ? ` · ${connection.host}` : ''}` : node.name),
            ),
            expanded[path] ? children.slice().sort((left, right) => left.name.localeCompare(right.name)).flatMap(child => renderTree(child.path, depth + 1)) : null,
          ]
        }
        return h(React.Fragment, null,
          h('div', { className: 'dsm-ssh-file-layout' },
            h('aside', { className: 'dsm-ssh-file-tree' },
              h('div', { className: 'dsm-ssh-file-tree-head' }, h('span', null, '文件树'), h('button', { className: 'dsm-db-icon-btn', title: '刷新当前目录', onClick: refresh }, loading ? '…' : '↻')),
              renderTree('/', 0),
            ),
            h('section', { className: 'dsm-ssh-file-main' },
              h('div', { className: 'dsm-ssh-file-toolbar' },
                h('button', { className: 'dsm-btn', title: '根目录', onClick: () => openDirectory('/') }, '⌂'),
                h('button', { className: 'dsm-btn', title: '上一级', disabled: currentPath === '/', onClick: goParent }, '↑'),
                h('button', { className: 'dsm-btn', title: '刷新', disabled: loading, onClick: refresh }, '↻'),
                h('input', { className: 'dsm-ssh-path-input', value: pathDraft, onChange: event => setPathDraft(event.target.value), onKeyDown: event => { if (event.key === 'Enter') openPath() }, 'aria-label': '远程路径' }),
                h('button', { className: 'dsm-btn', onClick: openPath }, '打开'),
                h('button', { className: 'dsm-btn primary', onClick: () => createRemote('mkdir') }, '新建文件夹'),
                h('button', { className: 'dsm-btn primary', onClick: () => createRemote('createFile') }, '新建文件'),
                h('button', { className: 'dsm-btn primary', onClick: () => uploadRef.current?.click() }, '上传文件'),
                h('input', { ref: uploadRef, className: 'dsm-ssh-upload-input', type: 'file', onChange: uploadFile }),
              ),
              error ? h('div', { className: 'dsm-ssh-file-error' }, error) : null,
              h('div', { className: 'dsm-ssh-file-table-wrap' }, loading && !entries.length ? h('div', { className: 'dsm-ssh-file-state' }, '正在读取目录…') : h('table', { className: 'dsm-ssh-file-table' },
                h('thead', null, h('tr', null, h('th', null, '名称'), h('th', null, '修改时间'), h('th', null, '权限'), h('th', null, '大小'))),
                h('tbody', null, entries.length ? entries.map(entry => h('tr', { key: entry.path, onDoubleClick: () => entry.isDirectory ? openDirectory(entry.path) : openEditor(entry), onContextMenu: event => openContextMenu(event, entry) },
                  h('td', null, h('div', { className: 'dsm-ssh-file-name' }, h('span', { className: 'dsm-ssh-file-name-icon' }, entry.isDirectory ? '📁' : '📄'), h('span', { className: 'dsm-ssh-file-name-text', title: entry.name }, entry.name))),
                  h('td', { className: 'dsm-ssh-file-muted' }, formatRemoteTime(entry.mtime)),
                  h('td', { className: 'dsm-ssh-file-muted' }, entry.mode),
                  h('td', { className: 'dsm-ssh-file-muted' }, entry.isDirectory ? '—' : formatBytes(entry.size)),
                )) : h('tr', null, h('td', { colSpan: 4 }, h('div', { className: 'dsm-ssh-file-state' }, '此目录为空')))),
              )),
              h('div', { className: 'dsm-ssh-file-footer' }, status || `${entries.length} 项 · 双击目录打开；右键文件可编辑或下载`),
            ),
          ),
          menu ? h('div', { className: 'dsm-ssh-context-backdrop', onClick: closeMenu, onContextMenu: event => { event.preventDefault(); closeMenu() } }, h('div', { className: 'dsm-ssh-context-menu', style: { left: menu.x, top: menu.y }, onClick: event => event.stopPropagation() },
            menu.entry.isDirectory ? h('button', { onClick: () => { closeMenu(); openDirectory(menu.entry.path) } }, '打开目录') : h(React.Fragment, null, h('button', { onClick: () => openEditor(menu.entry) }, '编辑文件'), h('button', { onClick: () => downloadEntry(menu.entry) }, '下载文件')),
          )) : null,
          editor ? h('div', { className: 'dsm-ssh-editor-backdrop', onMouseDown: event => { if (event.target === event.currentTarget && !editor.saving) setEditor(null) } }, h('section', { className: 'dsm-ssh-editor' },
            h('header', { className: 'dsm-ssh-editor-head' }, h('div', { className: 'dsm-ssh-editor-title', title: editor.entry.path }, `编辑 · ${editor.entry.name}`), h('span', { className: 'dsm-help' }, editor.entry.path), h('button', { className: 'dsm-close', disabled: editor.saving, onClick: () => setEditor(null) }, '×')),
            h('div', { className: 'dsm-ssh-editor-body' }, editor.loading ? h('div', { className: 'dsm-ssh-file-state' }, '正在读取文件…') : h('textarea', { className: 'dsm-ssh-editor-textarea', value: editor.text, onChange: event => setEditor(current => ({ ...current, text: event.target.value })), spellCheck: false })),
            editor.error ? h('div', { className: 'dsm-ssh-file-error' }, editor.error) : null,
            h('footer', { className: 'dsm-ssh-editor-foot' }, h('button', { className: 'dsm-btn', disabled: editor.saving, onClick: () => setEditor(null) }, '取消'), h('button', { className: 'dsm-btn primary', disabled: editor.loading || editor.saving, onClick: saveEditor }, editor.saving ? '保存中…' : '保存')),
          )) : null,
        )
      }

      function SshWorkspace({ connection, api, onBack, onEdit }) {
        const [view, setView] = useState('files')
        return h(React.Fragment, null,
          h(WorkspaceHeader, { connection, onBack, onEdit }),
          h(SshOverview, { connection, api }),
          h('div', { className: 'dsm-ssh-workspace-tabs', role: 'tablist' },
            h('button', { className: 'dsm-ssh-workspace-tab' + (view === 'files' ? ' active' : ''), role: 'tab', 'aria-selected': view === 'files', onClick: () => setView('files') }, '文件管理'),
            h('button', { className: 'dsm-ssh-workspace-tab' + (view === 'terminal' ? ' active' : ''), role: 'tab', 'aria-selected': view === 'terminal', onClick: () => setView('terminal') }, '交互式终端'),
          ),
          view === 'files' ? h(SshFileManager, { connection, api }) : h(SshTerminalPanel, { connection, api }),
        )
      }

      function OperationView({ connection, api, onBack, onEdit, embedded = false }) {
        const [op, setOp] = useState('test')
        const [fields, setFields] = useState({ path: '/', key: '', bucket: connection.options?.bucket || '', collection: '', container: '', pattern: '*', tail: '200', limit: '100', value: '', text: '', sql: '', cql: '', body: '', content: '', contentBase64: '', fileName: '', filter: '{}', method: 'GET', prefix: '' })
        const [result, setResult] = useState(null)
        const [busy, setBusy] = useState(false)
        const [terminalId, setTerminalId] = useState('')
        const [terminalText, setTerminalText] = useState('')
        const [terminalInput, setTerminalInput] = useState('')
        const [terminalBusy, setTerminalBusy] = useState(false)
        const terminalOutputRef = useRef(null)
        const set = (key, value) => setFields(current => ({ ...current, [key]: value }))
        const run = () => {
          setBusy(true); setResult(null)
          const params = { op, ...fields }
          api({ op: 'exec', id: connection.id, params }).then(setResult).catch(error => setResult({ ok: false, error: error.message })).finally(() => setBusy(false))
        }
        const appendTerminal = value => {
          const text = normalizeTerminalText(value?.text)
          if (text) setTerminalText(current => current + text)
        }
        const terminalRequest = (operation, extra = {}) => api({ op: 'exec', id: connection.id, params: { op: operation, terminalId, ...extra } })
        const openTerminal = () => {
          setTerminalBusy(true)
          terminalRequest('terminalOpen', { terminalId: undefined }).then(value => { setTerminalId(value.terminalId || ''); setTerminalText(normalizeTerminalText(value.text)) }).catch(error => setTerminalText(current => current + `\n  [连接失败] ${normalizeTerminalText(error.message)}\n  `)).finally(() => setTerminalBusy(false))
        }
        const sendTerminal = () => {
          if (!terminalId || !terminalInput) return
          const data = terminalInput + '\n  '
          setTerminalInput('')
          terminalRequest('terminalWrite', { data }).then(appendTerminal).catch(error => setTerminalText(current => current + `\n  [发送失败] ${normalizeTerminalText(error.message)}\n  `))
        }
        const closeTerminal = () => {
          if (!terminalId) return
          const id = terminalId
          terminalRequest('terminalClose').catch(() => {}).finally(() => { if (id === terminalId) setTerminalId('') })
        }
        useEffect(() => {
          if (!terminalId) return undefined
          const timer = setInterval(() => terminalRequest('terminalRead').then(appendTerminal).catch(() => {}), 500)
          return () => clearInterval(timer)
        }, [terminalId])
        useEffect(() => {
          const output = terminalOutputRef.current
          if (output) output.scrollTop = output.scrollHeight
        }, [terminalText])
        useEffect(() => () => { if (terminalId) api({ op: 'exec', id: connection.id, params: { op: 'terminalClose', terminalId } }).catch(() => {}) }, [connection.id, terminalId])
        const queryLabel = ['mysql', 'mariadb', 'postgresql', 'mssql'].includes(connection.type) ? 'SQL' : connection.type === 'cassandra' ? 'CQL' : connection.type === 'mongodb' ? 'JSON 操作' : connection.type === 'elasticsearch' ? 'JSON Body' : '命令 / 查询'
        const queryKey = ['mysql', 'mariadb', 'postgresql', 'mssql'].includes(connection.type) ? 'sql' : connection.type === 'cassandra' ? 'cql' : connection.type === 'elasticsearch' ? 'body' : 'text'
        const needsQuery = ['query', 'exec'].includes(op)
        const authIssue = credentialIssue(connection)
        return h(React.Fragment, null,
          embedded ? null : h('div', { className: 'dsm-actions dsm-operation-head', style: { marginTop: 0 } }, h('button', { className: 'dsm-btn', onClick: onBack }, '← 返回连接列表'), h('span', { className: 'dsm-title' }, `${connection.name} · ${typeLabel(connection.type)}`), h('span', { className: 'dsm-sub' }, `${connection.host || '本机'}${connection.port ? ':' + connection.port : ''}`), onEdit ? h('button', { className: 'dsm-btn', onClick: onEdit }, '编辑连接') : null),
          authIssue ? h('div', { className: 'dsm-error dsm-notice' }, h('span', null, `此连接未配置${authIssue}。`), onEdit ? h('button', { className: 'dsm-btn', onClick: onEdit }, '补录凭据') : null) : null,
          embedded ? null : h(ServiceOverview, { connection, api }),
          h('div', { className: 'dsm-section' }, '读取 / 写入操作'),
          h('div', { className: 'dsm-grid' },
            h('div', { className: 'dsm-field' }, h('label', { className: 'dsm-label' }, '操作'), h('select', { className: 'dsm-select', value: op, onChange: event => setOp(event.target.value) }, (OP_META[connection.type] || ['test']).map(item => h('option', { key: item, value: item }, OP_LABEL[item] || item)))),
            connection.type === 'elasticsearch' ? h('div', { className: 'dsm-field' }, h('label', { className: 'dsm-label' }, 'HTTP Method'), h('select', { className: 'dsm-select', value: fields.method, onChange: event => set('method', event.target.value) }, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(item => h('option', { key: item, value: item }, item)))) : null,
            ['ftp', 'ssh'].includes(connection.type) && op !== 'terminal' ? h(Field, { label: '远程路径', value: fields.path, onChange: value => set('path', value), placeholder: '/var/log/app.log' }) : null,
            ['redis'].includes(connection.type) ? h(Field, { label: 'Key', value: fields.key, onChange: value => set('key', value) }) : null,
            ['s3'].includes(connection.type) ? h(Field, { label: 'Bucket', value: fields.bucket, onChange: value => set('bucket', value) }) : null,
            ['s3'].includes(connection.type) && op === 'listObjects' ? h(Field, { label: 'Prefix', value: fields.prefix, onChange: value => set('prefix', value) }) : null,
            ['s3'].includes(connection.type) && ['readObject', 'writeObject', 'deleteObject'].includes(op) ? h(Field, { label: 'Object Key', value: fields.key, onChange: value => set('key', value), wide: true }) : null,
            ['mongodb'].includes(connection.type) && ['find'].includes(op) ? h(Field, { label: 'Collection', value: fields.collection, onChange: value => set('collection', value) }) : null,
            ['docker'].includes(connection.type) && ['logs', 'start', 'stop', 'exec'].includes(op) ? h(Field, { label: 'Container', value: fields.container, onChange: value => set('container', value) }) : null,
            connection.type === 'elasticsearch' && op === 'query' ? h(Field, { label: 'API Path', value: fields.path, onChange: value => set('path', value), placeholder: '/_search', wide: true }) : null,
            connection.type === 'redis' && op === 'listKeys' ? h(Field, { label: 'Key Pattern', value: fields.pattern, onChange: value => set('pattern', value), placeholder: '*' }) : null,
            connection.type === 'docker' && op === 'logs' ? h(Field, { label: '日志行数', value: fields.tail, onChange: value => set('tail', value), type: 'number' }) : null,
            connection.type === 'mongodb' && op === 'find' ? h(Field, { label: '返回数量', value: fields.limit, onChange: value => set('limit', value), type: 'number' }) : null,
            needsQuery ? h('div', { className: 'dsm-field wide' }, h('label', { className: 'dsm-label' }, queryLabel), h('textarea', { className: 'dsm-textarea', value: fields[queryKey], onChange: event => set(queryKey, event.target.value), placeholder: connection.type === 'mongodb' ? '{"action":"find","collection":"users","filter":{}}' : connection.type === 'redis' ? '["GET","key"]' : '' })) : null,
            op === 'find' ? h(Field, { label: 'Filter JSON', value: fields.filter, onChange: value => set('filter', value) }) : null,
            ['writeFile', 'writeObject'].includes(op) ? h('div', { className: 'dsm-field wide' }, h('label', { className: 'dsm-label' }, '写入内容'), h('textarea', { className: 'dsm-textarea', value: fields.content, onChange: event => set('content', event.target.value) })) : null,
            op === 'uploadFile' ? h('div', { className: 'dsm-field wide' }, h('label', { className: 'dsm-label' }, '选择本地文件'), h('input', { className: 'dsm-input', type: 'file', onChange: event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const value = String(reader.result || ''); set('contentBase64', value.includes(',') ? value.slice(value.indexOf(',') + 1) : value); set('fileName', file.name) }; reader.readAsDataURL(file) } }), fields.fileName ? h('div', { className: 'dsm-help' }, `${fields.fileName} · 将写入 ${fields.path}`) : null) : null,
            ['setKey'].includes(op) ? h(Field, { label: 'Value', value: fields.value || '', onChange: value => set('value', value), wide: true }) : null,
          ),
          op === 'terminal' ? h('div', { className: 'dsm-terminal-wrap' }, h('div', { className: 'dsm-actions', style: { marginTop: 8 } }, !terminalId ? h('button', { className: 'dsm-btn primary', disabled: terminalBusy, onClick: openTerminal }, terminalBusy ? '连接中…' : '打开远程终端') : h('button', { className: 'dsm-btn danger', onClick: closeTerminal }, '关闭终端'), h('span', { className: 'dsm-help' }, terminalId ? '已连接；输入命令后按 Enter 执行。' : '使用 SSH shell 建立远程终端会话。')), h('pre', { ref: terminalOutputRef, className: 'dsm-terminal-output' }, terminalText || '终端输出将在这里显示'), h('textarea', { className: 'dsm-textarea dsm-terminal-input', disabled: !terminalId, value: terminalInput, onChange: event => setTerminalInput(event.target.value), onKeyDown: event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendTerminal() } }, placeholder: terminalId ? '输入远程命令，Enter 执行' : '请先打开终端' })) : h('div', { className: 'dsm-actions' }, h('button', { className: 'dsm-btn primary', disabled: busy, onClick: run }, busy ? '执行中…' : '执行操作'), h('span', { className: 'dsm-help' }, '写入、删除和容器控制操作会直接作用于远端服务。')),
          h('div', { className: 'dsm-result' }, busy ? h('div', { className: 'dsm-empty' }, '执行中…') : h(Result, { value: result })),
          result?.encoding === 'base64' ? h('div', { className: 'dsm-actions' }, h('button', { className: 'dsm-btn primary', onClick: () => downloadBase64(result.text, result.filename) }, '下载到本地')) : null,
        )
      }

      let servicePaneSequence = 0

      function ServicePane({ api, connection: initialConnection, editing: initialEditing, onSaved, close }) {
        const [connection, setConnection] = useState(initialConnection || null)
        const [editing, setEditing] = useState(initialEditing || null)
        const save = saved => {
          setConnection(saved)
          setEditing(null)
          onSaved?.(saved)
        }
        const cancelEdit = () => {
          if (connection) setEditing(null)
          else close()
        }
        const content = editing ? h(ConnectionForm, {
          value: editing,
          api,
          onCancel: cancelEdit,
          onSaved: save,
        }) : connection ? (connection.type === 'ssh'
          ? h(SshWorkspace, { key: connection.id, connection, api, onBack: close, onEdit: () => setEditing(connection) })
          : RELATIONAL_TYPES.has(connection.type)
            ? h(DatabaseWorkspace, { key: connection.id, connection, api, onBack: close, onEdit: () => setEditing(connection) })
            : DATA_WORKSPACE_TYPES.has(connection.type)
              ? h(DataWorkspace, { key: connection.id, connection, api, onBack: close, onEdit: () => setEditing(connection) })
            : h(OperationView, { key: connection.id, connection, api, onBack: close, onEdit: () => setEditing(connection) }))
          : h('div', { className: 'dsm-empty' }, '选择左侧连接，或新建一个服务连接。')
        return h('main', { className: 'dsm-main dsm-center-main' }, content)
      }

      function ServicePaneLayer({ api, pane, onClose, onSaved }) {
        if (!pane) return null
        return h('div', { className: 'dsm-center-pane-layer', 'aria-label': '中间区域服务器操作' },
          h('div', { className: 'dsm-center-pane-grid' },
            h('section', { className: 'dsm-center-pane', 'aria-label': pane.title || '服务器操作' },
              h('header', { className: 'dsm-center-pane-head' },
                h('span', { className: 'dsm-center-pane-title' }, pane.connection ? `${pane.connection.name} · ${typeLabel(pane.connection.type)}` : '新建服务连接'),
                h('span', { className: 'dsm-center-pane-kind' }, '服务器配置与操作'),
                h('button', { className: 'dsm-center-pane-action', title: '返回会话', 'aria-label': '返回会话', onClick: onClose }, '×'),
              ),
              h('div', { className: 'dsm-center-pane-body' }, h(ServicePane, {
                key: pane.id,
                api,
                connection: pane.connection,
                editing: pane.editing,
                onSaved,
                close: onClose,
              })),
            ),
          ),
        )
      }

      function ManagerPanel({ api, onClose, embedded = false }) {
        const [connections, setConnections] = useState([])
        const [sdk, setSdk] = useState({})
        const [editing, setEditing] = useState(null)
        const [workspace, setWorkspace] = useState(null)
        const [centerPane, setCenterPane] = useState(null)
        const [error, setError] = useState('')
        const load = () => Promise.all([api({ op: 'list' }), api({ op: 'capabilities' })]).then(([list, capabilities]) => { setConnections(list.connections || []); setSdk(capabilities.available || {}) }).catch(error => setError(error.message))
        useEffect(() => { load() }, [])
        const selected = workspace && connections.find(item => item.id === workspace.id)
        const saved = connection => setConnections(list => list.some(item => item.id === connection.id) ? list.map(item => item.id === connection.id ? connection : item) : [...list, connection])
        const openConnection = connection => setCenterPane({ id: `server:${connection.id}`, connection, editing: null })
        const openNew = () => {
          const id = `server:new:${++servicePaneSequence}`
          setCenterPane({ id, connection: null, editing: blankConnection() })
        }
        const closePane = () => setCenterPane(null)
        const savePane = connection => {
          saved(connection)
          setCenterPane(current => current ? { ...current, connection, editing: null } : current)
        }
        const list = connections.length ? connections.map(connection => h('button', {
          key: connection.id,
          className: 'dsm-card' + (selected?.id === connection.id || centerPane?.connection?.id === connection.id ? ' active' : ''),
          onClick: () => openConnection(connection),
          title: `${connection.name} · ${typeLabel(connection.type)} · ${connection.host || '本机'}${connection.port ? ':' + connection.port : ''}`,
          'aria-label': `打开连接 ${connection.name}`,
        }, h('span', { className: 'dsm-card-icon' }, TYPE_META[connection.type]?.icon || '🔌'), h('span', { className: 'dsm-card-copy' }, h('span', { className: 'dsm-card-name' }, connection.name), h('span', { className: 'dsm-card-meta' }, h('span', { className: 'dsm-dot ' + (sdk[connection.type] === false || missingCredential(connection) ? 'bad' : '') }), `${typeLabel(connection.type)} · ${connection.host || '本机'}${connection.port ? ':' + connection.port : ''}`)), h('span', { className: 'dsm-sub' }, '›'))) : h('div', { className: 'dsm-empty' }, '还没有服务连接\n  点击右上角新建')
        const fallbackContent = editing ? h(ConnectionForm, { value: editing, api, onCancel: () => setEditing(null), onSaved: connection => { setEditing(null); saved(connection) } }) : selected ? (selected.type === 'ssh' ? h(SshWorkspace, { key: selected.id, connection: selected, api, onBack: () => setWorkspace(null), onEdit: () => setEditing(selected) }) : RELATIONAL_TYPES.has(selected.type) ? h(DatabaseWorkspace, { key: selected.id, connection: selected, api, onBack: () => setWorkspace(null), onEdit: () => setEditing(selected) }) : DATA_WORKSPACE_TYPES.has(selected.type) ? h(DataWorkspace, { key: selected.id, connection: selected, api, onBack: () => setWorkspace(null), onEdit: () => setEditing(selected) }) : h(OperationView, { key: selected.id, connection: selected, api, onBack: () => setWorkspace(null), onEdit: () => setEditing(selected) })) : h('div', { className: 'dsm-empty' }, '点击左侧连接，在中间区域打开服务器操作。')
        const panel = h('section', { className: 'dsm-panel' + (embedded ? ' dsm-embedded-panel' : ''), onClick: event => event.stopPropagation() },
          h('header', { className: 'dsm-head' }, h('span', { className: 'dsm-title' }, '服务管理'), h('span', { className: 'dsm-sub' }, `${connections.length} 个连接`), h('button', { className: 'dsm-btn primary', onClick: openNew }, '+ 新建连接'), h('button', { className: 'dsm-close', onClick: onClose }, '×')),
          error ? h('div', { className: 'dsm-error', style: { margin: '10px 15px 0' } }, error) : null,
          h('div', { className: 'dsm-body' },
            h('aside', { className: 'dsm-list' }, list,
              h('div', { className: 'dsm-help', style: { marginTop: 14 } }, '支持 FTP、SSH、Redis、MySQL、MariaDB、PostgreSQL、SQL Server、Elasticsearch、Docker、MongoDB、Cassandra 和各种 S3。'),
            ),
            !embedded ? h('main', { className: 'dsm-main' }, fallbackContent) : null,
          ),
        )
        const result = embedded ? h(React.Fragment, null, panel, h(ServicePaneLayer, { api, pane: centerPane, onClose: closePane, onSaved: savePane })) : h('div', { className: 'dsm-backdrop', onClick: onClose }, panel)
        return result
      }

      function ServiceManagerIcon() {
        return h('svg', {
          viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
          strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
          h('ellipse', { cx: 12, cy: 5, rx: 7, ry: 3 }),
          h('path', { d: 'M5 5v6c0 1.66 3.13 3 7 3s7-1.34 7-3V5' }),
          h('path', { d: 'M5 11v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6' }),
        )
      }

      return {
        // This helper is composed by the resource-center module explicitly. It must
        // not become a second loader fiber with its own pending dependencies.
        inject: [],
      apply(ctx, options = {}) {
        installStyle()
        const api = body => apiRequest(body)
        const sidebar = options.sidebar || ctx.get('resourceCenter') || ctx.get('dshResourceCenter')
        if (!sidebar || typeof sidebar.registerActivity !== 'function') return
        ctx.effect(() => sidebar.registerActivity({
          id: 'dsh-service-manage',
          label: '服务管理',
          order: 20,
          icon: ServiceManagerIcon,
          component: props => h(ManagerPanel, { api, onClose: props.close, embedded: true }),
        }), 'dsh-service-manage: sidebar activity')
        const inputTriggers = ctx.get('inputTriggers')
        if (inputTriggers) ctx.effect(() => inputTriggers.registerSource(createServerInputSource()), 'dsh-service-manage: @server source')
      },
      }
    },
  })
  global.__dshResourceCenterServiceManagerRegistered = true
  }
})(typeof window === "undefined" ? globalThis : window);
