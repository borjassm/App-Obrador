import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import Card from '@/components/Card';
import { Colors, Fonts, Radius, Spacing, Typography, getFamilyColor } from '@/constants/theme';

interface Props {
  name: string;
  family: string;
  savedQty?: number;
  discardedQty?: number;
  /** Ítem activo en el master-detail (fondo tint + borde primary + icono edit) */
  selected?: boolean;
  onPress: () => void;
}

export default function ProductCard({ name, family, savedQty, discardedQty, selected, onPress }: Props) {
  const familyColor = getFamilyColor(family);
  const saved = savedQty ?? 0;
  const discarded = discardedQty ?? 0;
  const hasData = saved > 0 || discarded > 0;

  return (
    <Card
      onPress={onPress}
      shadow="sm"
      style={{ ...styles.card, ...(selected ? styles.cardSelected : null) }}
    >
      <View style={[styles.familyBar, { backgroundColor: familyColor }]} />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.family}>
          {family.charAt(0).toUpperCase() + family.slice(1)}
        </Text>
      </View>

      {hasData ? (
        <View style={styles.status}>
          <MaterialIcons name="check" size={16} color={Colors.success} />
          <Text style={styles.statusDone}>{saved} · {discarded}</Text>
        </View>
      ) : (
        <Text style={styles.pending}>Pendiente</Text>
      )}

      {selected && (
        <MaterialIcons name="edit" size={18} color={Colors.primary} style={styles.editIcon} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  cardSelected: {
    backgroundColor: Colors.primaryTint,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  familyBar: {
    width: 8,
    height: 36,
    borderRadius: Radius.full,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  family: {
    ...Typography.meta,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusDone: {
    fontFamily: Fonts.extraBold,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.success,
    fontVariant: ['tabular-nums'],
  },
  pending: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textMuted,
  },
  editIcon: {
    marginLeft: Spacing.xs,
  },
});
