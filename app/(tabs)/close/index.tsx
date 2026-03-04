import { useMemo } from 'react';
import { Alert, Button, ScrollView, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { useSession } from '@/hooks/useSession';
import { useCloseSessionForm } from '@/hooks/useCloseSessionForm';

export default function CloseDailyTab() {
  const { session } = useSession();
  const { date, setDate, locationId, setLocationId, locations, entries, updateQty, canSubmit, submit } = useCloseSessionForm();

  const selectedLocationName = useMemo(
    () => locations.find((x) => x.id === locationId)?.name ?? 'Sin ubicación',
    [locationId, locations]
  );

  const onSave = async () => {
    if (!session?.user.id) {
      Alert.alert('Sesión requerida');
      return;
    }

    const { error } = await submit(session.user.id);
    if (error) {
      Alert.alert('Error guardando cierre', String(error));
      return;
    }

    Alert.alert('Cierre guardado', `Ubicación: ${selectedLocationName} · Fecha: ${date}`);
  };

  return (
    <Screen>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Cierre diario por producto</Text>
      <Text>Uso principal: tienda SANTA FELICIANA 10 (leftovers).</Text>
      <TextInput value={date} onChangeText={setDate} style={{ backgroundColor: '#fff', padding: 12 }} placeholder="YYYY-MM-DD" />
      <ScrollView horizontal>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {locations.map((loc) => (
            <Button key={loc.id} title={loc.name} onPress={() => setLocationId(loc.id)} color={loc.id === locationId ? '#0f766e' : '#64748b'} />
          ))}
        </View>
      </ScrollView>
      <Text>Ubicación seleccionada: {selectedLocationName}</Text>
      <ScrollView>
        {entries.map((entry) => (
          <View key={entry.productId} style={{ backgroundColor: '#fff', padding: 10, marginBottom: 8 }}>
            <Text style={{ fontWeight: '700' }}>{entry.productName}</Text>
            <TextInput value={entry.savedQty} onChangeText={(v) => updateQty(entry.productId, 'savedQty', v)} keyboardType="numeric" placeholder="saved_qty" style={{ borderWidth: 1, borderColor: '#ddd', marginTop: 6, padding: 8 }} />
            <TextInput value={entry.discardedQty} onChangeText={(v) => updateQty(entry.productId, 'discardedQty', v)} keyboardType="numeric" placeholder="discarded_qty" style={{ borderWidth: 1, borderColor: '#ddd', marginTop: 6, padding: 8 }} />
          </View>
        ))}
      </ScrollView>
      <Button title="Guardar cierre diario" disabled={!canSubmit} onPress={onSave} />
    </Screen>
  );
}
