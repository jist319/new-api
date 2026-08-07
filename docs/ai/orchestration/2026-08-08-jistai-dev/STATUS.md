# 运行状态 · 2026-08-08-jistai-dev

更新：2026-08-08（本地运行 + 管理员初始化完成）

## 基线

- `dev` = `main` = `upstream/main` = `5c3abff`（`v1.0.0-rc.24`）
- 工作目录：`D:\Codex\JistAI-newapi二开`
- 本地 HEAD：账本 + 引导脚本 commit（未推送，`origin/dev` 仍为 `5c3abff`）

## 当前阶段：本地运行 + 管理员初始化（2026-08-08）

- 目标：把 `dev` 分支跑起来给用户看效果，并完成管理员初始化。
- 结果：✅ **运行中** —— http://localhost:3000（首页截图 `.local-tests/ui-home.png`，控制台截图 `.local-tests/ui-dashboard.png`）
- 容器：`new-api-dev`（镜像 `new-api-dev:local`，本地 dev 构建）/ `new-api-dev-pg`（postgres:15-alpine，healthy）/ `new-api-dev-redis`（redis:7-alpine）
- 管理员初始化：✅ `setup:true`；使用模式 = **对外运营**；用户名 `admin`（密码已通过聊天告知用户，**不写入账本**，建议用户后续在「个人设置」中修改）
- 登录验证：✅ 通过真实 UI 登录成功 → `/dashboard/overview`（概览/创建密钥引导/钱包/用量正常，初始额度 $200）
- 验证：`/api/status` → `success:true` + `setup:true`；首页/登录/控制台均 200


## 当前阶段：品牌二开 · 全站 Logo 替换（2026-08-08）

- 目标：把所有页面的 logo 换成 JistAI 品牌标识（来源 `D:\图片\logo\JistAi\JistAILogo.png`，1024×1024 PNG）。
- 方案：前端 logo 单一来源 `DEFAULT_LOGO = '/logo.png'`（侧栏/顶栏/公共头/页脚/移动抽屉/favicon/登录页/设置页全走它），直接替换 `web/public/logo.png` 资产即可全覆盖；SVG `Logo` 组件为死代码未改动。
- 验证：`bun run typecheck` ✅、`bun run build` ✅；镜像 `new-api-dev:local` 重建并重启容器；浏览器实测首页 header/footer 与 favicon、控制台侧栏均显示新 logo（截图 `.local-tests/ui-home-newlogo.png`、`.local-tests/ui-dashboard-newlogo.png`）。
- 提交：`840fd0a1 feat(branding): 全站 logo 替换为 JistAI 品牌标识`（本地，未推送）。

## 当前阶段：Logo 替换缓存修复（2026-08-08）

- 现象：用户反馈「没看到更换」。排查结论：服务器已提供新 logo（哈希一致），但静态资源响应头 `Cache-Control: max-age=604800`（7 天），浏览器缓存了旧的 `/logo.png`，普通刷新不重新拉取。
- 修复：改用**独立新文件名** `/jistai-logo.png`（新 URL 无缓存），并**恢复原版 `web/public/logo.png`**（上游资产保留，可回退）。改动点：新增 `web/public/jistai-logo.png`；`lib/constants.ts` `DEFAULT_LOGO='/jistai-logo.png'`；`index.html` favicon；`footer.tsx` 兜底路径。`index.html` 本身是 `no-cache`，普通刷新即可拿到新代码。
- 验证：`bun run typecheck`/`build` ✅；镜像重建 + 容器重启；`curl /jistai-logo.png` = 222734（新图），`/logo.png` = 9597（原版）；浏览器实测首页 header/footer、登录页、favicon 均指向 `/jistai-logo.png`。
- 提交：`9ae59c41 fix(branding): logo 改用独立文件 jistai-logo.png 绕过浏览器 7 天缓存`（本地，未推送）。

## 当前阶段：品牌二开 · 系统名称与版权行（2026-08-08）

- 需求：① 系统名称改为 JistAI；② 首页左下版权行改为「© 2026 JistAI.版权所有.基于New API二次开发」；③ JistAI 加粗并链接到 `https://github.com/jist319/new-api/tree/dev`。
- 改动：`common/constants.go` `SystemName="JistAI"`（后端默认，运行实例 DB 无 SystemName 选项行，改代码即生效）；`web/src/lib/constants.ts` `DEFAULT_SYSTEM_NAME='JistAI'`；`footer.tsx` 普通分支版权行改为 JistAI 加粗超链接 + 二次开发声明（右侧上游署名保留）。
- 验证：`go build ./...` ✅、`bun typecheck`/`build` ✅；镜像重建 + 容器重启；`/api/status` `system_name:"JistAI"`；首页 DOM：版权文本匹配、链接 href/target/_blank/加粗均正确（截图 `.local-tests/ui-home-jistai-name.png`）。
- 提交：`af25cd68 feat(branding): 系统名称改为 JistAI，首页版权行加 JistAI 超链接与二次开发声明`（本地，未推送）。

## 诊断：网页聊天与客户端预设点击行为（2026-08-08）

- 现象：用户反馈「只有 AI as Workspace 内置成功」。实测结论：预设分为两类——https（AI as Workspace、Lobe Chat 官方示例）在浏览器中正常打开新标签并自动注入令牌/地址；自定义协议（ccswitch://、cherrystudio://、deepchat://、opencat://、ama://、fluentread）只能在已安装对应客户端的设备上唤起，浏览器内无法打开（CC Switch 点击后落到本地 /ccswitch 404，属浏览器对自定义协议的回退行为，非二开 bug）。
- 内置网页聊天页：/chat/<id> 需要管理员配置 web 类型聊天预设才有入口；当前未配置 → /chat 404、/chat/new 跳回仪表盘；Playground 可用但无渠道/模型（channels=0）无法发消息。
- 结论：给用户使用需 ① 配置渠道；② 用户在装有客户端的设备上点击预设唤起 App；③ 或配置 web 聊天预设做纯网页聊天。

## 修复：CC Switch 预设链接残缺（2026-08-08）

- 根因：`setting/chat.go` 默认 `"CC Switch": "ccswitch"` 缺少 `://v1/import?...`，前端 `window.open("ccswitch")` 按相对路径解析 → 本地 `/ccswitch` 404，从未发起协议唤起（即使已安装客户端也打不开）。
- 修复：改为完整深链模板 `ccswitch://v1/import?resource=provider&app=claude&name=JistAI&endpoint={address}&apiKey={key}&homepage={address}&enabled=true`（格式与 `cc-switch-dialog.tsx` 一致，`{address}`/`{key}` 由前端替换为服务器地址与令牌）。
- 验证：`go build` ✅；镜像重建 + 重启；`/api/status` chats 中 CC Switch 已返回完整深链。
- 重要限制：应用内浏览器（webview）不会把自定义协议交给系统，唤起 CC Switch 需在 Chrome/Edge 等普通浏览器点击（已安装客户端时系统会弹「打开 CC Switch？」）。
- 提交：`4e2cb6a1 fix(chat): 补全 CC Switch 一键导入深链模板`（本地，未推送）。

## 实现：客户端预设「未安装探测 + 下载页引导」（2026-08-08）

- 需求：https 预设在内置浏览器直接打开；自定义协议预设先探测本地是否安装，未安装则弹「请先安装此应用」并跳转对应下载页。
- 实现：新增 `web/src/features/chat/lib/external-launch.ts`（`APP_DOWNLOAD_URLS` 映射 + `openExternalApp` 探测：`window.open(协议链接)` 后 1.8s 内窗口未关闭/被拦截 → 判定未安装 → 关闭占位窗口 → toast「请先安装此应用」→ 打开下载页）；接入令牌行操作菜单与侧栏聊天预设两处入口；FluentRead 扩展缺失时同样处理；i18n 7 语言新增提示 key。
- 下载页映射：CC Switch→ccswitch.io、Cherry Studio→cherryai.com.cn/download、AionUI→aionui.site/download、DeepChat→GitHub Releases、OpenCat→App Store、AMA/BotGem→App Store、FluentRead→GitHub。
- 验证：typecheck/build ✅；镜像重建 + 重启；应用内浏览器实测 CC Switch：协议导航被浏览器安全策略拦截后，回退逻辑自动打开 ccswitch.io 下载页（符合未安装流程）。注：应用内浏览器本身不支持自定义协议唤起，真实用户需在 Chrome/Edge 使用（已安装时会由系统弹「打开 CC Switch？」）。
- 提交：`5a98bc8e feat(chat): 客户端预设未安装时弹提示并跳转下载页（含安装探测）`（本地，未推送）。
## 已完成

- [x] clone fork（`--branch dev`）+ 添加 `upstream` remote
- [x] main 对齐：`upstream/main` 已 fetch（`5c3abff`），merge = Already up to date；`push origin main` = up-to-date
- [x] 本地 `main`/`dev` 分支；`dev` 跟踪 `origin/dev`
- [x] 工具链：Go 1.25.1（`D:\Codex\.tools\go`，`GOPROXY=https://goproxy.cn,direct`）、Bun 1.3.14（npm 全局，npmmirror）
- [x] `go mod download` ✅；`web/bun install` ✅（1110 包）
- [x] `docs/ai` 约定 + 运行账本初始化，本地提交（未推送）
- [x] 环境固化：Go/Bun 已装并写入用户 PATH；`GOPROXY`/`GOMODCACHE` 持久化到用户级 go env
- [x] 新增幂等引导脚本 `scripts/bootstrap.ps1`（UTF-8 BOM；任何新会话/子窗口可一键恢复环境与依赖，`-Verify` 跑基线）
- [x] 本地运行：dev 分支镜像 `new-api-dev:local` 构建成功并启动（Postgres/Redis 就绪，端口 3000）
- [x] 管理员初始化：4 步向导完成（数据库检查 → admin 账号 → 对外运营 → 初始化系统），`/api/status` `setup:true`

## 基线验证矩阵（2026-08-08）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| go build | `go build ./...` | ✅ exit 0 |
| go vet | `go vet ./...` | ✅ exit 0 |
| go test | `go test ./...` | ❌ `service` 包 2 例失败（全包运行稳定复现，隔离运行通过 → 上游 flaky/共享状态，见 D008） |
| typecheck | `bun run typecheck` | ✅ exit 0 |
| lint | `bun run lint` | ❌ 上游存量错误（约 20+ 处，非本次改动引入） |
| build | `bun run build` | ✅ exit 0（dist 约 57MB） |
| compose | `docker compose config --quiet` | ✅ exit 0（仅 `version` 字段 obsolete 警告） |
| docker 本地运行 | `docker compose -f docker-compose.dev.yml up -d` | ✅ 三容器 Up；`/api/status` success |
| 管理员初始化 | 浏览器 4 步向导 | ✅ `setup:true`；登录 → `/dashboard/overview` 成功 |

失败测试：`TestObserveChannelAffinityUsageCacheByRelayFormat_MixedMode`、`TestObserveChannelAffinityUsageCacheByRelayFormat_UnsupportedModeKeepsEmpty`（`service` 包）。

## 阻塞

- B1：**TARGET_FEATURE 未明确** —— 真正二开前由用户确认目标功能；当前工作区、本地运行、管理员账号均已就绪。
- B2：~~Docker Desktop 未运行~~ → ✅ 已解除。
- B3：Docker Hub 直连不稳定 —— 重建镜像统一用 `docker build -f Dockerfile.local -t new-api-dev:local .`（`Dockerfile.local` 是未跟踪的本地构建文件，勿提交）。

## 下一步唯一动作

用户给出 TARGET_FEATURE 开始二开；或在控制台先配置渠道/令牌试用。**每完成一个阶段必须更新本文件**（D010）。