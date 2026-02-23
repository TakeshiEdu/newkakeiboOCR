/**
 * カテゴリ編集画面
 * カテゴリの名前・色編集、ルール一覧・追加・削除
 */
import Colors from '@/constants/Colors';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useDatabase } from '@/hooks/useDatabase';
import { getCategoryIcon } from '@/lib/category-utils';
import { Category, CategoryRule } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function CategoriesScreen() {
    const { categoryRepo, isReady } = useDatabase();

    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [rules, setRules] = useState<CategoryRule[]>([]);
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [showAddRule, setShowAddRule] = useState(false);
    const [newRuleText, setNewRuleText] = useState('');
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [editName, setEditName] = useState('');

    const loadCategories = useCallback(async () => {
        if (!isReady || !categoryRepo) return;
        const cats = await categoryRepo.getAll();
        setCategories(cats);
    }, [isReady, categoryRepo]);

    useFocusEffect(
        useCallback(() => {
            loadCategories();
        }, [loadCategories])
    );

    const loadRules = async (category: Category) => {
        if (!categoryRepo) return;
        setSelectedCategory(category);
        const r = await categoryRepo.getRulesByCategory(category.id);
        setRules(r);
        setShowRulesModal(true);
    };

    const handleAddRule = async () => {
        if (!newRuleText.trim() || !selectedCategory || !categoryRepo) return;
        await categoryRepo.addRule(newRuleText.trim(), selectedCategory.id, true);
        const r = await categoryRepo.getRulesByCategory(selectedCategory.id);
        setRules(r);
        setNewRuleText('');
        setShowAddRule(false);
    };

    const handleDeleteRule = (ruleId: number) => {
        Alert.alert('ルール削除', 'このルールを削除しますか？', [
            { text: 'キャンセル', style: 'cancel' },
            {
                text: '削除',
                style: 'destructive',
                onPress: async () => {
                    await categoryRepo?.deleteRule(ruleId);
                    if (selectedCategory) {
                        const r = await categoryRepo!.getRulesByCategory(selectedCategory.id);
                        setRules(r);
                    }
                },
            },
        ]);
    };

    const handleEditCategory = (category: Category) => {
        setEditingCategory(category);
        setEditName(category.name);
    };

    const handleSaveEdit = async () => {
        if (!editingCategory || !editName.trim() || !categoryRepo) return;
        await categoryRepo.update(editingCategory.id, { name: editName.trim() });
        setEditingCategory(null);
        loadCategories();
    };

    const renderCategory = ({ item }: { item: Category }) => (
        <View style={styles.categoryCard}>
            <View style={styles.categoryLeft}>
                <View style={[styles.iconBadge, { backgroundColor: item.color + '20' }]}>
                    <Ionicons
                        name={getCategoryIcon(item.id) as any}
                        size={18}
                        color={item.color}
                    />
                </View>
                {editingCategory?.id === item.id ? (
                    <View style={styles.editRow}>
                        <TextInput
                            style={styles.editInput}
                            value={editName}
                            onChangeText={setEditName}
                            autoFocus
                            onSubmitEditing={handleSaveEdit}
                        />
                        <TouchableOpacity onPress={handleSaveEdit}>
                            <Ionicons name="checkmark" size={22} color={Colors.success} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingCategory(null)}>
                            <Ionicons name="close" size={22} color={Colors.muted} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity onPress={() => handleEditCategory(item)}>
                        <Text style={styles.categoryName}>{item.name}</Text>
                    </TouchableOpacity>
                )}
            </View>
            <TouchableOpacity
                style={styles.rulesButton}
                onPress={() => loadRules(item)}
            >
                <Ionicons name="list-outline" size={18} color={Colors.primary} />
                <Text style={styles.rulesButtonText}>ルール</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>カテゴリ管理</Text>
                <Text style={styles.headerSubtitle}>
                    タップで名前を編集、ルールボタンで分類ルールを管理
                </Text>
            </View>

            <FlatList
                data={categories}
                keyExtractor={(item) => item.id}
                renderItem={renderCategory}
                contentContainerStyle={styles.list}
            />

            {/* ルール一覧モーダル */}
            <Modal
                visible={showRulesModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowRulesModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowRulesModal(false)}>
                            <Ionicons name="close" size={24} color={Colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>
                            {selectedCategory?.name} のルール
                        </Text>
                        <TouchableOpacity onPress={() => setShowAddRule(true)}>
                            <Ionicons name="add" size={24} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* ルール追加フォーム */}
                    {showAddRule && (
                        <View style={styles.addRuleForm}>
                            <TextInput
                                style={styles.ruleInput}
                                placeholder="キーワード or /正規表現/"
                                placeholderTextColor={Colors.muted}
                                value={newRuleText}
                                onChangeText={setNewRuleText}
                                autoFocus
                            />
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={handleAddRule}
                                disabled={!newRuleText.trim()}
                            >
                                <Text style={styles.addButtonText}>追加</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {rules.length === 0 ? (
                        <View style={styles.emptyRules}>
                            <Ionicons name="document-outline" size={48} color={Colors.muted} />
                            <Text style={styles.emptyRulesText}>
                                ルールがまだありません
                            </Text>
                            <Text style={styles.emptyRulesSubText}>
                                ＋ボタンからキーワードを追加して自動分類を設定
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={rules}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <View style={styles.ruleCard}>
                                    <View style={styles.ruleInfo}>
                                        <Text style={styles.ruleText}>{item.matchText}</Text>
                                        <View style={styles.ruleMetaRow}>
                                            {item.userDefined && (
                                                <View style={styles.badge}>
                                                    <Text style={styles.badgeText}>ユーザー定義</Text>
                                                </View>
                                            )}
                                            <Text style={styles.rulePriority}>
                                                優先度: {item.priority}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={() => handleDeleteRule(item.id)}>
                                        <Ionicons name="trash-outline" size={20} color={Colors.error} />
                                    </TouchableOpacity>
                                </View>
                            )}
                            contentContainerStyle={styles.rulesList}
                        />
                    )}
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
    header: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    headerTitle: {
        fontSize: FontSize.xl,
        fontWeight: '700',
        color: Colors.text,
    },
    headerSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.muted,
        marginTop: Spacing.xxs,
    },
    list: {
        padding: Spacing.md,
    },
    categoryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        marginBottom: Spacing.xs,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
    },
    categoryLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    iconBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryName: {
        fontSize: FontSize.md,
        fontWeight: '500',
        color: Colors.text,
    },
    editRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        flex: 1,
    },
    editInput: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.text,
        borderBottomWidth: 1,
        borderBottomColor: Colors.primary,
        paddingVertical: 2,
    },
    rulesButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.primary + '10',
        borderRadius: Radius.md,
    },
    rulesButtonText: {
        fontSize: FontSize.xs,
        color: Colors.primary,
        fontWeight: '600',
    },
    // Modal
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
    addRuleForm: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    ruleInput: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.text,
        backgroundColor: Colors.surface,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    addButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.primary,
        borderRadius: Radius.md,
    },
    addButtonText: {
        color: Colors.onPrimary,
        fontWeight: '600',
        fontSize: FontSize.sm,
    },
    rulesList: {
        padding: Spacing.md,
    },
    ruleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        marginBottom: Spacing.xs,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
    },
    ruleInfo: {
        flex: 1,
    },
    ruleText: {
        fontSize: FontSize.md,
        color: Colors.text,
        fontWeight: '500',
    },
    ruleMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.xxs,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: Colors.primary + '15',
        borderRadius: 4,
    },
    badgeText: {
        fontSize: 10,
        color: Colors.primary,
        fontWeight: '600',
    },
    rulePriority: {
        fontSize: FontSize.xs,
        color: Colors.muted,
    },
    emptyRules: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyRulesText: {
        fontSize: FontSize.md,
        color: Colors.muted,
        marginTop: Spacing.sm,
    },
    emptyRulesSubText: {
        fontSize: FontSize.sm,
        color: Colors.muted,
        marginTop: Spacing.xxs,
        textAlign: 'center',
    },
});
