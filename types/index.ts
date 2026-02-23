/**
 * 家計簿アプリ — TypeScript 型定義
 */

// トランザクション（取引ヘッダ）
export interface Transaction {
    id: string;
    type: 'expense' | 'income';
    amount: number; // expense=負値, income=正値
    store: string | null;
    memo: string | null;
    date: string; // ISO8601 (YYYY-MM-DD)
    source: 'chat' | 'ocr' | 'manual';
    rawText: string | null;
    createdAt: string; // ISO8601
}

// 明細（トランザクション内の個別行）
export interface TransactionItem {
    id: string;
    transactionId: string;
    itemName: string | null;
    price: number | null;
    categoryId: string | null;
}

// カテゴリ
export interface Category {
    id: string;
    name: string;
    color: string;
    orderIndex: number;
}

// カテゴリルール（自動分類辞書）
export interface CategoryRule {
    id: number;
    matchText: string;
    categoryId: string;
    priority: number;
    userDefined: boolean;
    updatedAt: string | null;
}

// カテゴリ編集履歴（学習用）
export interface CategoryEditHistory {
    id: number;
    transactionId: string | null;
    itemId: string | null;
    originalCategoryId: string | null;
    editedCategoryId: string | null;
    reason: string | null;
    editedAt: string;
}

// チャット解析結果
export interface ParsedInput {
    type: 'expense' | 'income';
    amount: number;
    store: string | null;
    memo: string | null;
    items: ParsedItem[];
    confidence: number;
}

export interface ParsedItem {
    name: string;
    price: number;
    categoryId: string | null;
}

// OCR 結果
export interface OcrResultLine {
    text: string;
    confidence: number;
    boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface OcrResult {
    lines: OcrResultLine[];
    fullText: string;
}

// レシート解析結果
export interface ParsedReceipt {
    storeName: string | null;
    date: string | null; // ISO8601 (YYYY-MM-DD)
    items: ParsedReceiptItem[];
    total: number | null;
    rawText: string;
    confidence: number; // 0-1
}

export interface ParsedReceiptItem {
    name: string;
    price: number;
    confidence: number; // 0-1
    categoryId: string | null;
    rawLine: string;
}

// 集計データ
export interface MonthlySummary {
    month: string; // YYYY-MM
    totalExpense: number;
    totalIncome: number;
    balance: number;
}

export interface CategorySummary {
    categoryId: string;
    categoryName: string;
    categoryColor: string;
    total: number;
    percentage: number;
}
