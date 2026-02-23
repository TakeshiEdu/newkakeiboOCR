/**
 * レシートOCRスキャナー
 *
 * react-native-mlkit-ocr を使用してレシート画像からテキストを抽出する。
 * オフライン（オンデバイス）で動作。
 */
import MlkitOcr from 'react-native-mlkit-ocr';
import type { OcrResult, OcrResultLine } from '@/types';

/**
 * 画像URIからOCRテキスト認識を実行する
 */
export async function recognizeText(imageUri: string): Promise<OcrResult> {
    try {
        const result = await MlkitOcr.detectFromUri(imageUri);

        const lines: OcrResultLine[] = result.map((block) => {
            // 各ブロックの行を結合
            const text = block.lines
                ? block.lines.map((line) => line.text).join('\n')
                : block.text;

            // bounding box
            const bounding = block.bounding;

            return {
                text: text.trim(),
                confidence: 0.8, // ML Kit on-device は固定デフォルト信頼度
                boundingBox: bounding
                    ? {
                        x: bounding.left ?? 0,
                        y: bounding.top ?? 0,
                        width: bounding.width ?? 0,
                        height: bounding.height ?? 0,
                    }
                    : undefined,
            };
        });

        // fullText は y 座標でソートしてから結合（上から下の順序を維持）
        const sortedLines = [...lines].sort((a, b) => {
            const ay = a.boundingBox?.y ?? 0;
            const by = b.boundingBox?.y ?? 0;
            return ay - by;
        });

        const fullText = sortedLines.map((l) => l.text).join('\n');

        return { lines: sortedLines, fullText };
    } catch (error) {
        console.error('[OCR] 認識エラー:', error);
        throw new Error('OCR認識に失敗しました。画像を確認してください。');
    }
}
