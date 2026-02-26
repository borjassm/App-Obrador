import { Text } from 'react-native';

import { Screen } from '@/components/Screen';
import { PRODUCTION_TEAMS } from '@/features/catalog/defaultData';

export default function PlanningTab() {
  return (
    <Screen>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Planificación (día anterior)</Text>
      <Text>Equipos nave: {PRODUCTION_TEAMS.join(', ')}.</Text>
      <Text>Base semanal + ajuste diario por ventas, merma y estacionalidad.</Text>
    </Screen>
  );
}
