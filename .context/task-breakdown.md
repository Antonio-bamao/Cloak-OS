# 任务拆解

## 当前优先级

1. Phase 0：项目上下文与基础工程文件
   - 创建/更新 `.context` 必需文件。
   - 创建 `package.json` 与 Node.js 测试脚本。
   - 建立 `src/core`、`src/detectors`、`src/services`、`src/repositories`、`src/routes`、`src/strategies`、`src/config`、`src/utils`。
2. Phase 1：核心检测链路
   - 测试并实现 `BaseDetector`、`DetectionPipeline`。
   - 测试并实现 `IpDetector`、`UserAgentDetector` 示例。
   - 测试并实现 `DecisionEngine` 判定规则。
3. Phase 1：活动与跳转链路
   - 测试并实现 `CampaignRepository` 内存版本。
   - 测试并实现 `CampaignService`。
   - 测试并实现 Redirect / Iframe / Loading 策略和工厂。
   - 提供 `cloak.routes.js`，保持 Route -> Service 边界。
4. Phase 1：质量与运行验证
   - 运行 `node --test`。
   - 运行 `.context` 校验脚本。
   - 更新工作日志与当前状态。
5. Phase 2：运行时 API 基础
   - 测试并实现统一 API 响应 helper。
   - 测试并实现健康检查 route。
   - 测试并实现 Node HTTP server 适配层。
   - 测试并实现 AppError 到统一错误响应的转换。
6. Phase 2：管理 API 与持久化准备
   - 增加 `/api/v1/campaigns` route。
   - 增加 JSON body 解析与动态 route 参数。
   - 增加结构化 logger。
   - 增加配置化启动入口和请求完成日志。
   - 明确 Campaign schema 草案。
   - 明确 AccessLog schema 草案。
   - 增加内存版 AccessLog Repository。
   - 将访问日志写入接入 `CampaignService.handleVisit`。
   - 增加 `/api/v1/campaigns/:id/logs` 分页查询。
   - 增加初始 SQL migration 生成器。
   - 增加访问日志 verdict/action/IP/时间范围过滤。
   - 落地 `migrations/001_initial.sql`，并测试与生成器一致。
   - 增加 Repository contract 测试。
   - 修复内存仓储可变引用泄漏。
   - 增加仓储时间源注入和分页参数归一化。
   - 增加 Bot IP 数据源抽象。
   - 调整 `IpDetector` 依赖 bot IP source contract。
   - 增加默认 DetectionPipeline 工厂。
   - 增加默认 CampaignService 工厂，集中 app 运行时装配。
   - 增加 `BOT_IPS` 配置解析并接入默认 pipeline。
   - 增加运行时配置校验。
   - 增加配置合并，支持局部覆盖。
   - 增加 README 运行说明和 `.env.example`。
   - 增加文档校验测试，覆盖命令、环境变量和 API 路径。
   - 增加 Redis Bot IP Source 适配器接口形状。
   - 注册公网斗篷入口 `GET /c/:campaignId`。
   - 支持策略响应原样返回 302/HTML，不强制 JSON 包装。
   - 补齐 Campaign update/delete Repository、Service、Route。
   - 扩展 Repository contract 覆盖 Campaign CRUD。
   - 增加公网斗篷入口 rate limiting。
   - 增加 AppError 响应头支持，用于 `Retry-After`。
   - 增加管理 API Bearer token 鉴权。
   - 保持 health 和公网 cloak 入口无需认证。
   - 增加 `AnalyticsService`，独立汇总管理台概览数据。
   - 增加 `/api/v1/analytics/overview` 受保护管理 API。
   - 扩展 AccessLog Repository contract，覆盖按 tenant 全量列表与 mutation 隔离。
   - 增加 `AccessLogService`，独立提供管理台全局日志查询。
   - 增加 `/api/v1/logs` 受保护管理 API，支持分页和筛选。
   - 扩展 AccessLog Repository contract，覆盖按 tenant 分页日志查询。
   - 新增可注入 SQL client 的 PostgreSQL 风格 Campaign / AccessLog Repository 适配器。
   - 使用 fake PG client 测试数据库仓储行为，避免当前阶段依赖真实数据库服务。
   - 通过 `REPOSITORY_DRIVER` 和仓储工厂统一切换 memory / postgres。
   - 通过 `startServer` 的 `postgresClient` / `createPostgresClient(databaseUrl)` 接入真实 PostgreSQL client。
   - 准备未来接入真实 PostgreSQL 驱动依赖。
7. Phase 3：前端管理台与分析
   - 使用 `ui-ux-pro-max` 生成 Cloak Admin 设计系统。
   - 增加 `/admin` 静态管理台入口。
   - 增加管理台概览指标、判定分布、全局日志、活动列表和活动表单。
   - 通过同源 API 调用 `/api/v1/analytics/overview`、`/api/v1/logs`、`/api/v1/campaigns`。
   - 保持管理台 UI 使用 ADMIN_TOKEN，不绕过后端鉴权。

## 依赖关系

- `DetectionPipeline` 依赖 Detector 契约，但不依赖具体检测器。
- `DecisionEngine` 依赖标准 `DetectionResult[]`，不直接访问请求或数据库。
- `CampaignService` 依赖 Repository、Pipeline、DecisionEngine 和跳转策略工厂。
- Route 层只依赖 Service。
- HTTP server 只做协议适配和统一响应，不写业务逻辑。
- `/api/v1/campaigns` route 只调用 `CampaignService`，不直接访问 Repository。
- `startServer` 只负责配置化监听和启动日志，不承载业务装配以外的逻辑。
- 访问日志通过 `accessLogRepository` 可选依赖接入 Service，未来替换数据库实现不需要改检测或跳转逻辑。
- 初始 migration SQL 从 schema 约束映射，避免表字段说明与实现漂移。
- 访问日志查询过滤在 Repository 层执行，Route 仅将 query 参数转为过滤条件。
- Repository 实现必须返回数据副本，避免调用方 mutation 污染存储状态。
- Repository contract 测试作为未来 PostgreSQL 实现的共享行为基线。
- Detector 依赖数据源接口，不直接拥有可变外部数据；未来 Redis/数据库数据源可替换 `botIpSource`。
- 默认 app 装配必须使用真实检测管道，不使用空 Pipeline。
- `startServer` 默认 app 必须在读取 config 后创建，确保环境配置进入运行时装配。
- 启动前必须校验运行时配置；局部覆盖配置必须与默认配置合并后再校验。
- README 和 `.env.example` 必须由测试覆盖关键命令、环境变量和 API 路径。
- 新增 Bot IP 数据源必须作为独立 source 模块接入，不改变 `IpDetector` 判定职责。
- 公网斗篷入口返回跳转策略的原始 HTTP 响应；管理 API 才使用统一 JSON 响应。
- Campaign CRUD 必须经 Route -> Service -> Repository 分层，不允许 Route 直接访问 Repository。
- 公网 rate limiting 必须作为 route wrapper 接入，不进入 Detector 或 CampaignService。
- 管理 API 鉴权必须作为 route wrapper 接入，不进入 CampaignService 或 Repository。
- 公网斗篷入口和健康检查不使用管理 API 鉴权。
- AnalyticsService 只依赖 CampaignRepository 与 AccessLogRepository，不侵入 CampaignService。
- Analytics route 只调用 AnalyticsService，并通过管理 API 鉴权 wrapper 接入。
- AccessLogService 只依赖 AccessLogRepository，避免把全局日志列表塞入 CampaignService。
- 全局日志 route 只调用 AccessLogService，并通过管理 API 鉴权 wrapper 接入。
- Admin UI 静态资源由独立 route 托管，不进入业务 Service。
- Admin UI 只通过公开的管理 API 读写数据，不直接访问 Repository。
- PostgreSQL 仓储适配器只依赖注入的 `client.query(sql, params)`，不直接耦合具体驱动。
- 默认运行时仍使用内存 Repository；未来切换数据库只应改装配层，不改 Service / Route。
- Redis 尚未接入真实服务，当前 Redis Bot IP Source 仅预留适配器接口。
