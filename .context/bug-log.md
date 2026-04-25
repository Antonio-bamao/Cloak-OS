# Bug / 工程异常记录

> 所有会影响推进、质量、节奏或判断的异常都要记录，包括代码、环境、依赖、测试、打包和设计误判。

## 初始化脚本参数使用错误

- 标题：初始化脚本参数使用错误
- 现象：第一次运行 `init_context.py . --project-name "斗篷Cloak"` 返回 `unrecognized arguments: .`。
- 触发条件：把项目路径作为位置参数传入，而脚本要求使用 `--project-root`。
- 影响：`.context` 初始化延迟一次命令。
- 根因：未先确认脚本 CLI 参数格式。
- 解决方案：改用 `python ...\init_context.py --project-root . --project-name "斗篷Cloak"`。
- 预防措施：后续使用技能脚本前先读取脚本或 `--help`。
- 状态：已解决。

## 当前目录不是 Git 仓库

- 标题：当前目录不是 Git 仓库
- 现象：运行 `git status --short` 返回 `fatal: not a git repository`。
- 触发条件：在项目根目录检查版本控制状态。
- 影响：无法按部分技能工作流提交设计文档或实现快照。
- 根因：项目目录尚未初始化 Git。
- 解决方案：本次继续在工作区直接落地文件，并在风险登记中记录。
- 预防措施：后续进入正式迭代前初始化 Git 或确认外部版本控制方式。
- 状态：已记录。

## Node 测试运行器在沙箱内无法 spawn

- 标题：Node 测试运行器在沙箱内无法 spawn
- 现象：第一次运行 `node --test` 返回 `Error: spawn EPERM`。
- 触发条件：Node 内置 test runner 在默认沙箱中为测试文件创建子进程。
- 影响：无法获得真实测试失败或通过信号。
- 根因：默认沙箱限制子进程创建。
- 解决方案：按权限流程请求提升后重新运行 `node --test`。
- 预防措施：后续运行 Node test runner 时使用已批准的 `node --test` 命令前缀。
- 状态：已解决。

## Route 文件补丁残留

- 标题：Route 文件补丁残留
- 现象：`src/routes/campaign.routes.js` 末尾出现重复的 `}) }; }` 片段。
- 触发条件：在同一次补丁中向对象 route map 追加新 route 并移动文件尾部。
- 影响：会导致语法错误，阻断测试运行。
- 根因：补丁上下文未精确收束到函数末尾。
- 解决方案：在运行测试前读取文件并删除残留片段。
- 预防措施：以后对对象/函数尾部追加 route 后先读取目标文件进行语法形状检查。
- 状态：已解决。

## 内存仓储暴露可变内部对象

- 标题：内存仓储暴露可变内部对象
- 现象：调用方修改 `create()` 返回的 Campaign 或 AccessLog 对象后，仓储内部状态也被修改。
- 触发条件：Repository 直接存储并返回同一个对象引用。
- 影响：测试和业务代码可能无意污染存储状态；未来数据库实现与内存实现行为不一致。
- 根因：内存仓储没有模拟数据库读写边界的值拷贝行为。
- 解决方案：新增 `cloneRecord` / `cloneRecords`，仓储写入和读取都返回副本。
- 预防措施：通过 Repository contract 测试固定 mutation 隔离行为。
- 状态：已解决。

## 配置校验破坏局部覆盖启动

- 标题：配置校验破坏局部覆盖启动
- 现象：`startServer({ config: { server: { host, port } } })` 因缺少 detection 配置而失败。
- 触发条件：新增 `validateConfig` 后直接校验调用方传入的局部配置。
- 影响：测试和调用方无法只覆盖部分配置。
- 根因：启动配置没有先与默认配置深度合并。
- 解决方案：新增 `mergeConfig(defaultConfig, overrideConfig)`，`startServer` 合并后再校验。
- 预防措施：配置校验测试同时覆盖完整配置和局部覆盖启动路径。
- 状态：已解决。

## 公网斗篷入口未注册且 HTTP server 强制 JSON 响应

- 标题：公网斗篷入口未注册且 HTTP server 强制 JSON 响应
- 现象：`GET /c/:campaignId` 返回 404；即使 route 存在，HTTP server 也只会 `sendJson`，无法正确返回 302 或 HTML。
- 触发条件：做后端阶段完成检查时对真实流量入口写集成测试。
- 影响：系统只能管理 Campaign，不能通过公网入口执行斗篷跳转。
- 根因：已有 `cloak.routes.js` 未注册到 app；HTTP 协议适配层没有区分管理 API JSON 响应和策略原始响应。
- 解决方案：注册 `GET /c/:campaignId`，并新增 `sendRouteResponse`，当 route 返回 headers 时原样发送 status/header/body。
- 预防措施：保留 `cloak-http.test.js` 覆盖 redirect 和 iframe 策略的 HTTP 集成行为。
- 状态：已解决。

## 公网 cloak 限流测试未禁用 redirect 跟随

- 标题：公网 cloak 限流测试未禁用 redirect 跟随
- 现象：限流尚未接入时，测试请求跟随 302 到 `https://money.example`，导致外部连接超时。
- 触发条件：`fetch` 默认跟随 redirect，而测试期望在本地验证 429。
- 影响：红灯测试耗时变长且失败原因被外部网络噪声污染。
- 根因：测试没有设置 `redirect: 'manual'`。
- 解决方案：限流集成测试改为手动处理 redirect。
- 预防措施：所有验证 302 或可能触发 302 的 HTTP 测试都显式设置 `redirect: 'manual'`。
- 状态：已解决。

## Docker daemon unavailable blocked real PostgreSQL admin smoke
- 现象：node src/database/run-postgres-admin-smoke-check.js --database-url postgres://cloak:cloak_dev_password@127.0.0.1:55432/cloak --check-health failed with connect ECONNREFUSED 127.0.0.1:55432; docker ps also failed because Docker Desktop daemon pipe was unavailable.
- 触发条件：Running real PostgreSQL admin smoke verification after strengthening admin UI state asset checks.
- 影响：Code-level tests pass, but real PostgreSQL smoke cannot be re-verified until the local Docker daemon and cloak-postgres test container are running again.
- 根因：Local Docker Desktop Linux engine is not running, so the cloak-postgres container is unavailable and port 55432 has no PostgreSQL listener.
- 解决方案：Recorded as an environment blocker; after Docker Desktop was restarted, started the existing `cloak-postgres` container, confirmed `pg_isready`, and reran the real PostgreSQL admin smoke successfully.
- 预防措施：Before real PostgreSQL smoke checks, confirm Docker daemon availability and cloak-postgres readiness with docker ps and pg_isready.
- 状态：已解决，2026-04-25 20:09 CST 复验通过。
