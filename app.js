const $ = (s) => document.querySelector(s);
const RAD = Math.PI / 180;

const PLACES = [
  { name: "Nairobi", lat: -1.29, lon: 36.82, tz: "Africa/Nairobi" },
  { name: "London", lat: 51.51, lon: -0.13, tz: "Europe/London" },
  { name: "New York", lat: 40.71, lon: -74.01, tz: "America/New_York" },
  { name: "Tokyo", lat: 35.68, lon: 139.69, tz: "Asia/Tokyo" },
  { name: "Sydney", lat: -33.87, lon: 151.21, tz: "Australia/Sydney" },
  { name: "Reykjavik", lat: 64.15, lon: -21.94, tz: "Atlantic/Reykjavik" },
  { name: "Tromsø", lat: 69.65, lon: 18.96, tz: "Europe/Oslo" },
];

// Sunrise equation, good to a minute or two away from the poles.
// Returns minutes after local midnight, or a flag when the sun never rises/sets.
function sunTimes(lat, lon, y, m, d, offsetH, angle = -0.833) {
  const jd = Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
  const n = Math.ceil(jd - 2451545.0 + 0.0008);
  const jStar = n - lon / 360; // longitude is east-positive, so east transits earlier
  const mAnom = (357.5291 + 0.98560028 * jStar) % 360;
  const c = 1.9148 * Math.sin(mAnom * RAD) + 0.02 * Math.sin(2 * mAnom * RAD) + 0.0003 * Math.sin(3 * mAnom * RAD);
  const lambda = (mAnom + c + 180 + 102.9372) % 360;
  const transit = 2451545.0 + jStar + 0.0053 * Math.sin(mAnom * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.sin(angle * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * cosDec);

  const toMin = (j) => {
    const ms = (j - 2440587.5) * 86400000;
    const dt = new Date(ms + offsetH * 3600000);
    return dt.getUTCHours() * 60 + dt.getUTCMinutes() + dt.getUTCSeconds() / 60;
  };
  const noon = toMin(transit);
  if (cosH > 1) return { never: true, noon };       // sun stays below the angle all day
  if (cosH < -1) return { always: true, noon };     // sun stays above it all day
  const h = Math.acos(cosH) / RAD / 360;
  return { rise: toMin(transit - h), set: toMin(transit + h), noon };
}

const fmt = (min) => {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
const dur = (min) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m`;

function arc(r, from, to, color, width) {
  // minutes after midnight -> angle, noon at the top, midnight at the bottom
  const a = (min) => ((min - 720) / 1440) * 2 * Math.PI;
  let span = to - from;
  if (span < 0) span += 1440;
  if (span >= 1439.9) return `<circle r="${r}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
  const p = (min) => [r * Math.sin(a(min)), -r * Math.cos(a(min))];
  const [x1, y1] = p(from), [x2, y2] = p(to);
  return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${span > 720 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="butt"/>`;
}

function pointAt(r, min) {
  const a = ((min - 720) / 1440) * 2 * Math.PI;
  return [r * Math.sin(a), -r * Math.cos(a)];
}

function read() {
  const [y, m, d] = $("#date").value.split("-").map(Number);
  return { lat: parseFloat($("#lat").value), lon: parseFloat($("#lon").value), off: parseFloat($("#off").value), y, m, d };
}

function render() {
  const { lat, lon, off, y, m, d } = read();
  if ([lat, lon, off, y].some((v) => Number.isNaN(v))) return;
  const sun = sunTimes(lat, lon, y, m, d, off);
  const civil = sunTimes(lat, lon, y, m, d, off, -6);

  let svg = `<circle r="150" fill="none" stroke="var(--night)" stroke-width="30"/>`;
  let length;

  if (sun.always) { svg += arc(150, 0, 1440, "var(--sun)", 30); length = 1440; }
  else if (sun.never) {
    if (civil.always || civil.rise !== undefined) svg += arc(150, 0, 1440, "#3a2c4f", 30);
    length = 0;
  } else {
    if (civil.rise !== undefined) {
      svg += arc(150, civil.rise, sun.rise, "var(--dawn)", 30);
      svg += arc(150, sun.set, civil.set, "var(--dawn)", 30);
    }
    svg += arc(150, sun.rise, sun.set, "var(--sun)", 30);
    length = (sun.set - sun.rise + 1440) % 1440;
  }

  // hour ticks
  for (let h = 0; h < 24; h += 3) {
    const [x1, y1] = pointAt(124, h * 60), [x2, y2] = pointAt(118, h * 60), [tx, ty] = pointAt(104, h * 60);
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--line)" stroke-width="2"/>`;
    svg += `<text x="${tx}" y="${ty + 4}" text-anchor="middle">${String(h).padStart(2, "0")}</text>`;
  }

  // solar noon marker and sunrise / sunset dots
  const [nx, ny] = pointAt(150, sun.noon);
  svg += `<circle cx="${nx}" cy="${ny}" r="5" fill="#fff"/>`;
  if (sun.rise !== undefined) {
    const [rx, ry] = pointAt(150, sun.rise), [sx, sy] = pointAt(150, sun.set);
    svg += `<circle cx="${rx}" cy="${ry}" r="4" fill="#0a0e1a" stroke="#fff" stroke-width="2"/><circle cx="${sx}" cy="${sy}" r="4" fill="#0a0e1a" stroke="#fff" stroke-width="2"/>`;
  }

  // "now" hand, when the chosen date is today
  const now = new Date();
  const isToday = now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d;
  if (isToday) {
    const nowMin = (now.getUTCHours() * 60 + now.getUTCMinutes() + off * 60 + 1440) % 1440;
    const [hx, hy] = pointAt(138, nowMin);
    svg += `<line x1="0" y1="0" x2="${hx}" y2="${hy}" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-dasharray="3 4"/>`;
  }

  svg += `<text class="big" text-anchor="middle" y="-2">${sun.never ? "polar night" : sun.always ? "midnight sun" : dur(length)}</text>`;
  svg += `<text text-anchor="middle" y="20">of daylight</text>`;
  $("#dial").innerHTML = svg;

  const row = (k, v, cls = "") => `<div class="${cls}"><dt>${k}</dt><dd>${v}</dd></div>`;
  $("#stats").innerHTML =
    row("Sunrise", sun.rise !== undefined ? fmt(sun.rise) : "—") +
    row("Sunset", sun.set !== undefined ? fmt(sun.set) : "—") +
    row("Solar noon", fmt(sun.noon)) +
    row("Dawn / dusk", civil.rise !== undefined ? `${fmt(civil.rise)} / ${fmt(civil.set)}` : "—") +
    row("Compared with the shortest day", compare(lat, lon, off, y, length), "wide");

  drawYear(lat, lon, off, y, m, d);
}

function lengthOn(lat, lon, off, y, m, d) {
  const s = sunTimes(lat, lon, y, m, d, off);
  if (s.always) return 1440;
  if (s.never) return 0;
  return (s.set - s.rise + 1440) % 1440;
}

function compare(lat, lon, off, y, length) {
  let min = Infinity, max = -Infinity;
  for (const [m, d] of [[6, 21], [12, 21]]) {
    const l = lengthOn(lat, lon, off, y, m, d);
    min = Math.min(min, l); max = Math.max(max, l);
  }
  const diff = Math.round(length - min);
  return `${diff >= 0 ? "+" : "−"}${Math.abs(diff)} min`;
}

function drawYear(lat, lon, off, y, m, d) {
  const days = [];
  for (let i = 0; i < 365; i += 3) {
    const dt = new Date(Date.UTC(y, 0, 1 + i));
    days.push({ i, len: lengthOn(lat, lon, off, y, dt.getUTCMonth() + 1, dt.getUTCDate()) });
  }
  const W = 720, H = 150, pad = 14;
  const x = (i) => (i / 365) * W;
  const yy = (v) => H - pad - (v / 1440) * (H - pad * 2);
  const pts = days.map((p) => `${x(p.i).toFixed(1)},${yy(p.len).toFixed(1)}`).join(" ");
  const today = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
  const t = days.reduce((a, b) => (Math.abs(b.i - today) < Math.abs(a.i - today) ? b : a));
  $("#year").innerHTML =
    [6, 12, 18].map((h) => `<line x1="0" x2="${W}" y1="${yy(h * 60)}" y2="${yy(h * 60)}" stroke="#222c52" stroke-dasharray="2 4"/>`).join("") +
    `<polyline points="${pts}" fill="none" stroke="#ffc857" stroke-width="2.5" vector-effect="non-scaling-stroke"/>` +
    `<line x1="${x(today)}" x2="${x(today)}" y1="0" y2="${H}" stroke="#fff" stroke-opacity=".35" vector-effect="non-scaling-stroke"/>` +
    `<circle cx="${x(today)}" cy="${yy(t.len)}" r="4" fill="#fff"/>`;
}

let placeTz = null; // timezone of the selected preset, so the offset follows the date (DST)

function tzOffset(tz, dateStr) {
  const date = new Date(dateStr + "T12:00:00Z");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(date);
  const v = {}; parts.forEach((q) => { if (q.type !== "literal") v[q.type] = +q.value; });
  return (Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute) - date.getTime()) / 3600000;
}

function setPlace(p) {
  $("#lat").value = p.lat; $("#lon").value = p.lon;
  placeTz = p.tz;
  $("#off").value = tzOffset(p.tz, $("#date").value);
  [...$("#presets").children].forEach((b) => b.classList.toggle("on", b.textContent === p.name));
  render();
}

function init() {
  const t = new Date();
  $("#date").value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  $("#presets").innerHTML = PLACES.map((p) => `<button>${p.name}</button>`).join("");
  $("#presets").addEventListener("click", (e) => {
    const p = PLACES.find((x) => x.name === e.target.textContent);
    if (p) setPlace(p);
  });
  ["lat", "lon", "date", "off"].forEach((id) => $("#" + id).addEventListener("input", () => {
    if (id === "lat" || id === "lon") { placeTz = null; [...$("#presets").children].forEach((b) => b.classList.remove("on")); }
    if (id === "off") placeTz = null;
    if (id === "date" && placeTz) $("#off").value = tzOffset(placeTz, $("#date").value);
    render();
  }));
  $("#here").addEventListener("click", () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      $("#lat").value = pos.coords.latitude.toFixed(2);
      $("#lon").value = pos.coords.longitude.toFixed(2);
      placeTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      $("#off").value = tzOffset(placeTz, $("#date").value);
      [...$("#presets").children].forEach((b) => b.classList.remove("on"));
      render();
    });
  });
  setPlace(PLACES[0]);
}

init();
