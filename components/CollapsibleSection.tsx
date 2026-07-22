import { ReactNode } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors, Fonts, Radius, Spacing, Typography, getFamilyColor } from '@/constants/theme';

// Animación de expandir/colapsar en Android (LayoutAnimation es experimental ahí)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Llamar justo antes de cambiar el estado expandido/colapsado
export function configureCollapseAnimation() {
  LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
}

interface Props {
  title: string;
  // Barra de acento: color de familia si se pasa `family`, o `color` explícito
  family?: string;
  color?: string;
  // Texto a la derecha (p. ej. "registrados 3/12" o "12 prod · 340 uds");
  // con metaDone se pinta en verde con check (sección completa)
  meta?: string;
  metaDone?: boolean;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

// Sección colapsable del rediseño v1 (cabecera card con barra de color de
// familia + chevron). El estado expandido lo gestiona el padre.
export default function CollapsibleSection({
  title,
  family,
  color,
  meta,
  metaDone,
  expanded,
  onToggle,
  children,
}: Props) {
  const accent = color ?? (family ? getFamilyColor(family) : Colors.primaryLight);

  return (
    <View style={styles.group}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={meta ? `${title}, ${meta}` : title}
      >
        <View style={[styles.bar, { backgroundColor: accent }]} />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {(meta !== undefined || metaDone) && (
          <View style={styles.status}>
            {metaDone && <MaterialIcons name="check-circle" size={16} color={Colors.success} />}
            {meta !== undefined && (
              <Text style={[styles.statusText, metaDone && styles.statusDone]}>{meta}</Text>
            )}
          </View>
        )}
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={24}
          color={Colors.textSecondary}
        />
      </Pressable>
      {expanded && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  headerPressed: {
    opacity: 0.85,
  },
  bar: {
    width: 8,
    height: 28,
    borderRadius: Radius.full,
  },
  title: {
    ...Typography.headingSmall,
    color: Colors.textPrimary,
    textTransform: 'capitalize',
    flex: 1,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusText: {
    ...Typography.meta,
    fontVariant: ['tabular-nums'],
  },
  statusDone: {
    color: Colors.success,
    fontFamily: Fonts.bold,
  },
  content: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
});
