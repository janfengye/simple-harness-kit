# Project Constraints

**SINGLE SOURCE OF TRUTH** — 所有规则的唯一权威来源。

## 约束 ID 格式

- `C-{area}-{number}` — 单条约束
- `JC-{number}` — 联合约束组（组内必须同时成立）
- `VH-{number}` — 违规历史

## 约束区域（area）

- `API` — 公开接口
- `DATA` — 数据处理
- `TEST` — 测试相关
- `ARCH` — 架构相关

---

## [JC-01: CSV 转换选项一致性]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-API-01 | 新选项必须在 types.ts 的 Json2CsvOptions 接口中定义类型 | 确保类型安全和 IDE 补全 | 编译不过或用户无法发现选项 |
| C-API-02 | 新选项必须在 constants.ts 的 defaultJson2CsvOptions 中设置默认值 | 确保向后兼容 | 缺少默认值导致 undefined 行为 |
| C-API-03 | 新选项默认值必须保持向后兼容（不改变现有行为） | 升级不引入 breaking change | 用户升级后行为突变 |

## [JC-02: TDD 纪律]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-TEST-01 | 先写失败测试，再写实现代码 | TDD 红绿循环确保测试真正验证功能 | 测试可能是假通过 |
| C-TEST-02 | 测试必须覆盖正常值、边界值和错误情况 | 全面覆盖防止遗漏 | 边界 case 逃逸到生产 |
| C-TEST-03 | 测试数据使用独立的 JSON/CSV 文件对 | 遵循项目已有模式 | 测试维护困难 |

## [JC-03: Header 处理管道顺序]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-DATA-01 | headerFields 的 wrap/trim 操作必须在 fieldTitleMap 替换之后执行 | wrap 操作会修改 key 值导致后续 map 查找失败 | fieldTitleMap 在特定选项组合下静默失效 |

---

## Violation History

| ID | 日期 | 发生了什么 | 根因 | 对应约束 |
|---|---|---|---|---|
| VH-01 | 2026-04-01 | alwaysQuote + fieldTitleMap 同时使用时 fieldTitleMap 被静默忽略 | wrapHeaderFields 在 generateCsvHeader(含 fieldTitleMap) 之前执行 | C-DATA-01 |
