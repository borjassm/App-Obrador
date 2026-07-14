import { Colors } from '@/constants/theme';

export interface LocationDisplay {
  shortName: string;
  /** Nombre de icono de MaterialIcons (@expo/vector-icons) */
  icon: 'factory' | 'storefront' | 'place';
  color: string;
  /** Fondo suave para el icon-tile */
  tint: string;
  description: string;
}

export const LOCATION_DISPLAY: Record<string, LocationDisplay> = {
  'LOS URQUIZA 17': {
    shortName: 'La Nave',
    icon: 'factory',
    color: Colors.secondary,
    tint: Colors.secondaryTint,
    description: 'Producción + Punto de venta · Los Urquiza 17',
  },
  'SANTA FELICIANA 10': {
    shortName: 'La Tienda',
    icon: 'storefront',
    color: Colors.primary,
    tint: Colors.primaryTint,
    description: 'Punto de venta · junto a Plaza de Olavide',
  },
  'NUEVA TIENDA': {
    shortName: 'Nueva tienda',
    icon: 'storefront',
    color: Colors.primary,
    tint: Colors.primaryTint,
    description: 'Próximamente · nombre por confirmar',
  },
};

export function getLocationDisplay(name: string): LocationDisplay {
  return LOCATION_DISPLAY[name] ?? {
    shortName: name,
    icon: 'place',
    color: Colors.primary,
    tint: Colors.primaryTint,
    description: '',
  };
}
