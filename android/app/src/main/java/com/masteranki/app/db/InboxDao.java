package com.masteranki.app.db;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Transaction;
import androidx.room.Update;

import java.util.List;

/** 收件箱与卡片的数据访问接口。 */
@Dao
public interface InboxDao {

    // ============ Entry ============

    @Query("SELECT * FROM inbox_entries ORDER BY createdAt DESC")
    List<InboxEntry> getAllEntries();

    @Query("SELECT * FROM inbox_entries WHERE id = :id LIMIT 1")
    InboxEntry getEntry(String id);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void saveEntry(InboxEntry entry);

    @Query("DELETE FROM inbox_entries WHERE id = :id")
    void deleteEntry(String id);

    @Query("DELETE FROM inbox_entries WHERE id IN (:ids)")
    void deleteEntries(List<String> ids);

    @Query("UPDATE inbox_entries SET extractedText = :text, title = COALESCE(:title, title) WHERE id = :entryId")
    void updateExtractedContent(String entryId, String text, String title);

    @Query("UPDATE inbox_entries SET deckName = :deckName WHERE id = :entryId")
    void updateDeckName(String entryId, String deckName);

    @Query("UPDATE inbox_entries SET isLocked = 1 WHERE id = :entryId")
    void lockEntry(String entryId);

    // ============ Cards ============

    @Query("SELECT * FROM flashcards WHERE entryId = :entryId ORDER BY sortOrder ASC")
    List<Flashcard> getCardsForEntry(String entryId);

    @Query("SELECT * FROM flashcards WHERE id IN (:cardIds)")
    List<Flashcard> getCards(List<String> cardIds);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void saveCards(List<Flashcard> cards);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void saveCard(Flashcard card);

    @Query("DELETE FROM flashcards WHERE id IN (:cardIds)")
    void deleteCards(List<String> cardIds);

    @Query("DELETE FROM flashcards WHERE entryId = :entryId")
    void deleteCardsForEntry(String entryId);

    @Query("UPDATE flashcards SET front = :front, back = :back, cloze = :cloze, imageUrl = :imageUrl, type = :type, tags = :tags WHERE id = :cardId")
    void updateCardContent(String cardId, String front, String back, String cloze, String imageUrl, String type, String tags);

    @Query("UPDATE flashcards SET status = :status, noteId = :noteId WHERE id = :cardId")
    void updateCardStatus(String cardId, String status, Long noteId);

    @Query("UPDATE flashcards SET sortOrder = :sortOrder WHERE id = :cardId")
    void updateCardOrder(String cardId, int sortOrder);

    // ============ Transactional batch ============

    /** 保存卡片 + 锁定条目（原子） */
    @Transaction
    default void persistCardsAndLock(String entryId, List<Flashcard> cards, List<String> removedIds) {
        if (removedIds != null && !removedIds.isEmpty()) {
            deleteCards(removedIds);
        }
        saveCards(cards);
        lockEntry(entryId);
    }

    /** 删除条目及其卡片（原子） */
    @Transaction
    default void deleteEntryCascade(String id) {
        deleteCardsForEntry(id);
        deleteEntry(id);
    }

    /** 批量删除条目及其卡片（原子） */
    @Transaction
    default void deleteEntriesCascade(List<String> ids) {
        for (String id : ids) {
            deleteCardsForEntry(id);
        }
        deleteEntries(ids);
    }

    /** 删除卡片后若条目已无卡片则清理（原子，供单卡删除） */
    @Transaction
    default void deleteCardsAndCleanup(String entryId, List<String> cardIds) {
        deleteCards(cardIds);
    }
}
