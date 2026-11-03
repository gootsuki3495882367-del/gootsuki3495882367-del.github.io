// Small interactive parts of the page: theme, menu, skill bars, project filter and
// the "network inspector" that reads the browser's Navigation / Resource Timing data.

const root = document.documentElement;

// ---------- colour theme (remembered in localStorage when available) ----------
function loadTheme() {
  try { return localStorage.getItem("theme"); } catch (e) { return null; }
}
function saveTheme(value) {
  try { localStorage.setItem("theme", value); } catch (e) { /* private mode: ignore */ }
}
const preferred = loadTheme() ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
root.dataset.theme = preferred;
document.querySelector(".theme-toggle").addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  saveTheme(root.dataset.theme);
});

// ---------- mobile menu ----------
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
toggle.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
});
links.addEventListener("click", () => links.classList.remove("open"));

// ---------- skill bars grow once the page has loaded ----------
window.addEventListener("load", () => {
  document.querySelectorAll(".skill").forEach((s) => {
    s.querySelector("i").style.width = s.dataset.level + "%";
  });
});

// ---------- project filter ----------
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    const filter = chip.dataset.filter;
    document.querySelectorAll(".card").forEach((card) => {
      const show = filter === "all" || card.dataset.tags.split(" ").includes(filter);
      card.classList.toggle("hidden", !show);
    });
  });
});

// ---------- host name, repository link, year ----------
const host = location.hostname || "this-site.github.io";
["host-name", "host-name-2", "host-name-3"].forEach((id) => {
  document.getElementById(id).textContent = host;
});
document.getElementById("year").textContent = new Date().getFullYear();
if (host.endsWith(".github.io")) {
  const user = host.replace(".github.io", "");
  document.getElementById("repo-link").href = `https://github.com/${user}/${host}`;
}

// ---------- network inspector ----------
const ms = (v) => (v > 0 ? v : 0);

function phases(t) {
  // each phase = [label, start, end] in ms from the start of the navigation / request
  return [
    ["Redirect", t.redirectStart, t.redirectEnd],
    ["DNS lookup", t.domainLookupStart, t.domainLookupEnd],
    ["TCP connect", t.connectStart, t.secureConnectionStart > 0 ? t.secureConnectionStart : t.connectEnd],
    ["TLS handshake", t.secureConnectionStart, t.secureConnectionStart > 0 ? t.connectEnd : 0],
    ["Waiting (TTFB)", t.requestStart, t.responseStart],
    ["Content download", t.responseStart, t.responseEnd],
  ].map(([label, a, b]) => [label, ms(a) - ms(t.startTime), ms(b) - ms(a) > 0 ? ms(b) - ms(a) : 0]);
}

function render(t, title) {
  const info = document.getElementById("conn-info");
  const protocol = t.nextHopProtocol || "unknown";
  const total = ms(t.responseEnd) - ms(t.startTime);
  info.innerHTML = `
    <div><span>Host</span><b>${host}</b></div>
    <div><span>Application protocol</span><b>${protocol}</b></div>
    <div><span>Transfer size</span><b>${t.transferSize ? (t.transferSize / 1024).toFixed(1) + " KB" : "cached"}</b></div>
    <div><span>${title}</span><b>${total.toFixed(1)} ms</b></div>`;
  const timeline = document.getElementById("timeline");
  timeline.innerHTML = "";
  phases(t).forEach(([label, start, dur]) => {
    const row = document.createElement("div");
    row.className = "row";
    const left = total > 0 ? (start / total) * 100 : 0;
    const width = total > 0 ? (dur / total) * 100 : 0;
    row.innerHTML = `<span>${label}</span>
      <div class="track"><div class="seg" style="left:${left}%;width:${width}%"></div></div>
      <span class="ms">${dur.toFixed(1)} ms</span>`;
    timeline.appendChild(row);
  });
}

function showNavigation() {
  const [nav] = performance.getEntriesByType("navigation");
  if (nav) render(nav, "Page response time");
}
if (document.readyState === "complete") showNavigation();
else window.addEventListener("load", showNavigation);

// a second request normally re-uses the open TCP/TLS connection, so DNS/TCP/TLS become 0 ms
document.getElementById("rerun").addEventListener("click", async () => {
  const url = location.href.split("#")[0] + "?t=" + Date.now();
  await fetch(url, { cache: "no-store" });
  const entries = performance.getEntriesByName(url);
  if (entries.length) render(entries[entries.length - 1], "Fetch response time");
});
