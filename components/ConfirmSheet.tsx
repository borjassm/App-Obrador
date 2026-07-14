import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/Button';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

interface SummaryItem {
  label: string;
  value: string | number;
  color?: string;
}

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  summary?: SummaryItem[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'danger';
}

export default function ConfirmSheet({
  visible,
  title,
  message,
  summary,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  variant = 'default',
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}

          {summary && summary.length > 0 && (
            <View style={styles.summaryBox}>
              {summary.map((item, i) => (
                <View
                  key={i}
                  style={[styles.summaryRow, i > 0 && styles.summaryRowDivider]}
                >
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                  <Text style={[styles.summaryValue, item.color ? { color: item.color } : undefined]}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Button
              title={cancelLabel}
              onPress={onCancel}
              variant="ghost"
              style={styles.actionBtn}
            />
            <Button
              title={confirmLabel}
              onPress={onConfirm}
              variant={variant === 'danger' ? 'danger' : 'primary'}
              style={styles.actionBtnWide}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    ...Shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.headingLarge,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  summaryBox: {
    backgroundColor: Colors.bgBase,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  summaryRowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  summaryLabel: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  summaryValue: {
    ...Typography.numberSmall,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
  actionBtnWide: {
    flex: 2,
  },
});
