import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { getLocationDisplay } from '@/constants/locations';
import { supabase } from '@/lib/supabase';
import { useTeamWorklist, type WorklistRow } from '@/hooks/useTeamWorklist';

function formatShortEs(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function parseQty(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  const n = parseFloat(clean);
  return Number.isNaN(n) || n < 0 ? null : n;
}

export default function TeamWorklistScreen() {
  const { teamId, locationId } = useLocalSearchParams<{ teamId: string; locationId: string }>();
  const [teamName, setTeamName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());

  const {
    todayISO,
    loading,
    saving,
    todayRows,
    tomorrowPlanned,
    setProduced,
    setComment,
    saveNow,
    refresh,
  } = useTeamWorklist(teamId ?? '', locationId ?? '');

  useEffect(() => {
    if (!teamId || !locationId) return;
    supabase.from('production_teams').select('name').eq('id', teamId).single()
      .then(({ data }) => data && setTeamName(data.name));
    supabase.from('locations').select('name').eq('id', locationId).single()
      .then(({ data }) => data && setLocationName(data.name));
  }, [teamId, locationId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const toggleComment = (itemId: string) => {
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const display = getLocationDisplay(locationName);
  const plannedRows = todayRows.filter((r) => r.plannedQty != null && r.plannedQty > 0);
  const otherRows = todayRows.filter((r) => r.plannedQty == null || r.plannedQty === 0);
  const producedCount = todayRows.filter((r) => r.producedQty != null).length;

  const renderRow = (row: WorklistRow) => {
    const { item } = row;
    const showComment = openComments.has(item.id);
    const hasComment = row.comment.trim().length > 0;

    return (
      <View key={item.id} style={styles.rowCard}>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rowMeta}>
              {item.itemType === 'tarea' ? 'tarea · ' : ''}
              {row.plannedQty != null ? `plan: ${row.plannedQty} ${item.unit}` : 'sin plan'}
            </Text>
          </View>

          <Pressable
            onPress={() => toggleComment(item.id)}
            hitSlop={8}
            style={({ pressed }) => [styles.commentBtn, pressed && styles.pressed]}
            accessibilityLabel={`Comentario de ${item.name}`}
          >
            <MaterialIcons
              name={hasComment ? 'chat-bubble' : 'chat-bubble-outline'}
              size={20}
              color={hasComment ? Colors.secondary : Colors.textMuted}
            />
          </Pressable>

          <View style={styles.qtyWrap}>
            <TextInput
              value={row.producedQty != null ? String(row.producedQty) : ''}
              onChangeText={(t) => setProduced(item.id, parseQty(t))}
              onBlur={() => saveNow(item.id)}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={Colors.textMuted}
              style={styles.qtyInput}
            />
            <Text style={styles.qtyUnit}>{item.unit}</Text>
          </View>
        </View>

        {showComment && (
          <TextInput
            value={row.comment}
            onChangeText={(t) => setComment(item.id, t)}
            onBlur={() => saveNow(item.id)}
            placeholder="Comentario: qué ha pasado, por qué no se llegó al plan…"
            placeholderTextColor={Colors.textMuted}
            style={styles.commentInput}
            multiline
          />
        )}
      </View>
    );
  };

  return (
    <Screen scrollable>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.topText}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {teamName || 'Equipo'} · {display.shortName || ''}
          </Text>
          <Text style={styles.topSubtitle}>{formatShortEs(todayISO)}</Text>
        </View>
        <View style={[styles.saveChip, { backgroundColor: saving ? Colors.borderLight : Colors.successLight }]}>
          <MaterialIcons
            name={saving ? 'cloud-upload' : 'cloud-done'}
            size={15}
            color={saving ? Colors.textSecondary : Colors.success}
          />
          <Text style={[styles.saveChipText, { color: saving ? Colors.textSecondary : Colors.success }]}>
            {saving ? 'Guardando…' : 'Al día'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
          <Text style={styles.stateText}>Cargando la hoja de trabajo…</Text>
        </View>
      ) : todayRows.length === 0 ? (
        <View style={styles.stateBox}>
          <MaterialIcons name="pending-actions" size={48} color={Colors.textMuted} />
          <Text style={styles.stateText}>Este equipo no tiene productos en este lugar.</Text>
        </View>
      ) : (
        <>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {producedCount}/{todayRows.length} apuntados
            </Text>
            <Text style={styles.progressHint}>El plan se actualiza solo si el admin lo cambia</Text>
          </View>

          {plannedRows.length > 0 && (
            <>
              <SectionHeader title="Producción de hoy" count={plannedRows.length} color={Colors.primary} />
              <View style={styles.list}>{plannedRows.map(renderRow)}</View>
            </>
          )}

          {otherRows.length > 0 && (
            <>
              <SectionHeader title="Sin plan asignado hoy" count={otherRows.length} />
              <View style={styles.list}>{otherRows.map(renderRow)}</View>
            </>
          )}

          {tomorrowPlanned.length > 0 && (
            <>
              <SectionHeader
                title="Preparar / amasar para mañana"
                count={tomorrowPlanned.length}
                color={Colors.secondary}
              />
              <View style={styles.list}>
                {tomorrowPlanned.map(({ item, plannedQty }) => (
                  <View key={item.id} style={styles.tomorrowRow}>
                    <Text style={styles.tomorrowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.tomorrowQty}>
                      {plannedQty} {item.unit}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.bottomPad} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topText: {
    flex: 1,
    gap: 2,
  },
  topTitle: {
    ...Typography.headingLarge,
    color: Colors.textPrimary,
  },
  topSubtitle: {
    ...Typography.meta,
    textTransform: 'capitalize',
  },
  saveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  saveChipText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  stateBox: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
  },
  stateText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  progressText: {
    ...Typography.labelMedium,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  progressHint: {
    ...Typography.meta,
    flexShrink: 1,
    textAlign: 'right',
  },
  list: {
    gap: Spacing.sm,
  },
  rowCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
  },
  rowMeta: {
    ...Typography.meta,
    fontVariant: ['tabular-nums'],
  },
  commentBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  qtyInput: {
    width: 76,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.sm,
    textAlign: 'right',
    fontFamily: Fonts.extraBold,
    fontSize: 17,
    color: Colors.textPrimary,
  },
  qtyUnit: {
    ...Typography.meta,
    width: 52,
  },
  commentInput: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.bgBase,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },
  tomorrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    minHeight: 48,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg,
  },
  tomorrowName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  tomorrowQty: {
    ...Typography.numberSmall,
    color: Colors.secondary,
  },
  bottomPad: {
    height: Spacing.xxl,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
