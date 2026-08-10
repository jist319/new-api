# 工作区状态 · docs/ai

更新：2026-08-10

## 当前任务：Shadow DOM 内 #id 锚点跳转修复

- 状态：**完成**（dev，本地提交，未推送）
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
- 提交：`git log` 见（未推送）
- 备注：本地曾用长 HTML 示例验证后已恢复原 DB 内容；生产部署未执行（用户未要求）。
