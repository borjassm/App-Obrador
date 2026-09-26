import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import Button from '@/components/Button';
import LocationCard from '@/components/LocationCard';
import { Screen } from '@/components/Screen';
import { Colors, Fonts, Radius, Spacing, TABLET_BREAKPOINT, Typography } from '@/constants/theme';
import { useGreeting } from '@/hooks/useGreeting';
import { useLocationStatus } from '@/hooks/useLocationStatus';
import { useRole } from '@/hooks/useRole';
import { useSession } from '@/hooks/useSession';
import { analyticsService } from '@/services/analytics.service';
import { authService } from '@/services/auth.service';
import { locationService } from '@/services/location.service';

interface LocationRow {
  id: string;
  name: string;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function todayLongDate(): string {
  const formatted = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return capitalize(formatted);
}

/** '2026-07-12' → '12/07' */
function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parts = iso.split('-');
  if (parts.length < 3) return null;
  return `${parts[2]}/${parts[1]}`;
}

function initials(name: string): string {
  const parts = name.replace(/[._-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OB';
  const chars = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2);
  return chars.toUpperCase();
}

function LocationCardWithStatus({ location, isTablet }: { location: LocationRow; isTablet: boolean }) {
  const { status, entryCount, totalProducts, refresh } = useLocationStatus(location.id);

  // Refrescar al volver a Inicio: el estado cambia mientras se registra
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <LocationCard
      locationName={location.name}
      status={status}
      entryCount={entryCount}
      totalProducts={totalProducts}
      tablet={isTablet}
      compact={!isTablet && status === 'closed'}
      onPress={() => router.push(`/(tabs)/location/${location.id}/close`)}
    />
  );
}

export default function HomeTab() {
  const greeting = useGreeting();
  const { session } = useSession();
  const { isAdmin } = useRole();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesDate, setSalesDate] = useState<string | null>(null);

  const userEmail = session?.user?.email ?? '';
  const userName = capitalize(userEmail.split('@')[0] ?? '');

  // Chip "Ventas al día" (solo admin, tablet)
  useEffect(() => {
    if (!isAdmin) return;
    analyticsService.latestDates().then((d) => setSalesDate(shortDate(d?.latest_sale)));
  }, [isAdmin]);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: supaError } = await locationService.listAll();
      if (supaError) {
        setError(supaError.message ?? 'Error al cargar ubicaciones');
      } else {
        setLocations(data ?? []);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Admin → Ajustes; empleado (no tiene Ajustes) → cerrar sesión
  const handleAvatar = () => {
    if (isAdmin) {
      router.push('/(tabs)/settings');
      return;
    }
    const doLogout = () => {
      authService.signOut();
    };
    if (Platform.OS === 'web') {
      if (window.confirm('¿Cerrar sesión?')) doLogout();
      return;
    }
    Alert.alert('Cerrar sesión', `Sesión iniciada como ${userEmail}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: doLogout },
    ]);
  };

  return (
    <Screen scrollable>
      <View style={[styles.headerRow, isTablet ? styles.headerRowTablet : styles.headerRowMobile]}>
        <View style={styles.headerText}>
          <Text style={[styles.date, !isTablet && styles.dateMobile]}>{todayLongDate()}</Text>
          <Text style={[styles.greeting, !isTablet && styles.greetingMobile]}>
            {greeting}
            {userName ? `, ${userName}` : ''}
          </Text>
        </View>
        {isTablet && isAdmin ? (
          <View style={styles.syncChip}>
            <MaterialIcons name="sync" size={19} color={Colors.secondary} />
            <Text style={styles.syncChipText}>
              Ventas al día{salesDate ? ` · ${salesDate}` : ''}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={handleAvatar}
            accessibilityLabel={isAdmin ? 'Ajustes' : 'Cerrar sesión'}
            style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
          >
            <Text style={styles.avatarText}>{initials(userName)}</Text>
          </Pressable>
        )}
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centerText}>Cargando ubicaciones…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Reintentar" variant="secondary" onPress={loadLocations} />
        </View>
      )}

      {!loading && !error && locations.length === 0 && (
        <View style={styles.center}>
          <MaterialIcons name="location-off" size={48} color={Colors.textMuted} />
          <Text style={styles.centerText}>No hay ubicaciones configuradas</Text>
        </View>
      )}

      {!loading && !error && locations.length > 0 && (
        <View style={[styles.cards, isTablet && styles.cardsTablet]}>
          {locations.map((loc) => (
            <View key={loc.id} style={isTablet ? styles.cardCellTablet : undefined}>
              <LocationCardWithStatus location={loc} isTablet={isTablet} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  headerRowTablet: {
    alignItems: 'flex-end',
  },
  headerRowMobile: {
    alignItems: 'center',
  },
  headerText: {
    gap: Spacing.xs,
    flexShrink: 1,
  },
  date: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  dateMobile: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  greeting: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  greetingMobile: {
    fontSize: 24,
    lineHeight: 31,
    letterSpacing: -0.4,
  },
  syncChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 44,
    paddingHorizontal: 18,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
  },
  syncChipText: {
    ...Typography.labelMedium,
    color: Colors.textSecondary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  avatarText: {
    fontFamily: Fonts.extraBold,
    fontSize: 13,
    color: Colors.textOnPrimary,
  },
  cards: {
    gap: Spacing.lg,
  },
  cardsTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  cardCellTablet: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  center: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  centerText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  errorText: {
    ...Typography.bodyMedium,
    color: Colors.danger,
    textAlign: 'center',
  },
});
