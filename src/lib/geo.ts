import { supabase } from "@/integrations/supabase/client";

// Store coordinates (Av. Eduardo Prado, 269 - Santo André)
export const STORE_COORDS = { lat: -23.6600, lng: -46.5300 };
export const MAX_DELIVERY_KM = 5;

/** Haversine distance in km between two lat/lng points */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export type GeoValidationResult =
  | { ok: true; distanceKm: number; lat: number; lng: number }
  | { ok: false; reason: "too_far"; distanceKm: number }
  | { ok: false; reason: "no_geocoding" };

/**
 * Validate delivery address distance using the geocode edge function.
 * Falls back to "no_geocoding" if the API key isn't configured.
 */
export async function validateDeliveryDistance(
  address: string
): Promise<GeoValidationResult> {
  try {
    const { data, error } = await supabase.functions.invoke("geocode", {
      body: { address },
    });

    if (error || data?.error === "no_api_key" || data?.error === "geocode_failed") {
      return { ok: false, reason: "no_geocoding" };
    }

    if (data?.lat != null && data?.lng != null) {
      const d = haversineKm(STORE_COORDS.lat, STORE_COORDS.lng, data.lat, data.lng);
      if (d <= MAX_DELIVERY_KM) {
        return { ok: true, distanceKm: d, lat: data.lat, lng: data.lng };
      }
      return { ok: false, reason: "too_far", distanceKm: d };
    }

    return { ok: false, reason: "no_geocoding" };
  } catch {
    return { ok: false, reason: "no_geocoding" };
  }
}

/** Validate if known lat/lng is within delivery range */
export function isWithinRange(lat: number, lng: number): GeoValidationResult {
  const d = haversineKm(STORE_COORDS.lat, STORE_COORDS.lng, lat, lng);
  if (d <= MAX_DELIVERY_KM) return { ok: true, distanceKm: d, lat, lng };
  return { ok: false, reason: "too_far", distanceKm: d };
}
