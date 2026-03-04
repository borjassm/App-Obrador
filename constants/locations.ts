export interface LocationDisplay {
  shortName: string;
  emoji: string;
  color: string;
  description: string;
}

export const LOCATION_DISPLAY: Record<string, LocationDisplay> = {
  'LOS URQUIZA 17': {
    shortName: 'Nave',
    emoji: '🏭',
    color: '#8B5E3C',
    description: 'Produccion',
  },
  'SANTA FELICIANA 10': {
    shortName: 'Tienda',
    emoji: '🏪',
    color: '#2A9D8F',
    description: 'Tienda + Cierre',
  },
};

export function getLocationDisplay(name: string): LocationDisplay {
  return LOCATION_DISPLAY[name] ?? {
    shortName: name,
    emoji: '📍',
    color: '#8B5E3C',
    description: '',
  };
}
