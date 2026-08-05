import type { ReactNode } from 'react';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import { Colors, Fonts, Radius, TABLET_BREAKPOINT } from '@/constants/theme';
import { useRole } from '@/hooks/useRole';
import { useSession } from '@/hooks/useSession';

// Pestañas visibles para el rol empleado (usuario genérico del obrador):
// registra el día a día y consulta el plan; sin ventas, analítica ni costes
const EMPLOYEE_TABS = new Set(['index', 'obrador', 'planning/index', 'settings/index']);

type TabIcon = {
  label: string;
  render: (color: string, size: number) => ReactNode;
};

const TAB_ICONS: Record<string, TabIcon> = {
  index: {
    label: 'Inicio',
    render: (color, size) => <MaterialIcons name="home" size={size} color={color} />,
  },
  obrador: {
    label: 'Obrador',
    render: (color, size) => <MaterialCommunityIcons name="stove" size={size} color={color} />,
  },
  'ventas/index': {
    label: 'Ventas',
    render: (color, size) => <MaterialIcons name="point-of-sale" size={size} color={color} />,
  },
  'dashboard/index': {
    label: 'Analítica',
    render: (color, size) => <MaterialIcons name="insert-chart" size={size} color={color} />,
  },
  'planning/index': {
    label: 'Plan',
    render: (color, size) => <MaterialIcons name="event-note" size={size} color={color} />,
  },
  'costes/index': {
    label: 'Costes',
    render: (color, size) => <MaterialIcons name="euro" size={size} color={color} />,
  },
  // Ajustes no va en la barra móvil (avatar de Inicio); en tablet, pie del rail
  'settings/index': {
    label: 'Ajustes',
    render: (color, size) => <MaterialIcons name="settings" size={size} color={color} />,
  },
};

function useTabItems({ state, navigation }: BottomTabBarProps) {
  const { isAdmin } = useRole();
  return state.routes
    .filter((route) => TAB_ICONS[route.name])
    .filter((route) => isAdmin || EMPLOYEE_TABS.has(route.name))
    .map((route) => {
      const focused = state.routes[state.index]?.key === route.key;
      const onPress = () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!focused && !event.defaultPrevented) {
          navigation.navigate(route.name as never);
        }
      };
      return { key: route.key, name: route.name, focused, onPress, ...TAB_ICONS[route.name] };
    });
}

function userInitials(email?: string): string {
  const name = email?.split('@')[0] ?? '';
  return name.slice(0, 2).toUpperCase() || '?';
}

/** Rail lateral izquierdo (tablet >= 768px) */
function SideRail(props: BottomTabBarProps) {
  const items = useTabItems(props);
  const { session } = useSession();
  const mainItems = items.filter((item) => item.name !== 'settings/index');
  const settingsItem = items.find((item) => item.name === 'settings/index');

  return (
    <View style={[styles.rail, { paddingTop: props.insets.top + 20, paddingBottom: props.insets.bottom + 20 }]}>
      <View style={styles.railLogo}>
        <MaterialCommunityIcons name="bread-slice-outline" size={24} color={Colors.textOnPrimary} />
      </View>

      <View style={styles.railItems}>
        {mainItems.map((item) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.railItem,
              item.focused && styles.railItemActive,
              pressed && styles.pressed,
            ]}
          >
            {item.render(item.focused ? Colors.primary : Colors.textMuted, 23)}
            <Text style={[styles.railLabel, item.focused && styles.railLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.railFooter}>
        {settingsItem ? (
          <Pressable
            onPress={settingsItem.onPress}
            style={({ pressed }) => [
              styles.railItem,
              settingsItem.focused && styles.railItemActive,
              pressed && styles.pressed,
            ]}
          >
            {settingsItem.render(settingsItem.focused ? Colors.primary : Colors.textMuted, 23)}
            <Text style={[styles.railLabel, settingsItem.focused && styles.railLabelActive]}>
              {settingsItem.label}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userInitials(session?.user?.email)}</Text>
        </View>
      </View>
    </View>
  );
}

/** Tab bar inferior (móvil < 768px). Ajustes queda fuera (avatar de Inicio). */
function MobileTabBar(props: BottomTabBarProps) {
  const items = useTabItems(props).filter((item) => item.name !== 'settings/index');

  return (
    <View style={[styles.tabBar, { paddingBottom: props.insets.bottom + 8 }]}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={item.onPress}
          style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}
        >
          {item.render(item.focused ? Colors.primary : Colors.textMuted, 24)}
          <Text style={[styles.tabLabel, item.focused && styles.tabLabelActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  return (
    <Tabs
      tabBar={(props) => (isTablet ? <SideRail {...props} /> : <MobileTabBar {...props} />)}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isTablet ? 'left' : 'bottom',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="obrador" options={{ title: 'Obrador' }} />
      <Tabs.Screen name="ventas/index" options={{ title: 'Ventas' }} />
      <Tabs.Screen name="dashboard/index" options={{ title: 'Analítica' }} />
      <Tabs.Screen name="planning/index" options={{ title: 'Plan' }} />
      <Tabs.Screen name="costes/index" options={{ title: 'Costes' }} />
      <Tabs.Screen name="settings/index" options={{ title: 'Ajustes' }} />

      {/* Hide location routes from tab bar — accessed via navigation */}
      <Tabs.Screen name="location/[locationId]" options={{ href: null }} />

      {/* Hidden utility routes */}
      <Tabs.Screen name="import-erp" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // ---- Rail lateral (tablet) ----
  rail: {
    width: 92,
    backgroundColor: Colors.bgCard,
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
    alignItems: 'center',
  },
  railLogo: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  railItems: {
    flex: 1,
    gap: 8,
    alignItems: 'center',
  },
  railItem: {
    width: 66,
    height: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  railItemActive: {
    backgroundColor: Colors.primaryTint,
  },
  railLabel: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: Colors.textMuted,
  },
  railLabelActive: {
    color: Colors.primary,
  },
  railFooter: {
    gap: 16,
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.extraBold,
    fontSize: 14,
    color: Colors.textOnPrimary,
  },

  // ---- Tab bar inferior (móvil) ----
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabLabel: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
});
