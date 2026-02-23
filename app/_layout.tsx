import { DatabaseProvider } from '@/hooks/useDatabase';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

export {
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const ONBOARDING_KEY = 'kakeibo_onboarding_done';

// Google ライトテーマ風のナビゲーションテーマ
const KakeiboTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1A73E8',
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#202124',
    border: '#E0E0E0',
    notification: '#EA4335',
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // オンボーディング完了チェック
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((value: string | null) => {
      setNeedsOnboarding(value !== 'true');
      setOnboardingChecked(true);
    });
  }, []);

  useEffect(() => {
    if (loaded && onboardingChecked) {
      SplashScreen.hideAsync();
    }
  }, [loaded, onboardingChecked]);

  if (!loaded || !onboardingChecked) {
    return null;
  }

  return (
    <DatabaseProvider>
      <ThemeProvider value={KakeiboTheme}>
        <Stack
          screenOptions={{ animation: 'fade' }}
          initialRouteName={needsOnboarding ? 'onboarding' : '(tabs)'}
        >
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="chat-input"
            options={{
              title: '入力',
              presentation: 'modal',
              headerStyle: { backgroundColor: '#FFFFFF' },
              headerTintColor: '#1A73E8',
            }}
          />
          <Stack.Screen
            name="transaction/[id]"
            options={{
              title: '取引詳細',
              headerStyle: { backgroundColor: '#FFFFFF' },
              headerTintColor: '#1A73E8',
            }}
          />
          <Stack.Screen
            name="categories"
            options={{
              title: 'カテゴリ編集',
              headerStyle: { backgroundColor: '#FFFFFF' },
              headerTintColor: '#1A73E8',
            }}
          />
          <Stack.Screen
            name="camera"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="receipt-confirm"
            options={{
              title: '明細確認',
              headerStyle: { backgroundColor: '#FFFFFF' },
              headerTintColor: '#1A73E8',
            }}
          />
        </Stack>
      </ThemeProvider>
    </DatabaseProvider>
  );
}
