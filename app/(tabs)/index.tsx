import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import Button from '@/components/Button';
import LocationCard from '@/components/LocationCard';
import { Screen } from '@/components/Screen';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useGreeting } from '@/hooks/useGreeting';
import { useSession } from '@/hooks/useSession';
import { locationService } from '@/services/location.service';
import { useLocationStatus } from '@/hooks/useLocationStatus';

interface LocationRow {
  id: string;
  name: string;
}

function LocationCardWithStatus({ location }: { location: LocationRow }) {
  const { status, entryCount, totalProducts } = useLocationStatus(location.id);

  const statusLabel =
    status === 'closed' ? 'Registrado ✓' :
    status === 'open' ? `En curso (${entryCount}/${totalProducts})` :
    'Pendiente';

  const statusVariant: 'success' | 'warning' | 'neutral' =
    status === 'closed' ? 'success' :
    status === 'open' ? 'warning' :
    'neutral';

  return (
    <LocationCard
      locationName={location.name}
      status={statusLabel}
      statusVariant={statusVariant}
      onPress={() => router.push(`/(tabs)/location/${location.id}`)}
    />
  );
}

export default function HomeTab() {
  const greeting = useGreeting();
  const { session } = useSession();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userEmail = session?.user?.email ?? '';
  const userName = userEmail.split('@')[0] ?? '';

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: supaError } = await locationService.listAll();
      if (supaError) {
        console.log('[HomeTab] Supabase error:', supaError);
        setError(supaError.message ?? 'Error al cargar ubicaciones');
      } else {
        setLocations(data ?? []);
      }
    } catch (e) {
      console.log('[HomeTab] Exception:', e);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting} 👋</Text>
        {userName ? <Text style={styles.user}>{userName}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tus ubicaciones</Text>
        <Text style={styles.sectionSub}>Selecciona una para registrar sobrantes</Text>
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centerText}>Cargando ubicaciones…</Text>
        </View>
      )}

      {/* Error */}
      {!loading && error && (
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Reintentar" variant="secondary" onPress={loadLocations} />
        </View>
      )}

      {/* Empty */}
      {!loading && !error && locations.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>📍</Text>
          <Text style={styles.centerText}>No hay ubicaciones configuradas</Text>
        </View>
      )}

      {/* Loaded */}
      {!loading && !error && locations.length > 0 && (
        <View style={styles.cards}>
          {locations.map((loc) => (
            <LocationCardWithStatus key={loc.id} location={loc} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  greeting: {
    ...Typography.displayMedium,
    color: Colors.textPrimary,
  },
  user: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
  },
  section: {
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headingSmall,
    color: Colors.textPrimary,
  },
  sectionSub: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  cards: {
    gap: Spacing.lg,
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
  errorEmoji: {
    fontSize: 48,
  },
  errorText: {
    ...Typography.bodyMedium,
    color: Colors.danger,
    textAlign: 'center',
  },
});
