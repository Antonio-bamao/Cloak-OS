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
   - 准备替换内存 Repository 的数据库接口。

## 依赖关系

- `DetectionPipeline` 依赖 Detector 契约，但不依赖具体检测器。
- `DecisionEngine` 依赖标准 `DetectionResult[]`，不直接访问请求或数据库。
- `CampaignService` 依赖 Repository、Pipeline、DecisionEngine 和跳转策略工厂。
- Route 层只依赖 Service。
- HTTP server 只做协议适配和统一响应，不写业务逻辑。
- `/api/v1/campaigns` route 只调用 `CampaignService`，不直接访问 Repository。
- `startServer` 只负责配置化监听和启动日志，不承载业务装配以外的逻辑。
- 访问日志通过 `accessLogRepository` 可选依赖接入 Service，未来替换数据库实现不需要改检测或跳转逻辑。
- 数据库和 Redis 尚未接入，当前 Repository 使用内存实现以降低 Phase 1 阻塞。
