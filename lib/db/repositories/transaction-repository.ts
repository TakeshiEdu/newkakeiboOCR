/**
 * トランザクション CRUD リポジトリ
 */
import { CategorySummary, MonthlySummary, Transaction, TransactionItem } from '@/types';
import * as SQLite from 'expo-sqlite';

// UUID生成（軽量版）
function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export class TransactionRepository {
    constructor(private db: SQLite.SQLiteDatabase) { }

    /**
     * トランザクション + 明細を一括保存
     */
    async create(
        tx: Omit<Transaction, 'id' | 'createdAt'>,
        items: Omit<TransactionItem, 'id' | 'transactionId'>[]
    ): Promise<string> {
        const id = generateId();
        const createdAt = new Date().toISOString();

        await this.db.runAsync(
            `INSERT INTO transactions (id, type, amount, store, memo, date, source, raw_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, tx.type, tx.amount, tx.store, tx.memo, tx.date, tx.source, tx.rawText, createdAt]
        );

        // FTS5 同期
        await this.db.runAsync(
            `INSERT INTO transactions_fts (rowid, store, memo, raw_text)
       VALUES (last_insert_rowid(), ?, ?, ?)`,
            [tx.store, tx.memo, tx.rawText]
        );

        // 明細の挿入
        for (const item of items) {
            const itemId = generateId();
            await this.db.runAsync(
                `INSERT INTO transaction_items (id, transaction_id, item_name, price, category_id)
         VALUES (?, ?, ?, ?, ?)`,
                [itemId, id, item.itemName, item.price, item.categoryId]
            );
        }

        return id;
    }

    /**
     * 単一トランザクション取得（明細付き）
     */
    async getById(id: string): Promise<{ transaction: Transaction; items: TransactionItem[] } | null> {
        const row = await this.db.getFirstAsync<any>(
            'SELECT * FROM transactions WHERE id = ?',
            [id]
        );
        if (!row) return null;

        const items = await this.db.getAllAsync<any>(
            'SELECT * FROM transaction_items WHERE transaction_id = ?',
            [id]
        );

        return {
            transaction: mapTransaction(row),
            items: items.map(mapTransactionItem),
        };
    }

    /**
     * 月別トランザクション一覧
     */
    async getByMonth(yearMonth: string): Promise<Transaction[]> {
        const rows = await this.db.getAllAsync<any>(
            `SELECT * FROM transactions
       WHERE strftime('%Y-%m', date) = ?
       ORDER BY date DESC, created_at DESC`,
            [yearMonth]
        );
        return rows.map(mapTransaction);
    }

    /**
     * 直近N件取得
     */
    async getRecent(limit: number = 5): Promise<Transaction[]> {
        const rows = await this.db.getAllAsync<any>(
            `SELECT * FROM transactions
       ORDER BY date DESC, created_at DESC
       LIMIT ?`,
            [limit]
        );
        return rows.map(mapTransaction);
    }

    /**
     * トランザクション更新
     */
    async update(id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type); }
        if (updates.amount !== undefined) { fields.push('amount = ?'); values.push(updates.amount); }
        if (updates.store !== undefined) { fields.push('store = ?'); values.push(updates.store); }
        if (updates.memo !== undefined) { fields.push('memo = ?'); values.push(updates.memo); }
        if (updates.date !== undefined) { fields.push('date = ?'); values.push(updates.date); }
        if (updates.source !== undefined) { fields.push('source = ?'); values.push(updates.source); }

        if (fields.length === 0) return;
        values.push(id);

        await this.db.runAsync(
            `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
    }

    /**
     * 明細アイテムのカテゴリを更新
     */
    async updateItemCategory(itemId: string, categoryId: string): Promise<void> {
        await this.db.runAsync(
            'UPDATE transaction_items SET category_id = ? WHERE id = ?',
            [categoryId, itemId]
        );
    }

    /**
     * 明細アイテムの品名を更新
     */
    async updateItemName(itemId: string, itemName: string): Promise<void> {
        await this.db.runAsync(
            'UPDATE transaction_items SET item_name = ? WHERE id = ?',
            [itemName, itemId]
        );
    }

    /**
     * トランザクション削除（明細もカスケード削除）
     */
    async delete(id: string): Promise<void> {
        await this.db.runAsync('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);
        await this.db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
    }

    /**
     * 月次サマリ取得
     */
    async getMonthlySummary(yearMonth: string): Promise<MonthlySummary> {
        const result = await this.db.getFirstAsync<any>(
            `SELECT
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income
       FROM transactions
       WHERE strftime('%Y-%m', date) = ?`,
            [yearMonth]
        );

        const totalExpense = result?.total_expense ?? 0;
        const totalIncome = result?.total_income ?? 0;

        return {
            month: yearMonth,
            totalExpense,
            totalIncome,
            balance: totalIncome + totalExpense, // expense は負値なので加算
        };
    }

    /**
     * カテゴリ別集計（JOIN使用）
     */
    async getCategorySummary(yearMonth: string): Promise<CategorySummary[]> {
        const rows = await this.db.getAllAsync<any>(
            `SELECT
        COALESCE(ti.category_id, 'other') as category_id,
        c.name as category_name,
        c.color as category_color,
        SUM(ABS(ti.price)) as total
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       LEFT JOIN categories c ON ti.category_id = c.id
       WHERE strftime('%Y-%m', t.date) = ?
         AND t.type = 'expense'
       GROUP BY ti.category_id
       ORDER BY total DESC`,
            [yearMonth]
        );

        const grandTotal = rows.reduce((sum: number, r: any) => sum + (r.total || 0), 0);

        return rows.map((r: any) => ({
            categoryId: r.category_id,
            categoryName: r.category_name || 'その他',
            categoryColor: r.category_color || '#AEB6BF',
            total: r.total,
            percentage: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0,
        }));
    }

    /**
     * 日別支出・収入サマリ（カレンダー表示用）
     */
    async getDailySummary(yearMonth: string): Promise<{ date: string; expense: number; income: number }[]> {
        const rows = await this.db.getAllAsync<any>(
            `SELECT
        date,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END), 0) as expense,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income
       FROM transactions
       WHERE strftime('%Y-%m', date) = ?
       GROUP BY date
       ORDER BY date ASC`,
            [yearMonth]
        );
        return rows.map((r: any) => ({
            date: r.date,
            expense: r.expense,
            income: r.income,
        }));
    }

    /**
     * 総資産計算（全期間の収入 + 支出合計）
     */
    async getTotalBalance(): Promise<number> {
        const result = await this.db.getFirstAsync<any>(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions`
        );
        return result?.total ?? 0;
    }

    /**
     * 全トランザクション取得（バックアップ用）
     */
    async getAll(): Promise<Transaction[]> {
        const rows = await this.db.getAllAsync<any>(
            `SELECT * FROM transactions ORDER BY date DESC, created_at DESC`
        );
        return rows.map(mapTransaction);
    }

    /**
     * 全明細取得（バックアップ用）
     */
    async getAllItems(): Promise<TransactionItem[]> {
        const rows = await this.db.getAllAsync<any>(
            `SELECT * FROM transaction_items`
        );
        return rows.map(mapTransactionItem);
    }

    /**
     * 全文検索（FTS5）
     */
    async search(query: string): Promise<Transaction[]> {
        const rows = await this.db.getAllAsync<any>(
            `SELECT t.* FROM transactions_fts fts
       JOIN transactions t ON fts.rowid = t.rowid
       WHERE transactions_fts MATCH ?
       ORDER BY t.date DESC`,
            [query]
        );
        return rows.map(mapTransaction);
    }
}

// --- Mapper ---
function mapTransaction(row: any): Transaction {
    return {
        id: row.id,
        type: row.type,
        amount: row.amount,
        store: row.store,
        memo: row.memo,
        date: row.date,
        source: row.source,
        rawText: row.raw_text,
        createdAt: row.created_at,
    };
}

function mapTransactionItem(row: any): TransactionItem {
    return {
        id: row.id,
        transactionId: row.transaction_id,
        itemName: row.item_name,
        price: row.price,
        categoryId: row.category_id,
    };
}
