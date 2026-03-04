import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Colors } from '@/constants/theme';
import { getLocationDisplay } from '@/constants/locations';
import { supabase } from '@/lib/supabase';

export default function LocationLayout() {
  const { locationId } = useLocalSearchParams<{ locationId: string }>();
  const [locationName, setLocationName] = useState('');

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
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: locationName ? `${display.emoji} ${display.shortName}` : 'Ubicación',
        }}
      />
      <Stack.Screen
        name="close"
        options={{
          title: 'Sobrantes del día',
        }}
      />
      <Stack.Screen
        name="product/[productId]"
        options={{
          title: 'Producto',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
