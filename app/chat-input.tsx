/**
 * チャット入力画面
 * テキスト入力 → リアルタイム解析プレビュー → 保存
 */
import Colors from '@/constants/Colors';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useDatabase } from '@/hooks/useDatabase';
import { categorize } from '@/lib/categorizer/categorizer';
import { parseChatInput, parseChatInputMultiLine } from '@/lib/parser/chat-parser';
import { ParsedInput } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    Animated,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ChatInputScreen() {
    const router = useRouter();
    const { transactionRepo, categoryRepo, isReady } = useDatabase();

    const [text, setText] = useState('');
    const [preview, setPreview] = useState<ParsedInput | null>(null);
    const [saving, setSaving] = useState(false);
    const [categoryName, setCategoryName] = useState('');
    const successAnim = useRef(new Animated.Value(0)).current;

    const handleTextChange = useCallback(
        async (value: string) => {
            setText(value);
            if (value.trim().length === 0) {
                setPreview(null);
                setCategoryName('');
                return;
            }

            const parsed = parseChatInput(value);
            setPreview(parsed);

            // カテゴリ推定
            if (isReady && categoryRepo) {
                try {
                    const rules = await categoryRepo.getAllRules();
                    const catId = categorize(parsed.store, parsed.items[0]?.name || null, rules);
                    const categories = await categoryRepo.getAll();
                    const cat = categories.find((c) => c.id === catId);
                    setCategoryName(cat?.name || 'その他');
                } catch {
                    setCategoryName('その他');
                }
            }
        },
        [isReady, categoryRepo]
    );

    const handleSave = async () => {
        if (!text.trim() || !isReady || !transactionRepo || !categoryRepo) return;
        setSaving(true);

        try {
            const lines = text.split('\n').filter((l) => l.trim().length > 0);
            const parsedList = lines.length > 1
                ? parseChatInputMultiLine(text)
                : [parseChatInput(text)];

            const rules = await categoryRepo.getAllRules();

            for (const parsed of parsedList) {
                const items = parsed.items.map((item) => ({
                    itemName: item.name,
                    price: parsed.type === 'expense' ? -item.price : item.price,
                    categoryId: categorize(parsed.store, item.name, rules),
                }));

                const today = new Date().toISOString().slice(0, 10);

                await transactionRepo.create(
                    {
                        type: parsed.type,
                        amount: parsed.amount,
                        store: parsed.store,
                        memo: parsed.memo,
                        date: today,
                        source: 'chat',
                        rawText: text,
                    },
                    items
                );
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
                setText('');
                setPreview(null);
                router.back();
            });
        } catch (error) {
            console.error('Failed to save:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={100}
        >
            {/* 解析プレビュー */}
            {preview && preview.amount !== 0 && (
                <View style={styles.previewCard}>
                    <View style={styles.previewRow}>
                        <View style={styles.previewItem}>
                            <Text style={styles.previewLabel}>種別</Text>
                            <Text
                                style={[
                                    styles.previewValue,
                                    {
                                        color:
                                            preview.type === 'expense'
                                                ? Colors.expense
                                                : Colors.income,
                                    },
                                ]}
                            >
                                {preview.type === 'expense' ? '支出' : '収入'}
                            </Text>
                        </View>
                        <View style={styles.previewItem}>
                            <Text style={styles.previewLabel}>金額</Text>
                            <Text style={styles.previewValue}>
                                {Math.abs(preview.amount).toLocaleString()}円
                            </Text>
                        </View>
                        <View style={styles.previewItem}>
                            <Text style={styles.previewLabel}>カテゴリ</Text>
                            <Text style={styles.previewValue}>{categoryName}</Text>
                        </View>
                    </View>
                    {preview.store && (
                        <View style={styles.previewStoreRow}>
                            <Ionicons name="storefront-outline" size={14} color={Colors.muted} />
                            <Text style={styles.previewStore}>{preview.store}</Text>
                        </View>
                    )}
                    {preview.confidence < 0.5 && (
                        <View style={styles.cautionRow}>
                            <Ionicons name="warning" size={14} color={Colors.warning} />
                            <Text style={styles.cautionText}>
                                解析の確度が低いです。内容をご確認ください
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* 金額なし警告 */}
            {text.trim().length > 0 && (!preview || preview.amount === 0) && (
                <View style={styles.warningCard}>
                    <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
                    <Text style={styles.warningText}>金額が検出されません</Text>
                </View>
            )}

            {/* 入力エリア */}
            <View style={styles.inputArea}>
                <TextInput
                    style={styles.textInput}
                    placeholder="例: コンビニ500円、ランチ1200円"
                    placeholderTextColor={Colors.muted}
                    value={text}
                    onChangeText={handleTextChange}
                    multiline
                    autoFocus
                    returnKeyType="default"
                />
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        (!text.trim() || saving) && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={!text.trim() || saving}
                >
                    <Ionicons
                        name="send"
                        size={22}
                        color={
                            text.trim() && !saving ? Colors.onPrimary : Colors.muted
                        }
                    />
                </TouchableOpacity>
            </View>

            {/* サクセスオーバーレイ */}
            <Animated.View
                style={[
                    styles.successOverlay,
                    {
                        opacity: successAnim,
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
                pointerEvents="none"
            >
                <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
                <Text style={styles.successText}>保存しました</Text>
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg,
        justifyContent: 'space-between',
    },
    previewCard: {
        margin: Spacing.md,
        padding: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
    },
    previewRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    previewItem: {
        flex: 1,
    },
    previewLabel: {
        fontSize: FontSize.xs,
        color: Colors.muted,
        marginBottom: 2,
    },
    previewValue: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.text,
    },
    previewStoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xxs,
        marginTop: Spacing.sm,
    },
    previewStore: {
        fontSize: FontSize.sm,
        color: Colors.muted,
    },
    cautionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xxs,
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.divider,
    },
    cautionText: {
        fontSize: FontSize.xs,
        color: Colors.warning,
    },
    warningCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        margin: Spacing.md,
        padding: Spacing.sm,
        backgroundColor: Colors.warning + '15',
        borderRadius: Radius.md,
    },
    warningText: {
        fontSize: FontSize.sm,
        color: Colors.warning,
    },
    inputArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.divider,
        gap: Spacing.sm,
    },
    textInput: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.text,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        maxHeight: 120,
        minHeight: 44,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: Colors.divider,
    },
    successOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    successText: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.success,
        marginTop: Spacing.sm,
    },
});
