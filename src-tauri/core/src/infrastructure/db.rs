use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions};
use std::path::Path;

/// 应用 SQLite 数据库，持有连接池并负责建表。
#[derive(Clone)]
pub struct AppDatabase {
    pool: SqlitePool,
}

impl AppDatabase {
    /// 连接（必要时创建）指定路径下的数据库文件，并确保表结构存在。
    pub async fn connect(path: &Path) -> Result<Self, sqlx::Error> {
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(sqlx::Error::Io)?;
        }
        let options = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal);
        let pool = SqlitePoolOptions::new()
            .max_connections(4)
            .connect_with(options)
            .await?;
        let db = Self { pool };
        db.migrate().await?;
        Ok(db)
    }

    /// 创建内存数据库，供单元测试使用。
    pub async fn connect_in_memory() -> Result<Self, sqlx::Error> {
        let pool = SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(1)
            .connect("sqlite::memory:")
            .await?;
        let db = Self { pool };
        db.migrate().await?;
        Ok(db)
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    async fn migrate(&self) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS collections (
                subject_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                image_url TEXT,
                added_at INTEGER NOT NULL
            )",
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS torrent_subject_bindings (
                info_hash TEXT PRIMARY KEY,
                subject_id INTEGER NOT NULL,
                subject_name TEXT NOT NULL
            )",
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn temp_db_path(name: &str) -> std::path::PathBuf {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("animesh_db_{}_{}.sqlite", name, nanos))
    }

    #[tokio::test]
    async fn 测试_connect_创建数据库文件与表结构() {
        let path = temp_db_path("connect").await;
        let db = AppDatabase::connect(&path).await.expect("连接应成功");
        let tables: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('collections', 'torrent_subject_bindings') ORDER BY name",
        )
        .fetch_all(db.pool())
        .await
        .expect("查询应成功");
        assert_eq!(
            tables,
            vec![
                "collections".to_string(),
                "torrent_subject_bindings".to_string()
            ]
        );
        assert!(path.exists());
        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn 测试_重复connect_表结构幂等() {
        let path = temp_db_path("idempotent").await;
        AppDatabase::connect(&path).await.expect("首次连接应成功");
        AppDatabase::connect(&path).await.expect("重复连接应成功");
        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn 测试_connect_in_memory_建表成功() {
        let db = AppDatabase::connect_in_memory()
            .await
            .expect("内存库应成功");
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM collections")
            .fetch_one(db.pool())
            .await
            .expect("查询应成功");
        assert_eq!(count, 0);
    }
}
