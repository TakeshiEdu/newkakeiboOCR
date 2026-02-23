/**
 * チャット入力解析エンジン
 *
 * 1行のテキストから金額・収支・店舗・明細を抽出する
 */
import { ParsedInput, ParsedItem } from '@/types';

// --- 収支キーワード ---
const INCOME_WORDS = ['給料', '収入', '振込', 'バイト', '給与', 'ボーナス', '報酬', '入金'];
const EXPENSE_WORDS = ['買った', '使った', '支払', '購入', '払った', '出費', '支出', '買い物'];

// --- 金額パターン ---
const AMOUNT_REGEX = /(\d{1,3}(,\d{3})+|\d+)(万)?(円)?/g;

/**
 * テキストを解析してトランザクション情報を抽出
 */
export function parseChatInput(text: string): ParsedInput {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);

    // 複数行の場合は最初の行のみ（呼び出し側で行分割して繰り返す）
    const line = lines[0] || text;

    // 複数品目分割（「と」「、」で区切る）
    const segments = splitMultipleItems(line);

    // 各セグメントから金額とアイテム名を抽出
    const items: ParsedItem[] = [];
    let totalAmount = 0;
    let storeName: string | null = null;

    if (segments.length > 1) {
        // 複数品目モード
        for (const seg of segments) {
            const amount = extractAmount(seg);
            const name = extractItemName(seg, amount);
            if (amount > 0) {
                items.push({ name: name || seg.trim(), price: amount, categoryId: null });
                totalAmount += amount;
            }
        }
    } else {
        // 単一トランザクションモード
        const amount = extractAmount(line);
        totalAmount = amount;
        storeName = extractStore(line, amount);
        const itemName = extractItemName(line, amount);
        if (amount > 0) {
            items.push({ name: itemName || storeName || line.trim(), price: amount, categoryId: null });
        }
    }

    // 収支判定
    const type = determineType(line);

    return {
        type,
        amount: type === 'expense' ? -totalAmount : totalAmount,
        store: storeName,
        memo: null,
        items,
        confidence: totalAmount > 0 ? 0.8 : 0.3,
    };
}

/**
 * 複数行テキストを行ごとに解析
 */
export function parseChatInputMultiLine(text: string): ParsedInput[] {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    return lines.map((line) => parseChatInput(line));
}

// --- 内部関数 ---

/**
 * 金額抽出（「万」対応、カンマ区切り対応）
 */
function extractAmount(text: string): number {
    const matches = [...text.matchAll(AMOUNT_REGEX)];
    if (matches.length === 0) return 0;

    // 最も大きい金額を採用（合計行と誤認しないように）
    let maxAmount = 0;
    for (const match of matches) {
        let numStr = match[1].replace(/,/g, '');
        let num = parseInt(numStr, 10);
        if (match[3] === '万') {
            num *= 10000;
        }
        if (num > maxAmount) maxAmount = num;
    }
    return maxAmount;
}

/**
 * 収支判定（最後に出現したキーワードを優先）
 */
function determineType(text: string): 'expense' | 'income' {
    let lastIncomeIdx = -1;
    let lastExpenseIdx = -1;

    for (const word of INCOME_WORDS) {
        const idx = text.lastIndexOf(word);
        if (idx > lastIncomeIdx) lastIncomeIdx = idx;
    }

    for (const word of EXPENSE_WORDS) {
        const idx = text.lastIndexOf(word);
        if (idx > lastExpenseIdx) lastExpenseIdx = idx;
    }

    if (lastIncomeIdx === -1 && lastExpenseIdx === -1) return 'expense'; // デフォルト
    if (lastIncomeIdx > lastExpenseIdx) return 'income';
    return 'expense';
}

/**
 * 店舗名抽出（金額より前の部分）
 */
function extractStore(text: string, amount: number): string | null {
    if (amount === 0) return null;

    const amountStr = amount.toString();
    const idx = text.indexOf(amountStr);
    if (idx <= 0) {
        // カンマ付きで探す
        const formatted = amount.toLocaleString();
        const idx2 = text.indexOf(formatted);
        if (idx2 <= 0) return null;
        const before = text.substring(0, idx2).trim();
        return cleanStoreName(before);
    }

    const before = text.substring(0, idx).trim();
    return cleanStoreName(before);
}

/**
 * 店舗名のクリーニング
 */
function cleanStoreName(name: string): string | null {
    // 余計な助詞や記号を除去
    const cleaned = name
        .replace(/[でにをはがのへと、。]$/g, '')
        .replace(/^[\s　]+|[\s　]+$/g, '')
        .trim();
    return cleaned.length > 0 ? cleaned : null;
}

/**
 * アイテム名抽出
 */
function extractItemName(text: string, amount: number): string | null {
    // 金額部分を除去して残りをアイテム名とする
    const cleaned = text
        .replace(AMOUNT_REGEX, '')
        .replace(/[の円で]$/g, '')
        .trim();
    return cleaned.length > 0 ? cleaned : null;
}

/**
 * 複数品目の分割（「と」「、」で区切り）
 */
function splitMultipleItems(text: string): string[] {
    // 金額を含むセグメントが2つ以上ある場合のみ分割
    const candidates = text.split(/[と、]/);

    // 各セグメントに金額が含まれているかチェック
    const withAmount = candidates.filter((seg) => extractAmount(seg) > 0);
    if (withAmount.length >= 2) {
        return candidates;
    }

    return [text]; // 分割しない
}
