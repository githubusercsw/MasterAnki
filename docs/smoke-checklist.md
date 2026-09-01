# MasterAnki 真机冒烟回归清单（v0.3.1）

> 2026-09-01。本清单对应 Phase 3.8-3（规划见 docs/phase38-architecture-review.md）。
> 目标：验证 v0.3.1 在真实 AnkiDroid 环境下的关键链路，逐项打勾。任一红项需记录截图/日志后回到主线修复。

## 前置条件
- [ ] 已安装 AnkiDroid 且已开启「AnkiDroid 插件 API」
- [ ] 已安装 MasterAnki v0.3.1 APK（release 下载，非 debug 签名）
- [ ] 已在设置页填入至少一个 LLM Provider API Key 并保存

## A. 牌组 API（Phase 3.6-1 / 3.7-1）
- [ ] 条目页牌组显示为 AnkiDroid 真实牌组列表（而非仅"MasterAnki"自由文本）
- [ ] 选择已有牌组后，卡片入库到该牌组
- [ ] 「新建牌组」输入新名 → 入库后 AnkiDroid 中出现该牌组
- [ ] 牌组名不在真实列表时回退自由输入，不崩溃

## B. 模板（模型）真实读取（Phase 3.5/3.6-2）
- [ ] 模板选择页显示 AnkiDroid 真实模板（用户自定义模板名，如中文名）
- [ ] 选模板 + 选牌组后返回，入库用所选真实模板与牌组
- [ ] 自定义模型字段映射正确（mapFieldsToModel 启发式：问题→Front 类、答案→Back 类）

## C. 编辑同步 AnkiDroid（Phase 3.6-3）
- [ ] 编辑已入库卡片（有 noteId）→ 保存后 AnkiDroid 中该卡片内容同步更新
- [ ] 编辑未入库卡片 → 仅本地更新，无报错
- [ ] 编辑同步失败（如 API 未开）→ 卡片标 error，提示"本地已更新但同步失败"

## D. 批量入库与失败重试（Phase 3.7-2/3.7-3）
- [ ] 批量入库：进度条显示，全部成功 toast「已添加 N 张」
- [ ] 批量部分失败：toast 提示"成功 N 失败 M"，失败卡片标警示图标 + 重试按钮
- [ ] 失败卡片点击「重试」可再次入库
- [ ] 删除待处理卡片（批量选中）二次确认正常

## E. 统计埋点（Phase 3.6-4 / 3.8-1）
- [ ] 生成卡片 → 记录 card_generated 且 sourceType 非空（text/url）
- [ ] 入库成功 → 记录 card_added 且 providerId 非空
- [ ] 系统分享接收 → 记录 source_shared
- [ ] 导出 getStats 数据核对：三类事件齐、sourceType/providerId 非空（Phase 4 前置）

## F. 分享接收（Phase 3.5）
- [ ] 冷启动：外部 App 分享文本到 MasterAnki → 进入后自动入库
- [ ] 热启动：已打开 App 时接收分享 → 自动入库
- [ ] URL 分享识别为 url 类型

## G. 日志系统（Phase 3.5）
- [ ] 设置页可查看日志列表
- [ ] 日志导出：写缓存 + 系统分享成功

## H. UI 反馈（Phase 3.7-3）
- [ ] 生成/入库/删除等瞬时操作出现成功/失败 toast 且自动消失
- [ ] 深色模式、三语切换正常

## 通过标准
- [ ] A-E 全部通过（核心链路）；F-H 无崩溃
- [ ] 若有失败，已记录步骤/期望/实际/截图

---

### 回归范围说明（来自 docs/phase38-architecture-review.md）
- 冒烟重点是 **Phase 3.7 重构项**（useDeckSelector 三页共用、useToast 反馈、CardListItem 拆分）与 **Phase 3.8-1 统计维度**。
- 若 A-E 全过 → 统计维度达标 → 可启动 Phase 4 学习统计仪表盘。
