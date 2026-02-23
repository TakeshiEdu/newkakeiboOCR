/**
 * 明細確認画面（OCR結果編集） — Scene: ReceiptDetailModal
 *
 * OCR結果の確認・修正・保存
 * - 店舗名（編集可）
 * - 日付（ピッカー）
 * - 合計金額（編集可）
 * - 明細リスト（各品目の名前・カテゴリ・金額を編集可能）
 * - 学習同意トグル
 * - 保存ボタン
 */
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { Colors } from '@/constants/Colors';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useDatabase } from '@/hooks/useDatabase';
import { categorize } from '@/lib/categorizer/categorizer';
import { getCategoryColor, getCategoryDef, getCategoryIcon } from '@/lib/category-utils';
import type { Category, CategoryRule, ParsedReceipt } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface EditableItem {
    id: string;
    name: string;
    price: number;
    categoryId: string;
    confidence: number;
    rawLine: string;
}

export default function ReceiptConfirmScreen() {
    const params = useLocalSearchParams<{ data: string; imageUri?: string }>();
    const { transactionRepo, categoryRepo, isReady } = useDatabase();

    // 解析データ
    const [storeName, setStoreName] = useState('');
    const [date, setDate] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [items, setItems] = useState<EditableItem[]>([]);
    const [rawText, setRawText] = useState('');
    const [overallConfidence, setOverallConfidence] = useState(0);

    // UI状態
    const [saving, setSaving] = useState(false);
    const [learnEnabled, setLearnEnabled] = useState(true);
    const [rules, setRules] = useState<CategoryRule[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    const successAnim = useRef(new Animated.Value(0)).current;

    // 初期化：解析データを読み込み
    useEffect(() => {
        if (!params.data) {
            Alert.alert('エラー', 'レシートデータがありません。', [
                { text: 'OK', onPress: () => router.back() },
            ]);
            return;
        }

        try {
            const parsed: ParsedReceipt = JSON.parse(params.data);
            setStoreName(parsed.storeName || '');
            setDate(parsed.date || new Date().toISOString().slice(0, 10));
            setTotalAmount(parsed.total?.toString() || '0');
            setRawText(parsed.rawText);
            setOverallConfidence(parsed.confidence);

            // 明細アイテムを編集可能な形に変換
            const editableItems: EditableItem[] = parsed.items.map((item, idx) => ({
                id: `item_${idx}_${Date.now()}`,
                name: item.name,
                price: item.price,
                categoryId: item.categoryId || 'other',
                confidence: item.confidence,
                rawLine: item.rawLine,
            }));
            setItems(editableItems);
        } catch (error) {
            console.error('[ReceiptConfirm] データ解析エラー:', error);
            Alert.alert('エラー', 'データの読み込みに失敗しました。', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        }
    }, [params.data]);

    // ルールとカテゴリデータを読み込み
    useEffect(() => {
        if (!isReady || !categoryRepo) return;

        const loadData = async () => {
            try {
                const [loadedRules, loadedCategories] = await Promise.all([
                    categoryRepo.getAllRules(),
                    categoryRepo.getAll(),
                ]);
                setRules(loadedRules);
                setCategories(loadedCategories);
            } catch (error) {
                console.error('[ReceiptConfirm] データ読み込みエラー:', error);
            }
        };
        loadData();
    }, [isReady, categoryRepo]);

    // ルール読み込み後に自動カテゴリ分類を実行
    useEffect(() => {
        if (rules.length === 0 || items.length === 0) return;

        setItems((prev) =>
            prev.map((item) => {
                if (item.categoryId && item.categoryId !== 'other') return item;
                const catId = categorize(storeName || null, item.name, rules);
                return { ...item, categoryId: catId };
            }),
        );
    }, [rules, storeName]);

    // ── 操作ハンドラ ──

    const updateItemName = (itemId: string, name: string) => {
        setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, name } : i)));
    };

    const updateItemPrice = (itemId: string, priceStr: string) => {
        const price = parseInt(priceStr.replace(/[^0-9]/g, ''), 10) || 0;
        setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, price } : i)));
    };

    const openCategoryPicker = (itemId: string) => {
        setEditingItemId(itemId);
        setCategoryPickerVisible(true);
    };

    const selectCategory = (categoryId: string) => {
        if (editingItemId) {
            setItems((prev) =>
                prev.map((i) => (i.id === editingItemId ? { ...i, categoryId } : i)),
            );
        }
        setCategoryPickerVisible(false);
        setEditingItemId(null);
    };

    const addNewItem = () => {
        const newItem: EditableItem = {
            id: `item_new_${Date.now()}`,
            name: '',
            price: 0,
            categoryId: 'other',
            confidence: 1.0,
            rawLine: '',
        };
        setItems((prev) => [...prev, newItem]);
    };

    const removeItem = (itemId: string) => {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
    };

    // 合計を再計算
    const calculatedTotal = items.reduce((sum, item) => sum + item.price, 0);

    // ── 保存 ──

    const handleSave = async () => {
        if (!isReady || !transactionRepo || !categoryRepo) return;
        if (items.length === 0) {
            Alert.alert('エラー', '明細が1件もありません。');
            return;
        }

        setSaving(true);
        try {
            const totalVal = parseInt(totalAmount.replace(/[^0-9]/g, ''), 10) || calculatedTotal;

            const transactionItems = items.map((item) => ({
                itemName: item.name || null,
                price: -item.price, // expense は負値
                categoryId: item.categoryId,
            }));

            const transactionId = await transactionRepo.create(
                {
                    type: 'expense' as const,
                    amount: -totalVal,
                    store: storeName || null,
                    memo: null,
                    date: date,
                    source: 'ocr' as const,
                    rawText: rawText || null,
                },
                transactionItems,
            );

            // 学習：カテゴリ変更時にルールに記録
            if (learnEnabled && categoryRepo) {
                for (const item of items) {
                    if (item.name && item.categoryId !== 'other') {
                        try {
                            await categoryRepo.recordEdit({
                                transactionId: transactionId,
                                itemId: item.id,
                                originalCategoryId: 'other',
                                editedCategoryId: item.categoryId,
                                reason: 'ocr_confirm',
                                editedAt: new Date().toISOString(),
                            });

                            // 同じ修正が3回以上あればルールを追加
                            const editCount = await categoryRepo.getEditCount(
                                item.name,
                                item.categoryId,
                            );
                            if (editCount >= 3) {
                                try {
                                    await categoryRepo.addRule(
                                        item.name,
                                        item.categoryId,
                                        true,
                                    );
                                } catch {
                                    // ルール追加失敗は無視（重複等）
                                }
                            }
                        } catch {
                            // 学習記録失敗は無視
                        }
                    }
                }
            }

            // サクセスアニメーション
            Animated.sequence([
                Animated.timing(successAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.delay(600),
                Animated.timing(successAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                router.replace('/(tabs)' as any);
            });
        } catch (error) {
            console.error('[ReceiptConfirm] 保存エラー:', error);
            Alert.alert('エラー', '保存に失敗しました。もう一度お試しください。');
        } finally {
            setSaving(false);
        }
    };

    // ── カテゴリ表示ヘルパー ──
    const getCatLabel = (catId: string): string => {
        const cat = categories.find((c) => c.id === catId);
        if (cat) return cat.name;
        const def = getCategoryDef(catId);
        return def?.name || 'その他';
    };

    const getCatColor = (catId: string): string => {
        const cat = categories.find((c) => c.id === catId);
        if (cat) return cat.color;
        return getCategoryColor(catId);
    };

    // ── 信頼度バッジ ──
    const ConfidenceBadge = ({ value }: { value: number }) => {
        const color =
            value >= 0.8 ? Colors.income : value >= 0.5 ? Colors.warning : Colors.expense;
        return (
            <View style={[styles.confidenceBadge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.confidenceText, { color }]}>
                    {Math.round(value * 100)}%
                </Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={100}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── 全体の信頼度 ── */}
                {overallConfidence < 0.7 && (
                    <View style={styles.warningBanner}>
                        <Ionicons name="warning" size={18} color={Colors.warning} />
                        <Text style={styles.warningText}>
                            読み取り精度が低い可能性があります。内容をご確認ください。
                        </Text>
                    </View>
                )}

                {/* ── 店舗名 ── */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>店舗名</Text>
                    <TextInput
                        style={styles.textInput}
                        value={storeName}
                        onChangeText={setStoreName}
                        placeholder="店舗名を入力"
                        placeholderTextColor={Colors.muted}
                    />
                </View>

                {/* ── 日付 ── */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>日付</Text>
                    <TextInput
                        style={styles.textInput}
                        value={date}
                        onChangeText={setDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={Colors.muted}
                    />
                </View>

                {/* ── 合計金額 ── */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>合計金額</Text>
                    <View style={styles.totalRow}>
                        <TextInput
                            style={[styles.textInput, styles.totalInput]}
                            value={totalAmount}
                            onChangeText={setTotalAmount}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={Colors.muted}
                        />
                        <Text style={styles.yenLabel}>円</Text>
                    </View>
                    {parseInt(totalAmount.replace(/[^0-9]/g, ''), 10) !== calculatedTotal && items.length > 0 && (
                        <TouchableOpacity
                            style={styles.recalcButton}
                            onPress={() => setTotalAmount(calculatedTotal.toString())}
                        >
                            <Ionicons name="calculator-outline" size={14} color={Colors.primary} />
                            <Text style={styles.recalcText}>
                                明細合計 {calculatedTotal.toLocaleString()}円 に合わせる
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── 明細リスト ── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionLabel}>明細</Text>
                        <Text style={styles.itemCount}>{items.length}件</Text>
                    </View>

                    {items.length === 0 ? (
                        <View style={styles.emptyItems}>
                            <Ionicons name="document-text-outline" size={32} color={Colors.muted} />
                            <Text style={styles.emptyItemsText}>
                                明細が検出されませんでした
                            </Text>
                        </View>
                    ) : (
                        items.map((item, index) => (
                            <View key={item.id} style={styles.itemCard}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemIndex}>#{index + 1}</Text>
                                    <ConfidenceBadge value={item.confidence} />
                                    <TouchableOpacity
                                        onPress={() => removeItem(item.id)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="close-circle" size={20} color={Colors.muted} />
                                    </TouchableOpacity>
                                </View>

                                {/* 商品名 */}
                                <TextInput
                                    style={styles.itemNameInput}
                                    value={item.name}
                                    onChangeText={(v) => updateItemName(item.id, v)}
                                    placeholder="商品名"
                                    placeholderTextColor={Colors.muted}
                                />

                                <View style={styles.itemBottomRow}>
                                    {/* カテゴリバッジ */}
                                    <TouchableOpacity
                                        style={[
                                            styles.categoryBadge,
                                            { backgroundColor: getCatColor(item.categoryId) + '20' },
                                        ]}
                                        onPress={() => openCategoryPicker(item.id)}
                                    >
                                        <Ionicons
                                            name={getCategoryIcon(item.categoryId) as any}
                                            size={14}
                                            color={getCatColor(item.categoryId)}
                                        />
                                        <Text
                                            style={[
                                                styles.categoryBadgeText,
                                                { color: getCatColor(item.categoryId) },
                                            ]}
                                        >
                                            {getCatLabel(item.categoryId)}
                                        </Text>
                                        <Ionicons
                                            name="chevron-down"
                                            size={12}
                                            color={getCatColor(item.categoryId)}
                                        />
                                    </TouchableOpacity>

                                    {/* 金額 */}
                                    <View style={styles.itemPriceRow}>
                                        <TextInput
                                            style={styles.itemPriceInput}
                                            value={item.price.toString()}
                                            onChangeText={(v) => updateItemPrice(item.id, v)}
                                            keyboardType="numeric"
                                        />
                                        <Text style={styles.itemPriceYen}>円</Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}

                    {/* 項目追加ボタン */}
                    <TouchableOpacity style={styles.addItemButton} onPress={addNewItem}>
                        <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                        <Text style={styles.addItemText}>項目を追加</Text>
                    </TouchableOpacity>
                </View>

                {/* ── 学習設定 ── */}
                <View style={styles.learnSection}>
                    <TouchableOpacity
                        style={styles.learnToggle}
                        onPress={() => setLearnEnabled(!learnEnabled)}
                    >
                        <Ionicons
                            name={learnEnabled ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={learnEnabled ? Colors.primary : Colors.muted}
                        />
                        <View style={styles.learnTextContainer}>
                            <Text style={styles.learnTitle}>カテゴリ学習</Text>
                            <Text style={styles.learnDesc}>
                                修正内容を記録してカテゴリ分類を改善します
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* ── 保存ボタン（固定フッタ） ── */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.85}
                >
                    {saving ? (
                        <Text style={styles.saveButtonText}>保存中...</Text>
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle" size={22} color={Colors.onPrimary} />
                            <Text style={styles.saveButtonText}>
                                {items.length}件を保存
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* ── サクセスオーバーレイ ── */}
            <Animated.View
                style={[
                    styles.successOverlay,
                    {
                        opacity: successAnim,
                        pointerEvents: 'none',
                    },
                ]}
            >
                <Animated.View
                    style={[
                        styles.successCircle,
                        {
                            transform: [
                                {
                                    scale: successAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.5, 1],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <Ionicons name="checkmark" size={48} color="#FFF" />
                </Animated.View>
            </Animated.View>

            {/* ── カテゴリ選択モーダル ── */}
            <Modal
                visible={categoryPickerVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setCategoryPickerVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setCategoryPickerVisible(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>カテゴリを選択</Text>
                        <FlatList
                            data={DEFAULT_CATEGORIES}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalCategoryItem}
                                    onPress={() => selectCategory(item.id)}
                                >
                                    <View
                                        style={[
                                            styles.modalCatIcon,
                                            { backgroundColor: item.color + '20' },
                                        ]}
                                    >
                                        <Ionicons
                                            name={item.icon as any}
                                            size={20}
                                            color={item.color}
                                        />
                                    </View>
                                    <Text style={styles.modalCatName}>{item.name}</Text>
                                    {editingItemId &&
                                        items.find((i) => i.id === editingItemId)?.categoryId ===
                                        item.id && (
                                            <Ionicons
                                                name="checkmark"
                                                size={20}
                                                color={Colors.primary}
                                            />
                                        )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </KeyboardAvoidingView>
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
    scrollContent: {
        padding: Spacing.md,
    },

    // ── 警告バナー ──
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.warning + '15',
        padding: Spacing.sm,
        borderRadius: Radius.sm,
        marginBottom: Spacing.md,
        gap: 8,
    },
    warningText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: '#A67C00',
    },

    // ── セクション ──
    section: {
        marginBottom: Spacing.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionLabel: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        color: Colors.muted,
        marginBottom: 6,
    },
    itemCount: {
        fontSize: FontSize.sm,
        color: Colors.muted,
        marginBottom: 6,
    },

    // ── テキスト入力 ──
    textInput: {
        backgroundColor: Colors.surface,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 12,
        fontSize: FontSize.md,
        color: Colors.text,
    },

    // ── 合計 ──
    totalRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    totalInput: {
        flex: 1,
        fontSize: FontSize.xl,
        fontWeight: '700',
    },
    yenLabel: {
        fontSize: FontSize.xl,
        fontWeight: '700',
        color: Colors.text,
        marginLeft: 8,
    },
    recalcButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 4,
    },
    recalcText: {
        fontSize: FontSize.xs,
        color: Colors.primary,
    },

    // ── 明細アイテム ──
    itemCard: {
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        padding: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    itemIndex: {
        fontSize: FontSize.xs,
        color: Colors.muted,
        fontWeight: '600',
    },
    itemNameInput: {
        fontSize: FontSize.md,
        color: Colors.text,
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
        marginBottom: 8,
    },
    itemBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    // ── カテゴリバッジ ──
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
        gap: 4,
    },
    categoryBadgeText: {
        fontSize: FontSize.xs,
        fontWeight: '600',
    },

    // ── 金額入力 ──
    itemPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemPriceInput: {
        fontSize: FontSize.md,
        fontWeight: '700',
        color: Colors.expense,
        textAlign: 'right',
        minWidth: 60,
        paddingVertical: 4,
    },
    itemPriceYen: {
        fontSize: FontSize.sm,
        color: Colors.muted,
        marginLeft: 2,
    },

    // ── 信頼度バッジ ──
    confidenceBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    confidenceText: {
        fontSize: 10,
        fontWeight: '600',
    },

    // ── 空の明細 ──
    emptyItems: {
        alignItems: 'center',
        paddingVertical: Spacing.lg,
        gap: 8,
    },
    emptyItemsText: {
        fontSize: FontSize.sm,
        color: Colors.muted,
    },

    // ── 項目追加 ──
    addItemButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        gap: 6,
        marginTop: 4,
    },
    addItemText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: '600',
    },

    // ── 学習セクション ──
    learnSection: {
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        padding: Spacing.md,
    },
    learnToggle: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    learnTextContainer: {
        flex: 1,
    },
    learnTitle: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.text,
    },
    learnDesc: {
        fontSize: FontSize.xs,
        color: Colors.muted,
        marginTop: 2,
    },

    // ── フッタ ──
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.bg,
        borderTopWidth: 1,
        borderTopColor: Colors.divider,
        padding: Spacing.md,
        paddingBottom: 34,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.lg,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: Colors.onPrimary,
        fontSize: FontSize.md,
        fontWeight: '700',
    },

    // ── サクセスオーバーレイ ──
    successOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.income,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── カテゴリモーダル ──
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.bg,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '60%',
        paddingBottom: 34,
    },
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.divider,
        alignSelf: 'center',
        marginTop: 8,
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.text,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    modalCategoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: Spacing.md,
        gap: 12,
    },
    modalCatIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCatName: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.text,
    },
});
