import { useState } from 'react';
import { Alert, Button, Text, TextInput } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/Screen';
import { authService } from '@/services/auth.service';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onLogin = async () => {
    const { error } = await authService.signIn(email.trim(), password);
    if (error) {
      Alert.alert('Login error', error.message);
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <Text style={{ fontSize: 26, fontWeight: '700' }}>App Obrador</Text>
      <Text>Tablet-first para cierre diario y control operativo.</Text>
      <TextInput style={{ backgroundColor: '#fff', padding: 12 }} placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <TextInput style={{ backgroundColor: '#fff', padding: 12 }} placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title="Entrar" onPress={onLogin} />
    </Screen>
  );
}
