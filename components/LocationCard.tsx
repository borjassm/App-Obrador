import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import Card from '@/components/Card';
import ProgressPill from '@/components/ProgressPill';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { getLocationDisplay } from '@/constants/locations';

export type LocationStatus = 'none' | 'open' | 'closed';

interface Props {
  locationName: string;
  status: LocationStatus;
  entryCount: number;
  totalProducts: number;
  onPress: () => void;
  /** Layout tablet (1b): padding 28, icon-tile 52, nombre 19/800 */
  tablet?: boolean;
  /** Variante móvil compacta (1g): solo cabecera + chip de estado */
  compact?: boolean;
}

interface ChipSpec {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  bg: string;
  color: string;
}

const STATUS_CHIP: Record<LocationStatus, ChipSpec> = {
  closed: { label: 'Registrado', icon: 'check-circle', bg: Colors.successLight, color: Colors.success },
  open: { label: 'En curso', icon: 'schedule', bg: Colors.warningLight, color: Colors.warning },
  none: { label: 'Pendiente', icon: 'schedule', bg: Colors.borderLight, color: Colors.textSecondary },
};

function formatLocationName(name: string): string {
  return name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export default function LocationCard({
  locationName,
  status,
  entryCount,
  totalProducts,
  onPress,
  tablet,
  compact,
}: Props) {
  const display = getLocationDisplay(locationName);
  const chip = STATUS_CHIP[status];
  const isClosed = status === 'closed';

  const subtitle = display.description
    ? display.description.toLowerCase().startsWith(display.shortName.toLowerCase())
      ? display.description
      : `${display.shortName} · ${display.description}`
    : display.shortName;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : null)}>
      <Card style={StyleSheet.flatten([styles.card, tablet && styles.cardTablet])}>
        <View style={styles.headerRow}>
          <View style={styles.identity}>
            <View
              style={[
                styles.iconTile,
                tablet && styles.iconTileTablet,
                { backgroundColor: display.tint },
              ]}
            >
              <MaterialIcons name={display.icon} size={tablet ? 26 : 23} color={display.color} />
            </View>
            <View style={styles.nameBlock}>
              <Text style={[styles.name, tablet && styles.nameTablet]} numberOfLines={1}>
                {formatLocationName(locationName)}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </View>
          <View style={[styles.chip, { backgroundColor: chip.bg }]}>
            <MaterialIcons name={chip.icon} size={14} color={chip.color} />
            <Text style={[styles.chipLabel, { color: chip.color }]}>{chip.label}</Text>
          </View>
        </View>

        {!compact && (
          <>
            <ProgressPill current={entryCount} total={totalProducts} />
            <View
              style={[
                styles.cta,
                tablet && styles.ctaTablet,
                isClosed ? styles.ctaSecondary : styles.ctaPrimary,
              ]}
            >
              <Text style={[styles.ctaLabel, isClosed ? styles.ctaLabelSecondary : styles.ctaLabelPrimary]}>
                {isClosed ? 'Ver resumen del día' : 'Continuar registro'}
              </Text>
              {!isClosed && (
                <MaterialIcons name="arrow-forward" size={20} color={Colors.textOnPrimary} />
              )}
            </View>
          </>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  card: {
    borderRadius: Radius.xl,
    padding: 22,
    gap: Spacing.lg,
  },
  cardTablet: {
    padding: 28,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 1,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileTablet: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
  },
  nameBlock: {
    gap: 2,
    flexShrink: 1,
  },
  name: {
    ...Typography.headingMedium,
    color: Colors.textPrimary,
  },
  nameTablet: {
    ...Typography.headingLarge,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
  },
  chipLabel: {
    fontFamily: Fonts.extraBold,
    fontSize: 12,
    lineHeight: 16,
  },
  cta: {
    minHeight: 56,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  ctaTablet: {
    minHeight: 58,
  },
  ctaPrimary: {
    backgroundColor: Colors.primary,
    ...Shadows.cta,
  },
  ctaSecondary: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  ctaLabel: {
    ...Typography.labelLarge,
  },
  ctaLabelPrimary: {
    color: Colors.textOnPrimary,
  },
  ctaLabelSecondary: {
    color: Colors.textSecondary,
  },
});
