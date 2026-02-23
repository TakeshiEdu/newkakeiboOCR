/**
 * 設定画面
 */
import Colors from '@/constants/Colors';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useDatabase } from '@/hooks/useDatabase';
import { generateBackupJSON, generateTransactionsCSV, writeExportFile } from '@/lib/export/exporter';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function SettingsScreen() {
    const router = useRouter();
    const { transactionRepo, isReady } = useDatabase();
    const [autoLearn, setAutoLearn] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [backingUp, setBackingUp] = useState(false);

    const handleExportCSV = useCallback(async () => {
        if (!isReady || !transactionRepo) return;
        setExporting(true);
        try {
            // 全トランザクションを取得
            const allMonths: string[] = [];
            const now = new Date();
            for (let i = 0; i < 12; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                allMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }

            const allTx = [];
            for (const m of allMonths) {
                const txs = await transactionRepo.getByMonth(m);
                allTx.push(...txs);
            }

            if (allTx.length === 0) {
                Alert.alert('エクスポート', 'エクスポートするデータがありません。');
                return;
            }

            const csv = generateTransactionsCSV(allTx);
            const filename = `kakeibo_${new Date().toISOString().slice(0, 10)}.csv`;
            const file = writeExportFile(filename, csv);

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(file.uri, {
                    mimeType: 'text/csv',
                    dialogTitle: 'CSVエクスポート',
                });
            } else {
                Alert.alert('完了', `ファイルを保存しました:\n${file.uri}`);
            }
        } catch (error) {
            console.error('Export failed:', error);
            Alert.alert('エラー', 'エクスポートに失敗しました。');
        } finally {
            setExporting(false);
        }
    }, [isReady, transactionRepo]);

    const handleBackup = useCallback(async () => {
        if (!isReady || !transactionRepo) return;
        setBackingUp(true);
        try {
            const [allTx, allItems] = await Promise.all([
                transactionRepo.getAll(),
                transactionRepo.getAllItems(),
            ]);

            if (allTx.length === 0) {
                Alert.alert('バックアップ', 'バックアップするデータがありません。');
                return;
            }

            const json = generateBackupJSON(allTx, allItems);
            const filename = `kakeibo_backup_${new Date().toISOString().slice(0, 10)}.json`;
            const file = writeExportFile(filename, json);

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(file.uri, {
                    mimeType: 'application/json',
                    dialogTitle: 'JSONバックアップ',
                });
            } else {
                Alert.alert('完了', `バックアップを保存しました:\n${file.uri}`);
            }
        } catch (error) {
            console.error('Backup failed:', error);
            Alert.alert('エラー', 'バックアップに失敗しました。');
        } finally {
            setBackingUp(false);
        }
    }, [isReady, transactionRepo]);

    return (
        <ScrollView style={styles.container}>
            {/* エクスポートセクション */}
            <Text style={styles.sectionTitle}>データ管理</Text>
            <View style={styles.section}>
                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleExportCSV}
                    disabled={exporting}
                >
                    <View style={styles.menuLeft}>
                        {exporting ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                            <Ionicons name="download-outline" size={22} color={Colors.primary} />
                        )}
                        <Text style={styles.menuText}>CSVエクスポート</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleBackup}
                    disabled={backingUp}
                >
                    <View style={styles.menuLeft}>
                        {backingUp ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                            <Ionicons name="cloud-upload-outline" size={22} color={Colors.primary} />
                        )}
                        <Text style={styles.menuText}>バックアップ</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
                </TouchableOpacity>
            </View>

            {/* 学習設定 */}
            <Text style={styles.sectionTitle}>学習設定</Text>
            <View style={styles.section}>
                <View style={styles.menuItem}>
                    <View style={styles.menuLeft}>
                        <Ionicons name="school-outline" size={22} color={Colors.primary} />
                        <View>
                            <Text style={styles.menuText}>自動学習</Text>
                            <Text style={styles.menuSubText}>
                                カテゴリ修正を次回以降に活用
                            </Text>
                        </View>
                    </View>
                    <Switch
                        value={autoLearn}
                        onValueChange={setAutoLearn}
                        trackColor={{ false: Colors.divider, true: Colors.primary + '60' }}
                        thumbColor={autoLearn ? Colors.primary : Colors.muted}
                    />
                </View>
            </View>

            {/* カテゴリ管理 */}
            <Text style={styles.sectionTitle}>カテゴリ管理</Text>
            <View style={styles.section}>
                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => router.push('/categories')}
                >
                    <View style={styles.menuLeft}>
                        <Ionicons name="pricetag-outline" size={22} color={Colors.primary} />
                        <Text style={styles.menuText}>カテゴリ編集</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
                </TouchableOpacity>
            </View>

            {/* アプリ情報 */}
            <Text style={styles.sectionTitle}>アプリ情報</Text>
            <View style={styles.section}>
                <View style={styles.menuItem}>
                    <View style={styles.menuLeft}>
                        <Ionicons name="information-circle-outline" size={22} color={Colors.muted} />
                        <Text style={styles.menuText}>バージョン</Text>
                    </View>
                    <Text style={styles.menuValue}>1.0.0</Text>
                </View>
            </View>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg,
    },
    sectionTitle: {
        fontSize: FontSize.xs,
        fontWeight: '600',
        color: Colors.muted,
        textTransform: 'uppercase',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xs,
    },
    section: {
        marginHorizontal: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
    },
    menuLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    menuText: {
        fontSize: FontSize.md,
        color: Colors.text,
        fontWeight: '500',
    },
    menuSubText: {
        fontSize: FontSize.xs,
        color: Colors.muted,
        marginTop: 2,
    },
    menuValue: {
        fontSize: FontSize.sm,
        color: Colors.muted,
    },
    menuDivider: {
        height: 1,
        backgroundColor: Colors.divider,
        marginLeft: Spacing.xl + Spacing.md,
    },
});
