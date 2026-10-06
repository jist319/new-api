# 工作区状态 · docs/ai

更新：2026-10-07

## 当前任务：订阅按分组作用域生效

- 状态：**完成**（dev，本地提交，未推送）
- 前置：用户要求丢弃「0 成本请求免资金来源」那次改动并**不再实现**，已 `git reset --hard 2626a06c1` 回退。
- 需求：订阅只对绑定的分组生效，堵住「一份扣不完的订阅在任意分组都能用」。
- 语义（用户拍板）：**老订阅（`group = ''`）对所有分组生效**，既有部署零行为变化。
- 实现：`UserSubscription` 加 `Group`（快照自 `plan.UpgradeGroup`，复用既有的「订阅把用户拉进某分组」契约）；三个消费口（`PreConsumeUserSubscription` / `HasActiveUserSubscription` / `UserActiveSubscriptionsAllowWalletOverflow`）加分组过滤 `(group = ? OR group = '')`；分组不匹配 → 走现成的钱包回退链，不引入新错误码。
- ⚠️ 过滤条件**必须带括号**：GORM 用 AND 拼接裸 Where 且不自动加括号，少了会退化成 `… OR group = ''`，把别人所有空组订阅都匹配进来。已有专项回归用例。
- 验证：SQLite 3.50.4 / MySQL 8.4.11 / PostgreSQL 15.19 三库跑通「空库迁移两次 + DropColumn 模拟旧库升级 + 两次再迁移 + 既有数据保留」；真实 PG 升级路径补列建索引、数据无损，且打开 DDL 日志重启后**捕获 0 条 DDL**（迁移幂等）；端到端验到「订阅绑定 vip 时 `并发1` 请求 403 用户额度不足」与「绑定 `并发1` 时订阅确实支付」两条。
- 附注：渠道 #1 指向上游另一台 new-api（`https://api.jistai.net`），上游返回 403 `无权访问 DeepSeek 分组`——上游账号分组配置问题，与本改动无关。

## 上一任务：按分组的每用户并发限制

- 状态：**完成**（dev，本地提交，未推送）
- 需求：售卖「并发数」订阅，买后把用户拉进一个**模型倍率 0、完全不计费**的分组，该分组对每用户限制同时进行的请求数。
- 澄清结论：免费靠**分组倍率 0**（纯配置，已验证 `CheckGroupRatio` 允许 0 且 0 成本请求结算净额为 0）；计数维度 **(分组,用户)**；超限**排队等槽位**再 429；**Redis + 内存双路径**；**未完成任务数**计入并发；按**请求实际使用的分组**取配置。
- 实现：`setting/rate_limit.go` 新增 `GroupConcurrencyLimit` + `GroupConcurrencyQueueTimeoutSeconds`；`common/group_concurrency.go` 用 Redis 排序集 + Lua 原子取槽（无 Redis 退回进程内），release 用 `sync.Once` 幂等，存储故障时失败开放；`middleware/group_concurrency.go` 读 `ContextKeyUsingGroup`，把未完成任务数从上限里扣掉后原子申请剩余额度，`defer release()` 覆盖全部退出路径；`model.CountUnfinishedTasksByUserGroup` 由数据库推导任务占用（任务转终态即自动释放，无泄漏）；挂载在现有次数限流器的 7 处 + 两处异步任务提交入口；前端新增独立的分组并发限制编辑器（见 STATUS 中「为什么不并进现有那张表」）。
- ⚠️ 已知取舍：排队占用 goroutine 且每 200ms 轮询；任务占用是读库而非原子预留（极端瞬时提交可少量超出）；游乐场未挂；崩溃遗留槽位最多 1 小时。
- 验证：`go build`/`go vet` ✅；`go test ./...` 仅剩既有 Windows 清理失败（263 条，与改动前一致）与 2 个 affinity flaky；新增 3 个测试文件覆盖守卫、配置校验与中间件端点行为；前端 typecheck/build ✅、`bun run test` 176 文件 / 2171 用例 ✅、lint error 与基线一致；容器重建后实测通过。

## 上一任务：套餐额度语义翻转（-1=不限量 / 0=不提供额度）

- 状态：**完成**（dev，本地提交，未推送）
- 用户明确要求把上一轮的语义翻转：**-1 = 不限量**，**0 = 该套餐不提供额度**；列表「套餐额度」列也要对应显示（0 显示「不提供额度」）。
- 改动：`PreConsumeUserSubscription` 改为跳过 `AmountTotal == 0`；新增共用 `formatTotalQuota(total, t)` 统一三处套餐额度显示；常量改名 `UNLIMITED_PLAN_TOTAL`；新建套餐默认值改为 -1；i18n 新增 `No quota` 并清掉两条过期文案。
- ⚠️ 与上游不一致：上游 0 是「不限额度」，现在 0 是「不发额度」。历史数据里额度为 0 的套餐升级后会变成不发放额度，其他部署需自行把 0 改成 -1。本机只有 1 个套餐且已设为 -1，无影响。
- 验证：`go build`/`go vet` ✅；`go test ./model/ -run TestPreConsume` ✅；`bun run typecheck` ✅；`bun run test` ✅；新增 `format.test.ts` 三例。
  [[db-timestamp-tx-deadlock]]

## 上一任务：订阅无额度套餐 + 兑换码分组/订阅类型

- 状态：**完成**（dev，本地提交，未推送）
- 三项需求：①套餐额度 -1 = 不提供额度，且「允许余额兑换」下方新增「允许兑换码兑换」；②兑换码新增「分组」筛选（订阅码与额度码通用）；③创建兑换码新增「额度 / 订阅」单选，订阅码创建时绑定套餐。
- 关键语义：`SubscriptionPlan.TotalAmount` 保留 `0 = 不限`，新增 **`-1 = 无额度**（`PreConsumeUserSubscription` 跳过负数总额，请求穿透到钱包）；`Redemption` 新增 `group`/`type`/`plan_id`；订阅码兑换走 `CreateUserSubscriptionFromPlanTx(..., "redemption")`，不写钱包。
- 顺带修掉 `CreateUserSubscriptionFromPlanTx` 在事务内用全局 `DB` 取时间戳导致的死锁（连接池为 1 时挂死），改为 `dbTimestamp(tx)`。见 [[db-timestamp-tx-deadlock]]。
- 验证：`go build`/`go vet`/`gofmt` ✅；`go test ./...` 仅剩既有 Windows 清理失败与 2 个 affinity flaky；`bun run typecheck`/`build`/`test`（174 文件 / 2166 用例）✅；lint 与基线一致（169/71）；i18n 7 语言 missing/extras 全 0；容器重建后迁移与新路由实测通过。
- 备注：未推送；`GET /api/user/topup` 的 `data` 由裸数字改为对象。

## 上一任务：容器构建 + 本地运行验证

- 状态：**完成**（dev，本地提交，待推送）
- 环境：WSL2 装 **Debian 13 (trixie)**（`wsl --install -d Debian --no-launch`，已设默认）；新建 `C:\Users\jist3\.wslconfig` 开 `networkingMode=mirrored` + `autoProxy=true`，解决 NAT 模式够不着 Windows 代理 `127.0.0.1:10808` 的问题；Docker Desktop 4.94.0、daemon 29.8.2。
- 构建：`docker build -f Dockerfile.local -t new-api-dev:local .` ✅ 323 MB。容器内跑通前端 `bun install`/`bun run build` + 后端 `go mod download`/`go build` —— Linux 环境的完整构建验证。
- 运行：`docker compose -f docker-compose.dev.yml up -d --no-build` ✅ 三容器 Up，端口 3000。
- 冒烟：`/api/status` 200 `success:true`；`/api/tutorial-doc` 200；`/jistai-logo.png` 200；`/manifest.json` 200；`/webchat/lobe/` 302。首页 title=JistAI、`/api/status` 含 `RedemptionCodeLink`、CC Switch 条目 `name=JistAI`。
- 备注：库为空需重跑初始化向导；`VERSION` 为 0 字节，镜像内版本号为空。

## 上一任务：工具链重装 + 合并后全量构建验证

- 状态：**完成**（dev，本地提交 `70a9fe6ff`、`7b269baf5`，未推送）
- 工具链：Go 1.27.0（`winget install GoLang.Go`）、Bun 1.4.2（`npm install -g --allow-scripts=bun bun`；npm 11 默认拦截 postinstall）。
- 通过：`go build ./...`、`go vet ./...`、`cd relaykit && GOWORK=off go build ./...`、`bun install`、`bun run typecheck`、`bun run build`（66.2 MB）、`bun run test`（173 文件 / 2161 用例全过）。
- 修掉两个合并引入的问题：
  1. `POST /pg/responses`、`GET /api/tutorial-doc` 未登记访问令牌路由规则 → 上游新测试 `TestAccessTokenRouteRulesCoverEveryDashboardRoute` 失败。已分别登记为 `accessTokenSessionRule` 与加入豁免清单。
  2. `bun run build` 因 `rsbuild.config.ts` 的 `html.favicon` 指向已删除的 `public/favicon.ico` 而失败。已移除该配置项，`dist/index.html` 仍带全部 JistAI 图标链接。
- 未通过（用 `git worktree` 拉干净 main 做对照，确认与本次合并无关）：`controller` 包 263 条 Windows `TempDir RemoveAll` 清理失败、`relay/channel` HTTP2 用例在 dev/main 两边都抖、`service` 两个 affinity 存量 flaky（D008）。
- lint 仍失败：240 条（169 error），上游收紧 `.oxlintrc` 规则后暴露的存量问题；唯一落在冲突文件里的一条 `data-table-row-actions.tsx:120 exhaustive-deps` 与 HEAD 逐字相同，未改动。
- 备注：`Dockerfile.local` 未跟踪未提交；Docker 未装，容器未重建。
  [[upstream-sync-conflict-policy]]

## 上一任务：同步 upstream/main 并合并进 dev

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

