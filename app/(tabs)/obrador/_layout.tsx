import { Stack } from 'expo-router';

// Grupo Obrador: menú + Producción diaria (el stock se retiró a petición del
// cliente; sus datos siguen en BD por si vuelve en el futuro)
export default function ObradorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="production" />
    </Stack>
  );
}
