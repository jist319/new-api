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