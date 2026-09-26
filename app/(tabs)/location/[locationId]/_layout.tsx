import { Stack } from 'expo-router';

// Registro de sobrantes de una ubicación: una sola pantalla con su propia
// cabecera (Inicio → "Continuar registro" entra directo aquí)
export default function LocationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="close" />
    </Stack>
  );
}
