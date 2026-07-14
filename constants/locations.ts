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
    shortName: 'Nave',
    icon: 'factory',
    color: Colors.secondary,
    tint: Colors.secondaryTint,
    description: 'Produccion',
  },
  'SANTA FELICIANA 10': {
    shortName: 'Tienda',
    icon: 'storefront',
    color: Colors.primary,
    tint: Colors.primaryTint,
    description: 'Tienda + Cierre',
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
