# 工作日志

> 每完成一个明确步骤就追加一条记录，不写流水账。

## 2026-04-23 17:32 CST - 初始化项目上下文

- 时间：2026-04-23 17:32 CST
- 目标：在实现前建立 `.context/` 项目记忆系统。
- 动作：运行 `project-context-os` 初始化脚本，创建必需上下文文件。
- 结果：`.context/README.md`、`master-plan.md`、`current-status.md`、`task-breakdown.md`、`work-log.md`、`bug-log.md`、`decisions.md`、`risk-register.md` 已创建。
- 验证：重新读取 `.context` 文件，确认模板存在。
- 下一步：将 `ENGINEERING_PRINCIPLES.md` 转换为具体计划和 Phase 1 任务。

## 2026-04-23 17:36 CST - 提炼工程计划

- 时间：2026-04-23 17:36 CST
- 目标：把工程准则文档转化为可执行任务。
- 动作：更新总体计划、当前状态和任务拆解。
- 结果：明确 Phase 0 到 Phase 3，当前执行 Phase 0 / Phase 1 的核心后端骨架。
- 验证：人工核对任务拆解与 `ENGINEERING_PRINCIPLES.md` 的 Pipeline、分层架构、策略模式和测试要求一致。
- 下一步：先写核心测试，再实现 Node.js 后端基础模块。

## 2026-04-23 17:45 CST - 完成 Phase 1 核心骨架

- 时间：2026-04-23 17:45 CST
- 目标：按测试优先方式落地核心斗篷引擎 MVP。
- 动作：先创建 `test/` 行为测试并确认缺失模块导致失败；随后实现 `src/core`、`src/detectors`、`src/strategies`、`src/repositories`、`src/services`、`src/routes`。
- 结果：完成 Pipeline、DecisionEngine、Detector 示例、跳转策略、内存 Campaign Repository、Campaign Service 和 cloak route。
- 验证：运行 `node --test`，14 个测试全部通过。
- 下一步：运行 `.context` 校验并整理 Phase 2 下一步。

## 2026-04-23 17:50 CST - 初始化 Git 仓库

- 时间：2026-04-23 17:50 CST
- 目标：为项目建立版本控制基础。
- 动作：运行 `git init`。
- 结果：已在项目根目录创建 `.git/`。
- 验证：`git init` 返回 `Initialized empty Git repository`；`git status --short` 显示当前项目文件均为未跟踪状态。
- 下一步：创建首次提交。

## 2026-04-23 18:05 CST - 完成 Phase 2 运行时基础切片

- 时间：2026-04-23 18:05 CST
- 目标：补充后端真实运行入口的最小基础能力。
- 动作：先新增 `test/api-runtime.test.js` 并确认缺失模块导致失败；随后实现 `api-response`、`health.routes`、`http-server` 和 `app`。
- 结果：系统现在具备统一成功/错误响应、`GET /health` route、Node HTTP server 适配层和 AppError 统一错误转换。
- 验证：运行 `node --test`，19 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：继续补 `/api/v1/campaigns` 管理 API route 和结构化 logger。

## 2026-04-23 18:20 CST - 完成 Campaign 管理 API 与结构化日志

- 时间：2026-04-23 18:20 CST
- 目标：补齐 Phase 2 的管理 API 基础和 logger。
- 动作：先新增 `campaign-api` 与 `logger` 测试并确认失败；随后实现 Campaign route、JSON body 解析、动态 route 参数、Repository 查询列表、Service 查询方法和结构化 logger。
- 结果：`/api/v1/campaigns` 支持创建、列表、按 ID 获取；无效 JSON 返回统一错误；logger 输出结构化字段。
- 验证：运行 `node --test`，23 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：添加配置化启动入口和请求完成日志。

## 2026-04-23 18:35 CST - 完成配置化启动和请求日志

- 时间：2026-04-23 18:35 CST
- 目标：让后端从可测试装配推进到可直接启动运行。
- 动作：先新增 `server-start` 测试和 HTTP 请求日志测试并确认失败；随后实现 `getConfig`、`startServer`、`npm start` 和 HTTP server 请求完成日志。
- 结果：服务可读取 `HOST` / `PORT` 启动；每个请求完成后记录 method、path、statusCode、latencyMs；启动成功后记录监听 host 和 port。
- 验证：运行 `node --test`，26 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：定义 Campaign / AccessLog schema 草案和持久化接口边界。

## 2026-04-23 18:50 CST - 完成 schema 草案与访问日志仓储

- 时间：2026-04-23 18:50 CST
- 目标：为未来 PostgreSQL 持久化建立稳定端口，同时记录斗篷访问日志。
- 动作：先新增 schema 与 access-log 测试并确认失败；随后实现 `databaseSchema`、`InMemoryAccessLogRepository`，并把访问日志写入接入 `CampaignService.handleVisit`。
- 结果：`campaigns` 与 `access_logs` schema 草案包含 tenant/audit 字段、索引和访问日志月分区策略；访问日志按 Campaign 和 tenant 查询；Service 不依赖具体存储实现。
- 验证：运行 `node --test`，31 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：增加访问日志查询 API 和 SQL migration 草案。

## 2026-04-23 19:05 CST - 完成访问日志查询 API 与 migration 草案

- 时间：2026-04-23 19:05 CST
- 目标：让管理侧可查询访问日志，并把 schema 映射到初始 SQL。
- 动作：先新增访问日志 API 与 migration 测试并确认失败；随后实现分页查询、`/api/v1/campaigns/:id/logs` route 和 `createInitialMigrationSql()`。
- 结果：访问日志 API 支持 page/pageSize 分页并返回统一 pagination；migration SQL 包含 campaigns、access_logs、索引和 access_logs 分区声明。
- 验证：运行 `node --test`，33 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：增加日志筛选条件和迁移文件落地。

## 2026-04-23 19:20 CST - 完成日志筛选与迁移文件落地

- 时间：2026-04-23 19:20 CST
- 目标：让访问日志 API 支持常用排查筛选，并把初始 migration 固化为文件。
- 动作：先新增筛选与 migration 文件一致性测试并确认失败；随后实现 verdict/action/ipAddress/from/to 过滤，保留测试传入的 createdAt，并创建 `migrations/001_initial.sql`。
- 结果：访问日志查询支持按判定、动作、IP、时间范围过滤；迁移文件与 `createInitialMigrationSql()` 输出保持一致。
- 验证：运行 `node --test`，35 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：定义 Repository contract 测试，为 PostgreSQL 实现做准备。

## 2026-04-23 19:35 CST - 完成 Repository contract 测试

- 时间：2026-04-23 19:35 CST
- 目标：固定数据访问端口行为，为未来 PostgreSQL Repository 复用同一契约测试做准备。
- 动作：先新增 `repository-contracts.test.js` 并确认失败；随后为内存仓储增加可注入时间源、返回副本、分页参数归一化。
- 结果：Campaign / AccessLog 仓储契约覆盖 tenant 隔离、时间戳、列表顺序、分页归一化和 mutation 隔离。
- 验证：运行 `node --test`，40 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：预留 Bot IP 数据源加载接口和 Detector 数据源抽象。

## 2026-04-23 19:50 CST - 完成 Bot IP 数据源抽象

- 时间：2026-04-23 19:50 CST
- 目标：让 IP 检测器依赖稳定数据源接口，避免直接持有列表数据。
- 动作：先新增 Bot IP source 与 detector 行为测试并确认失败；随后实现 `InMemoryBotIpSource`、`createBotIpSource`，并让 `IpDetector` 通过 `botIpSource.has(ip)` 查询。
- 结果：`IpDetector` 保留 `botIps` 兼容入口，同时支持注入未来 Redis/数据库数据源。
- 验证：运行 `node --test`，44 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：增加默认 DetectionPipeline 工厂，集中装配 IP / UA detector。

## 2026-04-23 20:05 CST - 完成默认检测管道工厂

- 时间：2026-04-23 20:05 CST
- 目标：集中运行时检测器装配，避免 app/service 层散落手动 new detector。
- 动作：先新增默认 pipeline 工厂测试并确认失败；随后实现 `createDefaultDetectionPipeline` 和 `createDefaultCampaignService`，让默认 app 使用 IP/UA detector 与访问日志仓储。
- 结果：默认启动路径不再使用空 Pipeline；IP/UA detector 装配顺序由工厂稳定维护。
- 验证：运行 `node --test`，46 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：增加 `BOT_IPS` 配置读取并接入默认 pipeline。

## 2026-04-23 20:20 CST - 完成 BOT_IPS 配置接入

- 时间：2026-04-23 20:20 CST
- 目标：让运行时可以通过环境变量注入 Bot IP 列表。
- 动作：先新增 `BOT_IPS` 配置和默认服务装配测试并确认失败；随后实现 CSV 解析、默认服务读取 config，并调整 `startServer` 默认 app 创建时机。
- 结果：`BOT_IPS=66.249.66.1,66.249.66.2` 会进入默认 `IpDetector` 的 Bot IP source。
- 验证：运行 `node --test`，47 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：增加运行时配置校验，避免无效端口或阈值进入服务。

## 2026-04-23 20:35 CST - 完成运行时配置校验

- 时间：2026-04-23 20:35 CST
- 目标：在服务启动前阻止无效配置进入运行时。
- 动作：先新增配置校验和启动前校验测试并确认失败；随后实现 `validateConfig`、`mergeConfig`，并让 `startServer` 创建 app 前完成校验。
- 结果：无效 host、port、检测阈值会以 `CONFIG_INVALID` 阻断启动；局部配置覆盖会与默认配置合并后再校验。
- 验证：运行 `node --test`，49 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：增加运行说明 / `.env.example`，并预留 Redis Bot IP Source 接口形状。

## 2026-04-23 20:50 CST - 完成运行文档收尾

- 时间：2026-04-23 20:50 CST
- 目标：补齐后端当前能力的启动与配置说明。
- 动作：先新增 README / `.env.example` 校验测试并确认失败；随后创建 `README.md` 和 `.env.example`。
- 结果：文档覆盖 `npm start`、`npm test`、运行时环境变量、健康检查、Campaign API、访问日志 API、架构说明和 migration 位置。
- 验证：运行 `node --test`，51 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：预留 Redis Bot IP Source 接口形状。

## 2026-04-23 21:05 CST - 完成 Redis Bot IP Source 适配器

- 时间：2026-04-23 21:05 CST
- 目标：预留 Redis Set 查询 Bot IP 的数据源接口，同时保持 Detector 单一职责。
- 动作：先新增 Redis Bot IP source 测试并确认失败；随后实现 `RedisBotIpSource` 和 `createBotIpSource({ type: 'redis' })` 分支。
- 结果：Redis-like client 通过 `sIsMember` 查询 IP，`load()` 可用 `del` / `sAdd` 刷新集合；`IpDetector` 无需修改即可使用 Redis 数据源。
- 验证：运行 `node --test`，54 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：执行后端阶段完成检查，确认进入 UI 前还缺什么。

## 2026-04-23 21:20 CST - 完成公网斗篷 HTTP 入口

- 时间：2026-04-23 21:20 CST
- 目标：补齐真实流量访问 Campaign 的公网入口。
- 动作：先新增 `/c/:campaignId` HTTP 集成测试并确认失败；随后注册 `createCloakRoute`，并让 HTTP server 在 route 返回 headers 时原样发送 status/header/body。
- 结果：`GET /c/:campaignId` 可返回 302 redirect 或 HTML iframe/loading 页面；管理 API 仍保持统一 JSON 响应。
- 验证：运行 `node --test`，56 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：执行后端阶段完成检查，梳理进入 UI 前是否还有必须补齐的后端缺口。

## 2026-04-23 21:35 CST - 补齐 Campaign REST CRUD

- 时间：2026-04-23 21:35 CST
- 目标：补齐计划文档中的 Campaign CRUD API。
- 动作：先扩展 Repository contract、Campaign API 和 README 测试并确认失败；随后实现 Repository update/delete、Service update/delete、Route PUT/DELETE。
- 结果：`PUT /api/v1/campaigns/:id` 支持部分更新并推进 `updatedAt`；`DELETE /api/v1/campaigns/:id` 支持 tenant 隔离删除。
- 验证：运行 `node --test`，59 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：继续后端阶段完成检查，确认进入 UI 前是否还缺安全或运行边界。

## 2026-04-23 21:50 CST - 完成公网斗篷入口限流

- 时间：2026-04-23 21:50 CST
- 目标：落实计划文档中斗篷公网接口需要 rate limiting 的安全要求。
- 动作：先新增限流器和公网 cloak 429 测试并确认失败；随后实现 `InMemoryRateLimiter`、`createRateLimitedRoute`，并在 app 装配层包住 `GET /c/:campaignId`。
- 结果：公网斗篷入口超限时返回 429 JSON 错误与 `Retry-After` 头；正常 redirect/HTML 响应不受影响。
- 验证：运行 `node --test`，61 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：继续后端阶段完成检查，重点看鉴权边界和进入 UI 前的后端依赖。

## 2026-04-23 22:05 CST - 完成管理 API 鉴权边界

- 时间：2026-04-23 22:05 CST
- 目标：落实管理后台 API 需要认证、公网斗篷入口无需认证的安全边界。
- 动作：先新增 auth service、authenticated route wrapper、Campaign API 401 和文档测试并确认失败；随后实现 Bearer token 鉴权并包住 `/api/v1/*` routes。
- 结果：管理 API 需要 `Authorization: Bearer <ADMIN_TOKEN>`；`GET /health` 和 `GET /c/:campaignId` 保持公开。
- 验证：运行 `node --test`，65 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：继续后端阶段完成检查，确认是否可以进入 UI 管理台阶段。

## 2026-04-23 22:20 CST - 完成管理台 Analytics Overview API

- 时间：2026-04-23 22:20 CST
- 目标：补齐进入 UI 管理台前需要的后端概览数据接口。
- 动作：先新增 analytics API、AnalyticsService、Repository contract 和 README 测试并确认失败；随后实现 `AnalyticsService`、`createAnalyticsRoutes`、`GET /api/v1/analytics/overview` 和 `findAllByTenant()`。
- 结果：管理台可通过受保护 API 获取 Campaign 总数、总访问量、verdict 计数和 action 计数；统计逻辑独立在 AnalyticsService 中，不侵入 CampaignService。
- 验证：运行 `node --test`，70 个测试全部通过。
- 下一步：执行后端阶段完成检查，确认是否进入 UI 管理台阶段。

## 2026-04-23 22:35 CST - 完成管理台全局日志 API

- 时间：2026-04-23 22:35 CST
- 目标：让 UI 管理台可以直接查询跨 Campaign 的日志列表，避免只依赖单个 Campaign 日志 API。
- 动作：先新增 AccessLogService、全局日志 API、Repository contract 和 README 测试并确认失败；随后实现 `AccessLogService`、`createAccessLogRoutes`、`GET /api/v1/logs` 和 `findPageByTenant()`。
- 结果：管理 API 可分页查询全局访问日志，并支持 verdict/action/ipAddress/from/to 过滤；全局日志查询独立在 AccessLogService 中，不侵入 CampaignService。
- 验证：运行 `node --test`，74 个测试全部通过。
- 下一步：继续后端阶段完成检查，若没有硬后端缺口则进入 UI 管理台阶段。

## 2026-04-23 22:55 CST - 启动管理台 UI

- 时间：2026-04-23 22:55 CST
- 目标：按设计 skill 进入管理台 UI，实现可访问的第一屏后台。
- 动作：使用 `ui-ux-pro-max` 生成并持久化 Cloak Admin 设计系统；先新增 admin UI 托管测试并确认失败；随后实现 `createAdminStaticRoutes`、`public/admin/index.html`、`styles.css`、`app.js` 和 README 入口说明。
- 结果：`GET /admin` 可加载管理台，包含概览、判定分布、全局日志、活动列表和活动表单；UI 通过同源管理 API 工作，并使用 ADMIN_TOKEN 鉴权。
- 验证：运行 `node --check public/admin/app.js`；运行 `node --test`，75 个测试全部通过。
- 下一步：启动本地服务，检查 `/admin` 实际访问；继续做 UI 交互细节与移动端打磨。

## 2026-04-23 23:05 CST - 修复 Windows 直接启动入口并验证管理台

- 时间：2026-04-23 23:05 CST
- 目标：让 `npm start` / `node src/server/start.js` 在 Windows 下能真正启动 HTTP 服务，方便访问管理台。
- 动作：复现 `Start-Process node src/server/start.js` 立刻退出；定位为 `import.meta.url === file://${process.argv[1]}` 在 Windows 路径下不匹配；先新增 `isDirectRun()` 测试并确认失败，再使用 `fileURLToPath()` 和 `path.resolve()` 修复。
- 结果：服务已在 `http://127.0.0.1:3100/admin` 启动，PID `16708`；`/admin` 返回 200，analytics API 返回统一 JSON 响应。
- 验证：运行 `node --test`，76 个测试全部通过；运行 `.context` 校验，返回 `context is valid`。
- 下一步：继续管理台 UI 交互细节与移动端检查。

## 2026-04-23 23:25 CST - 按参考图重做暗色管理台仪表盘

- 时间：2026-04-23 23:25 CST
- 目标：将管理台视觉从普通浅色后台重做为用户参考图中的暗色霓虹运营仪表盘风格。
- 动作：使用 `ui-ux-pro-max` 重新生成并持久化 `Cloak Dark Console` 设计系统；先更新 admin UI 测试锁定顶部状态栏、环形图、成功弹窗和暗色 elevated token；随后重写 `public/admin/index.html`、`styles.css` 和 `app.js`。
- 结果：管理台现在包含暗色左侧导航、顶部状态组件、紧凑 KPI 卡、主 Campaign 表格、右侧 conic 环形图、动作分布卡、全局日志表和成功弹窗；现有同源 API 交互保持不变。
- 验证：运行 `node --check public/admin/app.js`；运行 `node --test`，76 个测试全部通过；扫描 `public/admin` 未发现 `radial-gradient`、viewport 字号或 emoji 图标。
- 下一步：让用户刷新 `/admin` 进行视觉确认，再根据反馈继续微调密度、色彩和布局。

## 2026-04-23 20:52 CST - 管理台去 SaaS 化并统一中文文案

- 时间：2026-04-23 20:52 CST
- 目标：移除自用后台中不合适的 Premium/SaaS 推广内容，并把管理台可见文案统一为中文。
- 动作：删除侧栏 `Go Premium` 卡片及对应样式；将导航、顶部状态、KPI、表格、筛选、表单、弹窗和图表标签改为中文；新增运行时枚举格式化函数，让 `redirect/human/money` 等内部值只在 API 层保留，界面展示中文。
- 结果：管理台不再出现 Premium/SaaS 风格内容；自用后台语气更一致，活动模式、判定、动作等动态数据也以中文呈现。
- 验证：运行 `node --check public/admin/app.js`；运行 `node --test test/admin-ui.test.js`；运行 `node --test`，76 个测试全部通过；扫描 `public/admin` 未发现 `premium-card`、`Go Premium`、`Live shield insights` 等旧内容。
- 下一步：刷新 `/admin` 检查视觉效果；继续补空状态、错误态、筛选细节和移动端检查。

## 2026-04-23 21:34 CST - 新增 PostgreSQL 仓储适配器

- 时间：2026-04-23 21:34 CST
- 目标：继续推进计划中的数据库 Repository 替换准备，但不要求当前阶段接入真实数据库服务。
- 动作：先新增 `test/postgres-repository.test.js` 并确认缺少模块导致失败；随后实现 `PostgresCampaignRepository`、`PostgresAccessLogRepository` 和集中行映射 `row-mappers.js`。
- 结果：新增仓储只依赖注入的 `client.query(sql, params)`，使用参数化 SQL；Campaign 与 AccessLog Service / Route 不需要修改，未来可在装配层替换内存仓储。
- 验证：运行 `node --test test/postgres-repository.test.js`，4 个测试全部通过；运行 `node --test`，80 个测试全部通过；测试覆盖 tenant 隔离、更新/删除、日志筛选分页、LIMIT/OFFSET 和返回副本。
- 下一步：继续做数据库运行时配置开关，或回到管理台空状态/错误态打磨。

## 2026-04-23 22:00 CST - 完成仓储运行时配置开关

- 时间：2026-04-23 22:00 CST
- 目标：让默认装配不再把内存仓储写死在 app 中，为未来接入真实 PostgreSQL 做配置切换入口。
- 动作：先新增 `test/repository-factory.test.js` 和 `test/server-start.test.js` 的配置断言并确认失败；随后实现 `src/repositories/factory.js`、`config.repository.driver`、`REPOSITORY_DRIVER` 文档和 `createApp()` / `createDefaultCampaignService()` 的仓储工厂装配。
- 结果：系统现在可以通过 `config.repository.driver` 在 `memory` / `postgres` 之间切换；`postgres` 模式在未注入 `postgresClient` 时会以明确的 `REPOSITORY_CLIENT_REQUIRED` 失败，不会半启动。
- 验证：运行 `node --test test/server-start.test.js test/repository-factory.test.js test/docs.test.js`，10 个测试全部通过；运行 `node --test`，83 个测试全部通过。
- 下一步：继续接入真实 PostgreSQL client 装配，或回到管理台空状态 / 错误态打磨。

## 2026-04-23 22:02 CST - 完成 PostgreSQL 启动装配入口

- 时间：2026-04-23 22:02 CST
- 目标：让 `postgres` 仓储模式真正进入启动流程，但仍保持不绑定具体数据库驱动。
- 动作：先扩展 `test/server-start.test.js`，为 `DATABASE_URL` 校验和 `createPostgresClient(databaseUrl)` 透传写失败测试；随后实现 `config.repository.databaseUrl`、`startServer()` 的 postgres client 解析与透传。
- 结果：`REPOSITORY_DRIVER=postgres` 时必须提供 `DATABASE_URL`；`startServer()` 现在可以直接接收 `postgresClient`，也可以通过注入 `createPostgresClient(databaseUrl)` 在启动时创建 client，并传给 `createApp()`。
- 验证：运行 `node --test test/server-start.test.js`，7 个测试全部通过；运行 `node --test test/server-start.test.js test/repository-factory.test.js test/docs.test.js`，12 个测试全部通过；运行 `node --test`，85 个测试全部通过。
- 下一步：继续接入真实 PostgreSQL 驱动依赖，或回到管理台空状态 / 错误态打磨。

## 2026-04-23 23:48 CST - 完成 PostgreSQL 真实驱动接入设计

- 时间：2026-04-23 23:48 CST
- 目标：在实现前确认真实 PostgreSQL 驱动接入方案，避免破坏现有仓储和业务边界。
- 动作：梳理当前 `startServer()`、仓储工厂和 PostgreSQL 仓储现状；与用户确认走“内置官方 `pg` + `pg.Pool`”方案；新增设计文档 `docs/superpowers/specs/2026-04-23-postgres-runtime-design.md` 并提交。
- 结果：设计明确真实 PostgreSQL 驱动只进入基础设施和启动装配层，要求启动前连通性校验、内部 pool 优雅释放、Repository/Service/Route 接口保持不变。
- 验证：人工自检 spec 无占位符、无边界冲突；运行 `git commit -m "docs: add postgres runtime design"`，得到提交 `e13399e`。
- 下一步：等待用户 review spec 后，按 TDD 先写 failing tests，再实现真实 PostgreSQL 驱动装配。

## 2026-04-23 22:26 CST - 完成 PostgreSQL 运行时驱动装配

- 时间：2026-04-23 22:26 CST
- 目标：让项目在 `REPOSITORY_DRIVER=postgres` 时无需外部注入即可使用官方 PostgreSQL 驱动启动，同时保持现有仓储边界不变。
- 动作：先新增 `test/create-postgres-client.test.js` 和 `test/server-start.test.js` / `test/docs.test.js` 中的失败测试；随后实现 `src/infrastructure/postgres/create-postgres-client.js`、给 `startServer()` 接入默认 `pg.Pool` factory 与内部 client 生命周期释放，并更新 `package.json`、`README.md`、`.env.example`；最后运行 `pnpm install` 安装 `pg`。
- 结果：postgres 模式下服务现在会默认创建内置 `pg.Pool`，先执行 `SELECT 1` 连通性校验，再继续监听 HTTP；若该 pool 是启动流程内部创建，则在 `server.close()` 时自动执行 `end()` 释放连接；外部注入 client 的行为保持不变。
- 验证：运行 `node --test test/create-postgres-client.test.js test/server-start.test.js test/docs.test.js`，13 个测试全部通过；运行 `node --test`，89 个测试全部通过。
- 下一步：若继续数据库方向，接真实 PostgreSQL 联调或补 migration 执行入口；否则回到管理台空状态 / 错误态打磨。

## 2026-04-23 22:29 CST - 修复 Git 工作区被依赖目录淹没

- 时间：2026-04-23 22:29 CST
- 目标：恢复可读的 Git 工作区状态，消除 `pnpm install` 后 `node_modules/` 被 Git 统计为大量未跟踪文件的问题。
- 动作：定位到仓库缺少 `.gitignore`；先新增 `test/gitignore.test.js` 复现缺失忽略规则的失败，再创建 `.gitignore`，仅加入 `node_modules/` 和 `.pnpm-store/`。
- 结果：Git 不再把依赖目录当作待跟踪文件，工作区恢复为只显示真实源码和文档改动。
- 验证：运行 `node --test test/gitignore.test.js`，1 个测试通过；运行 `node --test`，90 个测试全部通过；`git status --short` 不再出现 `node_modules/` 或 `.pnpm-store/`。
- 下一步：继续真实 PostgreSQL 联调或回到管理台空状态 / 错误态打磨。

## 2026-04-23 22:33 CST - 完成 PostgreSQL migration runner

- 时间：2026-04-23 22:33 CST
- 目标：让项目不仅能连接 PostgreSQL，还能通过已有 `migrations/001_initial.sql` 真正初始化数据库 schema。
- 动作：先新增 `test/migration-runner.test.js`、`test/run-migrations-command.test.js` 和 docs 失败测试；随后实现 `src/database/migration-runner.js`、`src/database/run-migrations.js`，并在 `package.json` 中新增 `npm run migrate`；最后更新 `README.md` 说明 `schema_migrations` 与 migration 执行方式。
- 结果：系统现在会按文件名顺序执行 `migrations/*.sql`，把已执行文件写入 `schema_migrations`，并在下次执行时自动跳过；命令入口会创建 PostgreSQL client、运行 migration，然后释放连接。
- 验证：运行 `node --test test/migration-runner.test.js test/run-migrations-command.test.js test/docs.test.js`，5 个测试全部通过；运行 `node --test`，93 个测试全部通过。
- 下一步：若继续数据库方向，补真实 PostgreSQL 联调与 smoke-check；否则回到管理台空状态 / 错误态打磨。

## 2026-04-23 22:36 CST - 补强 migration 失败路径与 CLI 输出

- 时间：2026-04-23 22:36 CST
- 目标：让 PostgreSQL migration 流程在失败时也保持事务和资源释放安全，并提升 CLI 反馈可读性。
- 动作：先为 `runMigrations()` 增加失败时回滚/释放 session 的测试，再为 `runMigrationsCommand()` 增加失败时关闭 client 的测试；随后在 `src/database/run-migrations.js` 中新增 `formatMigrationSummary()`，并让 CLI 输出 applied/skipped 的具体文件名。
- 结果：migration SQL 失败时会显式 `ROLLBACK`；命令入口即使失败也会释放 PostgreSQL client；命令执行成功后会输出更清晰的 migration 摘要。
- 验证：运行 `node --test test/migration-runner.test.js test/run-migrations-command.test.js`，6 个测试全部通过；运行 `node --test`，96 个测试全部通过。
- 下一步：若继续数据库方向，补真实 PostgreSQL smoke-check / 联调说明；否则回到管理台空状态 / 错误态打磨。

## 2026-04-23 22:39 CST - 新增 migration status 模式

- 时间：2026-04-23 22:39 CST
- 目标：为真实 PostgreSQL 联调提供“先看状态、不真正执行 migration”的安全入口。
- 动作：先为 `getMigrationStatus()`、`runMigrationStatusCommand()` 和新的 status 摘要输出写失败测试；随后在 `src/database/migration-runner.js` 中新增 migration 状态收集函数，在 `src/database/run-migrations.js` 中新增 status 命令分支，并在 `package.json` / `README.md` 中加入 `npm run migrate:status`。
- 结果：现在可以通过 `npm run migrate:status` 查看全部 migration、已执行 migration 和 pending migration；`runMigrations()` 也改为复用状态收集逻辑，减少重复路径。
- 验证：运行 `node --test test/migration-runner.test.js test/run-migrations-command.test.js test/docs.test.js`，11 个测试全部通过；运行 `node --test`，99 个测试全部通过。
- 下一步：若继续数据库方向，补 CLI 参数级测试或真实 PostgreSQL smoke-check 流程；否则回到管理台空状态 / 错误态打磨。

## 2026-04-23 22:42 CST - 补齐 migration CLI 参数与 smoke-check 文档

- 时间：2026-04-23 22:42 CST
- 目标：让真实 PostgreSQL 联调在没有预先写入环境变量的情况下也能安全、明确地执行 status/migrate 流程。
- 动作：先为 `parseMigrationCliArgs()`、`--database-url` 覆盖行为和 README smoke-check 文档写失败测试；随后在 `src/database/run-migrations.js` 中新增统一 CLI 参数解析，并让 direct-run 路径支持 `--status`、`--database-url`、`--migrations-dir`；最后在 `README.md` 中补充真实 PostgreSQL 的 smoke-check 顺序和命令示例。
- 结果：现在可以直接运行 `node src/database/run-migrations.js --status --database-url <url>` 或带 `--migrations-dir` 的 migrate 命令；即使配置文件里的 postgres `databaseUrl` 为空，也能通过 CLI 覆盖完成联调。
- 验证：运行 `node --test test/run-migrations-command.test.js test/docs.test.js`，11 个测试全部通过；运行 `node --test`，103 个测试全部通过。
- 下一步：若继续数据库方向，可以直接做真实 PostgreSQL smoke-check，或继续补 `--help` / dry-run 能力；否则回到管理台空状态 / 错误态打磨。
