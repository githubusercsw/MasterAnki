# AnkiDroid Instant-Add API 文档（api-v1.1.0）

> 依据官方 `com.github.ankidroid:Anki-Android:api-v1.1.0` 源码整理（2026-08-31 复核）。
> 同主题已沉淀至记忆系统 wiki/entities/AnkiDroid-API。

## 一、接入要点

### 依赖（Gradle）
```groovy
// 仓库：jitpack（android/build.gradle allprojects.repositories 加 maven { url "https://jitpack.io" }）
implementation 'com.github.ankidroid:Anki-Android:api-v1.1.0'
```

### AndroidManifest
```xml
<!-- 读写 AnkiDroid 数据库所需权限 -->
<uses-permission android:name="com.ichi2.anki.permission.READ_WRITE_DATABASE" />
<!-- Android 11+ 显式声明可查询的包 -->
<queries>
    <package android:name="com.ichi2.anki" />
</queries>
```

### 运行时权限
- Capacitor 侧用 `@Permission(strings={"com.ichi2.anki.permission.READ_WRITE_DATABASE"}, alias="anki")` + `requestPermissionForAlias`。
- AnkiDroid 侧：用户在 AnkiDroid 的「设置 → 进阶 → 插件 API」开启。

### 探测 AnkiDroid 是否可用
```java
AddContentApi.getAnkiDroidPackageName(context) != null
// 未安装 / API 未开启 → null
```

## 二、方法全集（AddContentApi）

### 构建 / 探测
| 方法 | 说明 |
|------|------|
| `AddContentApi(Context)` | 构造（Context 应用上下文） |
| `static String getAnkiDroidPackageName(Context)` | 返回 AnkiDroid 包名或 null（未装/API 未开） |
| `int getApiHostSpecVersion()` | 宿主 API 规范版本 |

### 牌组 Deck
| 方法 | 说明 |
|------|------|
| `Long addNewDeck(String deckName)` | 新建牌组，返回 did（含层级 `父::子`） |
| `Map<Long, String> getDeckList()` | 全量牌组 {did → 全路径名} |
| `String getDeckName(long did)` | 取牌组名 |
| `String getSelectedDeckName()` | 当前选中牌组名 |

### 模型 Model
| 方法 | 说明 |
|------|------|
| `Long addNewBasicModel(String name)` | 新建 Basic 模型（字段 Front/Back，1 模板） |
| `Long addNewBasic2Model(String name)` | 新建 Basic (and reversed) 模型（Front/Back，2 模板） |
| `Long addNewCustomModel(String name, String[] fields, String[] cards, String[] qfmt, ...)` | 自定义模型 |
| `long getCurrentModelId()` | 当前模型 id |
| `Map<Long, String> getModelList()` | 全量模型 {mid → 名称} |
| `Map<Long, String> getModelList(int minNumFields)` | 按最少字段数过滤 |
| `String getModelName(long mid)` | 取模型名 |
| `String[] getFieldList(long modelId)` | **关键**：按该模型字段顺序返回字段名数组（addNote 拼接 fields 需与之对齐） |

### Note 笔记
| 方法 | 说明 |
|------|------|
| `Long addNote(long modelId, long deckId, String[] fields, Set<String> tags)` | 新增笔记，返回 noteId（顺序敏感：fields 须与 getFieldList 对齐） |
| `int addNotes(long modelId, long deckId, List<String[]> fieldsList, List<Set<String>> tagsList)` | 批量新增 |
| `boolean updateNoteFields(long noteId, String[] fields)` | 更新字段 |
| `boolean updateNoteTags(long noteId, Set<String> tags)` | 更新标签 |
| `NoteInfo getNote(long noteId)` | 读单条（NoteInfo: getId/getFields/getKey，**仅有字段值数组，无字段名**） |
| `int getNoteCount(long mid)` | 模型下笔记数 |
| `List<NoteInfo> findDuplicateNotes(long mid, String key)` | 查重（按 key） |
| `Cursor queryNotes(long modelId)` | 查询笔记 |
| `int insertNotes(long deckId, ContentValues[] valuesArr)` | 原始插入（需全读写权限） |

### 媒体 / 预览
| 方法 | 说明 |
|------|------|
| `String addMediaFromUri(Uri uri, boolean deleteOriginal)` | 从 Uri 添加媒体文件 |
| `Map<String, Map<String, String>> previewNewNote(long mid, String[] flds)` | 预览模板渲染 |

## 三、内置模型字段（Instant-Add 自带）
| 模型 | 字段 | 模板 |
|------|------|------|
| Basic（`addNewBasicModel`） | `Front`, `Back` | Card 1 |
| Basic (and reversed)（`addNewBasic2Model`） | `Front`, `Back` | Card 1, Card 2 |
| Cloze（用户安装 Cloze 模板后存在） | `Text`, `Extra` | Cloze |
| Image Occlusion（依赖 Image Occlusion Enhanced 插件） | `Image`, `Occlusion`, `Remarks` | IO |

## 四、实战要点（MasterAnki 已验证）
1. **幂等建 deck/model**：先 `getDeckList()/getModelList()` 按名查，找不到再 `addNew*`，避免重复。
2. **addNote 字段顺序**：先 `getFieldList(modelId)` 取字段顺序，再按序填值数组；前端传 `{Front:..., Back:...}` 对象由原生按序拼装。
3. **updateNote 字段顺序**：同样先用 getFieldList 解析顺序；`getNote` 返回的 NoteInfo 只有值数组无字段名，不能据此定位字段。
4. **Cloze 需要用户已有 Cloze 模板**：`addNewBasicModel` 只建 Basic；Cloze 模型在 AnkiDroid 中通常由用户创建/下载。策略：先 getModelList 匹配 `Cloze`，匹配不到再考虑建自定义。
5. **Image Occlusion 依赖门禁**：`checkDependency("ankidroid.ioenhanced")` 通过 getModelList 找含 "occlusion" 的模型名判定是否可用，UI 据此禁用模板。

## 五、源码位置（复核用）
- jitpack sources jar：`https://jitpack.io/com/github/ankidroid/Anki-Android/api-v1.1.0/Anki-Android-api-v1.1.0-sources.jar`
- 关键类：`com.ichi2.anki.api.AddContentApi` / `NoteInfo` / `BasicModel` / `Basic2Model`
