# 任务：<task-id>

## 目标

一句话描述用户可观察的结果。

## 范围

- 允许修改的目录/文件：
- 明确不涉及的目录/文件：

## 验收条件

- [ ]
- [ ]

## 约束

- 必须先读的项目规则或设计文档：
- 数据库、计费、i18n 或兼容性要求：
- 并行修改限制（共享文件）：

## Agent 分工

| 车道 | owner | 工作 | 交付 commit |
| --- | --- | --- | --- |
| backend |  |  |  |
| frontend |  |  |  |
| verification |  |  |  |
| integration |  |  |  |

## 阶段记录

### 调查

- 结论：
- 相关文件：

### 实现

- 修改：
- commit：

### 验证

- 命令：
- 结果：
- 未运行的检查及原因：

## 交接

`	ext
状态：完成 / 进行中 / 阻塞
修改：文件路径或 commit
验证：命令 -> 结果
风险：一句话
下一步：一个动作
`
"@; W "D:\Codex\JistAI-newapi二开\docs\ai\orchestration\2026-08-08-jistai-dev\PLAN.md" @"
# 运行计划 · 2026-08-08-jistai-dev

## 项目事实（基线）

- 工作目录：D:\Codex\JistAI-newapi二开（clone of https://github.com/jist319/new-api，初始为空目录）
- origin = jist319/new-api；upstream = QuantumNous/new-api（只拉不推）
- dev = main = upstream/main = 5c3abff（1.0.0-rc.24）
- 技术栈：Go 1.25.1（Gin/GORM），web/src（React 19 + shadcn/ui + Bun/Rsbuild），PostgreSQL/Redis（docker-compose 默认）

## 目标功能

- TARGET_FEATURE：待用户明确（见 STATUS 阻塞 B1）。确定后填写下表并展开工作包。

## 工作包图（待展开）

| 工作包 | 依赖 | 负责人/窗口 | 拥有路径 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| （待定，依赖 B1 解除） | | | | | |

## 高冲突区（唯一写者）

- common/、model/main.go、outer/、web/src 生成文件（routeTree 等）、docker-compose.yml、go.mod/go.sum、web/bun.lock

## 并发与集成策略

- 每个 Desktop 子窗口 = 独立 worktree（eature/<name>），窗口内使用子 agent。
- 只并行「无写冲突且依赖已满足」的工作包；集成由根任务亲自承担。
- 阶段提交：调查/实现/验证/集成各一 commit；不 push / 不开 PR / 不部署，除非用户明确要求。