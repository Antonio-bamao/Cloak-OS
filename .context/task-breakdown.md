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

## 依赖关系

- `DetectionPipeline` 依赖 Detector 契约，但不依赖具体检测器。
- `DecisionEngine` 依赖标准 `DetectionResult[]`，不直接访问请求或数据库。
- `CampaignService` 依赖 Repository、Pipeline、DecisionEngine 和跳转策略工厂。
- Route 层只依赖 Service。
- 数据库和 Redis 尚未接入，当前 Repository 使用内存实现以降低 Phase 1 阻塞。
