# 运行计划 · 2026-08-08-jistai-dev

## 项目事实（基线）

- 工作目录：`D:\Codex\JistAI-newapi二开`（clone of `https://github.com/jist319/new-api`，初始为空目录）
- `origin` = `jist319/new-api`；`upstream` = `QuantumNous/new-api`（只拉不推）
- `dev` = `main` = `upstream/main` = `5c3abff`（`v1.0.0-rc.24`）
- 技术栈：Go 1.25.1（Gin/GORM），`web/src`（React 19 + shadcn/ui + Bun/Rsbuild），PostgreSQL/Redis（docker-compose 默认）

## 目标功能

- TARGET_FEATURE：待用户明确（见 STATUS 阻塞 B1）。确定后填写下表并展开工作包。

## 工作包图（待展开）

| 工作包 | 依赖 | 负责人/窗口 | 拥有路径 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| （待定，依赖 B1 解除） | | | | | |

## 高冲突区（唯一写者）

- `common/`、`model/main.go`、`router/`、`web/src` 生成文件（routeTree 等）、`docker-compose.yml`、`go.mod`/`go.sum`、`web/bun.lock`

## 并发与集成策略

- 每个 Desktop 子窗口 = 独立 worktree（`feature/<name>`），窗口内使用子 agent。
- 只并行「无写冲突且依赖已满足」的工作包；集成由根任务亲自承担。
- 阶段提交：调查/实现/验证/集成各一 commit；不 push / 不开 PR / 不部署，除非用户明确要求。