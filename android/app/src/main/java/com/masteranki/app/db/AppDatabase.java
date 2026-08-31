package com.masteranki.app.db;

import android.content.Context;

import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;

/**
 * MasterAnki Room 数据库。
 *
 * 版本策略：初测阶段用 fallbackToDestructiveMigration 防止升级崩溃；
 * 正式发布前（Phase 6）改为显式 Migration 保留用户数据。
 */
@Database(
    entities = {InboxEntry.class, Flashcard.class, LogEntry.class, StatsEvent.class},
    version = 1,
    exportSchema = false
)
public abstract class AppDatabase extends RoomDatabase {

    private static volatile AppDatabase instance;

    public abstract InboxDao inboxDao();
    public abstract LogDao logDao();
    public abstract StatsDao statsDao();

    public static AppDatabase getInstance(Context context) {
        if (instance == null) {
            synchronized (AppDatabase.class) {
                if (instance == null) {
                    instance = Room.databaseBuilder(
                            context.getApplicationContext(),
                            AppDatabase.class,
                            "masteranki.db")
                        .fallbackToDestructiveMigration()
                        .build();
                }
            }
        }
        return instance;
    }
}
