const MODE_LABEL = { DRIVING: 'Voiture', WALKING: 'À pied', RUNNING: 'Course', SWIMMING: 'Nage', BOATING: 'Bateau' };
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

function cardinal(deg) {
  const d = ((deg % 360) + 360) % 360;
  return DIRS[Math.round(d / 45) % 8];
}
function fmtLatLon(lat, lon) {
  const la = `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}`;
  const lo = `${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'O'}`;
  return `${la}  ${lo}`;
}

/** Minimal heads-up display: speed, real distance, mode, heading, coordinates. */
export function createHUD() {
  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed', 'inset:0', 'pointer-events:none', 'z-index:10',
    'font-family:ui-monospace,SFMono-Regular,Menlo,monospace', 'color:#f2f5fa',
    'text-shadow:0 1px 3px rgba(0,0,0,.55)',
  ].join(';');
  root.innerHTML = `
    <div id="hud-info" style="position:absolute;top:18px;left:20px;font-size:12px;letter-spacing:.04em;line-height:1.7;opacity:.92">
      <div><span id="hud-mode" style="color:#6ee7b7;font-weight:600"></span> · <span id="hud-dir"></span></div>
      <div id="hud-coords" style="opacity:.8"></div>
    </div>
    <div id="hud-speed" style="position:absolute;bottom:22px;left:24px">
      <div><span id="hud-kmh" style="font-size:34px;font-weight:600;font-variant-numeric:tabular-nums">0</span>
        <span style="font-size:12px;opacity:.7;letter-spacing:.1em"> KM/H</span></div>
      <div style="font-size:12px;opacity:.7;letter-spacing:.06em"><span id="hud-km" style="font-variant-numeric:tabular-nums">0.0</span> km parcourus</div>
    </div>`;
  document.body.appendChild(root);

  const $ = (id) => root.querySelector(id);
  const kmh = $('#hud-kmh');
  const km = $('#hud-km');
  const mode = $('#hud-mode');
  const dir = $('#hud-dir');
  const coords = $('#hud-coords');

  return {
    update({ speedKmh, totalKm, mode: m, headingDeg, lat, lon }) {
      kmh.textContent = Math.round(speedKmh);
      km.textContent = totalKm.toFixed(1);
      mode.textContent = MODE_LABEL[m] || m;
      dir.textContent = `${cardinal(headingDeg)} ${Math.round(((headingDeg % 360) + 360) % 360)}°`;
      coords.textContent = fmtLatLon(lat, lon);
    },
  };
}
