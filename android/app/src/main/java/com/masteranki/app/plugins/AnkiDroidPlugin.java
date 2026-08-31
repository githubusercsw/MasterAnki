package com.masteranki.app.plugins;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.ichi2.anki.api.AddContentApi;
import com.masteranki.app.db.AppDatabase;
import com.masteranki.app.db.LogEntry;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * AnkiDroid Capacitor 插件（官方 Instant-Add API 接入）。
 *
 * 实现前端 src/plugins/AnkiDroid.ts 的接口。
 * 模型策略：优先使用 AnkiDroid 内置模型（Basic/Cloze/Image Occlusion），
 * 匹配不到时用 addNewBasicModel 兜底创建。
 * 权限：com.ichi2.anki.permission.READ_WRITE_DATABASE。
 */
@CapacitorPlugin(
    name = "AnkiDroid",
    permissions = {
        @Permission(
            strings = {"com.ichi2.anki.permission.READ_WRITE_DATABASE"},
            alias = "anki"
        )
    }
)
public class AnkiDroidPlugin extends Plugin {

    private AddContentApi api() throws Exception {
        if (AddContentApi.getAnkiDroidPackageName(getContext()) == null) {
            throw new IllegalStateException("AnkiDroid 未安装或 API 未开启");
        }
        return new AddContentApi(getContext());
    }

    // ==================== 能力检测 ====================

    @PluginMethod
    public void isAvailable(PluginCall call) {
        try {
            boolean ok = AddContentApi.getAnkiDroidPackageName(getContext()) != null;
            JSObject ret = new JSObject();
            ret.put("value", ok);
            call.resolve(ret);
        } catch (Exception e) {
            logError("AnkiDroid", "isAvailable", e);
            JSObject ret = new JSObject();
            ret.put("value", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", getPermissionState("anki") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState("anki") != PermissionState.GRANTED) {
            requestPermissionForAlias("anki", call, "permissionCallback");
        } else {
            JSObject ret = new JSObject();
            ret.put("value", true);
            call.resolve(ret);
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", getPermissionState("anki") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    // ==================== Deck / Model ====================

    @PluginMethod
    public void createDeck(PluginCall call) {
        String name = call.getString("name");
        if (name == null) {
            call.reject("Missing required parameter: name");
            return;
        }
        try {
            AddContentApi api = api();
            ensureDeck(api, name);
            call.resolve();
        } catch (Exception e) {
            logError("AnkiDroid", "createDeck", e);
            call.reject("Failed to create deck: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void ensureModel(PluginCall call) {
        String modelKey = call.getString("modelKey");
        JSArray fieldsArr = call.getArray("fields");
        if (modelKey == null) {
            call.reject("Missing required parameter: modelKey");
            return;
        }
        try {
            AddContentApi api = api();
            String modelName = resolveModelName(modelKey);
            ensureModel(api, modelName);
            call.resolve();
        } catch (Exception e) {
            logError("AnkiDroid", "ensureModel", e);
            call.reject("Failed to ensure model: " + e.getMessage(), e);
        }
    }

    // ==================== 模型读取 ====================

    /** 读取 AnkiDroid 中用户实际使用的全部模型：{ models: [{ id, name, fields }] } */
    @PluginMethod
    public void getModels(PluginCall call) {
        try {
            AddContentApi api = api();
            Map<Long, String> models = api.getModelList();
            JSArray arr = new JSArray();
            if (models != null) {
                for (Map.Entry<Long, String> e : models.entrySet()) {
                    JSObject m = new JSObject();
                    m.put("id", e.getKey().longValue());
                    m.put("name", e.getValue() != null ? e.getValue() : "");
                    String[] fields = api.getFieldList(e.getKey());
                    JSArray fieldsArr = new JSArray();
                    if (fields != null) {
                        for (String f : fields) {
                            fieldsArr.put(f != null ? f : "");
                        }
                    }
                    m.put("fields", fieldsArr);
                    arr.put(m);
                }
            }
            JSObject ret = new JSObject();
            ret.put("models", arr);
            call.resolve(ret);
        } catch (Exception e) {
            logError("AnkiDroid", "getModels", e);
            call.reject("Failed to get models: " + e.getMessage(), e);
        }
    }

    // ==================== Notes ====================

    @PluginMethod
    public void addNote(PluginCall call) {
        JSObject note = call.getObject("note");
        if (note == null) {
            call.reject("Missing required parameter: note");
            return;
        }
        try {
            String deckName = note.optString("deckName", "MasterAnki");
            String modelKey = note.getString("modelKey");
            if (modelKey == null) {
                call.reject("Missing required parameter: note.modelKey");
                return;
            }
            JSObject fieldsObj = note.getJSObject("fields");
            Set<String> tags = toTagSet(note.getJSONArray("tags"));

            AddContentApi api = api();
            long deckId = ensureDeck(api, deckName);
            long modelId = resolveModel(api, modelKey);

            // 按模型字段顺序拼接 fields 数组（AddContentApi 要求顺序一致）
            String[] fieldOrder = api.getFieldList(modelId);
            String[] fields = new String[fieldOrder.length];
            for (int i = 0; i < fieldOrder.length; i++) {
                fields[i] = fieldsObj.optString(fieldOrder[i], "");
            }

            Long noteId = api.addNote(modelId, deckId, fields, tags);
            JSObject ret = new JSObject();
            ret.put("noteId", noteId != null ? noteId.longValue() : JSONObject.NULL);
            call.resolve(ret);
        } catch (Exception e) {
            logError("AnkiDroid", "addNote", e);
            call.reject("Failed to add note: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void updateNote(PluginCall call) {
        if (!call.getData().has("noteId") || call.getData().isNull("noteId")) {
            call.reject("Missing required parameter: noteId");
            return;
        }
        try {
            long noteId = call.getLong("noteId");
            JSObject note = call.getObject("note");
            if (note == null) {
                call.reject("Missing required parameter: note");
                return;
            }
            JSObject fieldsObj = note.getJSObject("fields");
            Set<String> tags = toTagSet(note.getJSONArray("tags"));

            AddContentApi api = api();
            // 由 note.modelKey 解析模型 id，再按模型字段顺序拼数组
            String modelKey = note.getString("modelKey");
            if (modelKey == null) {
                call.reject("Missing required parameter: note.modelKey");
                return;
            }
            long modelId = resolveModel(api, modelKey);
            String[] fieldOrder = api.getFieldList(modelId);
            if (fieldOrder == null || fieldOrder.length == 0) {
                call.reject("Cannot resolve field order for model " + modelKey);
                return;
            }
            String[] fields = new String[fieldOrder.length];
            for (int i = 0; i < fieldOrder.length; i++) {
                fields[i] = fieldsObj.optString(fieldOrder[i], "");
            }
            boolean ok = api.updateNoteFields(noteId, fields);
            if (ok && tags != null) {
                ok = api.updateNoteTags(noteId, tags);
            }
            if (ok) {
                call.resolve();
            } else {
                call.reject("Failed to update note (unknown note id " + noteId + ")");
            }
        } catch (Exception e) {
            logError("AnkiDroid", "updateNote", e);
            call.reject("Failed to update note: " + e.getMessage(), e);
        }
    }

    // ==================== Dependency ====================

    @PluginMethod
    public void checkDependency(PluginCall call) {
        String depId = call.getString("depId");
        if (depId == null) {
            call.reject("Missing required parameter: depId");
            return;
        }
        try {
            boolean available;
            if ("ankidroid.ioenhanced".equals(depId)) {
                // Image Occlusion Enhanced：检查是否存在 Image Occlusion 模型
                AddContentApi api = api();
                Map<Long, String> models = api.getModelList();
                available = false;
                if (models != null) {
                    for (String name : models.values()) {
                        if (name != null && name.toLowerCase().contains("occlusion")) {
                            available = true;
                            break;
                        }
                    }
                }
            } else {
                // 未知依赖：按 AnkiDroid 可用性兜底
                available = AddContentApi.getAnkiDroidPackageName(getContext()) != null;
            }
            JSObject ret = new JSObject();
            ret.put("available", available);
            call.resolve(ret);
        } catch (Exception e) {
            logError("AnkiDroid", "checkDependency", e);
            JSObject ret = new JSObject();
            ret.put("available", false);
            call.resolve(ret);
        }
    }

    // ==================== Helpers ====================

    /** 模型 key → AnkiDroid 内置模型名（前端与原生共同约定） */
    private String resolveModelName(String modelKey) {
        if (modelKey == null) return "Basic";
        String k = modelKey.toLowerCase();
        if (k.contains("cloze")) return "Cloze";
        if (k.contains("image") || k.contains("occlu")) return "Image Occlusion";
        if (k.contains("basic2") || k.contains("reversed")) return "Basic (and reversed card)";
        return "Basic";
    }

    /** 幂等建牌组：已有则返回 id，否则新建 */
    private long ensureDeck(AddContentApi api, String name) {
        Map<Long, String> decks = api.getDeckList();
        if (decks != null) {
            for (Map.Entry<Long, String> e : decks.entrySet()) {
                if (name.equals(e.getValue())) {
                    return e.getKey();
                }
            }
        }
        Long id = api.addNewDeck(name);
        if (id == null) {
            throw new IllegalStateException("Failed to create deck: " + name);
        }
        return id;
    }

    /** 解析模型 id：优先按 modelKey 精确匹配 AnkiDroid 已有模型（用户真实模板）；
     *  匹配不到再用关键字映射内置模型（幂等 ensureModel）。 */
    private long resolveModel(AddContentApi api, String modelKey) {
        if (modelKey == null) return ensureModel(api, "Basic");
        Map<Long, String> models = api.getModelList();
        if (models != null) {
            for (Map.Entry<Long, String> e : models.entrySet()) {
                if (modelKey.equals(e.getValue())) {
                    return e.getKey();
                }
            }
        }
        return ensureModel(api, resolveModelName(modelKey));
    }

    /** 幂等建模型：按名字在 AnkiDroid 中查找，找不到则用 addNewBasicModel 创建 */
    private long ensureModel(AddContentApi api, String name) {
        Map<Long, String> models = api.getModelList();
        if (models != null) {
            for (Map.Entry<Long, String> e : models.entrySet()) {
                if (name.equals(e.getValue())) {
                    return e.getKey();
                }
            }
        }
        Long id = api.addNewBasicModel(name);
        if (id == null) {
            throw new IllegalStateException("Failed to create model: " + name);
        }
        return id;
    }

    private Set<String> toTagSet(JSONArray arr) throws JSONException {
        if (arr == null) return null;
        Set<String> tags = new HashSet<>();
        for (int i = 0; i < arr.length(); i++) {
            tags.add(arr.getString(i));
        }
        return tags;
    }

    private void logError(String tag, String op, Exception e) {
        try {
            AppDatabase.getInstance(getContext()).logDao().insert(
                new LogEntry("error", tag, op + ": " + e.getMessage(),
                    android.util.Log.getStackTraceString(e), System.currentTimeMillis()));
        } catch (Exception ignored) {
        }
    }
}
