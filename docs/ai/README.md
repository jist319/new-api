# AI 协作工作区

这组文件是 Codex 根任务与子窗口/子 agent 的持久化交接层，用来减少对话上下文增长。它们不替代代码、测试或 Git 提交；它们只记录如何恢复工作。

## 启动顺序

1. 阅读本文件。
2. 阅读 `orchestration/<run-id>/STATUS.md`（当前运行账本）。
3. 阅读当前任务文件 `tasks/<task-id>.md`（如果存在）。
4. 执行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap.ps1`（恢复 Go/Bun 工具链与依赖；加 `-Verify` 跑基线验证）。
5. 执行 `git status --short --branch` 和 `git log -1 --oneline`。
6. 只打开任务范围内的文件，不重新扫描整个仓库。

## 文件职责

- `orchestration/<run-id>/PLAN.md`：本运行的任务图（工作包 → 依赖 → 负责人 → 路径所有权 → 完成条件）。
- `orchestration/<run-id>/STATUS.md`：当前进度、基线 commit、验证结果、阻塞和下一步唯一动作。
- `orchestration/<run-id>/DECISIONS.md`：跨任务仍然有效的架构决策；只追加。
- `tasks/TEMPLATE.md`：新功能任务包和交接格式。
- `tasks/<task-id>.md`：一个功能或一个明确的修复目标。

## Agent 分工

- backend：`router/`、`controller/`、`service/`、`model/`、`relay/`、`relaykit/`、`common/`。
- frontend：`web/src/`，包括 feature、路由、i18n 和导航。
- verification：运行测试、类型检查、lint、构建和 Compose 静态检查，不修改业务代码。
- integration：由根任务承担，合并提交、处理冲突、更新状态并执行最终验证。

同一文件只允许一个 agent 写入。`common/`、`model/main.go`、`router/`、`web/src` 生成文件、`docker-compose.yml`、`go.mod/go.sum`、`web/bun.lock` 属于高冲突区域，必须明确唯一 owner。

## 上下文规则

- 子 agent 只接收任务文件、必要的约束和相关路径；不要复制整个主线程。
- 工具输出写入临时日志或测试产物，交接消息只保留结论、路径、命令和错误摘要。
- 每完成一个阶段就提交一次，并更新 `STATUS.md`。
- 新线程先读状态文件和最近提交，不从聊天记录重建项目背景。

## 交接最小格式

```text
状态：完成 / 进行中 / 阻塞
修改：文件路径或 commit
验证：命令 -> 结果
风险：一句话
下一步：一个动作
```