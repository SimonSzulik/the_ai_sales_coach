/** Map azimuth in degrees (0–360, typical convention: 180 = south) to 8-point compass. */
export function compassFromAzimuth(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}
