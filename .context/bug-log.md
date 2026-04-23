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
