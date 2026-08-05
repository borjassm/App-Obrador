import { Stack } from 'expo-router';

// Obrador abre directamente en la producción diaria (petición del cliente).
// La estructura por equipos (Panadería, Pastelería, Laminado, Horno) llegará
// con el rediseño del bloque C.
export default function ObradorLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
