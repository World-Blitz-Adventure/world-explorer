const PRESETS = [
  { name: 'Lomé, Togo', lat: 6.1319, lon: 1.2228 },
  { name: 'Nice', lat: 43.695, lon: 7.265 },
  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'Dubaï', lat: 25.2048, lon: 55.2708 },
  { name: 'Le Cap', lat: -33.9249, lon: 18.4241 },
  { name: 'Rio', lat: -22.9068, lon: -43.1729 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
  { name: 'Mont Blanc', lat: 45.8326, lon: 6.8652 },
  { name: 'Grand Canyon', lat: 36.0544, lon: -112.14 },
  { name: 'Le Caire', lat: 30.0444, lon: 31.2357 },
];

const BTN = 'pointer-events:auto;cursor:pointer;border:1px solid #2b3340;background:#161a22;color:#e8ebf1;border-radius:10px;padding:10px 12px;font:inherit;font-size:13px;transition:.15s';

/** Full-screen start screen: pick a point on Earth, geolocate, or enter coords. */
export function createStartScreen(onStart) {
  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:50', 'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:20px', 'padding:24px',
    'background:radial-gradient(circle at 50% 28%, #1a2233, #0b0d12)', 'color:#e8ebf1',
    'font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
  ].join(';');
  root.innerHTML = `
    <div style="text-align:center">
      <div style="font-size:12px;letter-spacing:.32em;color:#6ee7b7;font-weight:700">◢ WORLD EXPLORER</div>
      <h1 style="font-size:30px;margin:.35em 0 .15em;font-weight:700">Où veux-tu commencer&nbsp;?</h1>
      <div style="color:#99a2b2;font-size:14px">Choisis ton point de départ sur Terre</div>
    </div>
    <button id="we-geo" style="${BTN};background:#6ee7b7;color:#0b0d12;border-color:#6ee7b7;font-weight:600;font-size:14px;padding:12px 22px">📍 Commencer ici (ma position)</button>
    <div id="we-presets" style="display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:10px;max-width:560px;width:100%"></div>
    <form id="we-coords" style="display:flex;gap:8px;margin-top:4px">
      <input id="we-ll" placeholder="lat, lon — ex : 6.13, 1.22" autocomplete="off"
        style="pointer-events:auto;background:#10141b;border:1px solid #2b3340;border-radius:10px;color:#e8ebf1;padding:10px 12px;font:inherit;font-size:13px;width:240px" />
      <button style="${BTN}">Aller</button>
    </form>
    <div id="we-msg" style="color:#f5b14c;font-size:13px;height:16px"></div>`;
  document.body.appendChild(root);

  const $ = (id) => root.querySelector(id);
  const msg = $('#we-msg');
  const finish = (loc) => {
    root.remove();
    onStart(loc);
  };

  const grid = $('#we-presets');
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.textContent = p.name;
    b.style.cssText = BTN;
    b.onmouseenter = () => (b.style.borderColor = '#6ee7b7');
    b.onmouseleave = () => (b.style.borderColor = '#2b3340');
    b.onclick = () => finish({ lat: p.lat, lon: p.lon });
    grid.appendChild(b);
  }

  $('#we-geo').onclick = () => {
    msg.textContent = 'Localisation…';
    if (!navigator.geolocation) {
      msg.textContent = 'Géolocalisation indisponible — choisis une ville';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => finish({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => (msg.textContent = 'Position refusée — choisis une ville ou entre des coordonnées'),
      { timeout: 8000 }
    );
  };

  $('#we-coords').onsubmit = (e) => {
    e.preventDefault();
    const v = $('#we-ll').value.split(',').map((s) => parseFloat(s.trim()));
    if (v.length === 2 && isFinite(v[0]) && isFinite(v[1]) && Math.abs(v[0]) <= 90 && Math.abs(v[1]) <= 180) {
      finish({ lat: v[0], lon: v[1] });
    } else {
      msg.textContent = 'Coordonnées invalides (lat ≤ 90, lon ≤ 180)';
    }
  };
}
