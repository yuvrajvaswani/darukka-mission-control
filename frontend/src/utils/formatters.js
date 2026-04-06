/**
 * Format a date string to a human-readable label
 * @param {string} iso  - ISO date string (YYYY-MM-DD or ISO 8601)
 * @param {Intl.DateTimeFormatOptions} opts
 */
export function formatDate(iso, opts = { dateStyle: 'medium' }) {
  return new Date(iso).toLocaleDateString(undefined, opts)
}

/**
 * Format a float metric value with appropriate precision
 * @param {number} value
 * @param {number} decimals
 */
export function formatMetric(value, decimals = 3) {
  if (value == null) return '—'
  return Number(value).toFixed(decimals)
}

/**
 * Truncate a string to maxLength characters
 */
export function truncate(str, maxLength = 60) {
  if (!str) return ''
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str
}

/**
 * Convert a GeoJSON Polygon to a display-friendly coordinate summary
 */
export function polygonSummary(geometry) {
  if (!geometry?.coordinates?.[0]) return 'No geometry'
  const count = geometry.coordinates[0].length - 1  // subtract closing point
  return `Polygon · ${count} vertices`
}
