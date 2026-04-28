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
   - 引入官方 `pg` 驱动，并在 PostgreSQL 模式启动前执行连通性校验。
   - 增加 migration runner、status、dry-run、help 和可测试 CLI 调度层。
   - 增加 readonly PostgreSQL smoke-check、API smoke-check、Admin smoke-check。
   - 增加 API smoke cleanup，默认删除本次测试 Campaign 和访问日志。
   - 为 API/Admin smoke 增加可选 `--check-health` 探测。
   - 补子进程级 CLI 集成测试，覆盖 direct-run、stdout/stderr 和 exit code。
7. Phase 3：前端管理台与分析
   - 使用 `ui-ux-pro-max` 生成 Cloak Admin 设计系统。
   - 增加无构建依赖的 `/admin` 静态管理台入口。
   - 增加管理台概览指标、判定分布、全局日志、活动列表和活动表单。
   - 通过同源 API 调用 `/api/v1/analytics/overview`、`/api/v1/logs`、`/api/v1/campaigns`。
   - 保持管理台 UI 使用 ADMIN_TOKEN，不绕过后端鉴权。
   - 去除 SaaS/Premium 营销化文案，统一为自用中文管理台语气。
   - 补齐错误横幅、重试按钮、空状态和筛选无结果状态。
   - 补齐移动端 CSS：触控目标、表格横向滚动、侧栏/导航收敛、窄屏表单布局。
   - 增加 opt-in 真实浏览器布局测试，覆盖空状态、长 URL 非空表格和 PostgreSQL 模式。
   - 将浏览器截图输出到 `test-output/admin-browser-layout/`，并保持该目录不进入 Git。
8. Phase 4：生产部署与使用手册
   - 新增生产部署设计 spec 与执行计划。
   - 新增 Dockerfile，使用 Node 20 与 pnpm 生产依赖安装运行现有 Node HTTP server。
   - 新增 `.dockerignore`，避免依赖目录、Git 元数据、本地 env 和测试输出进入镜像上下文。
   - 新增 `docker-compose.prod.yml`，提供 app + PostgreSQL 的生产部署样例，PostgreSQL 不映射公网端口。
   - 新增 `docs/DEPLOYMENT.md`，记录 `.env.production`、migration、smoke-check、健康检查和更新流程。
   - 新增 `docs/USAGE.md`，记录 Admin UI/API 使用方式，以及机器人看白页、真人看黑页/黑夜页的验证流程。
   - 新增部署文档测试，锁定生产部署文件和使用手册关键内容。
   - 将 `docs/DEPLOYMENT.md` 和 `docs/USAGE.md` 改为中文用户文档。
   - 补齐管理台“系统设置”：新增受保护 `GET /api/v1/settings` 和独立 `#settings` 面板。
   - 收紧生产配置：生产环境禁止内存仓储与默认开发 token，`DATABASE_URL` 存在时自动选择 PostgreSQL。
   - 去掉生产文档和 env 示例里的持久化 Bot IP 示例，避免示例数据被当成线上规则。
   - 修复 PostgreSQL JSONB detection reasons 写入，确保 Bot 命中理由可真实写入访问日志。
   - 用真实 PostgreSQL 链路完成白页/黑页临时演练，并确认测试 Campaign/log 自动清理。
   - 新增 `preflight:postgres` 上线前检查命令，串联 migration status、health、settings、admin、白页/黑页演练和 cleanup。
   - 新增 Nginx/TLS 反向代理示例，保留 `X-Forwarded-For` 并限制管理入口来源 IP。
   - 新增 PostgreSQL 备份/恢复 PowerShell 脚本，恢复操作要求显式确认。
   - 将 `backups/` 加入 Git 和 Docker build 忽略列表。
   - 新增生产日志轮转配置：`LOG_FILE_PATH`、`LOG_MAX_BYTES`、`LOG_MAX_FILES`。
   - 新增 rotating JSON Lines file logger，并在未注入 logger 的启动路径按配置自动启用。
   - `docker-compose.prod.yml` 挂载 `cloak-app-logs` volume，默认写入 `/app/logs/cloak.log`。
   - 将 `logs/` 加入 Git 和 Docker build 忽略列表，并在 README / 部署文档记录日志轮转。
   - 新增 GitHub Actions CI workflow，覆盖依赖安装、全量测试、生产 Compose 配置解析和 `.context` 校验。
   - 新增手动 release smoke workflow，使用 PostgreSQL service container 跑 migration、smoke-check 和 production preflight。
   - 新增 repo-local `scripts/validate_context.py`，让 CI 中的项目上下文校验可移植。

## 剩余可选项

- 若未来确实需要复杂前端状态管理，再单独立项 React/Vite 管理台；当前无构建静态管理台已满足本阶段验收。
- 若未来需要完整公网生产发布，可继续补自动部署流水线和生产告警。
- 若要进一步增强真实机器人识别，可接入真实 Bot IP 情报源或 Redis/数据库 Bot IP source 管理界面，而不是依赖静态 `BOT_IPS`。
- 若要上线公网，仍需要备份恢复演练、真实 Bot IP 情报源和基础告警。

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
- Admin UI 当前采用无构建静态 HTML/CSS/JS；除非另立前端工程任务，不引入 React/Vite/SPA 状态库。
- 管理台浏览器布局测试必须保持 opt-in，避免日常 `node --test` 启动 Chrome 或连接真实数据库。
- PostgreSQL 仓储适配器只依赖注入的 `client.query(sql, params)`，不直接耦合具体驱动。
- 默认运行时仍使用内存 Repository；未来切换数据库只应改装配层，不改 Service / Route。
- Redis 尚未接入真实服务，当前 Redis Bot IP Source 仅预留适配器接口。
- 日志轮转属于 logger sink 层能力，不能把文件写入细节扩散到 HTTP server、Route 或业务 Service。
- GitHub Actions 当前只做质量门和手动发布前验收，不自动部署生产服务器。
