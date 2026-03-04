import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';
import { authService } from '@/services/auth.service';

export default function SettingsTab() {
  const { session } = useSession();
  const userEmail = session?.user?.email ?? 'Usuario';

  const logout = async () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            const { error } = await authService.signOut();
            if (error) Alert.alert('Error', error.message);
          },
        },
      ]
    );
  };

  return (
    <Screen scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Ajustes</Text>
      </View>

      {/* User info */}
      <Card style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {userEmail.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userEmail}>{userEmail}</Text>
          <Text style={styles.userRole}>Operador</Text>
        </View>
      </Card>

      {/* App info */}
      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Versión</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>SDK</Text>
          <Text style={styles.infoValue}>Expo 54</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Backend</Text>
          <Text style={styles.infoValue}>Supabase</Text>
        </View>
      </Card>

      {/* Logout */}
      <Pressable
        onPress={logout}
        style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutPressed]}
      >
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.headingLarge,
    color: Colors.textOnPrimary,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userEmail: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  userRole: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  infoCard: {
    gap: 0,
    marginBottom: Spacing.xxl,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  infoLabel: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  infoValue: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  logoutBtn: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  logoutPressed: {
    opacity: 0.8,
  },
  logoutText: {
    ...Typography.labelLarge,
    color: Colors.danger,
  },
});
