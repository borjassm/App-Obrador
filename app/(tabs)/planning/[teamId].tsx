import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import FilterPills from '@/components/FilterPills';
import { Screen } from '@/components/Screen';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { getLocationDisplay } from '@/constants/locations';
import { holidayAdjustmentFactor } from '@/features/planning/holidays';
import { addDays, isoLocal } from '@/features/planning/pipelineScheduler';
import { supabase } from '@/lib/supabase';
import { planningService } from '@/services/planning.service';
import { teamsService, type TeamItem } from '@/services/teams.service';
import { weatherAdjustmentFactor, weatherService } from '@/services/weather.service';

type Phase = 'hornear' | 'amasar';

const PHASE_OPTIONS = [
  { key: 'hornear', label: 'Hornear · hoy' },
  { key: 'amasar', label: 'Amasar · mañana' },
];

function parseQty(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  const n = parseFloat(clean);
  return Number.isNaN(n) || n < 0 ? null : n;
}

export default function TeamPlannerScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const [teamName, setTeamName] = useState('');
  const [items, setItems] = useState<TeamItem[]>([]);
  const [locations, setLocations] = useState<{ id: string; shortName: string }[]>([]);
  const [phase, setPhase] = useState<Phase>('hornear');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());
  const [suggestions, setSuggestions] = useState<Map<string, number>>(new Map());
  const [factorInfo, setFactorInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const todayISO = useMemo(() => isoLocal(new Date()), []);
  const targetDate = useMemo(
    () => (phase === 'hornear' ? todayISO : isoLocal(addDays(new Date(todayISO + 'T12:00:00'), 1))),
    [phase, todayISO]
  );

  // Equipo, items y lugares
  useEffect(() => {
    if (!teamId) return;
    (async () => {
      const { data: team } = await supabase
        .from('production_teams').select('name').eq('id', teamId).single();
      if (team) setTeamName(team.name);

      const teamItems = await teamsService.listItems(teamId);
      setItems(teamItems);

      const locationIds = [...new Set(teamItems.flatMap((i) => i.locationIds))];
      if (locationIds.length > 0) {
        const { data: locs } = await supabase
          .from('locations').select('id,name').in('id', locationIds).order('name');
        const options = (locs ?? []).map((l) => ({
          id: l.id,
          shortName: getLocationDisplay(l.name).shortName,
        }));
        setLocations(options);
        setLocationId((prev) => prev ?? options[0]?.id ?? null);
      }
      setLoading(false);
    })();
  }, [teamId]);

  const localItems = useMemo(
    () => (locationId ? items.filter((i) => i.locationIds.includes(locationId)) : []),
    [items, locationId]
  );

  // Sugerencias del motor para la fecha objetivo (con clima y festivos)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sugg, forecast] = await Promise.all([
        planningService.suggestions(targetDate),
        weatherService.getForecast(),
      ]);
      if (cancelled) return;
      const day = forecast.find((f) => f.date === targetDate);
      const wf = day ? weatherAdjustmentFactor(day.precipitation, day.tempMax) : 1;
      const holiday = holidayAdjustmentFactor(targetDate);
      const factor = wf * holiday.factor;

      const parts: string[] = [];
      if (wf !== 1) parts.push(`clima ×${wf.toLocaleString('es-ES')}`);
      if (holiday.factor !== 1) parts.push(`${holiday.reason} ×${holiday.factor.toLocaleString('es-ES')}`);
      setFactorInfo(parts.length > 0 ? parts.join(' · ') : null);

      const map = new Map<string, number>();
      for (const s of sugg) {
        map.set(s.product_id, Math.max(0, Math.round(s.suggested_qty * factor)));
      }
      setSuggestions(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetDate]);

  // Plan ya guardado para fecha+lugar
  const loadPlanned = useCallback(async () => {
    if (!locationId || localItems.length === 0) {
      setDrafts(new Map());
      return;
    }
    const entries = await teamsService.entriesFor(
      localItems.map((i) => i.id),
      locationId,
      [targetDate]
    );
    const next = new Map<string, string>();
    for (const item of localItems) {
      const entry = entries.get(teamsService.entryKey(item.id, locationId, targetDate));
      if (entry?.plannedQty != null) next.set(item.id, String(entry.plannedQty));
    }
    setDrafts(next);
    setSavedAt(null);
  }, [locationId, localItems, targetDate]);

  useEffect(() => {
    loadPlanned();
  }, [loadPlanned]);

  const setDraft = (itemId: string, value: string) => {
    setDrafts((prev) => new Map(prev).set(itemId, value));
  };

  const applySuggestions = () => {
    setDrafts((prev) => {
      const next = new Map(prev);
      for (const item of localItems) {
        const current = next.get(item.id);
        if (current && current.trim() !== '') continue;
        const sugg = item.productId ? suggestions.get(item.productId) : undefined;
        if (sugg != null && sugg > 0) next.set(item.id, String(sugg));
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!locationId) return;
    setSaving(true);
    const rows = localItems.map((item) => ({
      itemId: item.id,
      locationId,
      productionDate: targetDate,
      plannedQty: parseQty(drafts.get(item.id) ?? ''),
    }));
    const { error } = await teamsService.setPlanned(rows);
    if (!error) await teamsService.syncProductPlans(targetDate);
    setSaving(false);
    if (error) {
      Alert.alert('Error', 'No se pudo guardar el plan.');
    } else {
      setSavedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    }
  };

  const totalPlanned = localItems.reduce((sum, item) => {
    const v = parseQty(drafts.get(item.id) ?? '');
    return sum + (v ?? 0);
  }, 0);

  const dateLabel = new Date(targetDate + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen noPadding>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </Pressable>
          <View style={styles.topText}>
            <Text style={styles.topTitle}>Plan · {teamName || 'Equipo'}</Text>
            <Text style={styles.topSubtitle}>
              {dateLabel}
              {factorInfo ? ` · ${factorInfo}` : ''}
            </Text>
          </View>
        </View>

        <FilterPills options={PHASE_OPTIONS} selected={phase} onSelect={(k) => setPhase(k as Phase)} />
        {locations.length > 1 && locationId && (
          <FilterPills
            options={locations.map((l) => ({ key: l.id, label: l.shortName }))}
            selected={locationId}
            onSelect={setLocationId}
          />
        )}

        {loading ? (
          <View style={styles.stateBox}>
            <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
          </View>
        ) : localItems.length === 0 ? (
          <View style={styles.stateBox}>
            <MaterialIcons name="pending-actions" size={48} color={Colors.textMuted} />
            <Text style={styles.stateText}>Este equipo no tiene items en este lugar.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            <View style={styles.listHeader}>
              <Text style={styles.listHint}>
                El número queda visible al equipo en Obrador al guardar
              </Text>
              <Pressable
                onPress={applySuggestions}
                style={({ pressed }) => [styles.suggestBtn, pressed && styles.pressed]}
              >
                <MaterialIcons name="auto-awesome" size={16} color={Colors.primary} />
                <Text style={styles.suggestBtnText}>Rellenar con sugerencias</Text>
              </Pressable>
            </View>

            {localItems.map((item) => {
              const sugg = item.productId ? suggestions.get(item.productId) : undefined;
              return (
                <View key={item.id} style={styles.rowCard}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.rowMeta}>
                      {item.itemType === 'tarea' ? 'tarea · ' : ''}
                      {sugg != null ? `sugerido: ${sugg} ${item.unit}` : `sin sugerencia · ${item.unit}`}
                    </Text>
                  </View>
                  <TextInput
                    value={drafts.get(item.id) ?? ''}
                    onChangeText={(t) => setDraft(item.id, t)}
                    keyboardType="decimal-pad"
                    placeholder={sugg != null ? String(sugg) : '—'}
                    placeholderTextColor={Colors.textMuted}
                    style={styles.qtyInput}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {!loading && localItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <Text style={styles.totalLine}>
              {totalPlanned.toLocaleString('es-ES')} uds planificadas
            </Text>
            {savedAt && (
              <View style={styles.savedChip}>
                <MaterialIcons name="cloud-done" size={14} color={Colors.success} />
                <Text style={styles.savedChipText}>Guardado a las {savedAt}</Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [styles.saveCta, pressed && styles.pressed, saving && styles.disabled]}
          >
            <MaterialIcons name="save" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.saveCtaText}>{saving ? 'Guardando…' : 'Guardar plan'}</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    marginBottom: Spacing.sm,
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
  stateBox: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  stateText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  listHint: {
    ...Typography.meta,
    flexShrink: 1,
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  suggestBtnText: {
    ...Typography.labelMedium,
    fontSize: 13,
    color: Colors.primary,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
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
  qtyInput: {
    width: 84,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  footerInfo: {
    flex: 1,
    minWidth: 180,
    gap: 3,
  },
  totalLine: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedChipText: {
    ...Typography.meta,
    color: Colors.success,
  },
  saveCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 56,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    ...Shadows.cta,
  },
  saveCtaText: {
    ...Typography.labelLarge,
    color: Colors.textOnPrimary,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
