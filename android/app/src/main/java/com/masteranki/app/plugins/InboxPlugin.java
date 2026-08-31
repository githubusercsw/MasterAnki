package com.masteranki.app.plugins;

import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.masteranki.app.db.AppDatabase;
import com.masteranki.app.db.Flashcard;
import com.masteranki.app.db.InboxEntry;
import com.masteranki.app.db.InboxDao;
import com.masteranki.app.db.LogEntry;
import com.masteranki.app.db.StatsEvent;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Inbox Capacitor 插件（Room 实现）。
 *
 * 实现前端 src/plugins/Inbox.ts 的全部接口（14 方法）。
 * 字段语义与前端 src/lib/anki/types.ts 保持一致。
 */
@CapacitorPlugin(name = "Inbox")
public class InboxPlugin extends Plugin {

    private InboxDao dao() {
        return AppDatabase.getInstance(getContext()).inboxDao();
    }

    // ==================== Entries ====================

    @PluginMethod
    public void getAllEntries(PluginCall call) {
        try {
            List<InboxEntry> entries = dao().getAllEntries();
            JSArray arr = new JSArray();
            for (InboxEntry e : entries) {
                arr.put(entryToJson(e));
            }
            JSObject ret = new JSObject();
            ret.put("entries", arr);
            call.resolve(ret);
        } catch (Exception e) {
            logError("Inbox", "getAllEntries", e);
            call.reject("Failed to get entries: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getEntry(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("Missing required parameter: id");
            return;
        }
        try {
            InboxEntry entry = dao().getEntry(id);
            if (entry == null) {
                call.reject("Entry not found: " + id);
                return;
            }
            List<Flashcard> cards = dao().getCardsForEntry(id);
            JSArray cardsArr = new JSArray();
            for (Flashcard c : cards) {
                cardsArr.put(cardToJson(c));
            }
            JSObject ret = new JSObject();
            ret.put("entry", entryToJson(entry));
            ret.put("cards", cardsArr);
            call.resolve(ret);
        } catch (Exception e) {
            logError("Inbox", "getEntry", e);
            call.reject("Failed to get entry: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void saveEntry(PluginCall call) {
        JSObject entryObj = call.getObject("entry");
        if (entryObj == null) {
            call.reject("Missing required parameter: entry");
            return;
        }
        try {
            String id = entryObj.getString("id");
            if (id == null || id.isEmpty()) {
                id = UUID.randomUUID().toString();
            }
            InboxEntry entry = new InboxEntry(
                id,
                entryObj.optString("contentType", "text"),
                entryObj.optString("content", ""),
                entryObj.optString("preview", ""),
                entryObj.has("title") && !entryObj.isNull("title") ? entryObj.getString("title") : null,
                entryObj.has("extractedText") && !entryObj.isNull("extractedText") ? entryObj.getString("extractedText") : null,
                entryObj.has("deckName") && !entryObj.isNull("deckName") ? entryObj.getString("deckName") : null,
                entryObj.optBoolean("isLocked", false),
                entryObj.has("createdAt") ? entryObj.getLong("createdAt") : System.currentTimeMillis()
            );
            dao().saveEntry(entry);
            call.resolve();
        } catch (Exception e) {
            logError("Inbox", "saveEntry", e);
            call.reject("Failed to save entry: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void deleteEntry(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("Missing required parameter: id");
            return;
        }
        try {
            dao().deleteEntryCascade(id);
            call.resolve();
        } catch (Exception e) {
            logError("Inbox", "deleteEntry", e);
            call.reject("Failed to delete entry: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void deleteEntries(PluginCall call) {
        JSArray idsArr = call.getArray("ids");
        if (idsArr == null) {
            call.reject("Missing required parameter: ids");
            return;
        }
        try {
            List<String> ids = toStringList(idsArr);
            dao().deleteEntriesCascade(ids);
            call.resolve();
        } catch (Exception e) {
            logError("Inbox", "deleteEntries", e);
            call.reject("Failed to delete entries: " + e.getMessage(), e);
        }
    }

    // ==================== Cards ====================

    @PluginMethod
    public void saveCards(PluginCall call) {
        String entryId = call.getString("entryId");
        JSArray cardsArr = call.getArray("cards");
        if (entryId == null || cardsArr == null) {
            call.reject("Missing required parameters: entryId, cards");
            return;
        }
        try {
            long now = System.currentTimeMillis();
            List<Flashcard> cards = new ArrayList<>();
            for (int i = 0; i < cardsArr.length(); i++) {
                JSONObject c = cardsArr.getJSONObject(i);
                String cardId = UUID.randomUUID().toString();
                String type = c.has("type") && !c.isNull("type") ? c.getString("type") : "basic";
                Flashcard fc = new Flashcard(
                    cardId,
                    entryId,
                    type,
                    c.optString("front", ""),
                    c.optString("back", ""),
                    c.has("cloze") && !c.isNull("cloze") ? c.getString("cloze") : null,
                    c.has("imageUrl") && !c.isNull("imageUrl") ? c.getString("imageUrl") : null,
                    c.has("tags") && !c.isNull("tags") ? c.getJSONArray("tags").toString() : null,
                    c.has("sourceHash") && !c.isNull("sourceHash") ? c.getString("sourceHash") : null,
                    null,
                    i,
                    "pending",
                    now,
                    null
                );
                cards.add(fc);
            }
            dao().saveCards(cards);
            recordStats("card_generated", cards.size(), null, null);
            call.resolve();
        } catch (Exception e) {
            logError("Inbox", "saveCards", e);
            call.reject("Failed to save cards: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void updateCardContent(PluginCall call) {
        String cardId = call.getString("cardId");
        if (cardId == null) {
            call.reject("Missing required parameter: cardId");
            return;
        }
        try {
            String tags = call.getArray("tags") != null ? call.getArray("tags").toString() : null;
            String type = call.getData().has("type") && !call.getData().isNull("type") ? call.getString("type") : "basic";
            dao().updateCardContent(
                cardId,
                call.getString("front"),
                call.getString("back"),
                call.getData().has("cloze") && !call.getData().isNull("cloze") ? call.getString("cloze") : null,
                call.getData().has("imageUrl") && !call.getData().isNull("imageUrl") ? call.getString("imageUrl") : null,
                type,
                tags
            );
            call.resolve();
        } catch (Exception e) {
            logError("Inbox", "updateCardContent", e);
            call.reject("Failed to update card: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void updateCardStatus(PluginCall call) {
        String cardId = call.getString("cardId");
        if (cardId == null) {
            call.reject("Missing required parameter: cardId");
            return;
        }
        try {
            String status = call.getString("status");
            Long noteId = call.getData().has("noteId") && !call.getData().isNull("noteId") ? call.getLong("noteId") : null;
            dao().updateCardStatus(cardId, status, noteId);
            call.resolve();
        } catch (Exception e) {
            logError("Inbox", "updateCardStatus", e);
            call.reject("Failed to update card status: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void updateCardOrder(PluginCall call) {
        String cardId = call.getString("cardId");
        if (cardId == null) {
            call.reject("Missing required parameter: cardId");
            return;
        }
        try {
            dao().updateCardOrder(cardId, call.getInt("sortOrder"));
            call.resolve();
        } catch (Exception e) {
            logError("Inbox", "updateCardOrder", e);
            call.reject("Failed to update card order: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void deleteCards(PluginCall call) {
        JSArray cardIdsArr = call.getArray("cardIds");
        if (cardIdsArr == null) {
            call.reject("Missing required parameter: cardIds");
            return;
        }
        try {
            dao().deleteCards(toStringList(cardIdsArr));
            call.resolve();
        } catch (Exception e) {
            logError("Inbox", "deleteCards", e);
            call.reject("Failed to delete cards: " + e.getMessage(), e);
        }
    }

    // ==================== Entry updates ====================

    @PluginMethod
    public void updateExtractedContent(PluginCall call) {
        String entryId = call.getString("entryId");
        if (entryId == null) {
            call.reject("Missing required parameter: entryId");
            return;
        }
        try {
            String title = call.getData().has("title") && !call.getData().isNull("title") ? call.getString("title") : null;
            dao().updateExtractedContent(entryId, call.getString("extractedText"), title);
            call.resolve();
        } catch (Exception e) {
            logError("Inbox", "updateExtractedContent", e);
            call.reject("Failed to update extracted content: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void updateDeckName(PluginCall call) {
        String entryId = call.getString("entryId");
        if (entryId == null) {
            call.reject("Missing required parameter: entryId");
            return;
        }
        try {
            dao().updateDeckName(entryId, call.getString("deckName"));
            call.resolve();
        } catch (Exception e) {
            logError("Inbox", "updateDeckName", e);
            call.reject("Failed to update deck name: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void lockEntry(PluginCall call) {
        String entryId = call.getString("entryId");
        if (entryId == null) {
            call.reject("Missing required parameter: entryId");
            return;
        }
        try {
            dao().lockEntry(entryId);
            call.resolve();
        } catch (Exception e) {
            logError("Inbox", "lockEntry", e);
            call.reject("Failed to lock entry: " + e.getMessage(), e);
        }
    }

    // ==================== Stats ====================

    @PluginMethod
    public void getStats(PluginCall call) {
        try {
            long from = call.getData().has("from") && !call.getData().isNull("from") ? call.getLong("from") : 0L;
            long to = call.getData().has("to") && !call.getData().isNull("to") ? call.getLong("to") : Long.MAX_VALUE;
            List<StatsEvent> events = AppDatabase.getInstance(getContext()).statsDao().getRange(from, to);
            JSArray arr = new JSArray();
            for (StatsEvent ev : events) {
                JSObject o = new JSObject();
                o.put("type", ev.type);
                o.put("count", ev.count);
                o.put("sourceType", ev.sourceType != null ? ev.sourceType : JSONObject.NULL);
                o.put("createdAt", ev.createdAt);
                arr.put(o);
            }
            JSObject ret = new JSObject();
            ret.put("events", arr);
            call.resolve(ret);
        } catch (Exception e) {
            logError("Inbox", "getStats", e);
            call.reject("Failed to get stats: " + e.getMessage(), e);
        }
    }

    // ==================== Helpers ====================

    private JSObject entryToJson(InboxEntry e) throws JSONException {
        JSObject o = new JSObject();
        o.put("id", e.id);
        o.put("contentType", e.contentType);
        o.put("content", e.content);
        o.put("preview", e.preview);
        o.put("title", e.title != null ? e.title : JSONObject.NULL);
        o.put("extractedText", e.extractedText != null ? e.extractedText : JSONObject.NULL);
        o.put("deckName", e.deckName != null ? e.deckName : JSONObject.NULL);
        o.put("isLocked", e.isLocked);
        o.put("createdAt", e.createdAt);
        return o;
    }

    private JSObject cardToJson(Flashcard c) throws JSONException {
        JSObject o = new JSObject();
        o.put("id", c.id);
        o.put("entryId", c.entryId);
        o.put("type", c.type);
        o.put("front", c.front);
        o.put("back", c.back);
        o.put("cloze", c.cloze != null ? c.cloze : JSONObject.NULL);
        o.put("imageUrl", c.imageUrl != null ? c.imageUrl : JSONObject.NULL);
        o.put("tags", c.tags != null ? new JSONArray(c.tags) : new JSONArray());
        o.put("sourceHash", c.sourceHash != null ? c.sourceHash : JSONObject.NULL);
        o.put("noteId", c.noteId != null ? c.noteId : JSONObject.NULL);
        o.put("sortOrder", c.sortOrder);
        o.put("status", c.status);
        o.put("createdAt", c.createdAt);
        o.put("updatedAt", c.updatedAt != null ? c.updatedAt : JSONObject.NULL);
        return o;
    }

    private List<String> toStringList(JSArray arr) throws JSONException {
        List<String> list = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            list.add(arr.getString(i));
        }
        return list;
    }

    private void recordStats(String type, int count, String sourceType, String providerId) {
        try {
            AppDatabase.getInstance(getContext()).statsDao().insert(
                new StatsEvent(type, count, sourceType, providerId, System.currentTimeMillis()));
        } catch (Exception ignored) {
            // 统计失败不影响主流程
        }
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
