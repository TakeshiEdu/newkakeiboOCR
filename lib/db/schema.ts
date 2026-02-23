/**
 * SQLite スキーマ定義 & マイグレーション
 */
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import * as SQLite from 'expo-sqlite';

const CURRENT_DB_VERSION = 2;

/**
 * DBを開いてマイグレーションを実行
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('kakeibo.db');

  const currentVersion = await getDbVersion(db);

  if (currentVersion < CURRENT_DB_VERSION) {
    await runMigrations(db, currentVersion);
  }

  return db;
}

async function getDbVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  return result?.user_version ?? 0;
}

async function setDbVersion(db: SQLite.SQLiteDatabase, version: number): Promise<void> {
  await db.execAsync(`PRAGMA user_version = ${version}`);
}

/**
 * マイグレーション実行（バージョンベース）
 */
async function runMigrations(db: SQLite.SQLiteDatabase, fromVersion: number): Promise<void> {
  if (fromVersion < 1) {
    await migrateV1(db);
  }
  if (fromVersion < 2) {
    await migrateV2(db);
  }

  await setDbVersion(db, CURRENT_DB_VERSION);
}

/**
 * V1: 初期スキーマ作成
 */
async function migrateV1(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    -- トランザクション（取引ヘッダ）
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
      amount INTEGER NOT NULL,
      store TEXT,
      memo TEXT,
      date TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('chat', 'ocr', 'manual')),
      raw_text TEXT,
      created_at TEXT NOT NULL
    );

    -- 明細
    CREATE TABLE IF NOT EXISTS transaction_items (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      item_name TEXT,
      price INTEGER,
      category_id TEXT,
      FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    -- カテゴリ
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0
    );

    -- カテゴリルール（自動分類辞書）
    CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_text TEXT NOT NULL,
      category_id TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      user_defined INTEGER DEFAULT 0,
      updated_at TEXT,
      UNIQUE(match_text, category_id)
    );

    -- カテゴリ編集履歴（学習用）
    CREATE TABLE IF NOT EXISTS category_edit_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT,
      item_id TEXT,
      original_category_id TEXT,
      edited_category_id TEXT,
      reason TEXT,
      edited_at TEXT
    );

    -- FTS5 全文検索用仮想テーブル
    CREATE VIRTUAL TABLE IF NOT EXISTS transactions_fts USING fts5(
      store, memo, raw_text, content='transactions', content_rowid='rowid'
    );

    -- インデックス
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_items_tx_id ON transaction_items(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_items_category ON transaction_items(category_id);
    CREATE INDEX IF NOT EXISTS idx_rules_match ON category_rules(match_text);
  `);

  // デフォルトカテゴリの挿入
  for (const cat of DEFAULT_CATEGORIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (id, name, color, order_index) VALUES (?, ?, ?, ?)',
      [cat.id, cat.name, cat.color, cat.orderIndex]
    );
  }
}

/**
 * V2: デフォルト分類ルール50個を追加
 */
async function migrateV2(db: SQLite.SQLiteDatabase): Promise<void> {
  const now = new Date().toISOString();
  const defaultRules: [string, string][] = [
    // 食費 (food) — 15ルール
    ['セブンイレブン', 'food'],
    ['ファミリーマート', 'food'],
    ['ローソン', 'food'],
    ['マクドナルド', 'food'],
    ['すき家', 'food'],
    ['吉野家', 'food'],
    ['松屋', 'food'],
    ['スターバックス', 'food'],
    ['ドトール', 'food'],
    ['サイゼリヤ', 'food'],
    ['ガスト', 'food'],
    ['イオン', 'food'],
    ['イトーヨーカドー', 'food'],
    ['西友', 'food'],
    ['業務スーパー', 'food'],
    // 日用品 (daily) — 5ルール
    ['マツモトキヨシ', 'daily'],
    ['ウエルシア', 'daily'],
    ['ダイソー', 'daily'],
    ['セリア', 'daily'],
    ['ドン・キホーテ', 'daily'],
    // 交通費 (transport) — 5ルール
    ['JR', 'transport'],
    ['メトロ', 'transport'],
    ['Suica', 'transport'],
    ['PASMO', 'transport'],
    ['タクシー', 'transport'],
    // 娯楽 (entertainment) — 5ルール
    ['Netflix', 'entertainment'],
    ['Spotify', 'entertainment'],
    ['Amazon Prime', 'entertainment'],
    ['Disney+', 'entertainment'],
    ['Nintendo', 'entertainment'],
    // 通信費 (telecom) — 5ルール
    ['NTTドコモ', 'telecom'],
    ['KDDI', 'telecom'],
    ['ソフトバンク', 'telecom'],
    ['楽天モバイル', 'telecom'],
    ['UQモバイル', 'telecom'],
    // 医療 (medical) — 4ルール
    ['薬局', 'medical'],
    ['クリニック', 'medical'],
    ['病院', 'medical'],
    ['歯医者', 'medical'],
    // 衣服 (clothing) — 4ルール
    ['ユニクロ', 'clothing'],
    ['GU', 'clothing'],
    ['ZARA', 'clothing'],
    ['しまむら', 'clothing'],
    // 教育 (education) — 3ルール
    ['Udemy', 'education'],
    ['書店', 'education'],
    ['紀伊國屋', 'education'],
    // 住居 (housing) — 4ルール
    ['家賃', 'housing'],
    ['電気代', 'housing'],
    ['ガス代', 'housing'],
    ['水道代', 'housing'],
  ];

  for (const [matchText, categoryId] of defaultRules) {
    await db.runAsync(
      `INSERT OR IGNORE INTO category_rules (match_text, category_id, priority, user_defined, updated_at)
       VALUES (?, ?, 0, 0, ?)`,
      [matchText, categoryId, now]
    );
  }
}
