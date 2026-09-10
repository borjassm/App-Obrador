import { Stack } from 'expo-router';

// Plan por equipos (bloque C): equipos → fase (hornear/amasar) + lugar
export default function PlanningLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[teamId]" />
    </Stack>
  );
}
