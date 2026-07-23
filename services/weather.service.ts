// Previsión meteorológica de Madrid vía Open-Meteo (gratuita, sin API key).
// Se usa para ajustar la demanda prevista del plan de producción.

const LATITUDE = 40.4168;
const LONGITUDE = -3.7038;
const TIMEZONE = 'Europe/Madrid';

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  tempMax: number;
  tempMin: number;
  precipitation: number; // mm
  weatherCode: number;
}

export const weatherService = {
  /** Previsión diaria a 7 días. Si la API falla devuelve [] (factor neutro). */
  async getForecast(): Promise<ForecastDay[]> {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code` +
        `&timezone=${encodeURIComponent(TIMEZONE)}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      const dates: string[] = json?.daily?.time ?? [];
      return dates.map((date, i) => ({
        date,
        tempMax: json.daily.temperature_2m_max?.[i] ?? 0,
        tempMin: json.daily.temperature_2m_min?.[i] ?? 0,
        precipitation: json.daily.precipitation_sum?.[i] ?? 0,
        weatherCode: json.daily.weather_code?.[i] ?? 0,
      }));
    } catch {
      return [];
    }
  },
};

/** Factor de ajuste de demanda según lluvia y temperatura:
 *  lluvia fuerte baja la afluencia; calor extremo baja la demanda de horneados;
 *  frío la sube ligeramente. */
export function weatherAdjustmentFactor(precipitation: number, tempMax: number): number {
  let factor = 1;
  if (precipitation > 10) factor *= 0.85;
  else if (precipitation > 5) factor *= 0.92;
  else if (precipitation > 1) factor *= 0.97;
  if (tempMax > 35) factor *= 0.9;
  else if (tempMax < 5) factor *= 1.05;
  return Math.round(factor * 100) / 100;
}
