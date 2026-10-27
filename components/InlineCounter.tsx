import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  color?: string;
  disabled?: boolean;
}

// Tope de lo que se puede escribir a mano (4 cifras)
export const INLINE_COUNTER_MAX = 9999;

// Contador compacto − valor + para rellenar listas largas sin salir de la fila.
// El valor también se escribe con el teclado numérico (productos de 100+ uds).
// Cada tecla se pasa ya a onChange: cuenta aunque se pulse Guardar sin cerrar
// el teclado, y − / + parten del número escrito.
export default function InlineCounter({
  label,
  value,
  onChange,
  color = Colors.primary,
  disabled,
}: Props) {
  const canDecrease = !disabled && value > 0;
  // Texto en edición: puede estar vacío mientras se escribe (vacío = 0)
  const [text, setText] = useState(String(value));

  // Cambios desde fuera (− / +, recarga del día): mostrar el valor nuevo
  useEffect(() => {
    setText((t) => (toValue(t) === value ? t : String(value)));
  }, [value]);

  const handleChangeText = (raw: string) => {
    // Solo enteros: lo que vaya tras una coma o punto se descarta
    const digits = raw.split(/[.,]/)[0].replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
    const next = Math.min(INLINE_COUNTER_MAX, toValue(digits));
    setText(toValue(digits) > INLINE_COUNTER_MAX ? String(INLINE_COUNTER_MAX) : digits);
    if (next !== value) onChange(next);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Pressable
          onPress={() => onChange(Math.max(0, value - 1))}
          disabled={!canDecrease}
          hitSlop={HIT_SLOP}
          accessibilityLabel={`Restar ${label}`}
          style={({ pressed }) => [
            styles.btn,
            styles.btnMinus,
            pressed && styles.pressed,
            !canDecrease && styles.btnDisabled,
          ]}
        >
          <MaterialIcons name="remove" size={20} color={Colors.textSecondary} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={handleChangeText}
          onBlur={() => setText(String(value))}
          editable={!disabled}
          keyboardType="number-pad"
          inputMode="numeric"
          returnKeyType="done"
          maxLength={4}
          selectTextOnFocus
          accessibilityLabel={`Cantidad ${label}`}
          style={[styles.value, value > 0 && { color }]}
        />
        <Pressable
          onPress={() => onChange(Math.min(INLINE_COUNTER_MAX, value + 1))}
          disabled={disabled}
          hitSlop={HIT_SLOP}
          accessibilityLabel={`Sumar ${label}`}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: color },
            pressed && styles.pressed,
            disabled && styles.btnDisabled,
          ]}
        >
          <MaterialIcons name="add" size={20} color={Colors.textOnPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function toValue(text: string): number {
  const n = parseInt(text, 10);
  return Number.isNaN(n) ? 0 : n;
}

// Botones de 40 px; con el margen vertical el área táctil llega a 56 px sin
// ensanchar la fila (en móvil estrecho no caben botones más anchos)
const HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnMinus: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  // Recuadro suave: se nota que el número se puede tocar
  value: {
    width: 52,
    height: 40,
    paddingHorizontal: 2,
    paddingVertical: 0,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.bgBase,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontFamily: Fonts.extraBold,
    fontSize: 18,
    lineHeight: 22,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
});
