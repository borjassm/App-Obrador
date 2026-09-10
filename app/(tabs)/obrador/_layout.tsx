import { Stack } from 'expo-router';

// Obrador por equipos (bloque C) + envíos entre lugares (bloque D)
export default function ObradorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="envios/index" />
      <Stack.Screen name="envios/nuevo" />
      <Stack.Screen name="envios/[shipmentId]" />
      <Stack.Screen name="[teamId]/index" />
      <Stack.Screen name="[teamId]/[locationId]" />
    </Stack>
  );
}
