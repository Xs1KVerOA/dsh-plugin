# dsh-resource-center

`dsh-resource-center` 是 DeepSeek Harness 的资源中心插件。它把工作区会话树、服务管理和其他插件 Activity 统一到一个 VSCode 风格的侧栏中，并把服务配置与操作页面切换到 Harness 的中央内容区。

## 功能

### 资源中心侧栏

- 以工作区文件夹组织会话，支持展开、收起、重命名、删除和新增会话。
- 右键会话支持重命名、分叉和归档。
- 搜索工作区、会话标题、会话 ID 以及会话正文内容。
- “新建工作区”固定在侧栏底部。
- 侧栏根据宿主实际布局尺寸调整，不覆盖其他插件的 Activity 或中央内容区。
- 通过 `resourceCenter` 服务向其他 Web 插件开放 Activity 注册接口。

右侧工作台中的浏览器也提供 `MITM 监听` 开关。它读取并启停资源中心 Test 模块的同一个 MITM runtime，使用左侧已保存的监听地址、端口、拦截规则和 HaE 配置；开启后，浏览器地址栏加载的页面会通过 `/api/dsh-web-testing/browser`，因此请求会进入同一份 MITM 流量记录。该开关不会创建第二个代理实例。

当前 DSH 浏览器是宿主侧的沙箱 iframe，插件没有改写浏览器内核网络出口的接口。因此这里提供的是资源中心浏览器路由模式：普通 HTTP/HTTPS 页面会经过资源中心 Host 路由并记录；它不等同于系统级透明代理，也不能在宿主 iframe 内解密所有第三方 HTTPS 子资源。资源中心的 MITM 监听可与浏览器页联动，但当前不承诺浏览器内核级 HTTPS 解密；需要该能力时应由宿主提供 Browser Transport/代理注入 seam。

### 服务管理

内置服务管理 Activity，迁移并整合原 `dsh-service-manage` 的功能：

- SSH、FTP、Redis、MySQL、MariaDB、PostgreSQL、SQL Server、Elasticsearch、Docker、MongoDB、Cassandra 和 S3/MinIO/R2。
- 密码、SSH 私钥、S3 Access Key/Secret Key/Session Token，以及 SSH/TCP/SOCKS5 代理。
- SSH 服务器概览，包括 CPU、内存、磁盘、系统、运行时间和监听端口。
- SSH 文件树、目录浏览、文件读取、上传、下载和远程交互式终端。
- 数据库、缓存、容器、对象存储等服务的连接测试、版本/信息查询和对应操作。
- 会话输入框中的统一 `@` 引用菜单：可引用其他会话、Web Fuzzer 历史请求、MITM 流量记录和已保存服务连接；发送时按引用类型序列化为上下文。
- 配置和操作页面在中央主区域展示，关闭操作页即可回到当前会话。

服务管理使用 Node.js SDK，不调用系统 CLI；连接密钥由 Harness `credentials` 服务管理。

### 用量统计

资源中心内置独立的“用量统计”侧栏模块，默认固定在 Activity 侧栏底部。它由资源中心自己监听 `llm/stream`、回填历史会话、按计费时段和模型计算费用，并持久化到工作区的 `.dsh-resource-center-usage-stats.json`。面板展示总费用、调用次数、输入/输出 tokens、分时段、分模型、近 14 天趋势和会话消费 Top 5，并提供历史回填、刷新和二次确认清空。

用量接口使用资源中心专属命名空间 `/api/dsh-resource-center/usage-stats`，不依赖 `dsh-usage-billing`。因此卸载 `dsh-usage-billing` 后，资源中心仍能独立采集和展示用量；如果 Host 模块未加载，面板会明确提示 Host 服务不可用。

## 快速安装

要求 Node.js `>=22.19.0`，以及与当前发布包一致的 DeepSeek Harness release；当前源码验证目标为 `0.1.0-rc.5`。

### 从 GitHub 安装

```sh
git clone git@github.com:Xs1KVerOA/dsh-plugin.git
npx @deepseek-ai/dsh plugin --profile web add --allow-build=ssh2 --allow-build=cpu-features --allow-build=protobufjs "$PWD/dsh-plugin/resource-center-plugin"
npx @deepseek-ai/dsh --profile web --dump-config
cd "$PWD/dsh-plugin"
./start-local.sh
```

当前 DSH/pnpm profile 安装器可能要求显式批准 `ssh2`、`cpu-features` 和 `protobufjs` 的安装脚本。没有 C/C++ 编译环境时，SSH 仍可使用纯 JavaScript fallback；可选 native binding 不影响基本连接能力。

### 从本地目录安装

```sh
git clone https://github.com/Xs1KVerOA/dsh-plugin.git
cd dsh-plugin/resource-center-plugin
npm install
npx @deepseek-ai/dsh plugin --profile web add --allow-build=ssh2 --allow-build=cpu-features --allow-build=protobufjs "$PWD"
cd ..
./start-local.sh
```

安装或更新后使用仓库根目录的 `./start-local.sh` 重启 Harness；浏览器端如仍显示旧侧栏，请执行 Cmd/Ctrl+Shift+R 硬刷新。

不要使用 `npx @deepseek-ai/dsh web` 作为本地开发或加固验证入口。它可能从临时 npx cache 读取旧的 DSH Host/Client bundle；`start-local.sh` 会先构建当前源码、校验 profile 的 `link:` 依赖，再启动同级 Harness checkout。

### 安装 Release 包

在仓库根目录执行：

```sh
npm install
npm run check
npm pack
```

然后将生成的 `dsh-resource-center-<version>.tgz` 安装到 profile：

```sh
npx @deepseek-ai/dsh plugin --profile web add --allow-build=ssh2 --allow-build=cpu-features --allow-build=protobufjs ./dsh-resource-center-0.1.0.tgz
```

## Activity 扩展接口

其他 Web client 插件可以依赖 `dsh-resource-center`，通过 `resourceCenter` 注册自己的图标和面板：

```js
const React = require('react')
const h = React.createElement

function MyPanel() {
  return h('div', { style: { padding: 12 } }, '我的插件面板')
}

function MyIcon() {
  return h('span', { 'aria-hidden': 'true' }, '★')
}

return {
  inject: ['resourceCenter'],
  apply(ctx) {
    const sidebar = ctx.get('resourceCenter')
    ctx.effect(() => sidebar.registerActivity({
      id: 'my-plugin',
      label: '我的插件',
      order: 30,
      icon: MyIcon,
      component: MyPanel,
    }), 'my-plugin: resource-center activity')
  },
}
```

`registerActivity()` 返回卸载函数。插件卸载时图标和面板会自动移除；也可以使用以下方法控制面板：

```js
sidebar.open('my-plugin')
sidebar.close()
sidebar.toggle('my-plugin')
sidebar.getActive()
```

## 使用方式

1. 启动 Harness 后，默认打开资源中心的工作区侧栏。
2. 点击工作区图标浏览会话；点击会话进入对应对话。
3. 点击服务管理图标，再选择连接。
4. 连接的配置、服务器概览、文件管理和终端操作会在中央内容区展示。
5. 在会话输入框输入 `@`，按分类搜索并选择会话、Web Fuzzer 历史、MITM 流量或服务连接；选中后会以引用胶囊保留，发送时再加载对应上下文。

服务引用只包含连接 ID、名称、类型、地址、数据库和通道元数据，不包含密码、私钥或云密钥。模型需要通过 `dsh_server_manage` 调用服务管理通道完成实际操作。会话引用默认截取最近可用的会话事件上下文；Web Fuzzer 和 MITM 引用分别包含请求模板/Payload/结果，以及请求包/响应包。

## 支持的 Node.js SDK

| 服务 | SDK |
| --- | --- |
| SSH | `ssh2` |
| FTP | `basic-ftp` |
| Redis | `redis` |
| MySQL / MariaDB | `mysql2` |
| PostgreSQL | `pg` |
| SQL Server | `mssql` |
| Elasticsearch | `@elastic/elasticsearch` |
| Docker | `dockerode` |
| MongoDB | `mongodb` |
| Cassandra | `cassandra-driver` |
| S3 兼容服务 | `@aws-sdk/client-s3` |
| SOCKS5 代理 | `socks` |

## 数据与安全

- 非敏感连接元数据写入当前工作区的 `.dsh-servers.json`。
- 密码、私钥和云密钥通过 Harness `credentials` 服务保存，不写入连接配置文件。
- 服务器列表接口只返回密钥是否已配置，不返回密钥内容。
- 服务管理 API 仅用于本机 Harness Web Server，不向局域网开放。
- SSH、SOCKS5 和 TCP 转发隧道由插件生命周期管理；插件卸载时会关闭隧道和终端。
- 写入、删除、SQL/CQL、远程命令以及容器启停都可能产生真实副作用，请只对受授权的服务使用。

## 常见问题

### 安装后没有侧栏入口

确认 profile 中包含 `dsh-resource-center`，然后重启对应的 `dsh web`。可以使用以下命令检查：

```sh
npx @deepseek-ai/dsh plugin --profile web list
npx @deepseek-ai/dsh --profile web --dump-config
```

### `@` 引用候选为空

先确认对应数据已经存在：服务连接需要先保存，Web Fuzzer 需要至少执行一次请求，MITM 需要已有流量记录。重新聚焦会话输入框后输入 `@`；候选菜单按“会话 / Web Fuzzer / MITM / 服务连接”分组，并支持继续输入关键词过滤。

### SSH 连接失败

先执行“测试连接”，再分别检查地址、端口、认证密钥、代理跳板机和目标服务器权限。插件不会把密码或私钥写入 `.dsh-servers.json`。

## 开发与验证

```sh
npm install
npm run build:client
npm run check
npm test
npm pack --dry-run
```

Host 侧入口为 `index.js` 和 `service-manager-host.js`。客户端代码按侧栏模块拆分在 `client/modules/` 下：

```text
client/
├── main.js                         # 模块依赖图与按需加载入口
└── modules/
    ├── workspace/index.js          # 工作区侧栏
    ├── service-manager/index.js    # 服务管理侧栏
    ├── test/index.js               # Test 侧栏（MITM / Web Fuzzer）
    ├── right-sidebar/vendor/core.js # 独立迁移的右侧工作台客户端核心
    ├── right-sidebar/index.js      # 资源中心自己的浏览器/MITM 联动层
    └── usage-stats/index.js        # 用量统计侧栏
```

用量统计的 Host 采集器和价格配置位于根目录的 `usage-stats-host.js` 与 `usage-pricing.json`，和客户端模块一起随 npm 包发布。

由于 DSH Client Loader 接收的是静态脚本，`scripts/build-client.js` 会把这些独立源模块生成到运行时的 `client.js`。默认加载全部模块；开发或集成其他侧栏时，可以设置 `window.__DSH_RESOURCE_CENTER_MODULES`，例如 `['workspace']`，入口会自动加载依赖并只注册所选模块。这样各侧栏可以分别开发，只有模块入口和注册 ID 需要协作。

右侧工作台已经独立迁入资源中心：`right-sidebar/vendor/core.js` 固化 explorer、editor、terminal、git、browser、tab 和 bottom panel 等能力，Host 侧的 `right-sidebar-host.js` 独立提供文件、Git、终端、懒加载 chunk 和 WebSocket 路由，并使用 `/dsh-resource-center/sidebar/*` 命名空间。`right-sidebar/index.js` 只负责把浏览器页与资源中心 MITM 联动。其他模块仍可通过 `resourceCenter` 的 `openRightSidebar`、`closeRightSidebar` 和 `toggleRightSidebar` 控制右侧工作台。

`Test` 模块将原 `dsh-web-testing` 的 MITM 和 Web Fuzzer 合并到一个侧栏 Activity 中，通过面板内的标签切换。Host 侧运行时位于 `test-host.js`，提供 `/api/dsh-web-testing/*` API、`dsh_web_fuzzer` 和 `dsh_mitm_capture` 工具；默认只绑定本机、代理不自动启动，不对测试目标地址段做 SSRF 拦截。请仅在已授权的测试环境中使用。

Web Fuzzer 的“网络配置”位于 Test 侧栏，可对一次 Fuzz 的全部请求生效：

- 支持 HTTP/HTTPS 和 SOCKS5/SOCKS5H 代理，可填写带认证信息的代理 URL。
- 支持 CA PEM、客户端证书 PEM 和客户端私钥 PEM，用于自签名证书校验和 mTLS。
- 支持跳过 TLS 校验与强制 HTTPS。
- “HTTPS 劫持 / MITM”会要求配置 HTTP/HTTPS MITM 代理；resource-center 内置代理的 CONNECT 仍是 TCP 透传，不会自行签发证书解密流量。要查看解密后的 HTTPS 内容，请使用 mitmproxy、Burp 等外部 MITM 代理，并将其 CA 填入配置。

MITM 的代理开关和拦截配置位于 Test 侧栏，右侧流量区按 Yakit 风格展示抓取记录：

- 支持手动劫持：先暂停请求，放行后可继续暂停响应，再选择放行原响应、替换响应或丢弃。
- 支持自动放行规则，以及按路由片段和 URL 后缀筛选需要进入手动队列的 HTTP 请求。
- 支持 HaE 风格正则规则，在请求头/体和响应头/体中高亮并提取敏感数据；默认提供 JWT、Email、AWS Access Key、Bearer Token 四类常用规则，也支持在侧栏编辑、格式化和恢复规则。
- HaE 规则保存时会校验 JSON 与正则表达式；保存配置后会重新计算已有流量，关闭检测时会清理历史高亮并同步列表统计。
- 每次 Fuzz 都进入 Test 模块的共享 History，不区分当前 Web Fuzzer 实例；在 `@` 菜单中可按请求、Payload 和结果搜索，选中后引用或回到 Fuzzer 提取/重放。
- MITM 流量记录同样进入统一 `@` 菜单，选中后会把请求包和响应包作为上下文引用；MITM 详情页仍支持直接发送到 Web Fuzzer。
- 内置代理的 HTTPS `CONNECT` 当前只建立 TCP 透传隧道；如需 HTTPS 解密和逐包劫持，请配置外部 MITM 代理并信任对应 CA。

由于这些 Host/API/工具已经随 resource-center 一起提供，同一个 profile 不需要再额外安装 `dsh-web-testing`，否则会重复注册同名能力。

Bundle 通过 `cordis.patch.yml` 注册，客户端依赖在 `package.json` 的 `dsh.client.inject` 中声明。

resource-center 的 Test 模块只限制 MITM 监听端点绑定到 loopback，不限制 Fuzzer、MITM 或浏览器路由的目标地址。代理默认不自动启动，请仅在授权测试环境中按需打开：

```yaml
- insert:
    - id: dsh-resource-center
      name: 'dsh-resource-center'
      config:
        listenHost: '127.0.0.1'
        listenPort: 0
        autoStart: false
```

## License

MIT License，见 [LICENSE](LICENSE)。
