/**
 * オンボーディング画面
 * 初回起動時にアプリの使い方を案内
 */
import Colors from '@/constants/Colors';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

const ONBOARDING_KEY = 'kakeibo_onboarding_done';

interface Slide {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    title: string;
    description: string;
}

const slides: Slide[] = [
    {
        id: '1',
        icon: 'chatbubbles',
        iconColor: '#1A73E8',
        title: 'チャットで記録',
        description:
            '「コンビニ500円」と入力するだけ。\n金額・カテゴリを自動で認識します。',
    },
    {
        id: '2',
        icon: 'pie-chart',
        iconColor: '#34A853',
        title: '支出を見える化',
        description:
            'カテゴリ別のグラフで\nお金の流れが一目でわかります。',
    },
    {
        id: '3',
        icon: 'school',
        iconColor: '#FBBC04',
        title: '使うほど賢くなる',
        description:
            'カテゴリの修正を学習して\n次回からもっと正確に分類します。',
    },
    {
        id: '4',
        icon: 'shield-checkmark',
        iconColor: '#EA4335',
        title: '完全オフライン',
        description:
            'データはすべて端末内に保存。\nネットワーク不要で安心です。',
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleComplete = async () => {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        router.replace('/(tabs)');
    };

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
            setCurrentIndex(currentIndex + 1);
        } else {
            handleComplete();
        }
    };

    const handleSkip = () => {
        handleComplete();
    };

    const renderSlide = ({ item }: { item: Slide }) => (
        <View style={[styles.slide, { width }]}>
            <View style={[styles.iconContainer, { backgroundColor: item.iconColor + '15' }]}>
                <Ionicons name={item.icon} size={64} color={item.iconColor} />
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideDescription}>{item.description}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* スキップボタン */}
            {currentIndex < slides.length - 1 && (
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={styles.skipText}>スキップ</Text>
                </TouchableOpacity>
            )}

            {/* スライド一覧 */}
            <FlatList
                ref={flatListRef}
                data={slides}
                keyExtractor={(item) => item.id}
                renderItem={renderSlide}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(idx);
                }}
            />

            {/* ドットインジケータ */}
            <View style={styles.pagination}>
                {slides.map((_, index) => {
                    const inputRange = [
                        (index - 1) * width,
                        index * width,
                        (index + 1) * width,
                    ];
                    const dotWidth = scrollX.interpolate({
                        inputRange,
                        outputRange: [8, 24, 8],
                        extrapolate: 'clamp',
                    });
                    const opacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.3, 1, 0.3],
                        extrapolate: 'clamp',
                    });

                    return (
                        <Animated.View
                            key={index}
                            style={[
                                styles.dot,
                                { width: dotWidth, opacity, backgroundColor: Colors.primary },
                            ]}
                        />
                    );
                })}
            </View>

            {/* 次へ/始めるボタン */}
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>
                    {currentIndex === slides.length - 1 ? 'はじめる' : '次へ'}
                </Text>
                <Ionicons
                    name={
                        currentIndex === slides.length - 1
                            ? 'checkmark'
                            : 'arrow-forward'
                    }
                    size={20}
                    color={Colors.onPrimary}
                />
            </TouchableOpacity>
        </View>
    );
}

/** オンボーディング完了チェック */
export async function isOnboardingDone(): Promise<boolean> {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg,
    },
    skipButton: {
        position: 'absolute',
        top: 60,
        right: Spacing.lg,
        zIndex: 10,
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.sm,
    },
    skipText: {
        fontSize: FontSize.md,
        color: Colors.muted,
        fontWeight: '500',
    },
    slide: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    slideTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.text,
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    slideDescription: {
        fontSize: FontSize.md,
        color: Colors.muted,
        textAlign: 'center',
        lineHeight: 24,
    },
    pagination: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.lg,
        gap: 6,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: Spacing.xl,
        marginBottom: 50,
        paddingVertical: Spacing.md,
        backgroundColor: Colors.primary,
        borderRadius: Radius.lg,
        gap: Spacing.xs,
    },
    nextButtonText: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.onPrimary,
    },
});
