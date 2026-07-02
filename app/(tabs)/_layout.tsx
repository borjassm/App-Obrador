import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Colors, Typography } from '@/constants/theme';

const TAB_ICONS: Record<string, string> = {
  index: '🏠',
  'stock/index': '📦',
  'production/index': '🥖',
  'dashboard/index': '📊',
  'planning/index': '📋',
  'settings/index': '⚙️',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => (
          <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
            {TAB_ICONS[route.name] ?? '📄'}
          </Text>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="stock/index" options={{ title: 'Stock' }} />
      <Tabs.Screen name="production/index" options={{ title: 'Producción' }} />
      <Tabs.Screen name="dashboard/index" options={{ title: 'Analítica' }} />
      <Tabs.Screen name="planning/index" options={{ title: 'Planificación' }} />
      <Tabs.Screen name="settings/index" options={{ title: 'Ajustes' }} />

      {/* Hide location routes from tab bar — accessed via navigation */}
      <Tabs.Screen name="location/[locationId]" options={{ href: null }} />

      {/* Hidden utility routes */}
      <Tabs.Screen name="close/index" options={{ href: null }} />
      <Tabs.Screen name="import-erp" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.bgCard,
    borderTopColor: Colors.borderLight,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabLabel: {
    ...Typography.bodySmall,
    fontSize: 11,
    fontWeight: '600',
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
});
