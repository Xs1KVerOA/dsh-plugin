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

### 服务管理

内置服务管理 Activity，迁移并整合原 `dsh-service-manage` 的功能：

- SSH、FTP、Redis、MySQL、MariaDB、PostgreSQL、SQL Server、Elasticsearch、Docker、MongoDB、Cassandra 和 S3/MinIO/R2。
- 密码、SSH 私钥、S3 Access Key/Secret Key/Session Token，以及 SSH/TCP/SOCKS5 代理。
- SSH 服务器概览，包括 CPU、内存、磁盘、系统、运行时间和监听端口。
- SSH 文件树、目录浏览、文件读取、上传、下载和远程交互式终端。
- 数据库、缓存、容器、对象存储等服务的连接测试、版本/信息查询和对应操作。
- 会话输入框中的 `@` 服务器引用，以及 `dsh_server_manage` 工具通道。
- 配置和操作页面在中央主区域展示，关闭操作页即可回到当前会话。

服务管理使用 Node.js SDK，不调用系统 CLI；连接密钥由 Harness `credentials` 服务管理。

## 快速安装

要求 Node.js `>=22.19.0`，以及 DeepSeek Harness `0.1.0-rc.6` 或更高版本。

### 从 GitHub 安装

```sh
npx @deepseek-ai/dsh plugin --profile web add --allow-build=ssh2 --allow-build=cpu-features --allow-build=protobufjs https://github.com/Xs1KVerOA/dsh-resource-center.git
npx @deepseek-ai/dsh --profile web --dump-config
npx @deepseek-ai/dsh web
```

当前 DSH/pnpm profile 安装器可能要求显式批准 `ssh2`、`cpu-features` 和 `protobufjs` 的安装脚本。没有 C/C++ 编译环境时，SSH 仍可使用纯 JavaScript fallback；可选 native binding 不影响基本连接能力。

### 从本地目录安装

```sh
git clone https://github.com/Xs1KVerOA/dsh-resource-center.git
cd dsh-resource-center
npm install
npx @deepseek-ai/dsh plugin --profile web add --allow-build=ssh2 --allow-build=cpu-features --allow-build=protobufjs "$PWD"
npx @deepseek-ai/dsh web
```

安装或更新后重启 Harness；浏览器端如仍显示旧侧栏，请执行 Cmd/Ctrl+Shift+R 硬刷新。

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
5. 在会话输入框输入 `@`，可以从已保存连接中选择服务器并提交给模型。

服务引用只包含连接 ID、名称、类型、地址、数据库和通道元数据，不包含密码、私钥或云密钥。模型需要通过 `dsh_server_manage` 调用服务管理通道完成实际操作。

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

### `@` 服务器候选为空

先在服务管理中保存至少一个连接，再重新聚焦会话输入框。连接名称包含中文或空格时，请从候选菜单选择安全 ID。

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
    └── service-manager/index.js    # 服务管理侧栏
```

由于 DSH Client Loader 接收的是静态脚本，`scripts/build-client.js` 会把这些独立源模块生成到运行时的 `client.js`。默认加载全部模块；开发或集成其他侧栏时，可以设置 `window.__DSH_RESOURCE_CENTER_MODULES`，例如 `['workspace']`，入口会自动加载依赖并只注册所选模块。这样各侧栏可以分别开发，只有模块入口和注册 ID 需要协作。

Bundle 通过 `cordis.patch.yml` 注册，客户端依赖在 `package.json` 的 `dsh.client.inject` 中声明。

## License

MIT License，见 [LICENSE](LICENSE)。
