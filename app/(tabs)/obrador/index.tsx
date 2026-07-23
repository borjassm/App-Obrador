import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import Card from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

// Menú del área de Obrador: acceso a Stock y Producción diaria
export default function ObradorTab() {
  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Text style={styles.title}>Obrador</Text>
        <Text style={styles.subtitle}>Stock de materias primas y registro de producción</Text>
      </View>

      <Card style={styles.menuCard} onPress={() => router.push('/(tabs)/obrador/stock')}>
        <View style={[styles.iconTile, { backgroundColor: Colors.secondaryTint }]}>
          <MaterialIcons name="inventory-2" size={26} color={Colors.secondary} />
        </View>
        <View style={styles.menuInfo}>
          <Text style={styles.menuTitle}>Stock</Text>
          <Text style={styles.menuDetail}>
            Ingredientes y producto terminado · recuentos y avisos de mínimo
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={26} color={Colors.textMuted} />
      </Card>

      <Card style={styles.menuCard} onPress={() => router.push('/(tabs)/obrador/production')}>
        <View style={[styles.iconTile, { backgroundColor: Colors.primaryTint }]}>
          <MaterialCommunityIcons name="stove" size={26} color={Colors.primary} />
        </View>
        <View style={styles.menuInfo}>
          <Text style={styles.menuTitle}>Producción diaria</Text>
          <Text style={styles.menuDetail}>
            Registro de lo producido frente al plan del día
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={26} color={Colors.textMuted} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.xl,
    marginBottom: Spacing.xl,
    gap: 2,
  },
  title: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
  },
  menuDetail: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
});
