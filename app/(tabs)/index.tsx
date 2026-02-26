import { Text } from 'react-native';

import { Screen } from '@/components/Screen';

export default function HomeTab() {
  return (
    <Screen>
      <Text style={{ fontSize: 24, fontWeight: '700' }}>OK: estoy renderizando</Text>
      <Text>Ubicaciones reales: LOS URQUIZA 17 (nave) y SANTA FELICIANA 10 (tienda).</Text>
      <Text>Nota: leftovers se registran principalmente en SANTA FELICIANA 10.</Text>
    </Screen>
  );
}
