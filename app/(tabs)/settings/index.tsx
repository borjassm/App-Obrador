import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

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
        <Text style={styles.title}>Ajustes</Text>
      </View>

      {/* User info */}
      <Text style={styles.sectionLabel}>Cuenta</Text>
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

      {/* Datos */}
      <Text style={styles.sectionLabel}>Datos</Text>
      <Card style={styles.dataCard} onPress={() => router.push('/(tabs)/import-erp')}>
        <View style={styles.dataIconTile}>
          <MaterialIcons name="upload-file" size={24} color={Colors.primary} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userEmail}>Importar ventas del ERP</Text>
          <Text style={styles.userRole}>Carga las exportaciones CSV para alimentar la analítica y las predicciones</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
      </Card>
      <Card style={styles.dataCard} onPress={() => router.push('/(tabs)/costes')}>
        <View style={styles.dataIconTile}>
          <MaterialIcons name="euro" size={24} color={Colors.primary} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userEmail}>Costes y márgenes</Text>
          <Text style={styles.userRole}>Precio, coste unitario y margen por producto · importación CSV/Excel</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
      </Card>
      <Card style={styles.dataCard} onPress={() => router.push('/(tabs)/ventas')}>
        <View style={styles.dataIconTile}>
          <MaterialIcons name="point-of-sale" size={24} color={Colors.primary} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userEmail}>Ventas por periodo</Text>
          <Text style={styles.userRole}>Último día, semana, mes, año o todo el historial · por ubicación</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
      </Card>

      {/* App info */}
      <Text style={styles.sectionLabel}>Aplicación</Text>
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
        <MaterialIcons name="logout" size={20} color={Colors.danger} />
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
  sectionLabel: {
    ...Typography.sectionLabel,
    marginBottom: Spacing.sm,
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
  dataCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  dataIconTile: {
    width: 46,
    height: 46,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  logoutPressed: {
    opacity: 0.8,
  },
  logoutText: {
    ...Typography.labelLarge,
    color: Colors.danger,
  },
});
