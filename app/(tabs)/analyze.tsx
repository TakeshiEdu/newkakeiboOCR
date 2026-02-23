/**
 * 分析画面（グラフ + カレンダー切替）
 * カテゴリ別集計バーチャート + 収支カレンダー
 */
import Colors from '@/constants/Colors';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useDatabase } from '@/hooks/useDatabase';
import { getCategoryIcon } from '@/lib/category-utils';
import { CategorySummary, MonthlySummary } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

type ViewMode = 'chart' | 'calendar';

interface DailySummary {
    date: string;
    expense: number;
    income: number;
}

export default function AnalyzeScreen() {
    const { transactionRepo, isReady } = useDatabase();

    const [viewMode, setViewMode] = useState<ViewMode>('chart');
    const [selectedMonth, setSelectedMonth] = useState(
        new Date().toISOString().slice(0, 7)
    );
    const [summary, setSummary] = useState<MonthlySummary>({
        month: '',
        totalExpense: 0,
        totalIncome: 0,
        balance: 0,
    });
    const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
    const [dailySummary, setDailySummary] = useState<DailySummary[]>([]);

    const loadData = useCallback(async () => {
        if (!isReady || !transactionRepo) return;
        try {
            const [sum, catSum, daySum] = await Promise.all([
                transactionRepo.getMonthlySummary(selectedMonth),
                transactionRepo.getCategorySummary(selectedMonth),
                transactionRepo.getDailySummary(selectedMonth),
            ]);
            setSummary(sum);
            setCategorySummary(catSum);
            setDailySummary(daySum);
        } catch (error) {
            console.error('Failed to load analyze data:', error);
        }
    }, [isReady, transactionRepo, selectedMonth]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const changeMonth = (delta: number) => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const d = new Date(year, month - 1 + delta, 1);
        setSelectedMonth(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        );
    };

    const formatAmount = (amount: number) => Math.abs(amount).toLocaleString();

    // カレンダー用のグリッド生成
    const generateCalendarGrid = () => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1).getDay(); // 0=日
        const daysInMonth = new Date(year, month, 0).getDate();

        const dailyMap = new Map<number, DailySummary>();
        dailySummary.forEach((d) => {
            const day = new Date(d.date).getDate();
            dailyMap.set(day, d);
        });

        const cells: { day: number; data: DailySummary | null }[] = [];

        // 空白セル（月初の曜日分）
        for (let i = 0; i < firstDay; i++) {
            cells.push({ day: 0, data: null });
        }

        // 日付セル
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ day: d, data: dailyMap.get(d) || null });
        }

        return cells;
    };

    const calendarCells = generateCalendarGrid();

    return (
        <ScrollView style={styles.container}>
            {/* 月選択 */}
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

            {/* セグメントコントロール */}
            <View style={styles.segmentControl}>
                <TouchableOpacity
                    style={[
                        styles.segmentButton,
                        viewMode === 'chart' && styles.segmentActive,
                    ]}
                    onPress={() => setViewMode('chart')}
                >
                    <Ionicons
                        name="pie-chart"
                        size={16}
                        color={viewMode === 'chart' ? Colors.onPrimary : Colors.muted}
                    />
                    <Text
                        style={[
                            styles.segmentText,
                            viewMode === 'chart' && styles.segmentTextActive,
                        ]}
                    >
                        グラフ
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.segmentButton,
                        viewMode === 'calendar' && styles.segmentActive,
                    ]}
                    onPress={() => setViewMode('calendar')}
                >
                    <Ionicons
                        name="calendar"
                        size={16}
                        color={viewMode === 'calendar' ? Colors.onPrimary : Colors.muted}
                    />
                    <Text
                        style={[
                            styles.segmentText,
                            viewMode === 'calendar' && styles.segmentTextActive,
                        ]}
                    >
                        カレンダー
                    </Text>
                </TouchableOpacity>
            </View>

            {viewMode === 'chart' ? (
                <>
                    {/* 月次サマリ */}
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>支出</Text>
                                <Text style={[styles.summaryValue, { color: Colors.expense }]}>
                                    -{formatAmount(summary.totalExpense)}円
                                </Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>収入</Text>
                                <Text style={[styles.summaryValue, { color: Colors.income }]}>
                                    +{formatAmount(summary.totalIncome)}円
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* カテゴリ別バーチャート */}
                    <View style={styles.chartSection}>
                        <Text style={styles.chartTitle}>カテゴリ別支出</Text>
                        {categorySummary.length === 0 ? (
                            <View style={styles.emptyChart}>
                                <Ionicons name="bar-chart-outline" size={48} color={Colors.muted} />
                                <Text style={styles.emptyChartText}>データがありません</Text>
                            </View>
                        ) : (
                            categorySummary.map((cat) => (
                                <View key={cat.categoryId} style={styles.categoryRow}>
                                    <View style={styles.categoryInfo}>
                                        <View
                                            style={[
                                                styles.categoryIconBadge,
                                                { backgroundColor: cat.categoryColor + '20' },
                                            ]}
                                        >
                                            <Ionicons
                                                name={getCategoryIcon(cat.categoryId) as any}
                                                size={14}
                                                color={cat.categoryColor}
                                            />
                                        </View>
                                        <Text style={styles.categoryName}>{cat.categoryName}</Text>
                                        <Text style={styles.categoryPercentage}>
                                            {cat.percentage}%
                                        </Text>
                                    </View>
                                    <View style={styles.barContainer}>
                                        <View
                                            style={[
                                                styles.bar,
                                                {
                                                    width: `${cat.percentage}%`,
                                                    backgroundColor: cat.categoryColor,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.categoryAmount}>
                                        {formatAmount(cat.total)}円
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>
                </>
            ) : (
                /* カレンダー表示 */
                <View style={styles.calendarSection}>
                    {/* 月合計 */}
                    <View style={styles.calendarSummary}>
                        <View style={styles.calendarSummaryItem}>
                            <Text style={styles.calendarSummaryLabel}>支出</Text>
                            <Text style={[styles.calendarSummaryValue, { color: Colors.expense }]}>
                                -{formatAmount(summary.totalExpense)}円
                            </Text>
                        </View>
                        <View style={styles.calendarSummaryItem}>
                            <Text style={styles.calendarSummaryLabel}>収入</Text>
                            <Text style={[styles.calendarSummaryValue, { color: Colors.income }]}>
                                +{formatAmount(summary.totalIncome)}円
                            </Text>
                        </View>
                    </View>

                    {/* 曜日ヘッダ */}
                    <View style={styles.dayNamesRow}>
                        {DAY_NAMES.map((name, i) => (
                            <View key={i} style={styles.dayNameCell}>
                                <Text
                                    style={[
                                        styles.dayNameText,
                                        i === 0 && { color: Colors.expense },
                                        i === 6 && { color: Colors.primary },
                                    ]}
                                >
                                    {name}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* カレンダーグリッド */}
                    <View style={styles.calendarGrid}>
                        {calendarCells.map((cell, index) => (
                            <View
                                key={index}
                                style={styles.calendarCell}
                            >
                                {cell.day > 0 && (
                                    <>
                                        <Text style={styles.calendarDay}>{cell.day}</Text>
                                        {cell.data && cell.data.expense > 0 && (
                                            <Text style={styles.calendarExpense}>
                                                -{cell.data.expense > 9999
                                                    ? `${(cell.data.expense / 10000).toFixed(1)}万`
                                                    : cell.data.expense.toLocaleString()}
                                            </Text>
                                        )}
                                        {cell.data && cell.data.income > 0 && (
                                            <Text style={styles.calendarIncome}>
                                                +{cell.data.income > 9999
                                                    ? `${(cell.data.income / 10000).toFixed(1)}万`
                                                    : cell.data.income.toLocaleString()}
                                            </Text>
                                        )}
                                    </>
                                )}
                            </View>
                        ))}
                    </View>
                </View>
            )}

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg,
    },
    monthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        gap: Spacing.lg,
    },
    monthText: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.text,
    },
    segmentControl: {
        flexDirection: 'row',
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        padding: 3,
    },
    segmentButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.xs,
        borderRadius: Radius.md,
        gap: Spacing.xxs,
    },
    segmentActive: {
        backgroundColor: Colors.primary,
    },
    segmentText: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        color: Colors.muted,
    },
    segmentTextActive: {
        color: Colors.onPrimary,
    },
    summaryCard: {
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        padding: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        height: 40,
        backgroundColor: Colors.divider,
    },
    summaryLabel: {
        fontSize: FontSize.sm,
        color: Colors.muted,
        marginBottom: Spacing.xxs,
    },
    summaryValue: {
        fontSize: FontSize.lg,
        fontWeight: '700',
    },
    chartSection: {
        marginHorizontal: Spacing.md,
        padding: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
    },
    chartTitle: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: Spacing.md,
    },
    emptyChart: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    emptyChartText: {
        fontSize: FontSize.sm,
        color: Colors.muted,
        marginTop: Spacing.sm,
    },
    categoryRow: {
        marginBottom: Spacing.md,
    },
    categoryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xxs,
    },
    categoryIconBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.xs,
    },
    categoryName: {
        fontSize: FontSize.sm,
        color: Colors.text,
        flex: 1,
    },
    categoryPercentage: {
        fontSize: FontSize.xs,
        color: Colors.muted,
    },
    barContainer: {
        height: 8,
        backgroundColor: Colors.divider,
        borderRadius: 4,
        marginBottom: Spacing.xxs,
    },
    bar: {
        height: 8,
        borderRadius: 4,
    },
    categoryAmount: {
        fontSize: FontSize.xs,
        color: Colors.muted,
        textAlign: 'right',
    },
    // カレンダー
    calendarSection: {
        marginHorizontal: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        padding: Spacing.sm,
    },
    calendarSummary: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: Spacing.sm,
        marginBottom: Spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    calendarSummaryItem: {
        alignItems: 'center',
    },
    calendarSummaryLabel: {
        fontSize: FontSize.xs,
        color: Colors.muted,
    },
    calendarSummaryValue: {
        fontSize: FontSize.md,
        fontWeight: '700',
        marginTop: 2,
    },
    dayNamesRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingBottom: Spacing.xxs,
    },
    dayNameCell: {
        width: '14.28%',
        alignItems: 'center',
        paddingVertical: 4,
    },
    dayNameText: {
        fontSize: FontSize.xs,
        fontWeight: '600',
        color: Colors.muted,
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    calendarCell: {
        width: '14.28%',
        minHeight: 52,
        paddingVertical: 2,
        borderTopWidth: 0.5,
        borderTopColor: Colors.divider,
        alignItems: 'center',
    },
    calendarDay: {
        fontSize: FontSize.xs,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 1,
    },
    calendarExpense: {
        fontSize: 9,
        color: Colors.expense,
        fontWeight: '500',
    },
    calendarIncome: {
        fontSize: 9,
        color: Colors.income,
        fontWeight: '500',
    },
});
