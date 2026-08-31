package com.masteranki.app.db;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;

/** 收件箱条目（一次分享/一次输入的载体），字段对齐前端 InboxEntry。 */
@Entity(tableName = "inbox_entries")
public class InboxEntry {
    @PrimaryKey
    @NonNull
    public String id;

    /** text | url | pdf | voice | image | youtube | epub */
    public String contentType;

    /** text: 实际文本；url: URL；pdf: 文件 URL；image: 图片 dataURL/URI */
    public String content;

    public String preview;

    public String title;

    /** 提取后的可读文本 */
    public String extractedText;

    public String deckName;

    public boolean isLocked;

    public long createdAt;

    public InboxEntry() {}

    public InboxEntry(String id, String contentType, String content, String preview, String title,
                      String extractedText, String deckName, boolean isLocked, long createdAt) {
        this.id = id;
        this.contentType = contentType;
        this.content = content;
        this.preview = preview;
        this.title = title;
        this.extractedText = extractedText;
        this.deckName = deckName;
        this.isLocked = isLocked;
        this.createdAt = createdAt;
    }
}
