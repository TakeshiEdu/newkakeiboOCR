/**
 * トランザクション詳細・編集画面
 * - トランザクションヘッダ（店舗・日付・金額・メモ）の編集
 * - 各明細のカテゴリ変更（学習履歴連動）
 */
import Colors from '@/constants/Colors';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useDatabase } from '@/hooks/useDatabase';
import { getCategoryIcon } from '@/lib/category-utils';
import { Category, Transaction, TransactionItem } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function TransactionDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { transactionRepo, categoryRepo, isReady } = useDatabase();

    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [items, setItems] = useState<TransactionItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    // 編集状態
    const [editing, setEditing] = useState(false);
    const [editStore, setEditStore] = useState('');
    const [editMemo, setEditMemo] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editDate, setEditDate] = useState('');

    // カテゴリ選択モーダル
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingOriginalCategoryId, setEditingOriginalCategoryId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!isReady || !transactionRepo || !categoryRepo || !id) return;
        try {
            const result = await transactionRepo.getById(id);
            if (result) {
                setTransaction(result.transaction);
                setItems(result.items);
            }
            const cats = await categoryRepo.getAll();
            setCategories(cats);
        } catch (error) {
            console.error('Failed to load transaction:', error);
        }
    }, [isReady, transactionRepo, categoryRepo, id]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    // --- 編集モード ---
    const startEditing = () => {
        if (!transaction) return;
        setEditStore(transaction.store || '');
        setEditMemo(transaction.memo || '');
        setEditAmount(Math.abs(transaction.amount).toString());
        setEditDate(transaction.date);
        setEditing(true);
    };

    const cancelEditing = () => {
        setEditing(false);
    };

    const saveEditing = async () => {
        if (!transaction || !transactionRepo || !id) return;
        const amountNum = parseInt(editAmount, 10);
        if (isNaN(amountNum) || amountNum <= 0) {
            Alert.alert('エラー', '有効な金額を入力してください。');
            return;
        }
        try {
            await transactionRepo.update(id, {
                store: editStore || null,
                memo: editMemo || null,
                amount: transaction.type === 'expense' ? -amountNum : amountNum,
                date: editDate,
            });
            setEditing(false);
            await loadData();
        } catch (error) {
            console.error('Failed to save:', error);
            Alert.alert('エラー', '保存に失敗しました。');
        }
    };

    // --- カテゴリ変更 ---
    const openCategoryPicker = (itemId: string, currentCategoryId: string | null) => {
        setEditingItemId(itemId);
        setEditingOriginalCategoryId(currentCategoryId);
        setCategoryModalVisible(true);
    };

    const selectCategory = async (newCategoryId: string) => {
        if (!editingItemId || !transactionRepo || !categoryRepo || !id) return;
        try {
            await transactionRepo.updateItemCategory(editingItemId, newCategoryId);

            // 学習: 編集履歴を記録
            if (editingOriginalCategoryId !== newCategoryId) {
                await categoryRepo.recordEdit({
                    transactionId: id,
                    itemId: editingItemId,
                    originalCategoryId: editingOriginalCategoryId || 'other',
                    editedCategoryId: newCategoryId,
                    reason: 'user_correction',
                    editedAt: new Date().toISOString(),
                });

                // 学習: item名 → 新カテゴリのルールを自動追加（3回以上の修正で）
                const editItem = items.find((i) => i.id === editingItemId);
                if (editItem?.itemName) {
                    const count = await categoryRepo.getEditCount(
                        editItem.itemName,
                        newCategoryId
                    );
                    if (count >= 3) {
                        // 閾値を超えたのでルールを追加
                        await categoryRepo.addRule(editItem.itemName, newCategoryId, false);
                    }
                }
            }

            setCategoryModalVisible(false);
            setEditingItemId(null);
            await loadData();
        } catch (error) {
            console.error('Failed to change category:', error);
            Alert.alert('エラー', 'カテゴリの変更に失敗しました。');
        }
    };

    // --- 削除 ---
    const handleDelete = () => {
        Alert.alert('削除確認', 'この取引を削除しますか？', [
            { text: 'キャンセル', style: 'cancel' },
            {
                text: '削除',
                style: 'destructive',
                onPress: async () => {
                    if (id) {
                        await transactionRepo?.delete(id);
                        router.back();
                    }
                },
            },
        ]);
    };

    // --- ヘルパー ---
    const getCategoryName = (categoryId: string | null) => {
        if (!categoryId) return 'その他';
        return categories.find((c) => c.id === categoryId)?.name || 'その他';
    };

    const getCategoryColor = (categoryId: string | null) => {
        if (!categoryId) return '#AEB6BF';
        return categories.find((c) => c.id === categoryId)?.color || '#AEB6BF';
    };

    if (!transaction) {
        return (
            <View style={styles.loading}>
                <Text style={styles.loadingText}>読み込み中...</Text>
            </View>
        );
    }

    const formatAmount = (amount: number) => Math.abs(amount).toLocaleString();
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    };

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView}>
                {/* ヘッダ情報 */}
                <View style={styles.header}>
                    <View
                        style={[
                            styles.typeIcon,
                            {
                                backgroundColor:
                                    transaction.type === 'expense'
                                        ? Colors.expense + '15'
                                        : Colors.income + '15',
                            },
                        ]}
                    >
                        <Ionicons
                            name={transaction.type === 'expense' ? 'arrow-down' : 'arrow-up'}
                            size={28}
                            color={
                                transaction.type === 'expense' ? Colors.expense : Colors.income
                            }
                        />
                    </View>

                    {editing ? (
                        <View style={styles.editAmountRow}>
                            <TextInput
                                style={styles.editAmountInput}
                                value={editAmount}
                                onChangeText={setEditAmount}
                                keyboardType="numeric"
                                selectTextOnFocus
                            />
                            <Text style={styles.editAmountYen}>円</Text>
                        </View>
                    ) : (
                        <Text
                            style={[
                                styles.amount,
                                {
                                    color:
                                        transaction.type === 'expense'
                                            ? Colors.expense
                                            : Colors.income,
                                },
                            ]}
                        >
                            {transaction.type === 'expense' ? '-' : '+'}
                            {formatAmount(transaction.amount)}円
                        </Text>
                    )}
                    <Text style={styles.typeBadge}>
                        {transaction.type === 'expense' ? '支出' : '収入'}
                    </Text>
                </View>

                {/* 詳細情報 */}
                <View style={styles.detailCard}>
                    {/* 店舗 */}
                    <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                            <Ionicons name="storefront-outline" size={18} color={Colors.muted} />
                        </View>
                        <View style={styles.detailContent}>
                            <Text style={styles.detailLabel}>店舗</Text>
                            {editing ? (
                                <TextInput
                                    style={styles.editInput}
                                    value={editStore}
                                    onChangeText={setEditStore}
                                    placeholder="店舗名"
                                    placeholderTextColor={Colors.muted}
                                />
                            ) : (
                                <Text style={styles.detailValue}>
                                    {transaction.store || '未設定'}
                                </Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.detailDivider} />

                    {/* 日付 */}
                    <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                            <Ionicons name="calendar-outline" size={18} color={Colors.muted} />
                        </View>
                        <View style={styles.detailContent}>
                            <Text style={styles.detailLabel}>日付</Text>
                            {editing ? (
                                <TextInput
                                    style={styles.editInput}
                                    value={editDate}
                                    onChangeText={setEditDate}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={Colors.muted}
                                />
                            ) : (
                                <Text style={styles.detailValue}>
                                    {formatDate(transaction.date)}
                                </Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.detailDivider} />

                    {/* 入力方法 */}
                    <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                            <Ionicons name="create-outline" size={18} color={Colors.muted} />
                        </View>
                        <View style={styles.detailContent}>
                            <Text style={styles.detailLabel}>入力方法</Text>
                            <Text style={styles.detailValue}>
                                {transaction.source === 'chat'
                                    ? 'チャット入力'
                                    : transaction.source === 'ocr'
                                        ? 'レシート撮影'
                                        : '手動入力'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.detailDivider} />

                    {/* メモ */}
                    <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                            <Ionicons name="document-text-outline" size={18} color={Colors.muted} />
                        </View>
                        <View style={styles.detailContent}>
                            <Text style={styles.detailLabel}>メモ</Text>
                            {editing ? (
                                <TextInput
                                    style={styles.editInput}
                                    value={editMemo}
                                    onChangeText={setEditMemo}
                                    placeholder="メモ"
                                    placeholderTextColor={Colors.muted}
                                />
                            ) : (
                                <Text style={styles.detailValue}>
                                    {transaction.memo || '未設定'}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* 明細リスト — カテゴリタップで変更可能 */}
                {items.length > 0 && (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>明細</Text>
                            <Text style={styles.sectionHint}>
                                カテゴリをタップして変更
                            </Text>
                        </View>
                        <View style={styles.detailCard}>
                            {items.map((item, index) => (
                                <View key={item.id}>
                                    {index > 0 && <View style={styles.detailDivider} />}
                                    <View style={styles.itemRow}>
                                        <View style={styles.itemInfo}>
                                            <Text style={styles.itemName}>
                                                {item.itemName || '品目'}
                                            </Text>
                                            {/* カテゴリ: タップで変更 */}
                                            <TouchableOpacity
                                                style={styles.categoryBadge}
                                                onPress={() =>
                                                    openCategoryPicker(item.id, item.categoryId)
                                                }
                                                activeOpacity={0.7}
                                            >
                                                <View
                                                    style={[
                                                        styles.categoryDot,
                                                        { backgroundColor: getCategoryColor(item.categoryId) + '20' },
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name={getCategoryIcon(item.categoryId || 'other') as any}
                                                        size={12}
                                                        color={getCategoryColor(item.categoryId)}
                                                    />
                                                </View>
                                                <Text style={styles.categoryBadgeText}>
                                                    {getCategoryName(item.categoryId)}
                                                </Text>
                                                <Ionicons
                                                    name="chevron-down"
                                                    size={12}
                                                    color={Colors.muted}
                                                />
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.itemPrice}>
                                            {item.price
                                                ? `${Math.abs(item.price).toLocaleString()}円`
                                                : '-'}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </>
                )}

                {/* アクションボタン */}
                <View style={styles.actions}>
                    {editing ? (
                        <>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.cancelButton]}
                                onPress={cancelEditing}
                            >
                                <Ionicons name="close" size={20} color={Colors.muted} />
                                <Text style={[styles.actionText, { color: Colors.muted }]}>
                                    キャンセル
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.saveButton]}
                                onPress={saveEditing}
                            >
                                <Ionicons name="checkmark" size={20} color={Colors.onPrimary} />
                                <Text style={[styles.actionText, { color: Colors.onPrimary }]}>
                                    保存
                                </Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.editButton]}
                                onPress={startEditing}
                            >
                                <Ionicons name="pencil" size={20} color={Colors.primary} />
                                <Text style={[styles.actionText, { color: Colors.primary }]}>
                                    編集
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.deleteButton]}
                                onPress={handleDelete}
                            >
                                <Ionicons name="trash-outline" size={20} color={Colors.error} />
                                <Text style={[styles.actionText, { color: Colors.error }]}>
                                    削除
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>

            {/* カテゴリ選択モーダル */}
            <Modal
                visible={categoryModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setCategoryModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                            <Ionicons name="close" size={24} color={Colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>カテゴリを選択</Text>
                        <View style={{ width: 24 }} />
                    </View>
                    <FlatList
                        data={categories}
                        keyExtractor={(cat) => cat.id}
                        renderItem={({ item: cat }) => {
                            const isSelected =
                                editingItemId &&
                                items.find((i) => i.id === editingItemId)?.categoryId === cat.id;
                            return (
                                <TouchableOpacity
                                    style={[
                                        styles.categoryOption,
                                        isSelected && styles.categoryOptionSelected,
                                    ]}
                                    onPress={() => selectCategory(cat.id)}
                                    activeOpacity={0.7}
                                >
                                    <View
                                        style={[
                                            styles.categoryOptionDot,
                                            { backgroundColor: cat.color + '20' },
                                        ]}
                                    >
                                        <Ionicons
                                            name={getCategoryIcon(cat.id) as any}
                                            size={18}
                                            color={cat.color}
                                        />
                                    </View>
                                    <Text
                                        style={[
                                            styles.categoryOptionText,
                                            isSelected && styles.categoryOptionTextSelected,
                                        ]}
                                    >
                                        {cat.name}
                                    </Text>
                                    {isSelected && (
                                        <Ionicons name="checkmark" size={20} color={Colors.primary} />
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        contentContainerStyle={styles.categoryList}
                    />
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg,
    },
    scrollView: {
        flex: 1,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.bg,
    },
    loadingText: {
        fontSize: FontSize.md,
        color: Colors.muted,
    },
    header: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    typeIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    amount: {
        fontSize: 36,
        fontWeight: '700',
    },
    editAmountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    editAmountInput: {
        fontSize: 32,
        fontWeight: '700',
        color: Colors.text,
        borderBottomWidth: 2,
        borderBottomColor: Colors.primary,
        paddingVertical: 4,
        paddingHorizontal: 8,
        minWidth: 120,
        textAlign: 'center',
    },
    editAmountYen: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.text,
    },
    typeBadge: {
        fontSize: FontSize.sm,
        color: Colors.muted,
        marginTop: Spacing.xxs,
    },
    detailCard: {
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        overflow: 'hidden',
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    detailContent: {
        flex: 1,
    },
    detailIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.bg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: FontSize.xs,
        color: Colors.muted,
    },
    detailValue: {
        fontSize: FontSize.md,
        color: Colors.text,
        fontWeight: '500',
        marginTop: 2,
    },
    editInput: {
        fontSize: FontSize.md,
        color: Colors.text,
        fontWeight: '500',
        borderBottomWidth: 1,
        borderBottomColor: Colors.primary,
        paddingVertical: 4,
        marginTop: 2,
    },
    detailDivider: {
        height: 1,
        backgroundColor: Colors.divider,
        marginLeft: Spacing.md + 32 + Spacing.sm,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xs,
    },
    sectionTitle: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        color: Colors.muted,
    },
    sectionHint: {
        fontSize: FontSize.xs,
        color: Colors.primary,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: FontSize.md,
        color: Colors.text,
        fontWeight: '500',
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        paddingVertical: 3,
        paddingHorizontal: 8,
        backgroundColor: Colors.bg,
        borderRadius: Radius.md,
        alignSelf: 'flex-start',
    },
    categoryDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryBadgeText: {
        fontSize: FontSize.xs,
        color: Colors.muted,
        fontWeight: '500',
    },
    itemPrice: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.text,
    },
    actions: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.md,
        gap: Spacing.sm,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        borderRadius: Radius.lg,
        gap: Spacing.xs,
    },
    editButton: {
        backgroundColor: Colors.primary + '10',
    },
    saveButton: {
        backgroundColor: Colors.primary,
    },
    cancelButton: {
        backgroundColor: Colors.surface,
    },
    deleteButton: {
        backgroundColor: Colors.error + '10',
    },
    actionText: {
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    // カテゴリ選択モーダル
    modalContainer: {
        flex: 1,
        backgroundColor: Colors.bg,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    modalTitle: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.text,
    },
    categoryList: {
        padding: Spacing.md,
    },
    categoryOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        marginBottom: Spacing.xs,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        gap: Spacing.sm,
    },
    categoryOptionSelected: {
        backgroundColor: Colors.primary + '10',
        borderWidth: 1,
        borderColor: Colors.primary + '30',
    },
    categoryOptionDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryOptionText: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.text,
        fontWeight: '500',
    },
    categoryOptionTextSelected: {
        color: Colors.primary,
        fontWeight: '600',
    },
});
