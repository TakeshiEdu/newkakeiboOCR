/**
 * ホーム画面 — 今月の状況
 * サマリカード + 簡易グラフ2つ + 直近5件トランザクション + FAB
 */
import Colors from '@/constants/Colors';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useDatabase } from '@/hooks/useDatabase';
import { getCategoryIcon } from '@/lib/category-utils';
import { CategorySummary, MonthlySummary, Transaction } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const { transactionRepo, isReady } = useDatabase();

  const [summary, setSummary] = useState<MonthlySummary>({
    month: '',
    totalExpense: 0,
    totalIncome: 0,
    balance: 0,
  });
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
  const [weeklyExpenses, setWeeklyExpenses] = useState<number[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  const loadData = useCallback(async () => {
    if (!isReady || !transactionRepo) return;
    try {
      const [sum, recent, catSum, dailySum, balance] = await Promise.all([
        transactionRepo.getMonthlySummary(currentMonth),
        transactionRepo.getRecent(5),
        transactionRepo.getCategorySummary(currentMonth),
        transactionRepo.getDailySummary(currentMonth),
        transactionRepo.getTotalBalance(),
      ]);
      setSummary(sum);
      setRecentTx(recent);
      setCategorySummary(catSum.slice(0, 5)); // 上位5カテゴリ
      setTotalBalance(balance);

      // 直近7日間の支出推移を計算
      const today = new Date();
      const last7: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayData = dailySum.find((ds) => ds.date === dateStr);
        last7.push(dayData?.expense || 0);
      }
      setWeeklyExpenses(last7);
    } catch (error) {
      console.error('Failed to load home data:', error);
    }
  }, [isReady, transactionRepo, currentMonth]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatAmount = (amount: number) => {
    const abs = Math.abs(amount);
    return abs.toLocaleString();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // 直近7日のラベル
  const getWeekLabels = () => {
    const labels: string[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }
    return labels;
  };

  const weekLabels = getWeekLabels();
  const maxWeekly = Math.max(...weeklyExpenses, 1);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 月表示ヘッダ */}
        <View style={styles.monthHeader}>
          <Text style={styles.monthText}>
            {new Date().getFullYear()}年{new Date().getMonth() + 1}月
          </Text>
        </View>

        {/* サマリカード */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.expenseCard]}>
            <Text style={styles.summaryLabel}>支出</Text>
            <Text style={[styles.summaryAmount, { color: Colors.expense }]}>
              -{formatAmount(summary.totalExpense)}円
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.incomeCard]}>
            <Text style={styles.summaryLabel}>収入</Text>
            <Text style={[styles.summaryAmount, { color: Colors.income }]}>
              +{formatAmount(summary.totalIncome)}円
            </Text>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>総資産</Text>
          <Text style={styles.balanceAmount}>
            {totalBalance >= 0 ? '+' : ''}{formatAmount(totalBalance)}円
          </Text>
        </View>

        {/* 簡易グラフ 1: 直近7日間の支出推移 */}
        <View style={styles.miniChartCard}>
          <View style={styles.miniChartHeader}>
            <Text style={styles.miniChartTitle}>直近7日間の支出</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/analyze')}>
              <Text style={styles.seeAll}>詳しく</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.barChartContainer}>
            {weeklyExpenses.map((exp, i) => (
              <View key={i} style={styles.barColumn}>
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.miniBar,
                      {
                        height: `${Math.max((exp / maxWeekly) * 100, 2)}%`,
                        backgroundColor:
                          i === 6 ? Colors.primary : Colors.primary + '60',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{weekLabels[i].split('/')[1]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 簡易グラフ 2: カテゴリ別支出 TOP5 */}
        <View style={styles.miniChartCard}>
          <View style={styles.miniChartHeader}>
            <Text style={styles.miniChartTitle}>カテゴリ別TOP5</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/analyze')}>
              <Text style={styles.seeAll}>詳しく</Text>
            </TouchableOpacity>
          </View>
          {categorySummary.length === 0 ? (
            <Text style={styles.noDataText}>データがありません</Text>
          ) : (
            categorySummary.map((cat) => (
              <View key={cat.categoryId} style={styles.miniCategoryRow}>
                <View
                  style={[
                    styles.miniCategoryIcon,
                    { backgroundColor: cat.categoryColor + '20' },
                  ]}
                >
                  <Ionicons
                    name={getCategoryIcon(cat.categoryId) as any}
                    size={12}
                    color={cat.categoryColor}
                  />
                </View>
                <Text style={styles.miniCategoryName}>{cat.categoryName}</Text>
                <View style={styles.miniBarBg}>
                  <View
                    style={[
                      styles.miniCategoryBar,
                      {
                        width: `${cat.percentage}%`,
                        backgroundColor: cat.categoryColor,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.miniCategoryAmount}>
                  {formatAmount(cat.total)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* 直近トランザクション（5件） */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>最近の取引</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
            <Text style={styles.seeAll}>すべて見る</Text>
          </TouchableOpacity>
        </View>

        {recentTx.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={Colors.muted} />
            <Text style={styles.emptyText}>取引がありません</Text>
            <Text style={styles.emptySubText}>
              右下の ＋ ボタンから記録を始めましょう
            </Text>
          </View>
        ) : (
          recentTx.map((tx) => (
            <TouchableOpacity
              key={tx.id}
              style={styles.txCard}
              onPress={() => router.push(`/transaction/${tx.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.txLeft}>
                <View
                  style={[
                    styles.txIcon,
                    {
                      backgroundColor:
                        tx.type === 'expense'
                          ? Colors.expense + '15'
                          : Colors.income + '15',
                    },
                  ]}
                >
                  <Ionicons
                    name={tx.type === 'expense' ? 'arrow-down' : 'arrow-up'}
                    size={18}
                    color={tx.type === 'expense' ? Colors.expense : Colors.income}
                  />
                </View>
                <View>
                  <Text style={styles.txStore}>
                    {tx.store || tx.memo || '取引'}
                  </Text>
                  <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  {
                    color:
                      tx.type === 'expense' ? Colors.expense : Colors.income,
                  },
                ]}
              >
                {tx.type === 'expense' ? '-' : '+'}
                {formatAmount(tx.amount)}円
              </Text>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* カメラFAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          router.push('/camera');
        }}
        activeOpacity={0.85}
      >
        <Ionicons
          name="camera"
          size={28}
          color={Colors.onPrimary}
        />
      </TouchableOpacity>
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
  monthHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  monthText: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  summaryCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  expenseCard: {},
  incomeCard: {},
  summaryLabel: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginBottom: Spacing.xxs,
  },
  summaryAmount: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  balanceCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary + '0A',
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  balanceLabel: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginBottom: Spacing.xxs,
  },
  balanceAmount: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.primary,
  },
  // 簡易グラフ共通
  miniChartCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
  },
  miniChartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  miniChartTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  noDataText: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  // 7日間バーチャート
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
    gap: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    width: '100%',
    height: 60,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  miniBar: {
    width: '60%',
    borderRadius: 3,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 9,
    color: Colors.muted,
    marginTop: 4,
  },
  // カテゴリ別ミニグラフ
  miniCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  miniCategoryIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCategoryName: {
    fontSize: FontSize.xs,
    color: Colors.text,
    width: 48,
  },
  miniBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.divider,
    borderRadius: 3,
  },
  miniCategoryBar: {
    height: 6,
    borderRadius: 3,
  },
  miniCategoryAmount: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    width: 52,
    textAlign: 'right',
  },
  // セクション
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  seeAll: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.muted,
    marginTop: Spacing.sm,
  },
  emptySubText: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: Spacing.xxs,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
