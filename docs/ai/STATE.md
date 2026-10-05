# 工作区状态 · docs/ai

更新：2026-10-06

## 当前任务：同步 upstream/main 并合并进 dev

- 状态：**完成**（dev，本地提交 `58aa2e063`，未推送）
- 前置：本机仓库目录继承自 8-23 的一次提权操作，owner 为 `NT SERVICE\TrustedInstaller` 且带 `Mandatory Label\High Mandatory Level:(OI)(NP)(IO)(NW)`，中完整性进程无法写入 → git fetch/merge 全部失败。已由用户在管理员 PowerShell 执行 `takeown /F <repo> /R /D Y`、`icacls <repo> /reset /T /C`、`icacls <repo> /setintegritylevel (OI)(CI)Medium /T /C` 修复。
- 改动：
  - `main` fast-forward `2d8e50bf` → `b48b74ab`（234 个提交，2026-08-21 → 2026-10-05）
  - `dev` 以 `--no-ff` 合并 `main`，解决 19 个冲突文件
- 验证：
  - 冲突标记扫描清零 ✅
  - `node scripts/sync-i18n.mjs`：7 语言 missing/extras 均为 0 ✅
  - `go build ./...` / `bun run typecheck` / `bun run build` ❌ **未执行** —— 本机未安装 Go 与 Bun（仅 node/npm），工具链需先装回
- 备注：`Dockerfile.local` 仍为未跟踪的本地构建文件，未提交。
  [[upstream-sync-conflict-policy]]

## 上一任务：Shadow DOM 内 #id 锚点跳转修复

- 状态：**完成**（已随 dev 推送 origin）
- 修改：`web/src/components/html-content.tsx` 的 `IsolatedHtmlContent`（唯一改动文件）
  - 在现有 `useEffect` 中给 `shadowRoot` 添加 `click` 监听：找最近祖先 `a[href^="#"]` → 解析 id（容错 decodeURIComponent）→ `shadowRoot.getElementById(id)`（回退 `wrapper.querySelector([id="CSS.escape(id)"])`）→ 命中则 `preventDefault()` + `scrollIntoView({ behavior: 'smooth', block: 'start' })`；修饰键/非左键点击不拦截。
  - `useEffect` 清理时 `removeEventListener` 移除监听。
  - `isolatedContentBaseStyles` 增加 `[id] { scroll-margin-top: 24px; }`。
- 验证：
  - `bun install` ✅（无变更）
  - `bun run typecheck` ✅
  - `bun run lint`：仅上游存量错误（D008），`html-content.tsx` 无新增问题
  - `bun run build` ✅
  - `go build ./...` ✅（后端无影响）
  - 功能实测（无头 Chrome + CDP，本地容器）：`/tutorial`、`/about`、`/user-agreement`、`/privacy-policy` 四页点击 `#sec-3` 锚点均调用 `scrollIntoView({behavior:'smooth',block:'start'})` ✅

