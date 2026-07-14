import 'react-native-gesture-handler';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';

import { Colors, Radius } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <View style={styles.splashTile}>
        <MaterialCommunityIcons name="bread-slice-outline" size={28} color={Colors.textOnPrimary} />
      </View>
      <Text style={styles.splashTitle}>Obrador</Text>
      <ActivityIndicator color={Colors.secondaryLight} size="small" style={styles.spinner} />
    </View>
  );
}

export default function RootLayout() {
  const { session, loading } = useSession();
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (loading || !fontsLoaded) return <SplashScreen />;

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
  splashTile: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El splash se pinta antes de cargar Manrope → fuente de sistema
  splashTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Colors.textOnDark,
  },
  spinner: {
    marginTop: 24,
  },
});
