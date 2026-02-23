/**
 * カテゴリ ユーティリティ
 * カテゴリIDからアイコン名・色を引くためのヘルパー
 */
import { CategoryDef, DEFAULT_CATEGORIES } from '@/constants/categories';

const categoryMap = new Map<string, CategoryDef>(
    DEFAULT_CATEGORIES.map((c) => [c.id, c])
);

/**
 * カテゴリIDからIoniconsアイコン名を取得
 */
export function getCategoryIcon(categoryId: string): string {
    return categoryMap.get(categoryId)?.icon ?? 'ellipsis-horizontal';
}

/**
 * カテゴリIDから色を取得
 */
export function getCategoryColor(categoryId: string): string {
    return categoryMap.get(categoryId)?.color ?? '#AEB6BF';
}

/**
 * カテゴリIDからdefを取得
 */
export function getCategoryDef(categoryId: string): CategoryDef | undefined {
    return categoryMap.get(categoryId);
}
