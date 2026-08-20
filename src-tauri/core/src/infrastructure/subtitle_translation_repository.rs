use crate::domain::subtitle_translations::{
    SubtitleTranslationRecord, SubtitleTranslationRepository,
};
use crate::error::CoreResult;
use crate::infrastructure::db::AppDatabase;
use sqlx::Row;

/// 基于 SQLite 的字幕翻译记录仓储，对应 subtitle_translations 表。
#[derive(Clone)]
pub struct SqliteSubtitleTranslationRepository {
    pool: sqlx::SqlitePool,
}

impl SqliteSubtitleTranslationRepository {
    pub fn new(db: &AppDatabase) -> Self {
        Self {
            pool: db.pool().clone(),
        }
    }
}

#[async_trait::async_trait]
impl SubtitleTranslationRepository for SqliteSubtitleTranslationRepository {
    async fn get_by_id(&self, id: &str) -> CoreResult<Option<SubtitleTranslationRecord>> {
        let row = sqlx::query(
            "SELECT id, info_hash, file_id, original_track_id, source_lang, target_lang,
                    vtt_content, created_at, last_accessed_at
             FROM subtitle_translations
             WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        let Some(row) = row else {
            return Ok(None);
        };

        // 命中后更新 last_accessed_at（用于未来 LRU 清理参考）
        let now = current_millis();
        sqlx::query("UPDATE subtitle_translations SET last_accessed_at = ? WHERE id = ?")
            .bind(now)
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(Some(SubtitleTranslationRecord {
            id: row.try_get("id")?,
            info_hash: row.try_get("info_hash")?,
            file_id: row.try_get("file_id")?,
            original_track_id: row.try_get("original_track_id")?,
            source_lang: row.try_get("source_lang")?,
            target_lang: row.try_get("target_lang")?,
            vtt_content: row.try_get("vtt_content")?,
            created_at: row.try_get("created_at")?,
            last_accessed_at: now,
        }))
    }

    async fn list_by_torrent(
        &self,
        info_hash: &str,
        file_id: i64,
    ) -> CoreResult<Vec<SubtitleTranslationRecord>> {
        let rows = sqlx::query(
            "SELECT id, info_hash, file_id, original_track_id, source_lang, target_lang,
                    vtt_content, created_at, last_accessed_at
             FROM subtitle_translations
             WHERE info_hash = ? AND file_id = ?
             ORDER BY original_track_id, target_lang, created_at",
        )
        .bind(info_hash)
        .bind(file_id)
        .fetch_all(&self.pool)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            result.push(SubtitleTranslationRecord {
                id: row.try_get("id")?,
                info_hash: row.try_get("info_hash")?,
                file_id: row.try_get("file_id")?,
                original_track_id: row.try_get("original_track_id")?,
                source_lang: row.try_get("source_lang")?,
                target_lang: row.try_get("target_lang")?,
                // 列表查询不返回 vtt_content，避免传输过大
                vtt_content: String::new(),
                created_at: row.try_get("created_at")?,
                last_accessed_at: row.try_get("last_accessed_at")?,
            });
        }
        Ok(result)
    }

    async fn save(&self, record: &SubtitleTranslationRecord) -> CoreResult<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO subtitle_translations
                (id, info_hash, file_id, original_track_id, source_lang, target_lang,
                 vtt_content, created_at, last_accessed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&record.id)
        .bind(&record.info_hash)
        .bind(record.file_id)
        .bind(record.original_track_id)
        .bind(&record.source_lang)
        .bind(&record.target_lang)
        .bind(&record.vtt_content)
        .bind(record.created_at)
        .bind(record.last_accessed_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn delete_by_id(&self, id: &str) -> CoreResult<bool> {
        let result = sqlx::query("DELETE FROM subtitle_translations WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    async fn delete_by_torrent(&self, info_hash: &str, file_id: i64) -> CoreResult<u64> {
        let result = sqlx::query(
            "DELETE FROM subtitle_translations
             WHERE info_hash = ? AND file_id = ?",
        )
        .bind(info_hash)
        .bind(file_id)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected())
    }

    async fn delete_by_info_hash(&self, info_hash: &str) -> CoreResult<u64> {
        let result = sqlx::query(
            "DELETE FROM subtitle_translations
             WHERE info_hash = ?",
        )
        .bind(info_hash)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected())
    }
}

fn current_millis() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::db::AppDatabase;

    async fn setup() -> SqliteSubtitleTranslationRepository {
        let db = AppDatabase::connect_in_memory()
            .await
            .expect("内存库应成功");
        SqliteSubtitleTranslationRepository::new(&db)
    }

    fn sample_record(vtt: &str) -> SubtitleTranslationRecord {
        SubtitleTranslationRecord {
            id: "00000000-0000-4000-8000-000000000001".to_string(),
            info_hash: "abc123".to_string(),
            file_id: 1,
            original_track_id: 2,
            source_lang: "ja".to_string(),
            target_lang: "zh".to_string(),
            vtt_content: vtt.to_string(),
            created_at: 1000,
            last_accessed_at: 1000,
        }
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_空库getById返回None() {
        let repo = setup().await;
        let result = repo.get_by_id("nonexistent").await.expect("查询应成功");
        assert!(result.is_none());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_save写入并可读回完整内容() {
        let repo = setup().await;
        let vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n你好\n";
        repo.save(&sample_record(vtt)).await.expect("写入应成功");

        let loaded = repo
            .get_by_id("00000000-0000-4000-8000-000000000001")
            .await
            .expect("查询应成功")
            .expect("应存在记录");
        assert_eq!(loaded.vtt_content, vtt);
        assert_eq!(loaded.source_lang, "ja");
        // get_by_id 应更新 last_accessed_at
        assert!(loaded.last_accessed_at > 1000);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_save更新已存在记录_覆盖原内容() {
        let repo = setup().await;
        let mut rec = sample_record("原始译文");
        repo.save(&rec).await.expect("初始写入应成功");

        rec.vtt_content = "修改后的译文".to_string();
        rec.target_lang = "ja".to_string();
        repo.save(&rec).await.expect("覆盖写入应成功");

        let loaded = repo
            .get_by_id("00000000-0000-4000-8000-000000000001")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(loaded.vtt_content, "修改后的译文");
        assert_eq!(loaded.target_lang, "ja");
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_save同一轨道重复翻译_保留历史两行() {
        let repo = setup().await;
        repo.save(&sample_record("旧译文")).await.unwrap();
        let mut updated = sample_record("新译文");
        updated.id = "00000000-0000-4000-8000-000000000002".to_string();
        repo.save(&updated).await.unwrap();

        // 两条记录应同时保留，且 UUID 不同
        let rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT id, vtt_content FROM subtitle_translations WHERE info_hash = 'abc123'",
        )
        .fetch_all(&repo.pool)
        .await
        .expect("查询应成功");

        assert_eq!(rows.len(), 2);
        let id1 = rows[0].0.clone();
        let id2 = rows[1].0.clone();
        assert_ne!(id1, id2);
        let mut vtts: Vec<String> = rows.into_iter().map(|(_, vtt)| vtt).collect();
        vtts.sort();
        assert_eq!(vtts, vec!["新译文".to_string(), "旧译文".to_string()]);
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_多条独立记录互不影响() {
        let repo = setup().await;
        let rec1 = sample_record("用 Default 翻译");
        let mut rec2 = sample_record("用 Custom 翻译");
        rec2.id = "00000000-0000-4000-8000-000000000003".to_string();

        repo.save(&rec1).await.unwrap();
        repo.save(&rec2).await.unwrap();

        assert_eq!(
            repo.get_by_id("00000000-0000-4000-8000-000000000001")
                .await
                .unwrap()
                .unwrap()
                .vtt_content,
            "用 Default 翻译"
        );
        assert_eq!(
            repo.get_by_id("00000000-0000-4000-8000-000000000003")
                .await
                .unwrap()
                .unwrap()
                .vtt_content,
            "用 Custom 翻译"
        );
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_list_by_torrent返回所有记录且不含vtt() {
        let repo = setup().await;
        let rec1 = sample_record("译文1");
        let mut rec2 = sample_record("译文2");
        rec2.id = "00000000-0000-4000-8000-000000000004".to_string();
        rec2.target_lang = "en".to_string();
        let mut rec3 = sample_record("译文3");
        rec3.id = "00000000-0000-4000-8000-000000000005".to_string();
        rec3.original_track_id = 3;

        repo.save(&rec1).await.unwrap();
        repo.save(&rec2).await.unwrap();
        repo.save(&rec3).await.unwrap();

        // 同一原始轨道重复翻译的额外记录也应出现在列表中
        let mut rec1_dup = sample_record("译文1-新");
        rec1_dup.id = "00000000-0000-4000-8000-000000000006".to_string();
        repo.save(&rec1_dup).await.unwrap();

        // 不相关的种子不应出现
        let mut rec4 = sample_record("其他种子");
        rec4.id = "00000000-0000-4000-8000-000000000007".to_string();
        rec4.info_hash = "other".to_string();
        repo.save(&rec4).await.unwrap();

        let list = repo.list_by_torrent("abc123", 1).await.expect("查询应成功");
        assert_eq!(list.len(), 4);
        // 列表查询不应包含 vtt_content
        for item in &list {
            assert_eq!(item.vtt_content, "");
            assert!(!item.id.is_empty());
        }
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_deleteById按UUID删除() {
        let repo = setup().await;
        let id = "00000000-0000-4000-8000-000000000001";
        repo.save(&sample_record("译文")).await.unwrap();

        let deleted = repo.delete_by_id(id).await.expect("删除应成功");
        assert!(deleted);

        // 再次删除应返回 false
        let deleted_again = repo.delete_by_id(id).await.unwrap();
        assert!(!deleted_again);

        assert!(repo.get_by_id(id).await.unwrap().is_none());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_delete_by_torrent批量删除() {
        let repo = setup().await;
        let rec1 = sample_record("1");
        let mut rec2 = sample_record("2");
        rec2.id = "00000000-0000-4000-8000-000000000008".to_string();
        rec2.target_lang = "en".to_string();
        let mut rec3 = sample_record("3");
        rec3.id = "00000000-0000-4000-8000-000000000009".to_string();
        rec3.original_track_id = 3;

        repo.save(&rec1).await.unwrap();
        repo.save(&rec2).await.unwrap();
        repo.save(&rec3).await.unwrap();

        let count = repo
            .delete_by_torrent("abc123", 1)
            .await
            .expect("批量删除应成功");
        assert_eq!(count, 3);

        let list = repo.list_by_torrent("abc123", 1).await.unwrap();
        assert!(list.is_empty());
    }

    #[tokio::test]
    #[allow(non_snake_case)]
    async fn 测试_delete_by_info_hash清掉整颗种子所有记录() {
        let repo = setup().await;
        let k1 = sample_record("file1-track2");
        let mut k2 = sample_record("file2-track2");
        k2.id = "00000000-0000-4000-8000-00000000000a".to_string();
        k2.file_id = 2;
        let mut k3 = sample_record("file3-track9");
        k3.id = "00000000-0000-4000-8000-00000000000b".to_string();
        k3.file_id = 3;
        k3.original_track_id = 9;
        let mut k_other = sample_record("其他种子");
        k_other.id = "00000000-0000-4000-8000-00000000000c".to_string();
        k_other.info_hash = "other".to_string();

        repo.save(&k1).await.unwrap();
        repo.save(&k2).await.unwrap();
        repo.save(&k3).await.unwrap();
        repo.save(&k_other).await.unwrap();

        let count = repo
            .delete_by_info_hash("abc123")
            .await
            .expect("删除应成功");
        assert_eq!(count, 3);

        // abc123 下 3 条全没了
        let l1 = repo.list_by_torrent("abc123", 1).await.unwrap();
        let l2 = repo.list_by_torrent("abc123", 2).await.unwrap();
        let l3 = repo.list_by_torrent("abc123", 3).await.unwrap();
        assert!(l1.is_empty() && l2.is_empty() && l3.is_empty());

        // 其他种子不受影响
        let list_other = repo.list_by_torrent("other", 1).await.unwrap();
        assert_eq!(list_other.len(), 1);
    }
}
