# 决策记录

> 记录高影响决策，不要只记录结论，要写背景、理由和后续约束。

## 2026-04-23 - Phase 1 使用无外部依赖 Node.js 骨架

- 决策：首个可执行切片采用 Node.js ESM + `node:test`，暂不引入 Express、数据库、Redis 或构建工具。
- 原因：当前仓库只有架构原则文档；无外部依赖能最快验证核心模块边界、Pipeline、DecisionEngine、Strategy 和 Service/Repository 关系。
- 影响：HTTP route 先作为可测试的纯函数适配器；真实服务器和持久化放入 Phase 2。
- 备选：直接初始化 Express + PostgreSQL + Redis；因环境和字段细节未明确，推迟到核心契约稳定后。
