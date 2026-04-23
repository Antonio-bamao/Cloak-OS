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

- 替换内存 Repository 为数据库 Repository。
- 增加统一错误处理中间件、结构化 logger、配置加载。
- 增加健康检查和真实 HTTP 服务入口。

验收标准：
- API 统一响应格式。
- 管理 API 带 `/api/v1/` 前缀。
- `GET /health` 可返回运行状态。

### Phase 3 - 前端管理台与分析

- 建立 React SPA 管理台。
- 实现活动 CRUD、实时日志、基础数据概览。
- 预留 i18n、React Query、Zustand、React Hook Form 结构。

## 验收标准

- 核心模块边界清晰，新增 Detector / Strategy 不需要修改稳定业务代码。
- 所有新增核心逻辑先有测试，测试命令可一键运行。
- 配置、错误、日志和 API 响应格式集中管理。
- 数据模型预留 `tenant_id`、`created_at`、`updated_at`。
- `.context/current-status.md` 与实际工作状态保持同步。
