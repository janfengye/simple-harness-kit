# QA 标准

## 本项目的 QA 检查项

文档型项目不跑 build/test，但有自己的质量检查：

### Layer 2 等效检查

| 检查项 | 方法 | 标准 |
|--------|------|------|
| Markdown 格式 | 无损坏的链接引用 | 0 错误 |
| JS Hook 语法 | `node -c scripts/hooks/*.js` | 全部通过 |
| 文件命名 | 小写+连字符 | 无例外 |
| 内部链接 | methodology/ 之间的引用 | 全部有效 |

### JS Hook 功能性测试

语法检查（node -c）不够。对 Hook 脚本的变更，必须用真实或模拟输入验证功能：
- 构造 stdin JSON 输入（模拟 Claude Code 的 hook 调用格式）
- 验证 stderr 输出（提醒/警告）和 exit code（0 放行 / 2 阻止）
- 覆盖正常路径和边界条件

回归测试场景在 `tests/scenarios/` 下，变更 Hook 后至少跑相关场景。

### Hook 生效验证

**每次新 session 开始时**，检查 `.harness/observations.jsonl` 是否有新数据产生。如果没有，说明 session-logger hook 未生效，所有 hooks 可能都未加载。排查：
- `.claude/settings.json` 是否在项目根目录
- 工作目录是否在项目根目录
- Hook 脚本是否有执行权限

### Layer 3 等效检查

新增/修改方法论文档时，检查：
- 与其他文档是否一致（不自相矛盾）
- 实验证据是否支持（M1-M13 有对应实验）
- 场景实例是否可操作（不是空洞的描述）

### 真实场景验证

对于功能性变更（如 harness-learn 新增 --promote/--periodic），不能只用 mock 数据验证。必须在真实项目的开发流程中产出数据，用真实数据跑一遍完整流程。
