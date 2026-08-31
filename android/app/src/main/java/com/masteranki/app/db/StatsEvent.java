package com.masteranki.app.db;

import androidx.room.Entity;
import androidx.room.Index;
import androidx.room.PrimaryKey;

/** 学习统计事件（Phase 4 预埋），字段对齐前端 StatsEvent。 */
@Entity(
    tableName = "stats_events",
    indices = {@Index(value = {"createdAt"}), @Index(value = {"type"})}
)
public class StatsEvent {
    @PrimaryKey(autoGenerate = true)
    public long id;

    /** card_generated | card_added | source_shared */
    public String type;

    public int count;

    /** text | url | pdf | ... */
    public String sourceType;

    public String providerId;

    public long createdAt;

    public StatsEvent() {}

    public StatsEvent(String type, int count, String sourceType, String providerId, long createdAt) {
        this.type = type;
        this.count = count;
        this.sourceType = sourceType;
        this.providerId = providerId;
        this.createdAt = createdAt;
    }
}
