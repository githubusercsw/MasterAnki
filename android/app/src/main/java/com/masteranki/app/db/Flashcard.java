package com.masteranki.app.db;

import androidx.room.Entity;
import androidx.room.Index;
import androidx.room.PrimaryKey;

/** 生成的闪卡，字段对齐前端 Flashcard。 */
@Entity(
    tableName = "flashcards",
    indices = {
        @Index(value = {"entryId"}),
        @Index(value = {"status"})
    }
)
public class Flashcard {
    @PrimaryKey
    public String id;

    public String entryId;

    /** basic | cloze | image_occlusion */
    public String type;

    public String front;

    public String back;

    /** Cloze 专用：带 {{c1::...}} 标记的原文 */
    public String cloze;

    /** Image Occlusion 专用 */
    public String imageUrl;

    /** 标签，逗号分隔存储 */
    public String tags;

    /** 来源内容哈希（去重用） */
    public String sourceHash;

    /** AnkiDroid note id（编辑同步依赖） */
    public Long noteId;

    public int sortOrder;

    /** pending | added | error */
    public String status;

    public long createdAt;

    public Long updatedAt;

    public Flashcard() {}

    public Flashcard(String id, String entryId, String type, String front, String back, String cloze,
                     String imageUrl, String tags, String sourceHash, Long noteId, int sortOrder,
                     String status, long createdAt, Long updatedAt) {
        this.id = id;
        this.entryId = entryId;
        this.type = type;
        this.front = front;
        this.back = back;
        this.cloze = cloze;
        this.imageUrl = imageUrl;
        this.tags = tags;
        this.sourceHash = sourceHash;
        this.noteId = noteId;
        this.sortOrder = sortOrder;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}
