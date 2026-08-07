# AI 协作工作区

这组文件是 Codex 根任务与子窗口/子 agent 的持久化交接层，用来减少对话上下文增长。它们不替代代码、测试或 Git 提交；它们只记录如何恢复工作。

## 启动顺序

1. 阅读本文件。
2. 阅读 orchestration/<run-id>/STATUS.md（当前运行账本）。
3. 阅读当前任务文件 	asks/<task-id>.md（如果存在）。
4. 执行 git status --short --branch 和 git log -1 --oneline。
5. 只打开任务范围内的文件，不重新扫描整个仓库。

## 文件职责

- orchestration/<run-id>/PLAN.md：本运行的任务图（工作包 → 依赖 → 负责人 → 路径所有权 → 完成条件）。
- orchestration/<run-id>/STATUS.md：当前进度、基线 commit、验证结果、阻塞和下一步唯一动作。
- orchestration/<run-id>/DECISIONS.md：跨任务仍然有效的架构决策；只追加。
- 	asks/TEMPLATE.md：新功能任务包和交接格式。
- 	asks/<task-id>.md：一个功能或一个明确的修复目标。

## Agent 分工

- backend：outer/、controller/、service/、model/、elay/、elaykit/、common/。
- frontend：web/src/，包括 feature、路由、i18n 和导航。
- verification：运行测试、类型检查、lint、构建和 Compose 静态检查，不修改业务代码。
- integration：由根任务承担，合并提交、处理冲突、更新状态并执行最终验证。

同一文件只允许一个 agent 写入。common/、model/main.go、outer/、web/src 生成文件、docker-compose.yml、go.mod/go.sum、web/bun.lock 属于高冲突区域，必须明确唯一 owner。

## 上下文规则

- 子 agent 只接收任务文件、必要的约束和相关路径；不要复制整个主线程。
- 工具输出写入临时日志或测试产物，交接消息只保留结论、路径、命令和错误摘要。
- 每完成一个阶段就提交一次，并更新 STATUS.md。
- 新线程先读状态文件和最近提交，不从聊天记录重建项目背景。

## 交接最小格式

`	ext
状态：完成 / 进行中 / 阻塞
修改：文件路径或 commit
验证：命令 -> 结果
风险：一句话
下一步：一个动作
`
"@; W "D:\Codex\JistAI-newapi二开\docs\ai\tasks\TEMPLATE.md" @"
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