# dsh-dex

`dsh-dex` 为 DeepSeek Harness Web 接入 Dex OIDC，并在 API、SSE/WebSocket 事件流和持久化映射层实现用户隔离。

## 能力

- Dex Authorization Code + PKCE 登录，校验 discovery issuer、RS256 ID Token 签名、`iss`、`aud`、`exp`、`iat`、`nonce` 和 `sub`。
- HttpOnly、SameSite=Lax、HMAC-SHA256 签名会话 Cookie；客户端 secret 和 Cookie secret 通过 DSH `credentials` 引用读取，不进入 profile 或代码。
- `session` / `workspace` owner 映射写入 `dsh_dex` storage domain；普通用户只能看到自己的列表、搜索结果、历史、导出、工作区和事件流。
- 每个 Dex 用户的工作区根目录固定为 `/home/dsh/<dex-name>`；其中 `<dex-name>` 取 OIDC 的 `preferred_username`（不安全字符会规范化），客户端提交的其他目录会被忽略。
- 普通用户默认不能访问宿主文件浏览、settings、credentials、模型探测、preset 文档/管理等共享高权限接口。

## 配置

安装到本地 Web profile：

```sh
pnpm dsh plugin --profile web add /path/to/dsh-dex
```

`cordis.patch.yml` 已提供参考配置。生产部署至少需要设置：

```sh
export DSH_DEX_ISSUER='http://8.130.114.110:8000/dex'
export DSH_DEX_CLIENT_ID='dsh'
export DSH_DEX_PUBLIC_BASE_URL='http://127.0.0.1:3080'
export DSH_DEX_CLIENT_SECRET_REF='DEX_DSH_CLIENT_SECRET'
export DSH_DEX_COOKIE_SECRET_REF='DSH_DEX_COOKIE_SECRET'
export DSH_DEX_USER_ROOT='/home/dsh'
```

在 DSH credentials provider 中配置 `DEX_DSH_CLIENT_SECRET` 和至少 32 字节的
`DSH_DEX_COOKIE_SECRET`。Dex static client 的 redirect URI 必须精确匹配：

```text
<publicBaseUrl>/auth/callback
```

当前参考 Dex 使用 `http://8.130.114.110:8000/dex` issuer；若 DSH 通过反向代理、域名或子路径暴露，`publicBaseUrl` 必须写成浏览器实际访问的 origin/base URL，并同步修改 Dex client 的 redirect URI。生产环境应使用 HTTPS 并开启 `cookieSecure`。

## 隔离边界

这是 DSH 数据面和 API 面的用户隔离，不是 OS 级安全沙箱。不同用户的 session/workspace/事件不会通过本插件互相可见；但同一 Harness 进程仍共享 Node 进程、插件、LLM 凭据和宿主资源。若 Agent 工具能执行宿主命令或访问任意绝对路径，真正的跨用户安全边界必须继续使用每用户进程、容器/沙箱、独立凭据和独立 egress policy。
