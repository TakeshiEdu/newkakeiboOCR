/**
 * カテゴリ & ルール リポジトリ
 */
import { Category, CategoryEditHistory, CategoryRule } from '@/types';
import * as SQLite from 'expo-sqlite';

export class CategoryRepository {
    constructor(private db: SQLite.SQLiteDatabase) { }

    /**
     * 全カテゴリ取得（order_index順）
     */
    async getAll(): Promise<Category[]> {
        const rows = await this.db.getAllAsync<any>(
            'SELECT * FROM categories ORDER BY order_index ASC'
        );
        return rows.map(mapCategory);
    }

    /**
     * カテゴリ更新
     */
    async update(id: string, updates: Partial<Omit<Category, 'id'>>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
        if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
        if (updates.orderIndex !== undefined) { fields.push('order_index = ?'); values.push(updates.orderIndex); }

        if (fields.length === 0) return;
        values.push(id);

        await this.db.runAsync(
            `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
    }

    // --- ルール管理 ---

    /**
     * カテゴリに紐づくルール一覧
     */
    async getRulesByCategory(categoryId: string): Promise<CategoryRule[]> {
        const rows = await this.db.getAllAsync<any>(
            'SELECT * FROM category_rules WHERE category_id = ? ORDER BY priority DESC',
            [categoryId]
        );
        return rows.map(mapRule);
    }

    /**
     * 全ルール取得（優先度順）
     */
    async getAllRules(): Promise<CategoryRule[]> {
        const rows = await this.db.getAllAsync<any>(
            'SELECT * FROM category_rules ORDER BY priority DESC, user_defined DESC'
        );
        return rows.map(mapRule);
    }

    /**
     * ルール追加（重複無視）
     */
    async addRule(matchText: string, categoryId: string, userDefined: boolean = false): Promise<void> {
        await this.db.runAsync(
            `INSERT OR IGNORE INTO category_rules (match_text, category_id, priority, user_defined, updated_at)
       VALUES (?, ?, 0, ?, ?)`,
            [matchText, categoryId, userDefined ? 1 : 0, new Date().toISOString()]
        );
    }

    /**
     * ルール削除
     */
    async deleteRule(id: number): Promise<void> {
        await this.db.runAsync('DELETE FROM category_rules WHERE id = ?', [id]);
    }

    /**
     * ルールの優先度を上げる（使用回数ベース）
     */
    async boostRulePriority(matchText: string, categoryId: string): Promise<void> {
        await this.db.runAsync(
            `UPDATE category_rules SET priority = priority + 1, updated_at = ?
       WHERE match_text = ? AND category_id = ?`,
            [new Date().toISOString(), matchText, categoryId]
        );
    }

    /**
     * 編集履歴の記録
     */
    async recordEdit(edit: Omit<CategoryEditHistory, 'id'>): Promise<void> {
        await this.db.runAsync(
            `INSERT INTO category_edit_history
       (transaction_id, item_id, original_category_id, edited_category_id, reason, edited_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [
                edit.transactionId,
                edit.itemId,
                edit.originalCategoryId,
                edit.editedCategoryId,
                edit.reason,
                edit.editedAt,
            ]
        );
    }

    /**
     * 同一品目 → 同一カテゴリへの編集回数をカウント（学習閾値チェック用）
     */
    async getEditCount(matchText: string, categoryId: string): Promise<number> {
        const result = await this.db.getFirstAsync<any>(
            `SELECT COUNT(*) as cnt FROM category_edit_history
       WHERE edited_category_id = ?
         AND item_id IN (
           SELECT id FROM transaction_items WHERE item_name LIKE ?
         )`,
            [categoryId, `%${matchText}%`]
        );
        return result?.cnt ?? 0;
    }
}

// --- Mapper ---
function mapCategory(row: any): Category {
    return {
        id: row.id,
        name: row.name,
        color: row.color,
        orderIndex: row.order_index,
    };
}

function mapRule(row: any): CategoryRule {
    return {
        id: row.id,
        matchText: row.match_text,
        categoryId: row.category_id,
        priority: row.priority,
        userDefined: row.user_defined === 1,
        updatedAt: row.updated_at,
    };
}
