# 运行状态 · 2026-08-08-jistai-dev

更新：2026-08-09（浏览器标签页 favicon 修复完成）

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

## Lobe Chat / AI as Workspace 内置使用（同源代理，2026-08-09）

- 需求：Lobe Chat 和 AI as Workspace 在内置页面直接使用，不开新窗口。
- 事实：AI as Workspace（aiaw.app）允许被 iframe 嵌入 → 恢复 web 预设走内置 /chat/<id>（iframe）；LobeChat 官方（chat-preview 不可达；app.lobehub.com 返回 X-Frame-Options: DENY / frame-ancestors 'none'）无法跨域内嵌。
- 方案：新增后端同源代理 GET/POST /webchat/lobe/* → https://app.lobehub.com/*（controller/webchat.go，仅限单一上游防开放代理）：剥离 X-Frame-Options/CSP、重写 Location、HTML/JS/CSS 中根路径与 lobehub 绝对地址全部重写为 /webchat/lobe；前端 chat-links.ts 支持 {origin}（不编码）令牌并把 /、{origin} 开头识别为 web；setting/chat.go 默认 Lobe 预设改为 {origin}/webchat/lobe/?settings=...；DB Chats 选项已同步更新；chat-presets-item.tsx 恢复 web→/chat/<id> 内嵌。
- 验证：代理登录页及其 12 个资源全部 200；浏览器实测侧栏点 Lobe Chat → 同标签 /chat/4 内置页，iframe 指向 /webchat/lobe/...，控制台无 frame/refuse 错误（截图 .local-tests/lobe-embedded.png）。
- 遗留：LobeHub 登录（Clerk）经代理后的会话 Cookie 可能受域名限制，页面加载与使用正常，登录持久化需实测；如需完全可靠登录可考虑后续调整或引导用户用 LobeChat 客户端。
- 提交：7cd57c04（本地，未推送）。

## Lobe Chat 内置修复（Chrome 实测通过，2026-08-09）

- Chrome 实测发现两个代理缺陷并修复：① 浏览器带 gzip 时上游返回压缩体，HTML/JS 重写失效→资源请求根路径返回 HTML→SyntaxError；修复：代理强制上游 identity 编码，由 gin gzip 统一压缩。② 根路径重写误伤 JS 正则（/'/）→SyntaxError: Invalid regular expression flags；修复：根路径重写仅限 HTML，JS/CSS 只做域名替换。
- Chrome 最终实测：同标签 /chat/4 内置页，控制台零页面错误，登录页全部资源 200（截图 .local-tests/lobe-embedded-chrome2.png）。
- 提交：3ac7c6f2 及 63c7ba93（本地，未推送）。

## Lobe Chat 内置「Something went wrong」修复（上游抖动 502，2026-08-09）

- Chrome 复现：内置页出现 Something went wrong。定位：代理日志大量 502（webchat proxy error）——app.lobehub.com 从本机网络间歇性连不上（与 GitHub/DockerHub 抖动同源），静态资源时好时坏导致 SPA 加载不全。
- 修复：controller/webchat.go 增加 retryTransport——对无请求体的幂等 GET 请求在上游瞬时失败/5xx 时自动重试 3 次（400ms 递增退避），POST 不重放。
- 验证：部署后 Chrome 实测控制台零页面错误；近 3 分钟代理请求 56 个 200、0 个 502（截图 .local-tests/lobe-embedded-chrome3.png）。
- 遗留：上游网络仍可能偶发慢/失败（重试已显著缓解）；LobeHub 登录（Clerk）会话持久化经代理仍受域名限制。
- 提交：b773ca87（本地，未推送）。

## 功能：一键配置改为下拉列表（CC Switch + Cherry Studio，2026-08-09）

- 需求：API 密钥操作列「一键配置」改为多选列表；含 CC Switch，并新增 Cherry Studio 一键配置。
- 改动：data-table-row-actions.tsx 一键配置按钮改为 DropdownMenu（CC Switch / Cherry Studio）；CC Switch 走现有「填入 CC Switch」弹窗（Claude/Codex/Gemini + 模型）；Cherry Studio 走 cherrystudio://providers/api-keys?v=1&data={cherryConfig} 深链一键导入（resolveChatUrl 生成 base64 配置），未安装时弹「请先安装此应用」并跳 cherryai.com.cn/download。
- 验证：浏览器实测下拉显示两项；CC Switch 点击弹出导入弹窗；Cherry Studio 点击（协议被拦截场景）自动跳官方下载页。
- 提交：52362c56 及 52362c56（本地，未推送）。

## 修复：Cherry Studio 一键配置误跳下载页（2026-08-09）

- 现象：Chrome 里点「一键配置 → Cherry Studio」被误判未安装，跳到下载页；本机已装 Cherry Studio（cherrystudio:// 已注册）。
- 根因：旧探测（window.open 后 1.8s 检查标签是否关闭）跑赢 Chrome 的「打开 Cherry Studio?」原生确认框；iframe 方案在 Chrome 中不触发协议唤起（不适用）。
- 修复：external-launch.ts 改回 window.open + 立即回焦，6 秒后判定：标签已关或窗口失焦（App 启动）→ 成功；否则弹「请先安装此应用」并跳下载页。
- 验证：Chrome 实测点击后页面在 /keys 停留满 6 秒（不再 1.8s 误跳）；自动化无法点击 Chrome 原生确认框，真实用户确认后应正常唤起。
- 提交：689338b3（本地，未推送）。

## 功能：聊天页左侧「历史」面板（本地浏览器保存，2026-08-09）

- 需求：聊天（Playground）页左侧加「历史」，会话记录保存在用户浏览器 localStorage。
- 实现：新增 lib/storage/history.ts（load/upsert/delete/clear，上限 50 条）；use-playground-state.ts 增加 history 状态与自动保存（回复完成后 800ms 去抖写入，标题=首条用户消息，含 model/group），刷新页面按标题+消息数匹配复用条目避免重复，加载历史/新建对话/删除历史处理方法；新增 components/history/playground-history.tsx 左侧面板（历史列表 + 新建对话 + 删除）；index.tsx 布局改为左面板+主列；7 语言包新增 History/New Chat/No chat history yet。
- 验证：typecheck/build ✅；浏览器实测面板显示、发消息后自动生成历史条目（标题+时间+模型）、刷新不重复（2→2）。
- 提交：6e53213e（本地，未推送）。

## 功能：历史面板折叠/展开（2026-08-09）

- 需求：历史面板可折叠，聊天区获得更大空间；折叠后保留窄条入口可再展开。
- 实现：playground-history.tsx 增加 collapsed 状态：展开 240px 完整面板（头部含折叠按钮 PanelLeftClose + 新建对话）；折叠 40px 窄条（PanelLeftOpen 展开按钮）；7 语言包新增 Collapse history/Expand history。
- 验证：typecheck/build ✅；浏览器实测 240→40→240，折叠后历史列表隐藏、可展开恢复。
- 提交：779b51d2（本地，未推送）。

## UI：历史折叠动画与精简（2026-08-09）

- 需求：折叠加过渡动画；折叠后不再显示 40px 窄条，只保留展开 logo 按钮。
- 实现：playground-history.tsx 面板改为常驻并动态切换宽度（w-60 ↔ w-0，overflow-hidden，	ransition-[width] duration-300）；折叠时面板宽度 0，左上角浮动「展开历史」按钮（nimate-in fade-in-0 slide-in-from-left-2）。
- 验证：typecheck/build ✅；浏览器实测 240→0（无窄条、展开按钮出现）→240。
- 提交：e3c70722（本地，未推送）。

## 功能：聊天附件/联网/参数总开关（2026-08-09）

- 附件：附件菜单实现 上传文件/上传照片（图片选择器→dataURL）、截屏（getDisplayMedia 抓帧）、拍照（getUserMedia 抓帧）；消息 Message 增加 imageUrls，发送时经 formatMessageForAPI 转 ContentPart[image_url]，输入框上方显示缩略图+删除。
- 联网：搜索按钮改为开关（激活高亮），开启时请求携带 web_search_options（search_context_size=medium），是否真正联网取决于渠道/上游支持。
- 参数总开关：ParameterEnabled 增加 master（默认 false，storage schema 同步）；参数面板顶部「参数总开关」默认关闭，关闭时所有参数不随请求发送、控件禁用。
- 验证：typecheck/build ✅；浏览器实测附件菜单四项、联网开关激活、总开关默认关且参数禁用；zh 文案 附件/截屏 对齐。
- 提交：b7c567f2 及 d472d29（本地，未推送）。

## 附件/联网问题修复与实测（2026-08-09）

- 图片报错根因：unknown variant image_url 来自 **DeepSeek 上游**（其 Rust 后端不支持 image_url，直接调用复现 400）；网关透传正常，换视觉模型渠道即可。
- 文件类型：附件支持扩大为 图片 + 文本类文件（txt/md/csv/json/代码等，读取前 20000 字符注入为上下文）；其它二进制提示「暂不支持该文件类型」。
- 联网：开关已透传 web_search_options；DeepSeek 忽略该参数但请求正常（200）；真实联网需支持 web_search 的渠道；本机 DDG 等免费搜索 API 不可达（http=000），无法做免费兜底搜索。
- 实测（本机应用内浏览器）：上传 test-note.txt → chips + 注入 → DeepSeek 正确回答文件内容 ✅；图片上传链路正常（报错仅为 DeepSeek 不支持视觉）。
- 提交：9171a4af 及 9171a4af（本地，未推送）。

## 测试：GPT 中转渠道 zzone.cc.cd（2026-08-09）

- 用户提供 OpenAI 兼容 key + https://zzone.cc.cd/v1。配置渠道 GPT-zzone（type=1），发现 base_url 不能带 /v1（new-api 自动拼 /v1），已改为 https://zzone.cc.cd。
- 诊断：zzone 本身是 new-api 网关；/v1/models 实测支持 gpt-5.4/gpt-5.5/gpt-5.6-sol/gpt-5.6-terra/codex-auto-review（gpt-4o-mini 等不可用，已更新渠道模型与 abilities）。
- 结果：连接/鉴权/模型路由全部正常；真实调用返回 **403 Insufficient account balance（zzone 账户余额不足）**，充值后可复用。
- 临时调试代码（distributor/channel_cache/channel_select）已全部还原；key 仅存本地 DB（打码记录）。

## 修复：联网（Web Search）在 GPT 模型下可用（2026-08-09）

- 现象：聊天开启联网用 GPT 无效。
- 根因：① chat/completions 的 web_search_options 只写入 context 无人消费，OpenAI 联网需 Responses API + web_search_preview；② 会话用户分组为空时 /pg 分发找不到渠道。
- 修复：联网时前端改走 /pg/responses（新增会话路由，镜像 /pg/chat/completions）并携带 tools:[web_search_preview] + web_search_options；后端 Distribute 对 /pg/responses 读取请求体 group（镜像 chat 逻辑）；响应解析 output_text。
- 验证：API 实测 gpt-5.4 → 200，web_search_preview 调用 3 次并计费（logs id=217，quota 53748）；Chrome UI 实测 gpt-5.5 开启联网回答真实新闻并带来源（响应 55.81s，截图 .local-tests/websearch-gpt.png）。
- 注意：联网依赖渠道/模型支持（GPT-5.x 等）；DeepSeek 渠道不支持会报错；搜索+推理响应较慢属正常。
- 提交：74f220f6 及 676a52e0/1ec2564f/fef1c269/74f220f6（本地，未推送）。

## UI：历史面板底部隐私提示（2026-08-09）

- 需求：历史面板底部加一行小字「历史记录仅保存在本浏览器，不会同步到服务器」，带信息图标。
- 实现：playground-history.tsx 底部新增 Info 图标 + 提示；7 语言包新增 key。
- 验证：typecheck/build ✅；浏览器实测提示与图标显示正常。
- 提交：03f1f58d（本地，未推送）。

## 功能：钱包「获取兑换码」+ 计费设置「兑换码」链接（2026-08-09）

- 需求：钱包-资金-历史订单 下加「获取兑换码」点击跳转；系统设置-计费与支付 加「兑换码」可配置跳转链接。
- 后端：新增选项 RedemptionCodeLink（common/constants.go 默认空、model/option.go 映射+更新、controller/misc.go 状态暴露）。
- 前端：新增 redemption-code-settings-section（兑换码链接输入+保存）；billing 注册表加「兑换码」分区；充值卡 action 区加「获取兑换码」按钮（window.open 新标签，仅配置链接后显示）。
- 验证：go build/typecheck/build ✅；Chrome(admin) 实测计费导航出现「兑换码」且链接输入生效；钱包显示「获取兑换码」；选项 PUT 后 /api/status 返回 RedemptionCodeLink。
- 备注：当前测试值为 https://example.com/redeem，正式链接请在设置里填写。
- 提交：39aa2ea3（本地，未推送）。

## 修复：浏览器标签页 favicon 确认为 JistAILogo.png（2026-08-09）

- 需求：浏览器标签页 logo 也使用 JistAILogo.png。
- 排查：`web/public/jistai-logo.png` 与用户源文件 `D:\图片\logo\JistAi\JistAILogo.png` SHA-256 完全一致（9EB8765A20A2F3D0...），`web/index.html` 也已指向 `/jistai-logo.png`；但 Rsbuild 因 `web/public/favicon.ico` 存在，在构建产物 `<head>` 末尾自动注入 `<link rel="icon" href="/favicon.ico">`，浏览器取后者 → 标签页仍显示旧图标。DB 无 Logo 选项（status 返回空），前端不会用状态值覆盖 favicon，故根因就是重复的 favicon.ico。
- 修复：删除 `web/public/favicon.ico`（仓库内无任何代码引用，git 历史可回退）；重建后 `dist/index.html` 只剩 `<link rel="icon" type="image/png" href="/jistai-logo.png">`。
- 验证：`bun run build` ✅；镜像 `new-api-dev:local` 重建 + 容器重启；`curl localhost:3000/` 仅 1 个 icon 链接（jistai-logo.png）、无 favicon.ico；`/jistai-logo.png` 200 image/png 222734B。
- 提交：14f023b4（本地，未推送）。

## 交付：dev 分支推送 origin（2026-08-09）

- 用户明确要求「推送」；推送前对 `origin/dev..dev` 全量 diff 做密钥扫描（`sk-` 长密钥、测试账号密码、DB 口令等）无命中。
- 推送结果：`77b874a7..ba188fc6  dev -> dev`（共 25 个提交，含历史面板/折叠动画/附件联网参数/兑换码/favicon 修复等全部二开内容）。
- 本账本更新后另行提交并推送（见下）。

## 同步：main 镜像上游 + dev 合并（2026-08-09）

- 现象：GitHub 提示 fork 的 main 落后 QuantumNous/new-api:main 2 个提交。
- 上游更新（均未触碰二开文件）：`2399de97` fix(ali): stop injecting top_p（`relay/channel/ali/text.go` + 新增 `text_test.go`）；`823e2630` fix(channels): Qwen TTS 模型分类（`web/src/features/channels/lib/model-categories.ts`）。
- main：`git merge upstream/main --ff-only`（`5c3abff → 823e2630`）→ `git push origin main` ✅（不 force push）。
- dev：`git merge main` 无冲突（ort 自动合并 3 文件）。
- 验证：`go build ./...` ✅；`go test ./relay/channel/ali/...` ✅（新增测试）；`bun run typecheck` ✅；`bun run build` ✅。
- 提交：dev 上的 merge commit + 本账本提交，随后 `git push origin dev`。

## 部署准备：撤销（2026-08-09）

- 用户中断部署准备并要求撤销：① 删除本会话生成的专用 SSH 密钥 `id_ed25519_jistai`（私钥+公钥，公钥从未安装到服务器，无需服务器侧清理）；② 删除部署镜像 `jist319/new-api:dev-2026-08-09`（300MB，构建已完成但未用于任何容器/未上传）。
- 验证：密钥文件不存在、镜像 tag 不存在；本地运行镜像 `new-api-dev:local` 不受影响；服务器与远端未做任何变更（此前 main/dev 同步记录保持不变）。
- 下一步：待用户明确部署安排后再继续（届时重新生成密钥/镜像，流程见 PLAN 部署章节）。

## 功能：教程文档（2026-08-10）

- 需求：① 顶栏「文档」改名「教程文档」；② 系统设置 → 站点与品牌 → 系统信息 新增「教程文档」自定义内容；**留空以禁用**；支持 Markdown、HTML 或完整 URL 重定向。
- 后端：新增选项 `TutorialDoc`（`common/constants.go` 默认空、`model/option.go` OptionMap 注册 + UpdateOption case、`controller/misc.go` 状态暴露 `tutorial_doc` + 新增 `GET /api/tutorial-doc`、`router/api-router.go` 注册路由）。
- 前端：
  - 新增 `features/tutorial/`（api/types/tutorial-doc，复用 `LegalDocument` 渲染 Markdown/HTML/URL）+ 路由 `/tutorial`；
  - `use-top-nav-links.ts`：`tutorial_doc` 为空 → 不显示；http(s) URL → 外部新标签；其它 → 内置 `/tutorial` 页（标题 `Tutorial Docs`）；
  - `header-navigation-section.tsx` 文档模块名同步为「教程文档」；
  - 系统信息表单新增 `TutorialDoc` 字段（Textarea + 描述「留空禁用…」）；`SiteSettings` 类型/default/registry 同步；
  - i18n：7 语言新增 4 个 key（经 `add-missing-keys.mjs` + `bun run i18n:sync`，临时脚本已删）。
- 验证：`go build ./...` ✅、`go vet` ✅；`bun run typecheck` ✅、`bun run build` ✅（routeTree 重新生成含 `/tutorial`）；镜像 `new-api-dev:local` 重建 + 容器重启。
- API 实测：`/api/status.tutorial_doc` 初始空 → PUT 保存 Markdown（中文 roundtrip ok）→ status/`/api/tutorial-doc` 一致；URL 模式 → 返回完整 URL；清空 → `""`（禁用）；`/api/option/` 含 `TutorialDoc`；`/tutorial` 200；dist bundle 含「教程文档 / Tutorial Docs / /tutorial」。
- 备注：本地 DB 当前留有 Markdown 示例（顶栏会显示「教程文档」，点开可看效果）；正式使用请在 系统设置→站点与品牌→系统信息 编辑，或清空禁用。lint 仍为上游存量错误（D008），本次新文件无新增。
- 提交：760984be（本地，未推送）。

## UI：主页 Hero「文档」按钮同步为教程文档（2026-08-10）

- 需求：主页「前往仪表盘 / Get Started」右侧的「文档」按钮也要改。
- 改动：`hero.tsx` 不再读取 `docs_link`（去掉 `https://docs.newapi.pro` 兜底），改读 `tutorial_doc`：空 → 按钮隐藏；http(s) URL → 外链新标签；其它 → 内置 `/tutorial`；文案 `Tutorial Docs`（7 语言 key 已存在）。
- 验证：`bun typecheck`/`build` ✅；镜像重建 + 容器重启；`/api/status.tutorial_doc` 持久化（重启后内容保留，此前一次 `"1"` 为测试临时态，非功能问题）；当前 DB 留有 61 字符 Markdown 演示。
- 提交：3867d1b8（本地，未推送）。

## i18n：概览设置引导第 3 步文案 Playground → 聊天（2026-08-10）

- 需求：「设置引导 → 3. 发送请求」下小字「使用 Playground 或你的客户端验证路由」改为「使用聊天或你的客户端验证路由」。
- 改动：保持 key `Verify routing with Playground or your client` 不变（避免 i18n 产生 extra 残留），仅更新 7 个语言包该 key 的值（en=…with Chat…、zh=使用聊天或你的客户端验证路由、zh-TW/fr/ja/ru/vi 同步）；经 `add-missing-keys.mjs` + `bun run i18n:sync`（临时脚本已删）。
- 验证：sync 报告 missing/extras 均 0；`bun run build` ✅；镜像重建 + 容器重启；dist bundle 已含新值（`routing with Chat or your client`；残留 Playground 为 i18n key 本身）。
- 提交：643e61a8（本地，未推送）。

## 交付：dev 推送 origin（2026-08-10）

- 用户明确要求「推送」；推送前对 `origin/dev..dev` 全量 diff 做密钥扫描（`sk-` 长密钥、测试账号密码、DB 口令等）无命中。
- 推送结果：`ba2b89e4..3d6fe92a  dev -> dev`（7 个提交：部署准备撤销、教程文档功能、主页 Hero 按钮、设置引导文案 i18n 等）。
- 本账本更新后另行提交并推送。

## 修复：手机端聊天「历史」面板无法显示（2026-08-10）

- 现象：手机访问「聊天」时历史对话记录看不到。
- 根因：`playground-history.tsx` 的 `<aside>` 写死 `hidden md:flex` —— <768px 下面板整体隐藏，且展开按钮仅在折叠态渲染，手机端没有任何入口。
- 修复：面板移动端改为抽屉浮层（`absolute inset-y-0 left-0 z-30 w-60`），默认隐藏；聊天区左上角新增浮动「历史」入口按钮（`md:hidden`，仅手机显示），点击打开；打开时显示半透明遮罩（点遮罩关闭），选择对话/新建对话后自动关闭；桌面端行为不变（静态侧栏 + 折叠）。
- 验证：`bun typecheck`/`build` ✅（playground 历史 chunk 已更新）；镜像重建 + 容器重启；`/api/status` ok。
- 说明：历史记录按设计只存本浏览器 localStorage，手机与电脑是不同浏览器/设备，各自独立，不互通。
- 提交：5fdcd438（本地，未推送）。

## 交付：dev 推送 origin（2026-08-10 第二次）

- 用户明确要求「推送」；推送前对 `origin/dev..dev` 全量 diff 做密钥扫描（`sk-` 长密钥、测试账号密码、DB 口令等）无命中。
- 推送结果：`51185fc0..2db6306a  dev -> dev`（2 个提交：手机端历史面板修复 + STATUS 哈希记录）。
- 本账本更新后另行提交并推送。

## 修复：手机端历史抽屉透明/无动画/占比太小（2026-08-10）

- 现象：手机端「历史」①页面呈透明黑色；②打开/关闭无过渡动画；③面板只占屏幕约 1/3。
- 根因：抽屉背景用 `bg-muted/20`（20% 透明度），黑色遮罩透出来 → 看着像透明黑；面板用条件渲染切换 `hidden/flex`，无过渡；宽度固定 `w-60`(240px) 在手机上偏小。
- 修复：①背景改为不透明 `bg-background`（桌面仍 `md:bg-muted/20`）；②面板改为常驻 + `translate-x` 滑动（`-translate-x-full ↔ translate-x-0`，`transition-[width,transform] duration-300`），遮罩加 `animate-in fade-in-0`；③宽度改 `w-[85%] max-w-80`（约占屏 85%，上限 320px）。
- 验证：`bun typecheck`/`build` ✅；镜像重建 + 容器重启；`/api/status` ok。
- 提交：2300e1c7（本地，未推送）。

## 修复：手机端历史抽屉宽度改为 1/3 + 收起按钮可用（2026-08-10）

- 用户反馈：①手机端抽屉里「收起」按钮点了没反应；②85% 屏宽不符合预期，应为 **33%（1/3）**。
- 修复：①收起按钮 onClick 同时 `setMobileOpen(false)`（手机=关闭抽屉）与 `setCollapsed(true)`（桌面=折叠侧栏）；②手机端宽度从 `w-[85%] max-w-80` 改为 `w-1/3`（33.33% 屏宽，无上限），桌面端仍 `md:w-60`/折叠 `md:w-0` 不变。
- 验证：`bun typecheck`/`build` ✅；镜像重建 + 容器重启；`/api/status` ok。
- 提交：b149654c（本地，未推送）。
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
