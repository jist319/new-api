# 运行状态 · 2026-08-08-jistai-dev

更新：2026-08-08

## 基线

- `dev` = `main` = `upstream/main` = `5c3abff`（`v1.0.0-rc.24`）
- 工作目录：`D:\Codex\JistAI-newapi二开`（初始为空目录，已完成 clone）
- 本地 HEAD：账本初始化 commit（dev，未推送）

## 已完成

- [x] clone fork（`--branch dev`）+ 添加 `upstream` remote
- [x] main 对齐：`upstream/main` 已 fetch（`5c3abff`），merge = Already up to date；`push origin main` = up-to-date
- [x] 本地 `main`/`dev` 分支；`dev` 跟踪 `origin/dev`
- [x] 工具链：Go 1.25.1（`D:\Codex\.tools\go`，`GOPROXY=https://goproxy.cn,direct`）、Bun 1.3.14（npm 全局，npmmirror）
- [x] `go mod download` ✅；`web/bun install` ✅（1110 包）
- [x] `docs/ai` 约定 + 运行账本初始化，本地提交（未推送）

## 基线验证矩阵（2026-08-08，pristine rc.24 + 账本文件）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| go build | `go build ./...` | ✅ exit 0 |
| go vet | `go vet ./...` | ✅ exit 0 |
| go test | `go test ./...` | ❌ `service` 包 2 例失败（全包运行稳定复现，隔离运行通过 → 上游 flaky/共享状态，见 D008） |
| typecheck | `bun run typecheck` | ✅ exit 0 |
| lint | `bun run lint` | ❌ 上游存量错误（约 20+ 处，非本次改动引入） |
| build | `bun run build` | ✅ exit 0（dist 约 57MB） |
| compose | `docker compose config --quiet` | ✅ exit 0（仅 `version` 字段 obsolete 警告） |
| docker daemon | `docker info` | ❌ 未运行（容器级 E2E 需先启动 Docker Desktop） |

失败测试：`TestObserveChannelAffinityUsageCacheByRelayFormat_MixedMode`、`TestObserveChannelAffinityUsageCacheByRelayFormat_UnsupportedModeKeepsEmpty`（`service` 包）。

## 阻塞

- B1：**TARGET_FEATURE 未明确** —— 展开工作包前必须由用户确认目标功能。
- B2：Docker Desktop 未运行 —— 容器级端到端验证前需用户启动。

## 下一步唯一动作

解除 B1（用户明确 TARGET_FEATURE）后：按功能展开任务图 → 创建 worktree 子窗口 → 集成验证；B2 与功能验证并行处理。