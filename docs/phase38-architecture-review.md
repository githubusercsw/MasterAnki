# MasterAnki 架构审视 & 真机冒烟/Phase 4 启动方案（Phase 3.8）

> 2026-09-01。对应任务链：
> - 任务 3（先行）：从本质、根源审视"真机冒烟回归 → 启动 Phase 4"的规划是否科学，定位架构紧要问题，产出本方案
> - 任务 2（后行）：按本方案进入真机冒烟回归，通过后启动 Phase 4

## 一、规划审视：用户的规划是否规范、科学？

**用户规划**："下一步进入真机冒烟回归，通过后启动第四阶段（Phase 4 学习统计仪表盘）"。

**评估**：方向正确（冒烟验证 → 迭代下一阶段），但存在**两个科学性问题**：

### 问题 1：冒烟回归"测什么"未界定
"真机冒烟回归"是一个方向而非清单——哪些功能必须验证、验收标准是什么、失败如何处理，均未定义。
没有清单的冒烟 = 靠记忆随手点，覆盖率不可控（这正是"自动化缺把关"的变体）。

### 问题 2：Phase 4 启动存在隐藏前置依赖
Phase 4 是"学习统计仪表盘"，其数据源是 **StatsEvent 采集**。但当前采集存在**维度缺失 + 双路径不一致**（见 §二），
意味着若直接启动 Phase 4，仪表盘将拿到不完整/不一致的数据，产出不可信。**Phase 4 的前置不是"冒烟通过"，而是"统计采集先达标"。**

**修正后的科学规划**：冒烟回归（清单化）→ 修复统计采集维度（小而稳）→ 打 tag 发布 → 再启动 Phase 4 数据校验。

## 二、当前架构紧要问题（按优先级，均基于代码实证）

### P0-A 统计采集维度缺失 → Phase 4 数据不可信
**实证**：
- 原生 `InboxPlugin.recordStats("card_generated", cards.size(), null, null)` —— **sourceType/providerId 恒为 null**。
- 原生 `AnkiDroidPlugin.recordStats("card_added", 1, null, null)` —— **同上**。
- 前端埋点位置：原生在 `addNote` 成功后埋 card_added；web 降级在 `updateCardStatus('added')` 埋 —— **两条路径埋点时机不一致**，同一操作在不同端统计结果不同。
- web 降级 `StatsEventRow` 接口**无 providerId 字段**，`getStats` 返回不含 providerId —— **与原生字段不对齐**。

**影响**：Phase 4 仪表盘按来源（text/url/pdf）、按 Provider（gemini/deepseek…）维度分析将全部失效；web 与原生统计结果漂移。

### P0-B Phase 3.7 优化未发布 → 真机冒烟装不到
**实证**：`git tag --contains 61f9d1b` 为空。Phase 3.7（useDeckSelector/useToast/CardListItem 三项重构）只在 main，
release 上仍是 v0.3.0（=Phase 3.6 产物）。真机冒烟若装 v0.3.0，**测不到本轮优化**，冒烟等于空转。

### P1-C 无 E2E/冒烟清单 → 回归覆盖率不可控
**实证**：docs/ 下无冒烟清单文档；Phase 3.5/3.6 的冒烟靠口头清单。

### P1-D 统计埋点时机与业务状态耦合
`card_added` 在原生 addNote 成功后埋、web 在 updateCardStatus 埋，本质是"埋点时机与业务链路耦合在不同层"，
长期会产生统计盲区（如 addNote 成功但 updateCardStatus 失败的边界）。

## 三、可执行、稳健、兼容性强的方案

> 兼容性护栏：① 不改 Room 表结构（StatsEvent 字段已够用，只修写入值）；② 插件接口签名不变；
> ③ web 降级与原生行为对齐；④ 每步 typecheck + lint + test（forks）全绿后独立提交。

### 3.8-1 修统计采集维度（P0-A，最小改动）
- `InboxPlugin.saveCards`：埋 `card_generated` 时传 `sourceType = entry.contentType`。
- `AnkiDroidPlugin.addNote` 与 `CardEditorScreen`/`buildAddTask` 链路：埋 `card_added` 时传 `providerId`（`getActiveProviderId()`）。
- 统一埋点时机：**统一在"卡片真正落库成功后"**（addNote 成功 / updateNote 成功后）由业务侧调用，
  移除 web 降级 `updateCardStatus` 里的隐式埋点，改为与原生一致的显式埋点入口。
- web `StatsEventRow` 补 `providerId` 字段，`getStats` 返回对齐原生。
- **验收**：getStats 返回的事件含非空 sourceType/providerId；原生与 web 埋点时机一致；单测覆盖。

### 3.8-2 打 tag v0.3.1 发布（P0-B）
- 提交 3.8-1 后 `git tag v0.3.1 && git push origin v0.3.1`，触发 Actions 构建 APK。
- **验收**：release 出现 v0.3.1 APK（含 Phase 3.7 + 3.8-1）。

### 3.8-3 编写真机冒烟回归清单（P1-C，写入 docs/）
- 新增 `docs/smoke-checklist.md`，覆盖：牌组读取/新建、模板联动、编辑同步、批量失败重试、统计埋点验证、冷启动分享、日志导出。
- **验收**：清单含步骤/预期/通过标准，可逐项打勾。

### 3.8-4 Phase 4 启动前置（统计数据校验）
- 真机冒烟统计项通过后，用 `getStats` 导出数据核对：card_generated/card_added/source_shared 三类事件、sourceType/providerId 非空。
- **验收**：数据完整度达标后，Phase 4 仪表盘才有可消费的数据源。

## 四、不做（边界收敛）
- 不改 Room 表结构、不加新依赖、不重写统计引擎。
- 仪表盘 UI 属 Phase 4 正式范围，3.8 只做"让数据先可信"。

## 五、结论
用户规划"冒烟 → Phase 4"方向对，但**必须先补两块地基**：① 统计采集维度（否则 Phase 4 无据可依）；② 冒烟清单（否则回归不可控）。
按 3.8-1 → 3.8-2 → 3.8-3 → 3.8-4 小步推进，即可在不触发连锁反应的前提下让"真机冒烟 → Phase 4"真正可执行、可验收。
