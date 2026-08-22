/**
 * Converts Celsius to Fahrenheit and rounds to the nearest integer.
 */
export function toF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}
