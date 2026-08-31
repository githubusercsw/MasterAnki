# MasterAnki Phase 3 复检报告（UI/UX 体验提升）

> 阶段范围：深色模式 + Markdown 渲染 + 多语言 + 快捷操作
> 完成日期：2026-08-31
> 关联索引：`_memory/INDEX.md`

## 一、进入前复检结论

- **连锁反应**：3a 深色模式触点为 `index.css`（已有 CSS 变量基线）+ 新增 ThemeContext；3b Markdown 需新装依赖并触达 EntryDetail/CardEditor 预览；3c 多语言触达全部 6 页面 + ConfirmGate 组件；3d 快捷操作触达 Inbox 条目 + ShareReceiver 接口。均按预判落地，无未预期连锁反应。
- **架构与核心目的**：四类插件机制未触碰；内容→闪卡→AnkiDroid 链路未偏移。Phase 3 为纯 UI 展示层增强。
- **三根源治理**：主题/语言偏好持久化并启动恢复（状态可靠）；无破坏性操作；Markdown 纯前端不依赖环境。

## 二、新增文件

| 文件 | 职责 |
|------|------|
| `src/lib/theme/ThemeContext.tsx` | 主题上下文：浅色/深色/跟随系统，`.ion-palette-dark` 类驱动 + color-scheme 同步 + 持久化（key `masteranki:theme`） |
| `src/lib/i18n/index.ts` | i18next 初始化 + `initLanguage`/`setLanguage`（持久化 key `masteranki:language`） |
| `src/lib/i18n/locales/en.ts` | 英文语言包（common/app/inbox/entry/settings/create/editor/template/confirmGate/actions 10 命名空间） |
| `src/lib/i18n/locales/zh.ts` | 中文语言包（键结构与 en 完全一致） |
| `src/lib/i18n/locales/ja.ts` | 日文语言包（键结构与 en 完全一致） |
| `src/lib/i18n/i18n.test.ts` | 4 用例：三语言键一致性 + 页面 t() 键全覆盖扫描 |
| `src/components/MarkdownRenderer.tsx` | Markdown 渲染：remark-gfm（表格）+ remark-math/rehype-katex（公式）+ rehype-highlight（代码高亮） |

## 三、修改文件

| 文件 | 改动 |
|------|------|
| `package.json` | 新装 react-markdown/remark-gfm/remark-math/rehype-katex/katex/rehype-highlight/i18next/react-i18next（镜像源安装） |
| `main.tsx` | 深色改为 `dark.class.css`（类驱动）；包裹 ThemeProvider；启动 `initLanguage` |
| `src/index.css` | 深色变量改为 `html.ion-palette-dark` 类驱动；新增 Markdown 渲染样式 + 删除线样式 |
| `App.tsx` / `context.ts` | 统一使用 `getDefaultContext()` 单例上下文（主题/i18n/LLMService 共享存储） |
| `pages/SettingsScreen.tsx` | 新增"外观"区：主题切换（浅/深/跟随系统）+ 语言切换（en/zh/ja）；全文案 t() 化 |
| `pages/InboxScreen.tsx` | 全文案 t() 化 + 长按快捷菜单（IonActionSheet：重新生成/删除/分享，桌面右键 + 移动长按） |
| `pages/EntryDetailScreen.tsx` | 全文案 t() 化 + 卡片列表用 MarkdownRenderer 渲染 front/back |
| `pages/ManualCreateScreen.tsx` | 全文案 t() 化 + success 布尔态替代字符串匹配 |
| `pages/CardEditorScreen.tsx` | 全文案 t() 化 + 实时 Markdown 预览 |
| `pages/TemplateSelectScreen.tsx` | 全文案 t() 化 |
| `components/ConfirmGate.tsx` | 文案 t() 化（确认门四类摘要行） |
| `plugins/ShareReceiver.ts` | 新增 `shareText` 接口（长按分享用，Web 降级 navigator.share） |

## 四、校验结果（2026-08-31）

| 检查 | 结果 |
|------|------|
| `npm run typecheck` | ✅ 通过 |
| `npm run lint` | ✅ 0 error / 11 warning（React Compiler 规则既有误报降级） |
| `npm run build` | ✅ 通过（chunk>500kB 提示——KaTeX/highlight 引入，非错误） |
| `npm run test` | ✅ 45/45（validateJson 8 + providers 11 + dedupService 10 + batch 5 + export 7 + i18n 4） |
| i18n 一致性 | ✅ 三语言键完全一致；页面 t() 键全覆盖无遗漏 |

## 五、遗留与边界

- **通知栏快捷入口（3d.2）**：属原生 Android 能力，需 Android SDK 环境接入原生插件（同 Room DB 一并列入原生层待办），Web 端以长按/右键快捷菜单作为交互等价物。
- **Markdown 图片卡片（3b.5）**：图片提取依赖 Phase 5 输入源扩展（PDF/网页图），当前 MarkdownRenderer 已支持 `![alt](url)` 渲染，等待上游数据接入。
- **KaTeX/高亮体积**：主 chunk 增大至 ~2MB（gzip 530KB），后续可考虑 `import()` 按需加载 MarkdownRenderer 优化首屏。
- **endpoint 未随保存持久化**：Ollama 等需 endpoint 的 Provider，当前 Save 未写回 endpoint 字段（原 Phase 1 遗留，待 Phase 4 前补齐）。

## 六、测试期经验

- jsdom 缺 `crypto.subtle` → setup.ts 注入 Node webcrypto（ESM 项目必须 `import` 不可 `require`）——已在 Phase 2 沉淀，Phase 3 复用。
- ESM 项目测试文件内 `require()` 同样不可用，统一改用顶部 `import`。
- i18n key 一致性用**自动测试守护**（而非人工核对），三语言键结构与页面调用全覆盖，杜绝漏译/错译回归。
