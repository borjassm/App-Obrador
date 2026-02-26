import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="close/index" options={{ title: 'Cierre diario' }} />
      <Tabs.Screen name="dashboard/index" options={{ title: 'Analítica' }} />
      <Tabs.Screen name="planning/index" options={{ title: 'Planificación' }} />
      <Tabs.Screen name="settings/index" options={{ title: 'Ajustes' }} />
    </Tabs>
  );
}
