/**
 * カメラ（OCR/撮影） — Scene: CameraScreen
 *
 * レシート撮影 → OCR 実行 → 明細確認画面へ遷移
 * - ガイド枠（角丸）オーバーレイ
 * - フラッシュトグル
 * - シャッターボタン
 * - 撮影後プレビュー → OCR実行 → receipt-confirm へ遷移
 */
import React, { useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Image,
    Alert,
    StatusBar,
    Dimensions,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions, FlashMode } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { recognizeText } from '@/lib/ocr/receipt-scanner';
import { parseReceipt } from '@/lib/ocr/receipt-parser';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GUIDE_PADDING = 32;
const GUIDE_WIDTH = SCREEN_WIDTH - GUIDE_PADDING * 2;
const GUIDE_HEIGHT = GUIDE_WIDTH * 1.5; // レシートの典型的な縦横比

type ProcessingState = 'idle' | 'capturing' | 'preview' | 'processing';

export default function CameraScreen() {
    const cameraRef = useRef<CameraView>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [flash, setFlash] = useState<FlashMode>('off');
    const [state, setState] = useState<ProcessingState>('idle');
    const [capturedUri, setCapturedUri] = useState<string | null>(null);

    // カメラ権限の確認
    if (!permission) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Ionicons name="camera-outline" size={64} color={Colors.muted} />
                <Text style={styles.permissionTitle}>カメラの使用許可が必要です</Text>
                <Text style={styles.permissionDesc}>
                    レシートを撮影して家計簿に記録するために、{'\n'}カメラへのアクセスを許可してください。
                </Text>
                <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                    <Text style={styles.permissionButtonText}>カメラを許可する</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>戻る</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleCapture = async () => {
        if (!cameraRef.current || state !== 'idle') return;

        setState('capturing');
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.85,
                skipProcessing: false,
            });
            if (photo?.uri) {
                setCapturedUri(photo.uri);
                setState('preview');
            } else {
                setState('idle');
                Alert.alert('エラー', '撮影に失敗しました。もう一度お試しください。');
            }
        } catch (error) {
            console.error('[Camera] 撮影エラー:', error);
            setState('idle');
            Alert.alert('エラー', '撮影に失敗しました。');
        }
    };

    const handleRetake = () => {
        setCapturedUri(null);
        setState('idle');
    };

    const handleProcessOcr = async () => {
        if (!capturedUri) return;

        setState('processing');
        try {
            // OCR実行
            const ocrResult = await recognizeText(capturedUri);

            if (!ocrResult.fullText.trim()) {
                Alert.alert(
                    'テキストが検出されませんでした',
                    'レシートをもう一度撮影してください。明るい場所で、レシート全体が枠内に収まるようにしてください。',
                    [{ text: '再撮影', onPress: handleRetake }],
                );
                return;
            }

            // レシート解析
            const parsed = parseReceipt(ocrResult);

            // 明細確認画面へ遷移（パラメータで渡す）
            router.replace({
                pathname: '/receipt-confirm' as any,
                params: {
                    data: JSON.stringify(parsed),
                    imageUri: capturedUri,
                },
            });
        } catch (error) {
            console.error('[Camera] OCRエラー:', error);
            Alert.alert(
                'OCR処理に失敗しました',
                '画像の読み取りに失敗しました。再度お試しください。',
                [
                    { text: '再撮影', onPress: handleRetake },
                    { text: '戻る', onPress: () => router.back() },
                ],
            );
        }
    };

    const toggleFlash = () => {
        setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
    };

    // ── プレビュー表示 ──
    if (state === 'preview' || state === 'processing') {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <Image source={{ uri: capturedUri! }} style={styles.previewImage} />

                {/* OCR処理中オーバーレイ */}
                {state === 'processing' && (
                    <View style={styles.processingOverlay}>
                        <View style={styles.processingCard}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                            <Text style={styles.processingText}>レシートを読み取り中...</Text>
                            <Text style={styles.processingSubText}>
                                テキストを認識して明細を解析しています
                            </Text>
                        </View>
                    </View>
                )}

                {/* プレビュー操作ボタン */}
                {state === 'preview' && (
                    <View style={styles.previewActions}>
                        <TouchableOpacity
                            style={styles.previewButtonSecondary}
                            onPress={handleRetake}
                        >
                            <Ionicons name="refresh" size={24} color={Colors.text} />
                            <Text style={styles.previewButtonSecondaryText}>再撮影</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.previewButtonPrimary}
                            onPress={handleProcessOcr}
                        >
                            <Ionicons name="document-text" size={24} color={Colors.onPrimary} />
                            <Text style={styles.previewButtonPrimaryText}>明細を読み取る</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 閉じるボタン */}
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="close" size={28} color="#FFF" />
                </TouchableOpacity>
            </View>
        );
    }

    // ── カメラビュー ──
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                flash={flash}
            >
                {/* ガイド枠オーバーレイ */}
                <View style={styles.overlay}>
                    {/* 上部コントロール */}
                    <View style={styles.topControls}>
                        <TouchableOpacity
                            style={styles.controlButton}
                            onPress={() => router.back()}
                        >
                            <Ionicons name="close" size={28} color="#FFF" />
                        </TouchableOpacity>

                        <Text style={styles.headerTitle}>レシート撮影</Text>

                        <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
                            <Ionicons
                                name={flash === 'on' ? 'flash' : 'flash-off'}
                                size={24}
                                color="#FFF"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* ガイド枠 */}
                    <View style={styles.guideContainer}>
                        <View style={styles.guideFrame}>
                            {/* 4隅のマーカー */}
                            <View style={[styles.corner, styles.cornerTL]} />
                            <View style={[styles.corner, styles.cornerTR]} />
                            <View style={[styles.corner, styles.cornerBL]} />
                            <View style={[styles.corner, styles.cornerBR]} />
                        </View>
                        <Text style={styles.guideText}>
                            レシートを枠内に合わせてください
                        </Text>
                    </View>

                    {/* 下部コントロール */}
                    <View style={styles.bottomControls}>
                        <Text style={styles.tipText}>
                            💡 明るい場所で、レシート全体が映るように撮影
                        </Text>

                        {/* シャッターボタン */}
                        <TouchableOpacity
                            style={styles.shutterButton}
                            onPress={handleCapture}
                            activeOpacity={0.7}
                            disabled={state === 'capturing'}
                        >
                            {state === 'capturing' ? (
                                <ActivityIndicator size="small" color={Colors.primary} />
                            ) : (
                                <View style={styles.shutterInner} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </CameraView>
        </View>
    );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        justifyContent: 'space-between',
    },

    // ── 上部コントロール ──
    topControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 16,
    },
    controlButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '600',
    },

    // ── ガイド枠 ──
    guideContainer: {
        alignItems: 'center',
    },
    guideFrame: {
        width: GUIDE_WIDTH,
        height: GUIDE_HEIGHT,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.5)',
        borderRadius: 12,
        position: 'relative',
    },
    guideText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        marginTop: 12,
        textAlign: 'center',
    },

    // ── 4隅マーカー ──
    corner: {
        position: 'absolute',
        width: CORNER_SIZE,
        height: CORNER_SIZE,
    },
    cornerTL: {
        top: -1,
        left: -1,
        borderTopWidth: CORNER_THICKNESS,
        borderLeftWidth: CORNER_THICKNESS,
        borderTopColor: '#FFF',
        borderLeftColor: '#FFF',
        borderTopLeftRadius: 12,
    },
    cornerTR: {
        top: -1,
        right: -1,
        borderTopWidth: CORNER_THICKNESS,
        borderRightWidth: CORNER_THICKNESS,
        borderTopColor: '#FFF',
        borderRightColor: '#FFF',
        borderTopRightRadius: 12,
    },
    cornerBL: {
        bottom: -1,
        left: -1,
        borderBottomWidth: CORNER_THICKNESS,
        borderLeftWidth: CORNER_THICKNESS,
        borderBottomColor: '#FFF',
        borderLeftColor: '#FFF',
        borderBottomLeftRadius: 12,
    },
    cornerBR: {
        bottom: -1,
        right: -1,
        borderBottomWidth: CORNER_THICKNESS,
        borderRightWidth: CORNER_THICKNESS,
        borderBottomColor: '#FFF',
        borderRightColor: '#FFF',
        borderBottomRightRadius: 12,
    },

    // ── 下部コントロール ──
    bottomControls: {
        alignItems: 'center',
        paddingBottom: 50,
    },
    tipText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        marginBottom: 24,
        textAlign: 'center',
    },
    shutterButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    shutterInner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#FFF',
        borderWidth: 2,
        borderColor: '#E0E0E0',
    },

    // ── プレビュー ──
    previewImage: {
        flex: 1,
        resizeMode: 'contain',
    },
    previewActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 24,
        paddingBottom: 50,
        paddingHorizontal: 24,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    previewButtonSecondary: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        backgroundColor: '#FFF',
        gap: 8,
    },
    previewButtonSecondaryText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    previewButtonPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        gap: 8,
    },
    previewButtonPrimaryText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.onPrimary,
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        left: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── OCR処理中 ──
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
        marginHorizontal: 40,
        gap: 12,
    },
    processingText: {
        fontSize: 17,
        fontWeight: '600',
        color: Colors.text,
    },
    processingSubText: {
        fontSize: 14,
        color: Colors.muted,
        textAlign: 'center',
    },

    // ── 権限未許可 ──
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 32,
        gap: 12,
    },
    permissionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text,
        marginTop: 16,
    },
    permissionDesc: {
        fontSize: 15,
        color: Colors.muted,
        textAlign: 'center',
        lineHeight: 22,
    },
    permissionButton: {
        marginTop: 16,
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
    },
    permissionButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    backButton: {
        marginTop: 8,
        paddingVertical: 10,
    },
    backButtonText: {
        color: Colors.primary,
        fontSize: 15,
    },
});
