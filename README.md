# DSH Plugin Collection

这是一个 DeepSeek Harness 插件集合仓库。每个子目录都是独立的、可通过
`dsh plugin` 安装的插件包；根目录只负责集合说明和 npm workspace 编排。

## 插件

| 目录 | 包名 | 能力 |
| --- | --- | --- |
| [`resource-center-plugin/`](./resource-center-plugin/) | `dsh-resource-center` | 工作区侧栏、服务管理、Web Fuzzer、MITM、用量统计 |
| [`dsh-security/`](./dsh-security/) | `dsh-security` | 渗透测试与代码审计 preset、工具和报告 |

`dsh-resource-center` 已经内置 Web Testing Host/API 和 Test 侧栏，不要在同一个
profile 中重复安装另一个 `dsh-web-testing` 包。

## 安装到 DSH profile

在仓库根目录执行：

```sh
npx @deepseek-ai/dsh plugin --profile web add ./resource-center-plugin
npx @deepseek-ai/dsh plugin --profile web add ./dsh-security
npx @deepseek-ai/dsh --profile web --dump-config
```

也可以只安装其中一个插件。profile 中的插件配置由 DSH plugin 命令维护，
不要手动编辑 profile 的 bundle 列表。

## 开发与验证

```sh
npm install --legacy-peer-deps
npm run check
npm test
npm run pack
```

DSH core packages are supplied by the Harness profile and may not be published
as standalone npm versions. `--legacy-peer-deps` keeps the collection workspace
install from trying to resolve those profile-provided peers from the registry.

单个插件也可以在自己的目录中执行对应的 `npm install`、`npm test` 和 `npm pack`。

## 目录约定

- 每个插件保留自己的 `package.json`、`cordis.patch.yml`、源码、测试和 README。
- `node_modules`、构建产物、测试覆盖率、release tarball 和本机 DSH 数据不会提交。
- 插件之间通过已声明的 DSH peer dependency 或公开的 Cordis service 协作，避免依赖
 另一个插件的源码路径。
