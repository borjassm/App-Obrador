import { Stack } from 'expo-router';

// Grupo Obrador: menú + Stock de materia prima/producto + Producción diaria
export default function ObradorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="stock" />
      <Stack.Screen name="production" />
    </Stack>
  );
}
