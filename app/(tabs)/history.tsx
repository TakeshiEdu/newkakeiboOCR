/**
 * 履歴一覧画面
 * フィルタ + 検索 + トランザクションリスト
 */
import Colors from '@/constants/Colors';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useDatabase } from '@/hooks/useDatabase';
import { Category, Transaction } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function HistoryScreen() {
    const router = useRouter();
    const { transactionRepo, categoryRepo, isReady } = useDatabase();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchText, setSearchText] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(
        new Date().toISOString().slice(0, 7)
    );

    const loadData = useCallback(async () => {
        if (!isReady || !transactionRepo || !categoryRepo) return;
        try {
            const [txs, cats] = await Promise.all([
                searchText
                    ? transactionRepo.search(searchText)
                    : transactionRepo.getByMonth(selectedMonth),
                categoryRepo.getAll(),
            ]);
            setTransactions(txs);
            setCategories(cats);
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }, [isReady, transactionRepo, categoryRepo, selectedMonth, searchText]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleDelete = (id: string) => {
        Alert.alert('削除確認', 'この取引を削除しますか？', [
            { text: 'キャンセル', style: 'cancel' },
            {
                text: '削除',
                style: 'destructive',
                onPress: async () => {
                    await transactionRepo?.delete(id);
                    loadData();
                },
            },
        ]);
    };

    const changeMonth = (delta: number) => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const d = new Date(year, month - 1 + delta, 1);
        setSelectedMonth(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        );
    };

    const formatAmount = (amount: number) => Math.abs(amount).toLocaleString();
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    const renderItem = ({ item: tx }: { item: Transaction }) => (
        <TouchableOpacity
            style={styles.txCard}
            onPress={() => router.push(`/transaction/${tx.id}`)}
            onLongPress={() => handleDelete(tx.id)}
            activeOpacity={0.7}
        >
            <View style={styles.txLeft}>
                <View
                    style={[
                        styles.txIcon,
                        {
                            backgroundColor:
                                tx.type === 'expense' ? Colors.expense + '15' : Colors.income + '15',
                        },
                    ]}
                >
                    <Ionicons
                        name={tx.type === 'expense' ? 'arrow-down' : 'arrow-up'}
                        size={18}
                        color={tx.type === 'expense' ? Colors.expense : Colors.income}
                    />
                </View>
                <View style={styles.txInfo}>
                    <Text style={styles.txStore} numberOfLines={1}>
                        {tx.store || tx.memo || '取引'}
                    </Text>
                    <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
                </View>
            </View>
            <Text
                style={[
                    styles.txAmount,
                    { color: tx.type === 'expense' ? Colors.expense : Colors.income },
                ]}
            >
                {tx.type === 'expense' ? '-' : '+'}
                {formatAmount(tx.amount)}円
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* 検索バー */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color={Colors.muted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="検索..."
                    placeholderTextColor={Colors.muted}
                    value={searchText}
                    onChangeText={setSearchText}
                    onSubmitEditing={loadData}
                    returnKeyType="search"
                />
                {searchText.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchText(''); loadData(); }}>
                        <Ionicons name="close-circle" size={20} color={Colors.muted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* 月選択 */}
            {!searchText && (
                <View style={styles.monthSelector}>
                    <TouchableOpacity onPress={() => changeMonth(-1)}>
                        <Ionicons name="chevron-back" size={24} color={Colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>
                        {selectedMonth.replace('-', '年')}月
                    </Text>
                    <TouchableOpacity onPress={() => changeMonth(1)}>
                        <Ionicons name="chevron-forward" size={24} color={Colors.primary} />
                    </TouchableOpacity>
                </View>
            )}

            {/* リスト */}
            <FlatList
                data={transactions}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="document-text-outline" size={48} color={Colors.muted} />
                        <Text style={styles.emptyText}>取引がありません</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        gap: Spacing.xs,
    },
    searchInput: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.text,
        paddingVertical: Spacing.xs,
    },
    monthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: Spacing.sm,
        gap: Spacing.lg,
    },
    monthText: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.text,
    },
    list: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.xl,
    },
    txCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        marginBottom: Spacing.xs,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
    },
    txLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    txIcon: {
        width: 36,
        height: 36,
        borderRadius: Radius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    txInfo: {
        flex: 1,
    },
    txStore: {
        fontSize: FontSize.md,
        fontWeight: '500',
        color: Colors.text,
    },
    txDate: {
        fontSize: FontSize.xs,
        color: Colors.muted,
        marginTop: 2,
    },
    txAmount: {
        fontSize: FontSize.md,
        fontWeight: '600',
        marginLeft: Spacing.sm,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: FontSize.md,
        color: Colors.muted,
        marginTop: Spacing.sm,
    },
});
