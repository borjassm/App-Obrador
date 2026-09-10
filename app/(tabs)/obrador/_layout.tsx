import { Stack } from 'expo-router';

// Obrador por equipos (bloque C): equipos → lugar → hoja de trabajo del día
export default function ObradorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[teamId]/index" />
      <Stack.Screen name="[teamId]/[locationId]" />
    </Stack>
  );
}
