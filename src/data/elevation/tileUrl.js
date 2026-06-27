/** Verified free, keyless, CORS-enabled global elevation source. */
export const DEFAULT_URL_TEMPLATE =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

/**
 * Fill a `{z}/{x}/{y}` URL template.
 * @returns {string}
 */
export function tileUrl(template, z, x, y) {
  return template
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}
