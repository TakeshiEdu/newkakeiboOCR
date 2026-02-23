/**
 * CSV / JSON エクスポート機能
 * expo-file-system v2 (File/Directory API) を使用
 */
import { Transaction, TransactionItem } from '@/types';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * トランザクションCSV生成
 */
export function generateTransactionsCSV(transactions: Transaction[], bom: boolean = true): string {
    const header = 'id,date,type,amount,store,memo,source';
    const rows = transactions.map((tx) => {
        const store = escapeCsvField(tx.store || '');
        const memo = escapeCsvField(tx.memo || '');
        return `${tx.id},${tx.date},${tx.type},${tx.amount},${store},${memo},${tx.source}`;
    });

    const csv = [header, ...rows].join('\n');
    return bom ? '\uFEFF' + csv : csv;
}

/**
 * 明細CSVの生成
 */
export function generateItemsCSV(
    items: { item: TransactionItem; transactionDate: string }[],
    bom: boolean = true
): string {
    const header = 'id,transaction_id,date,item_name,price,category_id';
    const rows = items.map(({ item, transactionDate }) => {
        const name = escapeCsvField(item.itemName || '');
        return `${item.id},${item.transactionId},${transactionDate},${name},${item.price || 0},${item.categoryId || 'other'}`;
    });

    const csv = [header, ...rows].join('\n');
    return bom ? '\uFEFF' + csv : csv;
}

/**
 * JSON フルダンプ（バックアップ用）
 */
export function generateBackupJSON(
    transactions: Transaction[],
    items: TransactionItem[],
    maskSensitive: boolean = false
): string {
    const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        transactions: transactions.map((tx) => ({
            ...tx,
            rawText: maskSensitive ? maskText(tx.rawText) : tx.rawText,
        })),
        items: items,
    };

    return JSON.stringify(data, null, 2);
}

/**
 * ファイルに書き出し (新 expo-file-system API)
 */
export function writeExportFile(
    filename: string,
    content: string
): File {
    const exportDir = new Directory(Paths.document, 'exports');
    if (!exportDir.exists) {
        exportDir.create();
    }
    const file = new File(exportDir, filename);
    file.write(content);
    return file;
}

// --- ユーティリティ ---

function escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function maskText(text: string | null): string | null {
    if (!text) return null;
    // 電話番号パターンをマスク
    let masked = text.replace(/\d{2,4}-\d{2,4}-\d{3,4}/g, '***-****-****');
    // 住所っぽいパターン（〒）をマスク
    masked = masked.replace(/〒\d{3}-?\d{4}/g, '〒***-****');
    return masked;
}
