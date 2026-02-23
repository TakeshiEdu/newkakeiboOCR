/**
 * デフォルトカテゴリ定義（10カテゴリ）
 */

export interface CategoryDef {
    id: string;
    name: string;
    color: string;
    icon: string; // Ionicons name
    orderIndex: number;
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
    { id: 'food', name: '食費', color: '#FF6B6B', icon: 'restaurant', orderIndex: 0 },
    { id: 'daily', name: '日用品', color: '#4ECDC4', icon: 'cart', orderIndex: 1 },
    { id: 'transport', name: '交通費', color: '#45B7D1', icon: 'train', orderIndex: 2 },
    { id: 'entertainment', name: '娯楽', color: '#96CEB4', icon: 'game-controller', orderIndex: 3 },
    { id: 'telecom', name: '通信費', color: '#FFEAA7', icon: 'phone-portrait', orderIndex: 4 },
    { id: 'medical', name: '医療', color: '#DDA0DD', icon: 'medkit', orderIndex: 5 },
    { id: 'clothing', name: '衣服', color: '#98D8C8', icon: 'shirt', orderIndex: 6 },
    { id: 'education', name: '教育', color: '#F7DC6F', icon: 'school', orderIndex: 7 },
    { id: 'housing', name: '住居', color: '#BB8FCE', icon: 'home', orderIndex: 8 },
    { id: 'other', name: 'その他', color: '#AEB6BF', icon: 'ellipsis-horizontal', orderIndex: 9 },
];
