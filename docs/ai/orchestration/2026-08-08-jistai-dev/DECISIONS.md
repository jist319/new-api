# 决策记录 · 2026-08-08-jistai-dev（只追加）

## D001 仓库锚点

- 决定：本运行以 `D:\Codex\JistAI-newapi二开` 为唯一工作目录（clone `https://github.com/jist319/new-api`，`dev` 分支）。
- 原因：初始目录为空；与既有 `JistAI-NewAPI本地二开`（生产恢复账本）和 `ShiYan/new-api`（旧快照）相互独立，避免混淆。

## D002 分支流

- `main` 永远镜像 `upstream/main`（`git merge upstream/main`，不 force push）；`dev` 为二开专属，同步上游用 `git merge main`。
- 功能实现使用 `feature/<name>` 分支 + 独立 worktree；集成由根任务在 `dev` 完成。

## D003 账本

- `docs/ai/orchestration/<run-id>/`：PLAN / STATUS / DECISIONS；同时复用 `docs/ai/README.md` + `tasks/TEMPLATE.md` 交接格式。
- 只在状态转换或决策变化时更新，不写逐条聊天日志。

## D004 工具链（本机）

- Go：`D:\Codex\.tools\go`（1.25.1，阿里云镜像）；`GOPROXY=https://goproxy.cn,direct`；`GOMODCACHE=D:\Codex\.tools\gopath\pkg\mod`
- Bun：1.3.14，npm 全局安装（npmmirror registry）；`web` 依赖安装优先 npmmirror
- 原因：本机到 GitHub 大文件下载不稳定，国内镜像验证可用。

## D005 高冲突区单写者

- `common/`、`model/main.go`、`router/`、`web/src` 生成文件、`docker-compose.yml`、`go.mod/go.sum`、`web/bun.lock` 同一时刻只有一个写者。

## D006 远程约束

- 不 push / 不开 PR / 不部署，除非用户明确要求。初始化引导中的 push 步骤为 no-op 确认（远端已同步）。

## D007 Git 身份（仓库级）

- 决定：`git config user.name = jist319`，`user.email = jist319@users.noreply.github.com`（仅本仓库，未设置全局）。
- 原因：机器无全局 Git 身份，本地提交需要；使用 GitHub noreply 邮箱，避免泄露真实邮箱。

## D008 上游基线验证结论

- 决定：pristine rc.24 的 `go test ./...` 在 `service` 包有 2 个全包运行时稳定失败、隔离运行通过的用例（channel affinity usage cache 相关）；`bun run lint` 存在约 20+ 处上游存量错误。二者均非本次改动引入，作为基线事实记录，不在此运行中修复，除非目标功能触及相关模块。
- 影响：集成时若目标功能涉及 `service` 包或前端 lint 文件，先以「基线同样失败/同样报错」为对照，只验证「相对基线无新增回归」。

## D009 环境固化与引导脚本

- 决定：本机工具链固定为 Go 1.25.1（`D:\Codex\.tools\go`）+ Bun 1.3.14（npm 全局）；`GOPROXY`/`GOMODCACHE` 持久化到用户级 go env；用户 PATH 已加入 Go bin。
- 决定：仓库根 `scripts/bootstrap.ps1` 为幂等引导入口（UTF-8 BOM，兼容 Windows PowerShell 5.1），新会话/子窗口先运行它再开发；`-Verify` 可选跑 `go build ./...` + `bun run typecheck` + `docker compose config --quiet`。
- 原因：后续 Desktop 子窗口/新会话不继承本会话环境，需要可复现的恢复路径；BOM 解决中文注释在 Windows PowerShell 5.1 下的解析问题。