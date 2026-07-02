import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import Button from '@/components/Button';
import ConfirmSheet from '@/components/ConfirmSheet';
import ProductCard from '@/components/ProductCard';
import ProgressPill from '@/components/ProgressPill';
import SectionHeader from '@/components/SectionHeader';
import { Screen } from '@/components/Screen';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useProductEntries } from '@/hooks/useProductEntries';

export default function SobrantesScreen() {
  const { locationId } = useLocalSearchParams<{ locationId: string }>();
  const {
    sessionStatus,
    groups,
    entries,
    loading,
    totalSobrantes,
    totalDescartado,
    filledCount,
    totalCount,
    closeDay,
  } = useProductEntries(locationId ?? '');

  const [showConfirm, setShowConfirm] = useState(false);

  const isClosed = sessionStatus === 'closed';

  const handleClose = async () => {
    setShowConfirm(false);
    const { error } = await closeDay();
    if (error) {
      Alert.alert('Error', String(error));
    } else {
      Alert.alert('✅ Registro guardado', `${totalSobrantes} uds guardadas · ${totalDescartado} uds tiradas, en ${filledCount} productos`);
      router.back();
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Cargando productos…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scrollable>
      {/* Progress header */}
      <View style={styles.progressHeader}>
        <ProgressPill current={filledCount} total={totalCount} />
        {!isClosed && (
          <Text style={styles.hint}>Toca cada producto para registrar sobrantes</Text>
        )}
      </View>

      {/* Product groups */}
      {groups.map((group) => (
        <View key={group.family} style={styles.group}>
          <SectionHeader
            title={group.family.charAt(0).toUpperCase() + group.family.slice(1)}
            family={group.family}
          />
          <View style={styles.productList}>
            {group.products.map((product) => {
              const entry = entries.get(product.id);
              return (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  family={product.family}
                  savedQty={entry?.savedQty}
                  discardedQty={entry?.discardedQty}
                  onPress={() =>
                    router.push(`/(tabs)/location/${locationId}/product/${product.id}`)
                  }
                />
              );
            })}
          </View>
        </View>
      ))}

      {/* Finalize button */}
      {!isClosed && totalCount > 0 && (
        <View style={styles.footer}>
          <Button
            title={`Finalizar registro (${filledCount}/${totalCount})`}
            onPress={() => setShowConfirm(true)}
          />
        </View>
      )}

      {/* Confirm sheet */}
      <ConfirmSheet
        visible={showConfirm}
        title="¿Finalizar sobrantes?"
        message="Esto marcará el día como completo. Podrás ver el resumen después."
        summary={[
          { label: 'Productos registrados', value: `${filledCount} de ${totalCount}` },
          { label: 'Total guardado', value: `${totalSobrantes} uds`, color: Colors.primary },
          { label: 'Total tirado (merma)', value: `${totalDescartado} uds`, color: Colors.danger },
        ]}
        confirmLabel="Finalizar"
        onConfirm={handleClose}
        onCancel={() => setShowConfirm(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  progressHeader: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  group: {
    marginBottom: Spacing.xl,
  },
  productList: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  footer: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
});
