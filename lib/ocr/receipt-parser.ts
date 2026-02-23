/**
 * レシートテキスト解析モジュール
 *
 * OCR で取得した生テキストからレシートの構造化データを抽出する。
 * - 店舗名
 * - 日付
 * - 明細（商品名 + 金額）
 * - 合計金額
 */
import type { OcrResult, ParsedReceipt, ParsedReceiptItem } from '@/types';

// ── 正規表現パターン ──────────────────────────

// 金額パターン: ¥1,234 / 1,234円 / ￥500 / *500 / 500 等
const PRICE_PATTERN =
    /[¥￥\\*]?\s*(\d{1,3}(?:,\d{3})*|\d+)\s*円?/;

// 行末の金額（レシートでは右端に金額が来る）
const LINE_PRICE_PATTERN =
    /[¥￥\\*]?\s*(\d{1,3}(?:,\d{3})*|\d+)\s*円?\s*$/;

// 合計行を示すキーワード
const TOTAL_KEYWORDS = [
    '合計', '小計', '税込合計', '税込', 'お買上げ合計',
    '税込計', 'お買い上げ', '合　計', 'TOTAL', 'total',
    'お会計', '請求額', '支払合計', 'ご請求',
];

// 除外行（金額っぽいが明細ではない行）
const EXCLUDE_KEYWORDS = [
    '預り', 'お釣り', '釣銭', 'おつり', 'お釣',
    '現金', 'クレジット', 'カード', '電子マネー',
    'ポイント', '値引', '割引', '税', '消費税',
    '内税', '外税', '軽減税率', '10%対象', '8%対象',
    'Suica', 'WAON', 'nanaco', 'PayPay', 'iD',
    'QUICPay', 'お預かり', '変更',
];

// 日付パターン
const DATE_PATTERNS = [
    // 2026年02月23日, 2026/02/23, 2026-02-23
    /(\d{4})[年/\-.](\d{1,2})[月/\-.](\d{1,2})/,
    // 令和8年2月23日
    /令和(\d{1,2})年(\d{1,2})月(\d{1,2})日/,
    // R8.02.23
    /R(\d{1,2})[./](\d{1,2})[./](\d{1,2})/,
    // 02/23 (月/日のみ - 年は現在年で補完)
    /(\d{1,2})[/\-.](\d{1,2})\s/,
];

// 店舗名の候補行（レシートの最初の方に出る）
const STORE_HINTS = [
    '店', 'ストア', 'マート', 'スーパー', 'コンビニ',
    '薬局', 'ドラッグ', 'モール', 'デパート',
    '株式会社', '有限会社', '（株）', '(株)',
];

// ── 解析関数 ──────────────────────────

/**
 * OCR結果からレシートの構造化データを生成する
 */
export function parseReceipt(ocrResult: OcrResult): ParsedReceipt {
    const lines = ocrResult.fullText.split('\n').map((l) => l.trim()).filter(Boolean);

    const storeName = extractStoreName(lines);
    const date = extractDate(lines);
    const { items, total } = extractItemsAndTotal(lines);

    // 全体の confidence を算出
    const avgConfidence =
        items.length > 0
            ? items.reduce((sum, item) => sum + item.confidence, 0) / items.length
            : 0.5;

    return {
        storeName,
        date,
        items,
        total,
        rawText: ocrResult.fullText,
        confidence: Math.round(avgConfidence * 100) / 100,
    };
}

/**
 * 店舗名を抽出（レシート上部の最初の数行から推定）
 */
function extractStoreName(lines: string[]): string | null {
    // 最初の5行以内で店舗名を探す
    const candidates = lines.slice(0, 7);

    for (const line of candidates) {
        // 電話番号や住所、日付だけの行はスキップ
        if (/^\d{2,4}[/\-]/.test(line)) continue;
        if (/^\d{2,4}-\d{2,4}/.test(line)) continue; // 電話番号
        if (/^〒/.test(line)) continue; // 郵便番号
        if (/^TEL|^FAX|^tel|^fax/.test(line)) continue;
        if (line.length < 2) continue;

        // 店名のヒントがある行を優先
        if (STORE_HINTS.some((hint) => line.includes(hint))) {
            return cleanStoreName(line);
        }
    }

    // ヒントがなければ最初の意味のある行を採用
    for (const line of candidates) {
        if (/^\d{2,4}[/\-]/.test(line)) continue;
        if (/^\d{2,4}-\d{2,4}/.test(line)) continue;
        if (/^〒/.test(line)) continue;
        if (/^TEL|^FAX|^tel|^fax/.test(line)) continue;
        if (line.length < 2) continue;
        if (/^領収|^レシート|^明細/.test(line)) continue;

        return cleanStoreName(line);
    }

    return null;
}

function cleanStoreName(raw: string): string {
    // 末尾の「店」以降の余計な情報を除去
    return raw
        .replace(/\s*TEL.*$/i, '')
        .replace(/\s*電話.*$/, '')
        .replace(/\s*〒.*$/, '')
        .trim();
}

/**
 * 日付を抽出
 */
function extractDate(lines: string[]): string | null {
    const currentYear = new Date().getFullYear();

    for (const line of lines) {
        // パターン1: 西暦 YYYY/MM/DD
        const m1 = line.match(DATE_PATTERNS[0]);
        if (m1) {
            return formatDate(parseInt(m1[1]), parseInt(m1[2]), parseInt(m1[3]));
        }

        // パターン2: 令和X年M月D日
        const m2 = line.match(DATE_PATTERNS[1]);
        if (m2) {
            const year = 2018 + parseInt(m2[1]); // 令和元年 = 2019
            return formatDate(year, parseInt(m2[2]), parseInt(m2[3]));
        }

        // パターン3: RX.MM.DD
        const m3 = line.match(DATE_PATTERNS[2]);
        if (m3) {
            const year = 2018 + parseInt(m3[1]);
            return formatDate(year, parseInt(m3[2]), parseInt(m3[3]));
        }

        // パターン4: MM/DD（年なし）
        const m4 = line.match(DATE_PATTERNS[3]);
        if (m4) {
            const month = parseInt(m4[1]);
            const day = parseInt(m4[2]);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return formatDate(currentYear, month, day);
            }
        }
    }

    // 見つからなければ今日の日付
    return null;
}

function formatDate(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 明細行と合計金額を抽出
 */
function extractItemsAndTotal(
    lines: string[],
): { items: ParsedReceiptItem[]; total: number | null } {
    const items: ParsedReceiptItem[] = [];
    let total: number | null = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 合計行の検出
        const isTotalLine = TOTAL_KEYWORDS.some((kw) => trimmed.includes(kw));
        if (isTotalLine) {
            const priceMatch = trimmed.match(PRICE_PATTERN);
            if (priceMatch) {
                const val = parsePrice(priceMatch[1]);
                if (val !== null && val > 0) {
                    total = val;
                }
            }
            continue; // 合計行は明細に含めない
        }

        // 除外行チェック
        if (EXCLUDE_KEYWORDS.some((kw) => trimmed.includes(kw))) {
            continue;
        }

        // 金額を含む行 = 明細候補
        const priceMatch = trimmed.match(LINE_PRICE_PATTERN);
        if (priceMatch) {
            const price = parsePrice(priceMatch[1]);
            if (price !== null && price > 0 && price < 1000000) {
                // 行から金額部分を除去して商品名とする
                const itemName = trimmed
                    .replace(LINE_PRICE_PATTERN, '')
                    .replace(/[¥￥\\*×xX]\s*\d+/, '') // 数量表記を除去
                    .replace(/\s+/g, ' ')
                    .trim();

                if (itemName.length > 0) {
                    items.push({
                        name: itemName,
                        price,
                        confidence: 0.8,
                        categoryId: null,
                        rawLine: trimmed,
                    });
                }
            }
        }
    }

    // 合計が検出できなかった場合 → 明細の合算
    if (total === null && items.length > 0) {
        total = items.reduce((sum, item) => sum + item.price, 0);
    }

    return { items, total };
}

/**
 * カンマ区切り金額文字列をパースする
 */
function parsePrice(raw: string): number | null {
    const cleaned = raw.replace(/,/g, '');
    const val = parseInt(cleaned, 10);
    return isNaN(val) ? null : val;
}
