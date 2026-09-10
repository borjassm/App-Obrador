import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import Badge from '@/components/Badge';
import { Screen } from '@/components/Screen';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { getLocationDisplay } from '@/constants/locations';
import { shipmentsService, type ShipmentDetail } from '@/services/shipments.service';

function parseQty(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  const n = parseFloat(clean);
  return Number.isNaN(n) || n < 0 ? null : n;
}

export default function ShipmentDetailScreen() {
  const { shipmentId } = useLocalSearchParams<{ shipmentId: string }>();
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [received, setReceived] = useState<Map<string, string>>(new Map());
  const [comments, setComments] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!shipmentId) return;
      shipmentsService.getDetail(shipmentId).then((data) => {
        if (!data) return;
        setDetail(data);
        if (data.status === 'enviado') {
          // Prefill: lo recibido = lo enviado (la tienda corrige si difiere)
          setReceived((prev) => {
            if (prev.size > 0) return prev;
            const next = new Map<string, string>();
            for (const line of data.lines) next.set(line.id, String(line.qtySent));
            return next;
          });
        }
      });
    }, [shipmentId])
  );

  const pendingReception = detail?.status === 'enviado';

  const totalSent = useMemo(
    () => (detail ? detail.lines.reduce((s, l) => s + l.qtySent, 0) : 0),
    [detail]
  );

  const handleConfirm = async () => {
    if (!detail || saving) return;
    const rows = detail.lines.map((line) => ({
      id: line.id,
      qtyReceived: parseQty(received.get(line.id) ?? '') ?? 0,
      comment: (comments.get(line.id) ?? '').trim() || null,
    }));
    setSaving(true);
    const { error } = await shipmentsService.confirmReception(detail.id, rows);
    setSaving(false);
    if (error) {
      Alert.alert('Error', error);
      return;
    }
    router.back();
  };

  if (!detail) {
    return (
      <Screen>
        <View style={styles.stateBox}>
          <MaterialIcons name="hourglass-empty" size={48} color={Colors.textMuted} />
        </View>
      </Screen>
    );
  }

  const dateLabel = new Date(detail.shipmentDate + 'T12:00:00').toLocaleDateString('es-ES', {
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
            <Text style={styles.topTitle} numberOfLines={1}>
              {getLocationDisplay(detail.originName).shortName} →{' '}
              {getLocationDisplay(detail.destName).shortName}
            </Text>
            <Text style={styles.topSubtitle}>
              {dateLabel} · viaje {detail.trip} · {totalSent.toLocaleString('es-ES')} uds enviadas
            </Text>
          </View>
          <Badge
            label={detail.status === 'recibido' ? 'Recibido' : 'En camino'}
            variant={detail.status === 'recibido' ? 'success' : 'warning'}
          />
        </View>

        {pendingReception && (
          <Text style={styles.hint}>
            Confirma lo que ha llegado. Viene precargado con lo enviado: corrige solo lo que no
            cuadre y comenta el porqué.
          </Text>
        )}

        <View style={styles.list}>
          {detail.lines.map((line) => {
            const receivedNow = pendingReception
              ? parseQty(received.get(line.id) ?? '')
              : line.qtyReceived;
            const diff = receivedNow != null ? receivedNow - line.qtySent : null;
            return (
              <View key={line.id} style={styles.lineCard}>
                <View style={styles.lineRow}>
                  <View style={styles.lineInfo}>
                    <Text style={styles.lineName} numberOfLines={1}>{line.productName}</Text>
                    <Text style={styles.lineMeta}>
                      enviado: {line.qtySent.toLocaleString('es-ES')}
                      {diff != null && diff !== 0 && (
                        <Text style={styles.lineDiff}>
                          {'  '}({diff > 0 ? '+' : ''}
                          {diff.toLocaleString('es-ES')})
                        </Text>
                      )}
                    </Text>
                  </View>
                  {pendingReception ? (
                    <TextInput
                      value={received.get(line.id) ?? ''}
                      onChangeText={(t) => setReceived((prev) => new Map(prev).set(line.id, t))}
                      keyboardType="decimal-pad"
                      style={[
                        styles.qtyInput,
                        diff != null && diff !== 0 && styles.qtyInputDiff,
                      ]}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.qtyFinal,
                        diff != null && diff !== 0 && { color: Colors.danger },
                      ]}
                    >
                      {line.qtyReceived != null ? line.qtyReceived.toLocaleString('es-ES') : '—'}
                    </Text>
                  )}
                </View>
                {pendingReception && diff != null && diff !== 0 && (
                  <TextInput
                    value={comments.get(line.id) ?? ''}
                    onChangeText={(t) => setComments((prev) => new Map(prev).set(line.id, t))}
                    placeholder="¿Por qué no cuadra? (roto, contado mal, se quedó en la nave…)"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.commentInput}
                    multiline
                  />
                )}
                {!pendingReception && !!line.comment && (
                  <Text style={styles.commentText}>{line.comment}</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {pendingReception && (
        <View style={styles.footer}>
          <Pressable
            onPress={handleConfirm}
            disabled={saving}
            style={({ pressed }) => [styles.saveCta, pressed && styles.pressed, saving && styles.disabled]}
          >
            <MaterialIcons name="check-circle" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.saveCtaText}>
              {saving ? 'Guardando…' : 'Confirmar recepción'}
            </Text>
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
    marginBottom: Spacing.md,
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
    fontVariant: ['tabular-nums'],
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  stateBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  list: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  lineCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 52,
  },
  lineInfo: {
    flex: 1,
    gap: 2,
  },
  lineName: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
  },
  lineMeta: {
    ...Typography.meta,
    fontVariant: ['tabular-nums'],
  },
  lineDiff: {
    color: Colors.danger,
    fontFamily: Fonts.bold,
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
  qtyInputDiff: {
    borderColor: Colors.danger,
  },
  qtyFinal: {
    ...Typography.numberSmall,
    color: Colors.textPrimary,
  },
  commentInput: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    minHeight: 44,
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
  commentText: {
    ...Typography.meta,
    fontStyle: 'italic',
    paddingBottom: Spacing.sm,
  },
  footer: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  saveCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 56,
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
