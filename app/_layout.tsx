import 'react-native-gesture-handler';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { Colors, Typography } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashEmoji}>🍞</Text>
      <Text style={styles.splashTitle}>App Obrador</Text>
      <ActivityIndicator color={Colors.primaryLight} size="small" style={styles.spinner} />
    </View>
  );
}

export default function RootLayout() {
  const { session, loading } = useSession();

  if (loading) return <SplashScreen />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  splashEmoji: {
    fontSize: 64,
  },
  splashTitle: {
    ...Typography.displayMedium,
    color: Colors.textOnDark,
  },
  spinner: {
    marginTop: 24,
  },
});
