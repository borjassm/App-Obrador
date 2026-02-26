import { Alert, Button, Text } from 'react-native';

import { Screen } from '@/components/Screen';
import { authService } from '@/services/auth.service';

export default function SettingsTab() {
  const logout = async () => {
    const { error } = await authService.signOut();
    if (error) Alert.alert('Error', error.message);
  };

  return (
    <Screen>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Ajustes</Text>
      <Button title="Cerrar sesión" onPress={logout} />
    </Screen>
  );
}
