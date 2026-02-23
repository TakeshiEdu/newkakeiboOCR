/**
 * カテゴリ自動分類ロジック
 *
 * 判定順序（優先度高 → 低）:
 * 1. category_rules の完全一致
 * 2. category_rules の部分一致 / 正規表現
 * 3. ビルトイン短語リスト
 * 4. フォールバック → 'other'
 */
import { CategoryRule } from '@/types';

// ビルトインキーワード辞書
const BUILTIN_KEYWORDS: Record<string, string[]> = {
    food: [
        'コンビニ', 'スーパー', 'レストラン', '食堂', 'カフェ',
        'コーヒー', 'ランチ', 'ディナー', '弁当', 'パン',
        'セブン', 'ファミマ', 'ローソン', 'マック', 'すき家',
        '吉野家', '松屋', 'ラーメン', '寿司', 'ピザ',
        '飲み物', 'おにぎり', 'サンドイッチ', '牛乳', '水',
    ],
    daily: [
        'ドラッグ', '薬局', 'トイレ', 'シャンプー', '洗剤',
        '日用品', '消耗品', 'ティッシュ', 'タオル', '電池',
        '100均', 'ダイソー',
    ],
    transport: [
        '電車', 'バス', 'タクシー', 'Suica', 'PASMO',
        'ICOCA', '切符', '定期', '駐車', 'ガソリン',
        '高速', '新幹線', '飛行機',
    ],
    entertainment: [
        '映画', 'ゲーム', '本', '漫画', 'Netflix',
        'Spotify', 'YouTube', 'サブスク', 'カラオケ', '旅行',
        '趣味', 'ライブ', 'コンサート',
    ],
    telecom: [
        'スマホ', '携帯', 'Wi-Fi', 'インターネット', '通信',
        'docomo', 'au', 'SoftBank', '格安SIM',
    ],
    medical: [
        '病院', '歯科', '薬', '診察', '健康',
        '処方', '整体', 'クリニック',
    ],
    clothing: [
        '服', 'シャツ', 'パンツ', '靴', 'アウター',
        'ジャケット', 'ユニクロ', 'GU', 'ZARA',
    ],
    education: [
        '書籍', '参考書', '塾', 'スクール', '講座',
        'セミナー', '資格', '教材', 'Udemy',
    ],
    housing: [
        '家賃', '電気', 'ガス', '水道', '光熱費',
        'NHK', '管理費', '火災保険',
    ],
};

/**
 * カテゴリを判定する
 */
export function categorize(
    store: string | null,
    itemName: string | null,
    rules: CategoryRule[]
): string {
    const targets = [store, itemName].filter(Boolean) as string[];

    // 1. 完全一致ルール
    for (const target of targets) {
        const exactRule = rules.find(
            (r) => r.matchText.toLowerCase() === target.toLowerCase()
        );
        if (exactRule) return exactRule.categoryId;
    }

    // 2. 部分一致 / 正規表現ルール（priority順にソート済み前提）
    for (const target of targets) {
        for (const rule of rules) {
            try {
                // 正規表現として試行
                if (rule.matchText.startsWith('/') && rule.matchText.endsWith('/')) {
                    const pattern = rule.matchText.slice(1, -1);
                    if (new RegExp(pattern, 'i').test(target)) {
                        return rule.categoryId;
                    }
                }
                // 部分一致
                else if (target.toLowerCase().includes(rule.matchText.toLowerCase())) {
                    return rule.categoryId;
                }
            } catch {
                // 正規表現エラーは無視して次へ
                continue;
            }
        }
    }

    // 3. ビルトインキーワード
    for (const target of targets) {
        for (const [categoryId, keywords] of Object.entries(BUILTIN_KEYWORDS)) {
            for (const keyword of keywords) {
                if (target.toLowerCase().includes(keyword.toLowerCase())) {
                    return categoryId;
                }
            }
        }
    }

    // 4. フォールバック
    return 'other';
}
