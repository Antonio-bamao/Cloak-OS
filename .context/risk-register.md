# 风险台账

| 风险 | 触发条件 | 影响 | 缓解策略 |
| --- | --- | --- | --- |
| R-001 缺少版本控制 | `git status --short` 返回非仓库错误 | 协作、回滚、审查能力弱 | 已运行 `git init`，后续创建首次提交 |
| R-002 产品字段与数据库细节未定 | 除 `ENGINEERING_PRINCIPLES.md` 外无 schema 或产品需求文件 | Phase 2 真实持久化可能需要调整 | Phase 1 先用内存 Repository 锁定接口，后续替换基础设施 |
