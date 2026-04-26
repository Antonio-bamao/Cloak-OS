# 决策记录

> 记录高影响决策，不要只记录结论，要写背景、理由和后续约束。

## 2026-04-23 - Phase 1 使用无外部依赖 Node.js 骨架

- 决策：首个可执行切片采用 Node.js ESM + `node:test`，暂不引入 Express、数据库、Redis 或构建工具。
- 原因：当前仓库只有架构原则文档；无外部依赖能最快验证核心模块边界、Pipeline、DecisionEngine、Strategy 和 Service/Repository 关系。
- 影响：HTTP route 先作为可测试的纯函数适配器；真实服务器和持久化放入 Phase 2。
- 备选：直接初始化 Express + PostgreSQL + Redis；因环境和字段细节未明确，推迟到核心契约稳定后。

## 2026-04-26 - Phase 3 管理台采用无构建静态实现

- 决策：Phase 3 管理台采用 `/admin` 静态 HTML/CSS/原生 JS，而不是 React SPA。
- 背景：项目当前后端已经是无构建 Node.js ESM 形态，管理台需求集中在活动 CRUD、概览、日志、错误态、空状态和移动端可用性；引入 React/Vite/状态库会显著增加依赖与构建复杂度。
- 原因：无构建静态管理台可以直接由现有 Node HTTP server 托管，仍然只通过 `/api/v1/*` 管理 API 工作，保持 Route -> Service -> Repository 边界，不绕过 Bearer token 鉴权。
- 影响：管理台交互逻辑集中在 `public/admin/app.js`，样式集中在 `public/admin/styles.css`；通过 `test/admin-ui.test.js`、PostgreSQL admin smoke、opt-in Chrome 布局测试来防止资源和布局回退。
- 后续约束：除非另立复杂前端工程任务，不引入 React/Vite/React Query/Zustand/React Hook Form；需要新增管理台能力时优先复用现有静态资源和同源 API 模式。
- 备选：按早期计划建立 React SPA；当前阶段收益不足，保留为未来复杂交互或多页面后台需求出现后的单独决策。
