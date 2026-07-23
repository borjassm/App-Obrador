import { useEffect, useState } from 'react';

import { getLocationDisplay } from '@/constants/locations';
import { locationService } from '@/services/location.service';

export interface LocationOption {
  id: string;
  shortName: string;
}

// Ubicaciones activas con su nombre corto de display (La Nave / La Tienda…)
export function useLocations(): LocationOption[] {
  const [locations, setLocations] = useState<LocationOption[]>([]);

  useEffect(() => {
    locationService.listAll().then(({ data }) => {
      setLocations(
        (data ?? []).map((l) => ({ id: l.id, shortName: getLocationDisplay(l.name).shortName }))
      );
    });
  }, []);

  return locations;
}
