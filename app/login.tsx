import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import {
  Colors,
  Fonts,
  Radius,
  Shadows,
  Spacing,
  TABLET_BREAKPOINT,
  Typography,
} from '@/constants/theme';
import { authService } from '@/services/auth.service';

const CONTROL_HEIGHT = 58;

function LogoTile({ size = 44 }: { size?: number }) {
  return (
    <View style={[styles.logoTile, { width: size, height: size }]}>
      <MaterialCommunityIcons
        name="bread-slice-outline"
        size={Math.round(size * 0.55)}
        color={Colors.textOnPrimary}
      />
    </View>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const onLogin = async () => {
    if (!email.trim() || !password) return;

    setLoading(true);
    const { error } = await authService.signIn(email.trim(), password);
    setLoading(false);

    if (error) {
      Alert.alert('Error de acceso', error.message);
      return;
    }
    router.replace('/(tabs)');
  };

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const form = (
    <View style={styles.form}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Inicia sesión</Text>
        <Text style={styles.formSubtitle}>Accede con tu cuenta del obrador</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email</Text>
        <View
          style={[styles.inputWrap, focusedField === 'email' && styles.inputWrapFocused]}
        >
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            editable={!loading}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Contraseña</Text>
        <View
          style={[styles.inputWrap, focusedField === 'password' && styles.inputWrapFocused]}
        >
          <TextInput
            style={[styles.input, styles.inputWithIcon]}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            onSubmitEditing={onLogin}
            editable={!loading}
          />
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={8}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <MaterialIcons
              name={showPassword ? 'visibility-off' : 'visibility'}
              size={22}
              color={Colors.textMuted}
            />
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={onLogin}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.button,
          !canSubmit && styles.buttonDisabled,
          pressed && canSubmit && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>{loading ? 'Entrando…' : 'Entrar'}</Text>
        {!loading && (
          <MaterialIcons name="arrow-forward" size={20} color={Colors.textOnPrimary} />
        )}
      </Pressable>
    </View>
  );

  if (isTablet) {
    return (
      <View style={styles.splitRoot}>
        {/* Panel izquierdo — branding */}
        <View style={styles.brandPanel}>
          <View style={styles.brandRow}>
            <LogoTile />
            <Text style={styles.wordmark}>Obrador</Text>
          </View>
          <View style={styles.brandBottom}>
            <Text style={styles.claim}>El día a día de tu obrador, bajo control.</Text>
            <Text style={styles.subclaim}>
              Sobrantes, stock, producción y analítica de ventas en un solo sitio.
            </Text>
          </View>
        </View>

        {/* Panel derecho — formulario. Sin KeyboardAvoidingView: su salto de
            layout en iOS hacía perder el foco y cerraba el teclado al instante;
            automaticallyAdjustKeyboardInsets es el manejo nativo de UIKit. */}
        <ScrollView
          style={styles.formPanelScroll}
          contentContainerStyle={styles.formPanel}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          {form}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.mobileRoot}>
      <ScrollView
        contentContainerStyle={styles.mobileScroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        {/* Branding compacto */}
        <View style={styles.mobileBrand}>
          <View style={styles.brandRow}>
            <LogoTile />
            <Text style={styles.wordmark}>Obrador</Text>
          </View>
          <Text style={styles.mobileClaim}>El día a día de tu obrador, bajo control.</Text>
        </View>

        <View style={styles.mobileFormCard}>{form}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ---- Split (tablet) ----
  splitRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.bgBase,
  },
  brandPanel: {
    width: 460,
    backgroundColor: Colors.bgDark,
    justifyContent: 'space-between',
    padding: Spacing.xxxl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoTile: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    ...Typography.headingLarge,
    color: Colors.textOnDark,
  },
  brandBottom: {
    gap: Spacing.lg,
  },
  claim: {
    ...Typography.displayLarge,
    color: Colors.textOnDark,
  },
  subclaim: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(246, 241, 233, 0.6)',
  },
  formPanelScroll: {
    flex: 1,
  },
  formPanel: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },

  // ---- Mobile ----
  mobileRoot: {
    flex: 1,
    backgroundColor: Colors.bgDark,
  },
  mobileScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.xxl,
  },
  mobileBrand: {
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  mobileClaim: {
    ...Typography.displayMedium,
    color: Colors.textOnDark,
  },
  mobileFormCard: {
    backgroundColor: Colors.bgBase,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadows.lg,
  },

  // ---- Formulario ----
  form: {
    width: '100%',
    maxWidth: 420,
    gap: Spacing.lg,
  },
  formHeader: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  formTitle: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  formSubtitle: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  inputLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CONTROL_HEIGHT,
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  // Solo borderColor: añadir sombra/elevation al enfocar remonta el input en
  // la Nueva Arquitectura y cierra el teclado (facebook/react-native#45798)
  inputWrapFocused: {
    borderColor: Colors.primary,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.lg,
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
  },
  inputWithIcon: {
    paddingRight: Spacing.sm,
  },
  eyeButton: {
    height: '100%',
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: CONTROL_HEIGHT,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
    ...Shadows.cta,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    ...Typography.labelLarge,
    color: Colors.textOnPrimary,
  },
});
