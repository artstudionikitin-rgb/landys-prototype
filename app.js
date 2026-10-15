/* Landys — прототип поиска подрядников с картой */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CATS = window.CATEGORIES, PROS = window.CONTRACTORS;
  const catById = Object.fromEntries(CATS.map(c => [c.id, c]));
  const img = (id, w = 640) => `https://images.unsplash.com/${id}?w=${w}&h=${Math.round(w * .85)}&fit=crop&q=70`;
  const icons = () => window.lucide && lucide.createIcons();
  const isMobile = () => matchMedia("(max-width: 820px)").matches;

  const S = {
    county: "Angelina", cat: "all", land: null, sort: "rec",
    page: 1, quick: new Set(), picked: new Set(), saved: new Set([11]),
    area: null, hover: null
  };

  /* ---------- Фильтрация ---------- */
  function inScope(c) {
    if (S.area) return S.area.contains(c.ll);
    return c.serves.includes(S.county);
  }
  function passes(c, ignoreCat = false) {
    if (!inScope(c)) return false;
    if (!ignoreCat && S.cat !== "all" && !c.cats.includes(S.cat)) return false;
    if (S.land && !c.land.includes(S.land)) return false;
    if (S.quick.has("top") && !c.top) return false;
    if (S.quick.has("verified") && !c.verified) return false;
    if (S.quick.has("fast") && c.reply >= 30) return false;
    if (S.quick.has("guarantee") && !c.guarantee) return false;
    return true;
  }
  const score = c => (c.top ? 3 : 0) + c.rating + Math.min(c.nearby, 15) / 10 + (c.serves[0] === S.county ? .6 : 0) - c.reply / 200;
  const SORTS = {
    rec: (a, b) => score(b) - score(a),
    rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
    reply: (a, b) => a.reply - b.reply,
    nearby: (a, b) => b.nearby - a.nearby
  };
  const results = () => PROS.filter(c => passes(c)).sort(SORTS[S.sort]);

  /* ---------- Категории ---------- */
  function renderCats() {
    $("#cats").innerHTML = CATS.map(c => {
      const n = c.id === "all" ? PROS.filter(p => passes(p, true)).length
                               : PROS.filter(p => passes(p, true) && p.cats.includes(c.id)).length;
      return `<button class="cat ${S.cat === c.id ? "on" : ""}" data-cat="${c.id}">
        <i data-lucide="${c.icon}"></i>${c.short || c.name}<span class="n">${n}</span></button>`;
    }).join("");
  }

  /* ---------- Карточки ---------- */
  function servesText(c) {
    const others = c.serves.filter(s => s !== S.county).length;
    if (S.area) return `Based in <b>${c.town}</b> · serves ${c.serves.length} counties`;
    return c.serves[0] === S.county
      ? `Based in <b>${S.county}</b>${others ? ` +${others} counties` : ""}`
      : `Based in ${c.town} · <b>serves ${S.county}</b>`;
  }
  function card(c) {
    const cats = c.cats.map(id => catById[id].short || catById[id].name).join(" · ");
    const picked = S.picked.has(c.id);
    return `<article class="card ${picked ? "picked" : ""}" data-id="${c.id}">
      <div class="media">
        <div class="slides" style="--i:0">${c.photos.map(p => `<img loading="lazy" src="${img(p)}" alt="">`).join("")}</div>
        <div class="badges">
          ${c.top ? `<span class="badge"><i data-lucide="award"></i>Top Pro</span>` : ""}
          ${c.verified ? `<span class="badge badge-ver"><i data-lucide="badge-check"></i>Verified</span>` : ""}
        </div>
        <button class="heart ${S.saved.has(c.id) ? "on" : ""}" data-act="save" aria-label="Save"><i data-lucide="heart"></i></button>
        <button class="nav prev" data-act="prev" aria-label="Previous"><i data-lucide="chevron-left"></i></button>
        <button class="nav next" data-act="next" aria-label="Next"><i data-lucide="chevron-right"></i></button>
        <div class="dots">${c.photos.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>
      </div>
      <div class="body">
        <div class="head-block">
        <div class="row1">
          <h3>${c.name}</h3>
          <span class="rate"><i data-lucide="star"></i>${c.rating.toFixed(1)}<small>(${c.reviews})</small></span>
        </div>
        <p class="meta">${cats} · ${c.years} yrs</p>
        <p class="meta note">${c.note}</p>
        </div>
        <p class="serve"><span class="live"></span>${c.nearby} projects nearby · ${servesText(c)}</p>
        <div class="foot">
          <span class="reply"><i data-lucide="zap"></i>Replies in ~${c.reply < 60 ? c.reply + " min" : Math.round(c.reply / 60) + " hr"}</span>
          <button class="add" data-act="pick">${picked ? `<i data-lucide="check"></i>Added` : `<i data-lucide="plus"></i>Add to request`}</button>
        </div>
      </div>
    </article>`;
  }

  function face(c, cls = "face") { return `<span class="${cls}" style="background-image:url(${img(c.photos[0], 120)})"></span>`; }

  const PER_PAGE = 8;
  let lastSig = "";
  function pagerHtml(total) {
    const pages = Math.ceil(total / PER_PAGE);
    if (pages < 2) return "";
    const nums = Array.from({ length: pages }, (_, i) => i + 1)
      .map(n => `<button class="pg ${n === S.page ? "on" : ""}" data-page="${n}" aria-label="Page ${n}">${n}</button>`).join("");
    return `<div class="pg-row">
        <button class="pg pg-arrow" data-page="${S.page - 1}" ${S.page === 1 ? "disabled" : ""} aria-label="Previous page"><i data-lucide="chevron-left"></i></button>
        ${nums}
        <button class="pg pg-arrow" data-page="${S.page + 1}" ${S.page === pages ? "disabled" : ""} aria-label="Next page"><i data-lucide="chevron-right"></i></button>
      </div>`;
  }

  function renderList() {
    const list = results();
    const where = S.area ? "this map area" : `${S.county} County`;
    const catName = S.cat === "all" ? "Land pros" : catById[S.cat].name;
    $("#title").innerHTML = `${catName} ${S.area ? "in" : "serving"} <em>${where}</em>`;
    const local = list.filter(c => c.serves[0] === S.county).length;
    $("#sub").innerHTML = list.length
      ? `<b>${list.length} pros</b> ${S.area ? `in this area · <a href="#" class="back-county" data-county="${S.county}">Back to ${S.county} County</a>` : `· ${local} based locally · ${list.reduce((s, c) => s + c.nearby, 0)} projects done nearby`}`
      : (S.area ? `No pros in this area · <a href="#" class="back-county" data-county="${S.county}">Back to ${S.county} County</a>` : "No matches for these filters");
    document.title = `${catName} in ${where}, TX · Landys`;

    /* при смене фильтров/области — снова первая страница */
    const sig = JSON.stringify([S.county, S.cat, S.land, S.sort, [...S.quick], S.area && S.area.toBBoxString()]);
    if (sig !== lastSig) { S.page = 1; lastSig = sig; }
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    S.page = Math.min(S.page, pages);
    const pageList = list.slice((S.page - 1) * PER_PAGE, S.page * PER_PAGE);
    $("#grid").innerHTML = pageList.map(card).join("");
    $("#pager").innerHTML = pagerHtml(list.length);
    $("#empty").hidden = list.length > 0;
    $("#emptyTitle").textContent = S.area || S.cat !== "all" || S.quick.size || S.land
      ? "No pros match these filters" : `No pros in ${S.county} County yet`;
    $("#match").style.display = list.length >= 3 ? "" : "none";
    $("#matchFaces").innerHTML = list.slice(0, 3).map(c => face(c)).join("");

    const fc = S.quick.size + (S.land ? 1 : 0);
    $("#fcount").hidden = !fc; $("#fcount").textContent = fc;
    $("#mWhere").textContent = `${S.county} County, TX`;
    $("#mWhat").textContent = `${S.cat === "all" ? "All land pros" : catById[S.cat].name} · ${S.land || "Any land"}`;

    renderCats();
    renderMarkers(pageList);
    renderTray();
    icons();
  }

  /* ---------- Поиск: поповеры ---------- */
  function renderPops() {
    $("#stateList").innerHTML = STATES.map(s => `<li><button ${s.live ? 'class="on"' : "disabled"}>
      <span class="state-flag">${s.code}</span>${s.name}${s.live ? "" : '<span class="soon">Soon</span>'}</button></li>`).join("");
    const counts = {};
    COUNTIES.features.forEach(f => counts[f.properties.name] = PROS.filter(p => p.serves.includes(f.properties.name)).length);
    const q = ($("#countyFilter").value || "").toLowerCase();
    $("#countyList").innerHTML = COUNTIES.features.map(f => f.properties.name).sort()
      .filter(n => n.toLowerCase().includes(q))
      .map(n => `<li><button data-county="${n}" class="${n === S.county && !S.area ? "on" : ""}">${n} County<small>${counts[n] ? counts[n] + " pros" : "Coming soon"}</small></button></li>`).join("");
    $("#serviceList").innerHTML = CATS.map(c => `<li><button data-cat="${c.id}" class="${S.cat === c.id ? "on" : ""}"><span class="ic"><i data-lucide="${c.icon}"></i></span>${c.name}</button></li>`).join("");
    $("#landList").innerHTML = [null, ...LAND_TYPES].map(l => `<li><button data-land="${l || ""}" class="${S.land === l ? "on" : ""}"><span class="ic"><i data-lucide="${LAND_ICONS[l || "Any land"]}"></i></span>${l || "Any land"}</button></li>`).join("");
    icons();
  }
  function openPop(name) {
    $$(".pop").forEach(p => p.hidden = p.id !== `pop-${name}` || !p.hidden);
    $$(".seg").forEach(s => s.classList.toggle("is-open", s.dataset.pop === name && !$(`#pop-${name}`).hidden));
    renderPops();
    if (name === "where" && !$("#pop-where").hidden) setTimeout(() => $("#countyFilter").focus(), 30);
  }
  const closePops = () => { $$(".pop").forEach(p => p.hidden = true); $$(".seg").forEach(s => s.classList.remove("is-open")); };

  function updateSearchLabels() {
    $("#svcVal").textContent = S.cat === "all" ? "All land pros" : catById[S.cat].name;
    $("#svcVal").classList.toggle("set", S.cat !== "all");
    $("#whereVal").textContent = S.area ? "Map area, TX" : `${S.county} County, TX`;
    $("#whereVal").classList.add("set");
    $("#landVal").textContent = S.land || "Any land";
    $("#landVal").classList.toggle("set", !!S.land);
  }

  /* ---------- Карта ---------- */
  let map, terrain, countyLayer, maskLayer, outlineLayer, serviceLayer, projLayer;
  const markers = new Map();
  let areaTimer;
  function searchArea() {
    if (map._popup && map.hasLayer(map._popup)) return;
    S.area = freeBounds();
    updateSearchLabels(); renderList();
  }
  let quietUntil = 0, userMove = false;
  const quiet = (ms = 1500) => { quietUntil = Date.now() + ms; };

  /* Свободная зона карты — всё, что не перекрыто плашками */
  function freePad() {
    const ch = $("#chrome").getBoundingClientRect();
    const lp = $("#listPane").getBoundingClientRect();
    const listVisible = lp.width > 0 && getComputedStyle($("#listPane")).display !== "none" && !isMobile();
    return { tl: [listVisible ? lp.right + 50 : 30, ch.bottom + 60], br: [isMobile() ? 30 : 70, isMobile() ? 150 : 90] };
  }
  function freeBounds() {
    const p = freePad(), size = map.getSize();
    return L.latLngBounds(map.containerPointToLatLng(p.tl), map.containerPointToLatLng([size.x - p.br[0], size.y - p.br[1]]));
  }

  const toLatLngs = f => f.geometry.coordinates.map(poly => poly.map(ring => ring.map(([x, y]) => [y, x])));
  const featureOf = name => COUNTIES.features.find(f => f.properties.name === name);

  function initMap() {
    map = L.map("map", { zoomControl: false, attributionControl: true, minZoom: 7, maxZoom: 16, zoomSnap: .25 }).setView([31.27, -94.6], 10);
    terrain = L.layerGroup([
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", { attribution: "Esri" })
    ]);
    terrain.addTo(map);
    $("#map").classList.add("tone-terrain");

    countyLayer = L.geoJSON(COUNTIES, {
      style: () => ({ color: "#FEFBF6", weight: 1, opacity: .35, fillOpacity: 0, dashArray: "3 5" }),
      onEachFeature: (f, layer) => {
        const n = f.properties.name;
        layer.bindTooltip(() => {
          const k = PROS.filter(p => p.serves.includes(n)).length;
          return `${n} County<small>${k ? k + " pros · click to explore" : "Coming soon"}</small>`;
        }, { sticky: true, className: "county-tip", direction: "top", offset: [0, -10] });
        layer.on("mouseover", () => n !== S.county && layer.setStyle({ fillColor: "#FEFBF6", fillOpacity: .12, opacity: .8 }));
        layer.on("mouseout", () => layer.setStyle({ fillOpacity: 0, opacity: .35 }));
        layer.on("click", () => selectCounty(n));
      }
    }).addTo(map);

    serviceLayer = L.layerGroup().addTo(map);
    projLayer = L.layerGroup().addTo(map);
    buildProjects();

    map.on("autopanstart", () => { quiet(); });
    /* автопоиск только после действий пользователя: перетаскивание, колесо, тач, кнопки зума */
    const el = map.getContainer();
    ["pointerdown", "wheel", "touchstart", "keydown"].forEach(ev => el.addEventListener(ev, () => { userMove = true; }, { passive: true }));
    map.on("moveend", () => {
      if (!userMove) return;
      userMove = false;
      if (Date.now() < quietUntil) return;
      clearTimeout(areaTimer);
      areaTimer = setTimeout(searchArea, 350);
    });
    map.on("click", () => setHot(null));
  }

  function drawCounty(fit = true) {
    if (maskLayer) map.removeLayer(maskLayer);
    if (outlineLayer) map.removeLayer(outlineLayer);
    const f = featureOf(S.county);
    const rings = toLatLngs(f).map(p => p[0]);
    const world = [[85, -180], [85, 180], [-85, 180], [-85, -180]];
    maskLayer = L.polygon([world, ...rings], { stroke: false, fillColor: "#24180d", fillOpacity: .45, interactive: false }).addTo(map);
    outlineLayer = L.layerGroup([
      L.polygon(rings, { stroke: false, fillColor: "#5a4126", fillOpacity: .16, interactive: false }),
      L.polygon(rings, { color: "#14120e", weight: 7, opacity: .25, fill: false, interactive: false }),
      L.polygon(rings, { color: "#FEFBF6", weight: 2.5, fill: false, interactive: false })
    ]).addTo(map);
    if (fit) {
      quiet();
      const p = freePad();
      map.flyToBounds(L.polygon(rings).getBounds(), { paddingTopLeft: p.tl, paddingBottomRight: p.br, duration: .8 });
    }
  }

  function pinHtml(c) {
    const ic = catById[c.cats[0]].icon;
    return `<div class="pin ${c.top ? "top" : ""} ${S.picked.has(c.id) ? "picked" : ""}" data-id="${c.id}">
      <span class="ic"><i data-lucide="${ic}"></i></span>${c.rating.toFixed(1)}<span class="ck"><i data-lucide="check"></i></span></div>`;
  }
  function renderMarkers(list) {
    if (!map) return;
    const keep = new Set(list.map(c => c.id));
    markers.forEach((m, id) => { if (!keep.has(id)) { map.removeLayer(m); markers.delete(id); } });
    list.forEach(c => {
      if (markers.has(c.id)) return;
      const m = L.marker(c.ll, { icon: L.divIcon({ className: "pin-wrap", html: pinHtml(c), iconSize: [0, 0] }), riseOnHover: true, zIndexOffset: c.top ? 200 : 0 })
        .addTo(map)
        .bindPopup(() => popupHtml(c), { className: "lp", offset: [0, -40], maxWidth: 280, autoPanPaddingTopLeft: L.point(freePad().tl), autoPanPaddingBottomRight: [30, 80] });
      m.on("mouseover", () => setHot(c.id, "map"));
      m.on("mouseout", () => setHot(null, "map"));
      m.on("popupopen", () => { icons(); setHot(c.id, "map"); });
      markers.set(c.id, m);
    });
    icons();
  }
  function popupHtml(c) {
    return `<div class="lp-img" style="background-image:url(${img(c.photos[0], 520)})"></div>
      <div class="lp-body">
        <h4>${c.name}<span class="rate"><i data-lucide="star"></i>${c.rating.toFixed(1)}</span></h4>
        <p>${c.cats.map(id => catById[id].short || catById[id].name).join(" · ")} · ${c.town}, TX</p>
        <p>${c.nearby} projects nearby · replies in ~${c.reply} min</p>
        <div class="lp-actions">
          <button class="btn btn-line" data-scroll="${c.id}">View</button>
          <button class="btn btn-accent" data-pick-pop="${c.id}">${S.picked.has(c.id) ? "Added ✓" : "Add to request"}</button>
        </div>
      </div>`;
  }

  /* Зона обслуживания подрядника подсвечивается при наведении */
  function showService(c) {
    serviceLayer.clearLayers();
    if (!c) return;
    c.serves.forEach(n => {
      const f = featureOf(n); if (!f) return;
      L.polygon(toLatLngs(f).map(p => p[0]), {
        color: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
        weight: 2, fillOpacity: .16, interactive: false
      }).addTo(serviceLayer);
    });
  }

  function setHot(id, from) {
    if (S.hover === id) return;
    S.hover = id;
    $$(".pin.hot").forEach(p => p.classList.remove("hot"));
    $$(".card.is-hot").forEach(p => p.classList.remove("is-hot"));
    markers.forEach(m => m.setZIndexOffset(0));
    const c = PROS.find(p => p.id === id);
    showService(c);
    if (!c) return;
    const m = markers.get(id);
    if (m) { m.setZIndexOffset(1000); m.getElement()?.querySelector(".pin")?.classList.add("hot"); }
    const el = $(`.card[data-id="${id}"]`);
    if (el) el.classList.add("is-hot");
  }

  /* Точки завершённых проектов — показывают «живость» региона */
  function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
  function inPoly(pt, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function buildProjects() {
    const rnd = seeded(42);
    COUNTIES.features.forEach(f => {
      const n = f.properties.name;
      const k = PROS.filter(p => p.serves.includes(n)).reduce((s, p) => s + p.nearby, 0) / (n === "Angelina" ? 4 : 9);
      const ring = f.geometry.coordinates[0][0];
      const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      let made = 0, guard = 0;
      while (made < k && guard++ < 800) {
        const pt = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)];
        if (!inPoly(pt, ring)) continue;
        made++;
        const type = PROJECT_TYPES[Math.floor(rnd() * PROJECT_TYPES.length)];
        const yr = 2023 + Math.floor(rnd() * 4);
        L.circleMarker([pt[1], pt[0]], { radius: 3.5, color: "#FEFBF6", weight: 1, fillColor: "#E0A24A", fillOpacity: .95, className: "proj-dot" })
          .bindTooltip(`${type}<small>Completed ${yr} · via Landys</small>`, { className: "county-tip", direction: "top", offset: [0, -4] })
          .addTo(projLayer);
      }
    });
  }

  function selectCounty(name) {
    S.county = name; S.area = null;
    clearTimeout(areaTimer);
    closePops();
    drawCounty(true);
    updateSearchLabels();
    renderList();
    $("#listPane").scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- Мультивыбор ---------- */
  function togglePick(id) {
    S.picked.has(id) ? S.picked.delete(id) : S.picked.add(id);
    const el = $(`.card[data-id="${id}"]`);
    if (el) {
      const on = S.picked.has(id);
      el.classList.toggle("picked", on);
      $(".add", el).innerHTML = on ? `<i data-lucide="check"></i>Added` : `<i data-lucide="plus"></i>Add to request`;
    }
    markers.get(id)?.getElement()?.querySelector(".pin")?.classList.toggle("picked", S.picked.has(id));
    renderTray(); icons();
  }
  function renderTray() {
    const ps = [...S.picked].map(id => PROS.find(p => p.id === id));
    $("#tray").hidden = !ps.length;
    $("#trayFaces").innerHTML = ps.slice(0, 4).map(c => face(c)).join("");
    $("#trayTitle").textContent = `${ps.length} pro${ps.length > 1 ? "s" : ""} selected`;
  }

  /* ---------- Модалка ---------- */
  const PT_ICONS = {
    "Land clearing": "trees", "Pond building": "waves", "Water well drilling": "droplets",
    "Barbed wire fence": "fence", "House pad": "house", "Road building": "route",
    "Septic install": "cylinder", "Property line staking": "flag"
  };
  function openModal(kind) {
    let rec = [];
    if (kind === "picked") rec = [...S.picked].map(id => PROS.find(p => p.id === id));
    else if (kind === "top3") rec = results().slice(0, 3);
    $("#mKicker").textContent = kind === "picked" ? `Send to ${rec.length} selected` : kind === "top3" ? "Send to top 3 matches" : "Start your project";
    $("#mTitle").textContent = kind === "request" ? "We'll match you with the right pros" : "Tell pros about your project";
    $("#recips").innerHTML = rec.length
      ? rec.map(c => `<span class="recip">${face(c)}${c.name}</span>`).join("")
      : `<span class="recip-plain"><i data-lucide="map-pin"></i>${S.county} County, TX</span>`;
    $("#ptypes").innerHTML = PROJECT_TYPES.slice(0, 8).map((t, i) => `<button type="button" class="${i === 0 ? "on" : ""}"><i data-lucide="${PT_ICONS[t] || "shovel"}"></i><span>${t}</span></button>`).join("");
    $("#mLand").innerHTML = LAND_TYPES.map(l => `<option ${l === S.land ? "selected" : ""}>${l}</option>`).join("");
    $("#sheetForm").hidden = false; $("#sheetDone").hidden = true;
    $("#doneText").textContent = rec.length
      ? `${rec.length} pro${rec.length > 1 ? "s" : ""} got your project. Expect replies by text & email — usually within 30 minutes.`
      : "Our Texas team will connect you with a trusted local pro in less than 48 hours.";
    $("#modal").hidden = false;
    icons();
  }
  const closeModal = () => $("#modal").hidden = true;

  /* ---------- События ---------- */
  document.addEventListener("click", e => {
    const t = e.target;

    const seg = t.closest(".seg");
    if (seg) { openPop(seg.dataset.pop); return; }
    if (!t.closest(".pop") && !t.closest(".seg")) closePops();

    const cat = t.closest("[data-cat]");
    if (cat) { S.cat = cat.dataset.cat; closePops(); updateSearchLabels(); renderList(); return; }
    const cty = t.closest("[data-county]");
    if (cty) { e.preventDefault(); selectCounty(cty.dataset.county); return; }
    const land = t.closest("[data-land]");
    if (land) { S.land = land.dataset.land || null; closePops(); updateSearchLabels(); renderList(); return; }

    const q = t.closest(".qchip");
    if (q) { const k = q.dataset.q; S.quick.has(k) ? S.quick.delete(k) : S.quick.add(k); q.classList.toggle("on"); renderList(); return; }

    const act = t.closest("[data-act]");
    if (act) {
      e.stopPropagation();
      const cardEl = act.closest(".card"), id = +cardEl.dataset.id;
      if (act.dataset.act === "save") { S.saved.has(id) ? S.saved.delete(id) : S.saved.add(id); act.classList.toggle("on"); }
      if (act.dataset.act === "pick") togglePick(id);
      if (act.dataset.act === "prev" || act.dataset.act === "next") {
        const sl = $(".slides", cardEl), n = sl.children.length;
        let i = +getComputedStyle(sl).getPropertyValue("--i") || 0;
        i = (i + (act.dataset.act === "next" ? 1 : -1) + n) % n;
        sl.style.setProperty("--i", i);
        $$(".dots i", cardEl).forEach((d, k) => d.classList.toggle("on", k === i));
      }
      return;
    }

    const cardEl = t.closest(".card");
    if (cardEl) {
      const id = +cardEl.dataset.id, m = markers.get(id);
      if (m) {
        if (isMobile()) document.body.classList.add("show-map"), setMobileToggle();
        quiet();
        const p = freePad(), sz = map.getSize();
        const target = map.latLngToContainerPoint(m.getLatLng());
        const cx = (p.tl[0] + sz.x - p.br[0]) / 2, cy = (p.tl[1] + sz.y - p.br[1]) / 2;
        map.panBy([target.x - cx, target.y - cy], { animate: true });
        setTimeout(() => { map.invalidateSize(); m.openPopup(); }, isMobile() ? 120 : 250);
      }
      return;
    }

    const sc = t.closest("[data-scroll]");
    if (sc) {
      map.closePopup();
      if (isMobile()) { document.body.classList.remove("show-map"); setMobileToggle(); }
      const el = $(`.card[data-id="${sc.dataset.scroll}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("is-hot"); setTimeout(() => el?.classList.remove("is-hot"), 1600);
      return;
    }
    const pp = t.closest("[data-pick-pop]");
    if (pp) { const id = +pp.dataset.pickPop; togglePick(id); pp.textContent = S.picked.has(id) ? "Added ✓" : "Add to request"; return; }

    const pg = t.closest("[data-page]");
    if (pg && !pg.disabled) {
      S.page = +pg.dataset.page; renderList();
      $("#listPane").scrollTo({ top: $("#grid").offsetTop - 20, behavior: "smooth" });
      return;
    }

    const open = t.closest("[data-open]");
    if (open) { openModal(open.dataset.open); return; }
    if (t.closest("[data-close]")) { closeModal(); return; }

    const chip = t.closest(".chips-pick button, .seg-pick button");
    if (chip) {
      if (chip.closest(".seg-pick")) $$("button", chip.parentNode).forEach(b => b.classList.remove("on"));
      chip.classList.toggle("on", chip.closest(".seg-pick") ? true : !chip.classList.contains("on"));
      return;
    }


  });

  /* Наведение на карточку → пин и зона обслуживания */
  $("#grid").addEventListener("mouseover", e => { const c = e.target.closest(".card"); if (c) setHot(+c.dataset.id); });
  $("#grid").addEventListener("mouseleave", () => setHot(null));

  $("#sort").addEventListener("change", e => { S.sort = e.target.value; renderList(); });
  $("#countyFilter").addEventListener("input", renderPops);
  $("#countyFilter").addEventListener("keydown", e => {
    if (e.key === "Enter") { const b = $("#countyList button"); if (b) selectCounty(b.dataset.county); }
  });
  $("#zin").onclick = () => { userMove = true; map.zoomIn(); };
  $("#zout").onclick = () => { userMove = true; map.zoomOut(); };
  $("#zfit").onclick = () => { S.area ? selectCounty(S.county) : drawCounty(true); };
  $("#trayClear").onclick = () => { [...S.picked].forEach(togglePick); };
  $("#resetBtn").onclick = () => { S.cat = "all"; S.land = null; S.quick.clear(); S.area = null; $$(".qchip").forEach(q => q.classList.remove("on")); updateSearchLabels(); renderList(); drawCounty(true); };
  $("#reqForm").addEventListener("submit", e => { e.preventDefault(); $("#sheetForm").hidden = true; $("#sheetDone").hidden = false; icons(); });
  $("#filtersBtn").onclick = e => { e.stopPropagation(); openPop("land"); };
  $("#msearch").onclick = e => { e.stopPropagation(); openPop("where"); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closePops(); closeModal(); } });

  function setMobileToggle() {
    const on = document.body.classList.contains("show-map");
    $("#mtoggle").innerHTML = on ? `<i data-lucide="list"></i><span>List</span>` : `<i data-lucide="map"></i><span>Map</span>`;
    icons();
  }
  $("#mtoggle").onclick = () => {
    document.body.classList.toggle("show-map"); setMobileToggle();
    setTimeout(() => { quiet(); map.invalidateSize(); drawCounty(true); }, 50);
  };

  /* ---------- Ползунок подсветки в поиске ---------- */
  const glider = document.createElement("span");
  glider.className = "glider";
  $("#search").prepend(glider);
  function glideTo(seg) {
    if (!seg) { glider.classList.remove("on", "open"); return; }
    glider.style.width = seg.offsetWidth + "px";
    glider.style.transform = `translateX(${seg.offsetLeft}px)`;
    glider.classList.add("on");
    glider.classList.toggle("open", seg.classList.contains("is-open"));
  }
  const openSeg = () => $(".seg.is-open");
  $$(".search .seg").forEach(seg => seg.addEventListener("mouseenter", () => glideTo(seg)));
  $("#search").addEventListener("mouseleave", () => glideTo(openSeg()));
  new MutationObserver(recs => recs.some(r => r.target.classList.contains("seg")) && glideTo(openSeg() || ($("#search").matches(":hover") ? $(".search .seg:hover") : null)))
    .observe($("#search"), { subtree: true, attributes: true, attributeFilter: ["class"] });

  /* ---------- Старт ---------- */
  initMap();
  drawCounty(false);
  quiet();
  { const p = freePad(); map.fitBounds(L.polygon(toLatLngs(featureOf(S.county)).map(p => p[0])).getBounds(), { paddingTopLeft: p.tl, paddingBottomRight: p.br }); }
  quiet();
  updateSearchLabels();
  renderPops();
  renderList();
  window.addEventListener("resize", () => { quiet(); map.invalidateSize(); });
})();
