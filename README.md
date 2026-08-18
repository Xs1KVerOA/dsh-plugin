# DSH Plugin Collection

DeepSeek Harness 插件集合仓库。每个插件都保留独立的 `package.json`、
`cordis.patch.yml`、源码、测试和 README，可以单独安装、验证和打包；根目录只负责
集合说明与 npm workspace 编排。

## 插件

| 目录 | 包名 | 主要能力 |
| --- | --- | --- |
| [`resource-center-plugin/`](./resource-center-plugin/) | `dsh-resource-center` | 工作区侧栏、服务管理、Web Fuzzer、MITM、用量统计 |
| [`dsh-security/`](./dsh-security/) | `dsh-security` | 渗透测试、代码审计 preset、结构化 API/报告 |

`dsh-resource-center` 已内置 Web Testing Host/API 和 Test 侧栏。同一个 profile
不要再额外安装 `dsh-web-testing`，否则会重复注册相关能力。

## 快速开始

### 获取仓库

```sh
git clone git@github.com:Xs1KVerOA/dsh-plugin.git
cd dsh-plugin
```

也可以使用 HTTPS：

```sh
git clone https://github.com/Xs1KVerOA/dsh-plugin.git
```

### 安装到 DSH profile

安装两个插件：

```sh
npx @deepseek-ai/dsh plugin --profile web add ./resource-center-plugin
npx @deepseek-ai/dsh plugin --profile web add ./dsh-security
npx @deepseek-ai/dsh --profile web --dump-config
```

只需要单个能力时，可以只安装对应目录。profile 中的 bundle 列表由 `dsh plugin`
命令维护，不要手动编辑 profile manifest。

### 使用本地安装脚本

`install.sh` 默认安装资源中心，也支持切换到任意插件目录：

```sh
./install.sh --dry-run
./install.sh --plugin-dir "$PWD/dsh-security" --dry-run
```

## 开发与验证

根目录 workspace 安装依赖时使用：

```sh
npm install --legacy-peer-deps
npm run check
npm test
npm run pack
```

DSH core packages 由 Harness profile 提供，可能没有对应的独立 npm 版本；
`--legacy-peer-deps` 可避免 npm 从 registry 解析这些 profile-provided peers。

也可以单独验证插件：

```sh
npm --prefix resource-center-plugin test
npm --prefix dsh-security test
npm --prefix resource-center-plugin pack --dry-run
npm --prefix dsh-security pack --dry-run
```

`npm run check` 会执行 JavaScript 语法检查、客户端 bundle 检查和 DSH release
兼容性检查；`npm test` 会运行两个插件的 Host/Client/存储测试。

## 安全边界

- 只在获得授权的目标上使用服务管理、Web Fuzzer 和 MITM 功能。
- 资源中心默认只绑定本机，代理默认不自动启动，并拒绝私有目标。
- SSH、数据库、容器、远程命令和写入类操作可能产生真实副作用。
- 密码、私钥和云密钥由 Harness `credentials` 服务管理，不应提交到仓库。
- `node_modules`、构建产物、release tarball、profile 数据和本机运行统计不会提交。

更详细的功能、配置和兼容性说明见各插件目录下的 README。
