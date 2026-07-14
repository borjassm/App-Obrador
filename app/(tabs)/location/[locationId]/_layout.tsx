import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { Colors, Fonts, TABLET_BREAKPOINT } from '@/constants/theme';
import { getLocationDisplay } from '@/constants/locations';
import { supabase } from '@/lib/supabase';

export default function LocationLayout() {
  const { locationId } = useLocalSearchParams<{ locationId: string }>();
  const [locationName, setLocationName] = useState('');
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  useEffect(() => {
    if (!locationId) return;
    supabase
      .from('locations')
      .select('name')
      .eq('id', locationId)
      .single()
      .then(({ data }) => {
        if (data) setLocationName(data.name);
      });
  }, [locationId]);

  const display = getLocationDisplay(locationName);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgBase },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontFamily: Fonts.extraBold },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: locationName ? display.shortName : 'Ubicación',
        }}
      />
      <Stack.Screen
        name="close"
        options={{
          title: 'Sobrantes del día',
          // En tablet el master-detail lleva su propia cabecera en el panel izquierdo
          headerShown: !isTablet,
        }}
      />
      <Stack.Screen
        name="product/[productId]"
        options={{
          title: 'Producto',
          presentation: 'modal',
          // La pantalla móvil 1h lleva su propia top bar (back circular + contador + chip)
          headerShown: false,
        }}
      />
    </Stack>
  );
}
