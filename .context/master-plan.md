# 斗篷Cloak 总体计划

## 目标

- 构建一个低耦合、高内聚、易扩展的斗篷系统，用插件式检测管道判定访客身份，并按活动配置执行 safe / money / block 动作。
- 首期交付一个可测试的 Node.js 后端核心骨架：检测器、Pipeline、DecisionEngine、Campaign Service、Repository、跳转策略和 API 路由边界。
- 所有实现遵守 `ENGINEERING_PRINCIPLES.md`：扩展优先新增模块，Route 不穿透 Repository，Detector 之间不互相依赖，配置集中管理，日志结构化。

## 阶段与里程碑

### Phase 0 - 项目上下文与工程骨架

- 初始化 `.context/` 项目记忆系统。
- 从 `ENGINEERING_PRINCIPLES.md` 提炼可执行任务。
- 建立无外部依赖的 Node.js 项目骨架和测试入口。

验收标准：
- `.context` 必需文件完整且无占位内容。
- `package.json` 提供 `test` 脚本。
- 基础目录符合分层架构。

### Phase 1 - 核心斗篷引擎 MVP

- 实现 `BaseDetector` 契约、`DetectionPipeline` 注册/执行机制。
- 实现 IP、UA 基础检测器示例，作为插件式扩展样板。
- 实现 `DecisionEngine`，把多个检测结果汇总为 `bot` / `human` / `suspicious` 与动作。
- 实现 Redirect / Iframe / Loading 策略和策略工厂。
- 实现 Campaign Service / Repository / API route 边界。

验收标准：
- 新增检测器只需新增文件并注册到 Pipeline。
- Route 层只做 HTTP 入出站适配，不直接访问 Repository。
- 单元测试覆盖 Pipeline、Detector、DecisionEngine、策略工厂和 Campaign Service。

### Phase 2 - 数据与运行时能力

- 保留内存 Repository 作为默认开发模式，并通过仓储工厂支持 PostgreSQL Repository。
- 增加统一错误处理中间件、结构化 logger、配置加载。
- 增加健康检查和真实 HTTP 服务入口。
- 增加 PostgreSQL client 装配、migration runner、readonly/API/Admin smoke-check 与真实 Docker PostgreSQL 联调。

验收标准：
- API 统一响应格式。
- 管理 API 带 `/api/v1/` 前缀。
- `GET /health` 可返回运行状态。
- `REPOSITORY_DRIVER=postgres` 时可连接真实 PostgreSQL，并通过 migration 与 smoke-check 验证。

### Phase 3 - 前端管理台与分析

- 建立无构建依赖的静态管理台，由 `/admin`、`/admin/styles.css`、`/admin/app.js` 托管。
- 实现活动 CRUD、全局访问日志、基础数据概览、判定/动作分布和活动表单。
- 管理台只通过同源管理 API 工作，不直接访问 Repository，不绕过 Bearer token 鉴权。
- 补齐空状态、错误态、移动端布局和真实浏览器布局检查。

## 验收标准

- 核心模块边界清晰，新增 Detector / Strategy 不需要修改稳定业务代码。
- 所有新增核心逻辑先有测试，测试命令可一键运行。
- 配置、错误、日志和 API 响应格式集中管理。
- 数据模型预留 `tenant_id`、`created_at`、`updated_at`。
- 管理台无需前端构建即可随 Node HTTP server 访问，并通过管理 API 完成读写。
- PostgreSQL 模式下 migration、API smoke、Admin smoke 和 opt-in 浏览器布局检查均可复验。
- `.context/current-status.md` 与实际工作状态保持同步。
