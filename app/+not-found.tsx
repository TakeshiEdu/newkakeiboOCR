/**
 * Not Found 画面
 * 存在しないルートにアクセスした際のフォールバック
 */
import Colors from '@/constants/Colors';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function NotFoundScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Ionicons name="alert-circle-outline" size={64} color={Colors.muted} />
            <Text style={styles.title}>ページが見つかりません</Text>
            <Text style={styles.description}>
                お探しのページは存在しないか、移動した可能性があります。
            </Text>
            <TouchableOpacity
                style={styles.button}
                onPress={() => router.replace('/(tabs)')}
                accessibilityRole="button"
                accessibilityLabel="ホームに戻る"
            >
                <Text style={styles.buttonText}>ホームに戻る</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.bg,
        padding: Spacing.xl,
    },
    title: {
        fontSize: FontSize.xl,
        fontWeight: '700',
        color: Colors.text,
        marginTop: Spacing.md,
    },
    description: {
        fontSize: FontSize.md,
        color: Colors.muted,
        textAlign: 'center',
        marginTop: Spacing.sm,
        lineHeight: 22,
    },
    button: {
        marginTop: Spacing.xl,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.xl,
        backgroundColor: Colors.primary,
        borderRadius: Radius.lg,
    },
    buttonText: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.onPrimary,
    },
});
