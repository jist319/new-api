# 运行状态 · 2026-08-08-jistai-dev

更新：2026-08-08（本地运行阶段）

## 基线

- `dev` = `main` = `upstream/main` = `5c3abff`（`v1.0.0-rc.24`）
- 工作目录：`D:\Codex\JistAI-newapi二开`
- 本地 HEAD：`6d040cfb`（账本 + 引导脚本，未推送，`origin/dev` 仍为 `5c3abff`）

## 当前阶段：本地运行验证（2026-08-08）

- 目标：把 `dev` 分支跑起来给用户看效果。
- 结果：✅ **运行中** —— http://localhost:3000（首页截图 `.local-tests/ui-home.png`）
- 容器：`new-api-dev`（镜像 `new-api-dev:local`，本地 dev 构建，300MB）/ `new-api-dev-pg`（`postgres:15-alpine`，healthy）/ `new-api-dev-redis`（`redis:7-alpine`）
- 验证：`/api/status` → `success:true`；首页 `GET /` → 200；日志 `New API ready in 726ms`
- 关键操作：Docker Hub（`auth.docker.io`）直连被墙 → 改用本机已有同 digest 基础镜像 + 未跟踪 `Dockerfile.local`（内置 `GOPROXY=https://goproxy.cn,direct`）+ 临时 npmmirror registry 完成离线构建；`web/.npmrc` 已还原，工作树干净（仅 `Dockerfile.local` 未跟踪，供后续重建复用）

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
| docker 本地运行 | `docker compose -f docker-compose.dev.yml up -d` | ✅ 三容器 Up；`/api/status` success；首页 200 |

失败测试：`TestObserveChannelAffinityUsageCacheByRelayFormat_MixedMode`、`TestObserveChannelAffinityUsageCacheByRelayFormat_UnsupportedModeKeepsEmpty`（`service` 包）。

## 阻塞

- B1：**TARGET_FEATURE 未明确** —— 真正二开前由用户确认目标功能；当前工作区与本地运行已就绪。
- B2：~~Docker Desktop 未运行~~ → ✅ 已解除（用户已启动，本地运行验证完成）。
- B3：Docker Hub 直连不稳定 —— 后续重建镜像统一用 `docker build -f Dockerfile.local -t new-api-dev:local .`（`Dockerfile.local` 是未跟踪的本地构建文件，勿提交）。

## 下一步唯一动作

用户在 http://localhost:3000/setup 完成管理员初始化（当前页面在 /setup）；随后给出 TARGET_FEATURE 开始二开。**每完成一个阶段必须更新本文件**（D010）。