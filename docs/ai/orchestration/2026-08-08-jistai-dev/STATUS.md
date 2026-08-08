# 运行状态 · 2026-08-08-jistai-dev

更新：2026-08-08（本地运行 + 管理员初始化完成）

## 基线

- `dev` = `main` = `upstream/main` = `5c3abff`（`v1.0.0-rc.24`）
- 工作目录：`D:\Codex\JistAI-newapi二开`
- 本地 HEAD：账本 + 引导脚本 commit（未推送，`origin/dev` 仍为 `5c3abff`）

## 当前阶段：本地运行 + 管理员初始化（2026-08-08）

- 目标：把 `dev` 分支跑起来给用户看效果，并完成管理员初始化。
- 结果：✅ **运行中** —— http://localhost:3000（首页截图 `.local-tests/ui-home.png`，控制台截图 `.local-tests/ui-dashboard.png`）
- 容器：`new-api-dev`（镜像 `new-api-dev:local`，本地 dev 构建）/ `new-api-dev-pg`（postgres:15-alpine，healthy）/ `new-api-dev-redis`（redis:7-alpine）
- 管理员初始化：✅ `setup:true`；使用模式 = **对外运营**；用户名 `admin`（密码已通过聊天告知用户，**不写入账本**，建议用户后续在「个人设置」中修改）
- 登录验证：✅ 通过真实 UI 登录成功 → `/dashboard/overview`（概览/创建密钥引导/钱包/用量正常，初始额度 $200）
- 验证：`/api/status` → `success:true` + `setup:true`；首页/登录/控制台均 200


## 当前阶段：品牌二开 · 全站 Logo 替换（2026-08-08）

- 目标：把所有页面的 logo 换成 JistAI 品牌标识（来源 `D:\图片\logo\JistAi\JistAILogo.png`，1024×1024 PNG）。
- 方案：前端 logo 单一来源 `DEFAULT_LOGO = '/logo.png'`（侧栏/顶栏/公共头/页脚/移动抽屉/favicon/登录页/设置页全走它），直接替换 `web/public/logo.png` 资产即可全覆盖；SVG `Logo` 组件为死代码未改动。
- 验证：`bun run typecheck` ✅、`bun run build` ✅；镜像 `new-api-dev:local` 重建并重启容器；浏览器实测首页 header/footer 与 favicon、控制台侧栏均显示新 logo（截图 `.local-tests/ui-home-newlogo.png`、`.local-tests/ui-dashboard-newlogo.png`）。
- 提交：`840fd0a1 feat(branding): 全站 logo 替换为 JistAI 品牌标识`（本地，未推送）。

## 当前阶段：Logo 替换缓存修复（2026-08-08）

- 现象：用户反馈「没看到更换」。排查结论：服务器已提供新 logo（哈希一致），但静态资源响应头 `Cache-Control: max-age=604800`（7 天），浏览器缓存了旧的 `/logo.png`，普通刷新不重新拉取。
- 修复：改用**独立新文件名** `/jistai-logo.png`（新 URL 无缓存），并**恢复原版 `web/public/logo.png`**（上游资产保留，可回退）。改动点：新增 `web/public/jistai-logo.png`；`lib/constants.ts` `DEFAULT_LOGO='/jistai-logo.png'`；`index.html` favicon；`footer.tsx` 兜底路径。`index.html` 本身是 `no-cache`，普通刷新即可拿到新代码。
- 验证：`bun run typecheck`/`build` ✅；镜像重建 + 容器重启；`curl /jistai-logo.png` = 222734（新图），`/logo.png` = 9597（原版）；浏览器实测首页 header/footer、登录页、favicon 均指向 `/jistai-logo.png`。
- 提交：`9ae59c41 fix(branding): logo 改用独立文件 jistai-logo.png 绕过浏览器 7 天缓存`（本地，未推送）。

## 当前阶段：品牌二开 · 系统名称与版权行（2026-08-08）

- 需求：① 系统名称改为 JistAI；② 首页左下版权行改为「© 2026 JistAI.版权所有.基于New API二次开发」；③ JistAI 加粗并链接到 `https://github.com/jist319/new-api/tree/dev`。
- 改动：`common/constants.go` `SystemName="JistAI"`（后端默认，运行实例 DB 无 SystemName 选项行，改代码即生效）；`web/src/lib/constants.ts` `DEFAULT_SYSTEM_NAME='JistAI'`；`footer.tsx` 普通分支版权行改为 JistAI 加粗超链接 + 二次开发声明（右侧上游署名保留）。
- 验证：`go build ./...` ✅、`bun typecheck`/`build` ✅；镜像重建 + 容器重启；`/api/status` `system_name:"JistAI"`；首页 DOM：版权文本匹配、链接 href/target/_blank/加粗均正确（截图 `.local-tests/ui-home-jistai-name.png`）。
- 提交：`af25cd68 feat(branding): 系统名称改为 JistAI，首页版权行加 JistAI 超链接与二次开发声明`（本地，未推送）。

## 诊断：网页聊天与客户端预设点击行为（2026-08-08）

- 现象：用户反馈「只有 AI as Workspace 内置成功」。实测结论：预设分为两类——https（AI as Workspace、Lobe Chat 官方示例）在浏览器中正常打开新标签并自动注入令牌/地址；自定义协议（ccswitch://、cherrystudio://、deepchat://、opencat://、ama://、fluentread）只能在已安装对应客户端的设备上唤起，浏览器内无法打开（CC Switch 点击后落到本地 /ccswitch 404，属浏览器对自定义协议的回退行为，非二开 bug）。
- 内置网页聊天页：/chat/<id> 需要管理员配置 web 类型聊天预设才有入口；当前未配置 → /chat 404、/chat/new 跳回仪表盘；Playground 可用但无渠道/模型（channels=0）无法发消息。
- 结论：给用户使用需 ① 配置渠道；② 用户在装有客户端的设备上点击预设唤起 App；③ 或配置 web 聊天预设做纯网页聊天。

## 修复：CC Switch 预设链接残缺（2026-08-08）

- 根因：`setting/chat.go` 默认 `"CC Switch": "ccswitch"` 缺少 `://v1/import?...`，前端 `window.open("ccswitch")` 按相对路径解析 → 本地 `/ccswitch` 404，从未发起协议唤起（即使已安装客户端也打不开）。
- 修复：改为完整深链模板 `ccswitch://v1/import?resource=provider&app=claude&name=JistAI&endpoint={address}&apiKey={key}&homepage={address}&enabled=true`（格式与 `cc-switch-dialog.tsx` 一致，`{address}`/`{key}` 由前端替换为服务器地址与令牌）。
- 验证：`go build` ✅；镜像重建 + 重启；`/api/status` chats 中 CC Switch 已返回完整深链。
- 重要限制：应用内浏览器（webview）不会把自定义协议交给系统，唤起 CC Switch 需在 Chrome/Edge 等普通浏览器点击（已安装客户端时系统会弹「打开 CC Switch？」）。
- 提交：`4e2cb6a1 fix(chat): 补全 CC Switch 一键导入深链模板`（本地，未推送）。

## 实现：客户端预设「未安装探测 + 下载页引导」（2026-08-08）

- 需求：https 预设在内置浏览器直接打开；自定义协议预设先探测本地是否安装，未安装则弹「请先安装此应用」并跳转对应下载页。
- 实现：新增 `web/src/features/chat/lib/external-launch.ts`（`APP_DOWNLOAD_URLS` 映射 + `openExternalApp` 探测：`window.open(协议链接)` 后 1.8s 内窗口未关闭/被拦截 → 判定未安装 → 关闭占位窗口 → toast「请先安装此应用」→ 打开下载页）；接入令牌行操作菜单与侧栏聊天预设两处入口；FluentRead 扩展缺失时同样处理；i18n 7 语言新增提示 key。
- 下载页映射：CC Switch→ccswitch.io、Cherry Studio→cherryai.com.cn/download、AionUI→aionui.site/download、DeepChat→GitHub Releases、OpenCat→App Store、AMA/BotGem→App Store、FluentRead→GitHub。
- 验证：typecheck/build ✅；镜像重建 + 重启；应用内浏览器实测 CC Switch：协议导航被浏览器安全策略拦截后，回退逻辑自动打开 ccswitch.io 下载页（符合未安装流程）。注：应用内浏览器本身不支持自定义协议唤起，真实用户需在 Chrome/Edge 使用（已安装时会由系统弹「打开 CC Switch？」）。
- 提交：`5a98bc8e feat(chat): 客户端预设未安装时弹提示并跳转下载页（含安装探测）`（本地，未推送）。

## 修复：令牌真实 Key 接口 429 限流（2026-08-08）

- 现象：报错「Request failed with status code 429」。定位：POST /api/token/:id/key 挂 CriticalRateLimit，默认 20 次/20 分钟/IP；打开令牌行菜单会自动请求真实 Key，多次点击即触顶。
- 修复：仅在本地开发 compose（docker-compose.dev.yml）加 CRITICAL_RATE_LIMIT=10000，生产 compose 不动；容器重建后 env 生效。
- 验证：浏览器连续 5 次打开令牌菜单无 429 弹窗；后端日志无 429 状态码。
- 提交：0ef72ced（本地，未推送）。

## 修复：未安装提示中文化 + Chrome 弹窗拦截问题（2026-08-08）

- 现象：① 弹窗提示在 Chrome 下显示英文；② Chrome 里点击预设后「连接加载不出来、提示无标题」，内置浏览器正常。
- 根因：回退下载页此前用 \window.open\，但它在 1.8s 异步检测之后调用，已失去用户手势，被 Chrome 弹窗拦截；协议链接自身在 Chrome 打开的是「无标题」错误标签页。
- 修复：提示硬编码为中文「请先安装此应用」（不随浏览器语言）；下载页改为 \window.location.href\ **当前标签直接跳转**（不受弹窗拦截影响），并在跳转前关闭协议占位标签。
- 验证：应用内浏览器实测 CC Switch → 当前标签跳转 ccswitch.io/zh/ 成功；typecheck/build ✅。真实 Chrome 行为待用户复测。
- 提交：5af09ce9（本地，未推送）。

## 修复：无密钥报错随系统语言翻译（2026-08-08）

- 现象：普通用户无启用密钥点「聊天」预设报英文「No enabled API keys found...」，需按界面语言显示中文。
- 根因（三层）：① 报错消息在 use-active-chat-key.ts 抛英文 Error，展示处直接 error.message（已改为 	(error.message)）；② i18n 未关 keySeparator（已补 keySeparator:false）；③ **真正主因**：locale 文件实际是 { "translation": {...} } 结构，此前用脚本追加的 3 个新 key（请先安装此应用 / No enabled API keys... / Failed to load API key）被加到了**顶层**而非 translation 内，i18next 在 namespace 中找不到 → 恒返回英文 key。
- 修复：用 Node 把 7 个语言包中 3 个 key 移入 	ranslation 对象（保持 2 空格缩进，diff 极小）；移除临时调试日志。
- 验证：应用内浏览器实测 nokeytest 用户点 CC Switch → toast 显示「未找到已启用的 API 密钥，请先创建或启用一个。」；typecheck/build ✅。
- 提交：cef0efc0（本地，未推送）。

## E2E：用户使用场景完整测试（2026-08-08，DeepSeek 渠道）

- 渠道：添加 DeepSeek（type=43，BaseURL https://api.deepseek.com，模型 deepseek-chat/deepseek-reasoner），API Key 仅存本地 DB 渠道配置（未进代码/账本，报告打码）；渠道测试连通 0.67s。
- 测试用户：nokeytest（角色普通用户），额度 5,000,000（本地测试直接 UPDATE users；后台 EditWithTx 不更新 quota，属上游行为，生产用充值流程）；创建令牌 E2E-令牌（分组需设为 default 才能匹配渠道，Redis 令牌缓存重启后刷新）。
- 结果：① 渠道测试 ✅；② 用户登录/令牌创建/取密钥 ✅；③ 直接 API POST /v1/chat/completions（Bearer sk-...）✅ 返回 DeepSeek 中文回复；④ Playground 网页聊天 ✅（回复 1.22s）；⑤ 计费扣减 ✅（用户额度 5,000,000→4,999,994，令牌 used_quota 0→6）；⑥ 使用日志 ✅（logs id=52: deepseek-chat, 10+36 tokens, quota 6）；⑦ 无密钥中文报错 ✅（此前修复验证）。
- 遗留提示：AddToken 默认空分组，用户需默认 default 分组才能用渠道（可考虑二开改进：新建令牌默认填 default）。

## UI：侧栏聊天导航文案调整（2026-08-08）

- 需求：① 去掉「游乐场」上方的小「聊天」分组字；②「游乐场」改名「聊天」；③ 预设菜单「聊天」改名「第三方聊天」。
- 改动：
av-group.tsx 组标题为空时不再渲染；use-sidebar-data.ts chat 组 title 置空、Playground 项 title 改 t('Chat')、预设项 title 改 t('Third-party Chat')；7 个语言包新增「Third-party Chat」key（zh=第三方聊天）。
- 验证：typecheck/build ✅；镜像重建部署；浏览器实测侧栏显示「聊天 / 第三方聊天 / 常规…」，无小分组字。
- 提交：0733c7c2（本地，未推送）。

## UI：聊天 / 第三方聊天图标互换（2026-08-08）

- 需求：互换侧栏「聊天」与「第三方聊天」的图标。
- 改动：use-sidebar-data.ts 聊天项 icon MessageSquare、第三方聊天项 icon FlaskConical。
- 验证：typecheck/build ✅；部署后浏览器 DOM 确认 lucide-message-square / lucide-flask-conical。
- 提交：5f6452dd（本地，未推送）。

## UI：API 密钥操作列新增「一键配置」（2026-08-08）

- 需求：操作列加「一键配置」；三点菜单里的 CC Switch 导入移入其中。
- 改动：data-table-row-actions.tsx 操作列新增「一键配置」按钮（Settings2 图标 + t('One-click Config')），点击打开 CC Switch 导入弹窗（resolveRealKey → setOpen('cc-switch')）；三点菜单移除 CC Switch 项（保留 复制密钥/复制连接信息/聊天/删除）；7 个语言包新增「One-click Config」key（zh=一键配置）。
- 验证：typecheck/build ✅；部署后浏览器实测：操作列显示「一键配置」按钮，点击弹出「填入 CC Switch」弹窗（应用 Claude/Codex/Gemini、名称、主模型等）。
- 提交：71d6c378（本地，未推送）。

## UI：系统设置/个人资料侧边栏模块命名同步（2026-08-08）

- 需求：系统设置 → 侧边栏模块 → 聊天区域里的「游乐场」「聊天」与侧栏新命名保持一致。
- 改动：sidebar-modules-section.tsx 与 sidebar-modules-card.tsx 中 playground 模块 title 改 t('Chat')（聊天）、chat 模块 title 改 t('Third-party Chat')（第三方聊天）。
- 验证：typecheck/build ✅；部署后浏览器实测系统设置侧边栏模块显示「聊天 / 第三方聊天」。
- 提交：efd38f1c（本地，未推送）。

## 功能：令牌管理新增「API 密钥操作显示聊天入口」开关（2026-08-09）

- 需求：系统设置 → 侧边栏模块 → 控制台区域 → 令牌管理 下增加开关，控制 API 密钥操作列三点菜单里的「聊天」（第三方聊天预设）入口显隐。
- 改动：use-sidebar-config.ts console 配置新增 ctionsChat（默认 true）并导出 parseSidebarConfig；sidebar-modules-section.tsx 令牌管理下渲染子开关（随令牌管理/控制台区域禁用联动）；data-table-row-actions.tsx 读取 console.actionsChat 控制「聊天」子菜单显隐；7 语言包新增 2 条文案。
- 验证：typecheck/build ✅；系统设置页实测显示新开关；管理员接口保存 ctionsChat:false 后 status 生效、无前端运行时报错；自动化无法可靠打开 Radix 下拉（已知自动化限制），菜单显隐逻辑已按代码门控 + 配置验证。
- 提交：96aa8368（本地，未推送）。

## UI：令牌管理与聊天入口开关同排（2026-08-09）

- 需求：把「API 密钥操作菜单显示聊天入口」开关与「令牌管理」放到同一行。
- 改动：sidebar-modules-section.tsx 子开关改为 Fragment 平铺（不再占整行下方）；use-sidebar-config.ts console 配置把 token 提到首位，使网格第一行为「令牌管理 | 聊天入口开关」。
- 验证：typecheck/build ✅；部署后浏览器实测两者 top 坐标一致（同排）。
- 提交：f61eb5ea（本地，未推送）。

## UI：聊天入口开关改为令牌管理下方子项（2026-08-09）

- 需求：把「API 密钥操作菜单显示聊天入口」作为子项放在令牌管理下方（非并排）。
- 改动：sidebar-modules-section.tsx token 组改为 md:col-span-2 容器：上方为令牌管理卡片，下方为带左边框、缩进的子开关（muted 小标题，随令牌管理/控制台区域禁用联动）。
- 验证：typecheck/build ✅；部署后浏览器实测子项位于令牌管理下方（top 更大）且缩进（left 更大）。
- 提交：8fc300d6（本地，未推送）。

## 修复：第三方聊天 Lobe Chat 无法打开（2026-08-09）

- 现象：侧栏「第三方聊天」点「Lobe Chat 官方示例」打不开。
- 根因：https 类预设被当作 web 类型，侧栏点击进入 /chat/<id> 用 iframe 内嵌 LobeHub，而 LobeHub 禁止被嵌入（X-Frame-Options）→ 白屏。
- 修复：chat-presets-item.tsx 移除 web 预设的 /chat/<id> 链接分支，统一改为按钮触发 handleOpenExternal（先取启用密钥 → esolveChatUrl → window.open 新标签直开）；web 类型不再提前 return。AI as Workspace 同步受益。
- 验证：typecheck/build ✅；部署后浏览器实测点 Lobe Chat → 新标签打开 chat-preview.lobehub.com/?settings=...（含 apiKey/address）。
- 提交：34e97134（本地，未推送）。
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
- [x] 管理员初始化：4 步向导完成（数据库检查 → admin 账号 → 对外运营 → 初始化系统），`/api/status` `setup:true`

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
| docker 本地运行 | `docker compose -f docker-compose.dev.yml up -d` | ✅ 三容器 Up；`/api/status` success |
| 管理员初始化 | 浏览器 4 步向导 | ✅ `setup:true`；登录 → `/dashboard/overview` 成功 |

失败测试：`TestObserveChannelAffinityUsageCacheByRelayFormat_MixedMode`、`TestObserveChannelAffinityUsageCacheByRelayFormat_UnsupportedModeKeepsEmpty`（`service` 包）。

## 阻塞

- B1：**TARGET_FEATURE 未明确** —— 真正二开前由用户确认目标功能；当前工作区、本地运行、管理员账号均已就绪。
- B2：~~Docker Desktop 未运行~~ → ✅ 已解除。
- B3：Docker Hub 直连不稳定 —— 重建镜像统一用 `docker build -f Dockerfile.local -t new-api-dev:local .`（`Dockerfile.local` 是未跟踪的本地构建文件，勿提交）。

## 下一步唯一动作

用户给出 TARGET_FEATURE 开始二开；或在控制台先配置渠道/令牌试用。**每完成一个阶段必须更新本文件**（D010）。