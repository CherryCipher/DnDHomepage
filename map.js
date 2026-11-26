"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const KEY = "hempstead-map-editor-v1";
  const ICONS = { shop: "🛍", house: "⌂", tavern: "🍺", location: "◆", poi: "✦" };
  const LABELS = { shop: "Shop", house: "Huis", tavern: "Tavern", location: "Locatie", poi: "POI" };
  const SOURCE = "data/map/map.json";
  const store = {
    data: { image: "data/map/hempstead.png", hotspots: [] },
    tables: [],
    selected: null,
    editing: false,
    placing: null,
    filter: "all",
    objectUrl: null
  };
  const nlLines = value => value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const makeId = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() :
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  const safeCategory = value => Object.hasOwn(ICONS, value) ? value : "poi";
  const normalize = raw => {
    const valid = raw && typeof raw === "object" ? raw : {};
    return {
      image: typeof valid.image === "string" ? valid.image : "data/map/hempstead.png",
      hotspots: (Array.isArray(valid.hotspots) ? valid.hotspots : []).filter(x =>
        x && typeof x.id === "string" && typeof x.name === "string" &&
        Number.isFinite(Number(x.x)) && Number.isFinite(Number(x.y))
      ).map(x => ({
        id: x.id, name: x.name.slice(0, 120), category: safeCategory(x.category),
        x: Math.max(0, Math.min(100, Number(x.x))), y: Math.max(0, Math.min(100, Number(x.y))),
        description: String(x.description || ""), dmDescription: String(x.dmDescription || ""),
        image: String(x.image || ""), people: Array.isArray(x.people) ? x.people.filter(y => typeof y === "string") : [],
        randomPeople: Array.isArray(x.randomPeople) ? x.randomPeople.filter(y => typeof y === "string") : [],
        randomCount: Math.max(0, Math.min(30, Number(x.randomCount) || 0)),
        tables: Array.isArray(x.tables) ? x.tables.filter(y => typeof y === "string") : []
      }))
    };
  };
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store.data));
      status("Lokaal opgeslagen. Exporteer JSON om dit naar je website te brengen.");
    } catch {
      status("Opslaan in browser mislukt. Exporteer de JSON voordat je afsluit.");
    }
  };
  const status = msg => { $("map-status").textContent = msg; };
  function imageLoad() {
    const image = $("map-image");
    image.onerror = () => {
      image.hidden = true;
      $("map-empty").hidden = false;
    };
    image.onload = () => {
      image.hidden = false;
      $("map-empty").hidden = true;
    };
    const url = store.objectUrl || store.data.image;
    image.removeAttribute("src");
    if (url) image.src = url;
    else { image.hidden = true; $("map-empty").hidden = false; }
  }

  function renderPins() {
    const container = $("map-pins");
    const fragment = document.createDocumentFragment();
    for (const item of store.data.hotspots) {
      if (store.filter !== "all" && item.category !== store.filter) continue;
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "map-pin";
      pin.classList.toggle("is-selected", item.id === store.selected);
      pin.style.left = item.x + "%";
      pin.style.top = item.y + "%";
      pin.dataset.category = item.category;
      pin.textContent = ICONS[item.category];
      pin.title = item.name;
      pin.setAttribute("aria-label", item.name + " (" + LABELS[item.category] + ")");
      pin.addEventListener("click", event => {
        event.stopPropagation();
        store.selected = item.id;
        store.placing = null;
        if (store.editing) editItem(item);
        else showItem(item);
        renderPins();
      });
      fragment.append(pin);
    }
    container.replaceChildren(fragment);
  }
  const element = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  const labeled = (parent, heading, body) => {
    if (!body) return;
    parent.append(element("h4", "map-detail-heading", heading), element("p", "map-detail-body", body));
  };
  function randomPeople(item) {
    const shuffled = [...item.randomPeople];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return [...item.people, ...shuffled.slice(0, item.randomCount)];
  }
  function showItem(item) {
    const parent = $("map-detail");
    parent.replaceChildren();
    parent.append(element("p", "eyebrow", LABELS[item.category]), element("h3", "", item.name));
    if (item.image) {
      const img = document.createElement("img");
      img.className = "map-detail-image";
      img.src = item.image;
      img.alt = item.name;
      img.loading = "lazy";
      parent.append(img);
    }
    labeled(parent, "Beschrijving", item.description);
    if (item.dmDescription) {
      const heading = element("h4", "map-detail-heading", "DM-notities");
      const notes = element("p", "map-dm-notes", item.dmDescription);
      parent.append(heading, notes);
    }
    const people = randomPeople(item);
    if (people.length) {
      parent.append(element("h4", "map-detail-heading", "Personen die je hier kunt tegenkomen"));
      const ul = element("ul", "map-person-list");
      people.forEach(person => ul.append(element("li", "", person)));
      parent.append(ul);
      if (item.randomPeople.length && item.randomCount) {
        const reroll = element("button", "control-button", "Andere aanwezigen");
        reroll.type = "button";
        reroll.addEventListener("click", () => showItem(item));
        parent.append(reroll);
      }
    }
    if (item.category !== "house" && item.tables.length) {
      parent.append(element("h4", "map-detail-heading", "Random tables"));
      item.tables.forEach(tableId => {
        const table = store.tables.find(x => x.id === tableId);
        if (!table) return;
        const button = element("button", "map-roll-button", "⚄  " + table.name);
        button.type = "button";
        const result = element("div", "map-roll-result");
        button.addEventListener("click", () => {
          if (!Array.isArray(table.rows) || !table.rows.length) return;
          const row = table.rows[Math.floor(Math.random() * table.rows.length)];
          result.textContent = String(row.roll) + " — " + row.result;
        });
        parent.append(button, result);
      });
    }
  }
  const current = () => store.data.hotspots.find(x => x.id === store.selected);
  function renderSelection() {
    if (store.editing) {
      $("map-detail").hidden = true;
      $("map-editor").hidden = false;
      if (current()) editItem(current());
      else $("map-hotspot-form").hidden = true;
    } else {
      $("map-detail").hidden = false;
      $("map-editor").hidden = true;
      if (current()) showItem(current());
      else $("map-detail").replaceChildren(element("p", "eyebrow", "HEMPSTEAD"), element("h3", "", "Kies een hotspot"),
        element("p", "", "Klik op een locatie op de kaart om de details te bekijken."));
    }
    renderPins();
  }
  function populateTableOptions(item) {
    const container = $("map-table-options");
    container.replaceChildren();
    if (!store.tables.length) {
      container.append(element("p", "map-hint", "Geen random tables gevonden."));
      return;
    }
    store.tables.forEach(t => {
      const label = element("label", "map-check-option");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = t.id;
      input.checked = item.tables.includes(t.id);
      label.append(input, document.createTextNode(" " + t.name));
      container.append(label);
    });
  }
  function applyCategory() {
    const category = $("map-hotspot-category").value;
    $("map-tables-section").hidden = category === "house";
    $("map-advanced-persons").hidden = category === "house";
  }
  function editItem(item) {
    $("map-hotspot-form").hidden = false;
    $("map-editor-title").textContent = "Hotspot: " + (item.name || "Nieuw");
    $("map-hotspot-name").value = item.name;
    $("map-hotspot-category").value = item.category;
    $("map-hotspot-description").value = item.description;
    $("map-hotspot-image").value = item.image;
    $("map-hotspot-dm").value = item.dmDescription;
    $("map-hotspot-people").value = item.people.join("\n");
    $("map-hotspot-random-people").value = item.randomPeople.join("\n");
    $("map-hotspot-random-count").value = String(item.randomCount);
    populateTableOptions(item);
    applyCategory();
  }
  function saveItem(event) {
    event.preventDefault();
    const item = current();
    if (!item) return;
    item.name = $("map-hotspot-name").value.trim();
    if (!item.name) return;
    item.category = safeCategory($("map-hotspot-category").value);
    item.description = $("map-hotspot-description").value.trim();
    item.image = $("map-hotspot-image").value.trim();
    item.dmDescription = $("map-hotspot-dm").value.trim();
    item.people = nlLines($("map-hotspot-people").value);
    item.randomPeople = item.category === "house" ? [] : nlLines($("map-hotspot-random-people").value);
    item.randomCount = item.category === "house" ? 0 :
      Math.max(0, Math.min(30, Number($("map-hotspot-random-count").value) || 0));
    item.tables = item.category === "house" ? [] :
      [...document.querySelectorAll("#map-table-options input:checked")].map(x => x.value);
    persist();
    editItem(item);
    renderPins();
  }
  function newHotspot(x, y) {
    const item = { id: makeId(), name: "Nieuwe hotspot", category: "poi", x, y,
      description: "", dmDescription: "", image: "", people: [], randomPeople: [], randomCount: 0, tables: [] };
    store.data.hotspots.push(item);
    store.selected = item.id;
    store.placing = null;
    persist();
    renderSelection();
    $("map-hotspot-name").focus();
    $("map-hotspot-name").select();
  }
  function onMapClick(event) {
    if (!store.editing || !store.placing) return;
    const bounds = $("map-surface").getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
    if (store.placing === "new") newHotspot(x, y);
    else {
      const item = current();
      if (item) { item.x = x; item.y = y; persist(); renderPins(); }
      store.placing = null;
      status("Pin verplaatst en opgeslagen.");
    }
    $("map-surface").classList.remove("is-placing");
  }
  function imageDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
      const request = indexedDB.open("hempstead-map-image-v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("files");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
  async function saveImage(file) {
    const db = await imageDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("files", "readwrite");
      transaction.objectStore("files").put(file, "city-map");
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }
  async function clearLocalImage() {
    try {
      const db = await imageDatabase();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction("files", "readwrite");
        transaction.objectStore("files").delete("city-map");
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    } catch { /* An absent local image is fine. */ }
  }
  async function loadLocalImage() {
    try {
      const db = await imageDatabase();
      const file = await new Promise((resolve, reject) => {
        const transaction = db.transaction("files", "readonly");
        const r = transaction.objectStore("files").get("city-map");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      db.close();
      if (file instanceof Blob) {
        if (store.objectUrl) URL.revokeObjectURL(store.objectUrl);
        store.objectUrl = URL.createObjectURL(file);
      }
    } catch { /* The hosted file path still works without IndexedDB. */ }
    imageLoad();
  }
  async function initialize() {
    try {
      const response = await fetch(SOURCE);
      if (response.ok) store.data = normalize(await response.json());
    } catch { status("Kaartdata niet bereikbaar. Je kunt wel lokaal bewerken."); }
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) store.data = normalize(JSON.parse(saved));
    } catch { status("Lokale kaartdata konden niet worden gelezen."); }
    try {
      const response = await fetch("data/tables/tables.json");
      if (response.ok) {
        const data = await response.json();
        store.tables = Array.isArray(data.tables) ? data.tables : [];
      }
    } catch { /* No table links until the JSON is available. */ }
    $("map-image-path").value = store.data.image;
    await loadLocalImage();
    renderSelection();
  }
  $("map-edit-toggle").addEventListener("click", () => {
    store.editing = !store.editing;
    store.placing = null;
    $("map-surface").classList.remove("is-placing");
    $("map-edit-toggle").setAttribute("aria-pressed", String(store.editing));
    $("map-edit-toggle").textContent = store.editing ? "Klaar met bewerken" : "Kaart bewerken";
    renderSelection();
  });
  $("map-category-filter").addEventListener("change", event => {
    store.filter = event.target.value;
    renderPins();
  });
  $("map-new").addEventListener("click", () => {
    store.placing = "new";
    $("map-surface").classList.add("is-placing");
    status("Klik op een plek op de kaart om de nieuwe hotspot te plaatsen.");
  });
  $("map-reposition").addEventListener("click", () => {
    store.placing = "move";
    $("map-surface").classList.add("is-placing");
    status("Klik op de nieuwe positie van de geselecteerde pin.");
  });
  $("map-surface").addEventListener("click", onMapClick);
  $("map-hotspot-category").addEventListener("change", applyCategory);
  $("map-hotspot-form").addEventListener("submit", saveItem);
  $("map-delete").addEventListener("click", () => {
    const item = current();
    if (!item || !confirm("Hotspot verwijderen: " + item.name + "?")) return;
    store.data.hotspots = store.data.hotspots.filter(x => x.id !== item.id);
    store.selected = null;
    persist();
    renderSelection();
  });
  $("map-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(store.data, null, 2) + "\n"], {type: "application/json"});
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "map.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("map.json geëxporteerd. Plaats dit bestand in data/map/map.json om hotspots online te publiceren.");
  });
  $("map-import").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!raw || !Array.isArray(raw.hotspots)) throw new Error("Geen hotspots-array gevonden");
      store.data = normalize(raw);
      store.selected = null;
      $("map-image-path").value = store.data.image;
      persist();
      imageLoad();
      renderSelection();
      status("JSON geïmporteerd. De lokale afbeelding wordt apart opgeslagen.");
    } catch (error) { status("Import mislukt: " + error.message); }
    event.target.value = "";
  });
  $("map-apply-path").addEventListener("click", async () => {
    store.data.image = $("map-image-path").value.trim();
    if (store.objectUrl) URL.revokeObjectURL(store.objectUrl);
    store.objectUrl = null;
    await clearLocalImage();
    persist();
    imageLoad();
  });
  $("map-image-upload").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      status("Gebruik een PNG, JPG of WebP."); return;
    }
    try {
      await saveImage(file);
      if (store.objectUrl) URL.revokeObjectURL(store.objectUrl);
      store.objectUrl = URL.createObjectURL(file);
      imageLoad();
      status("Afbeelding lokaal geladen. Voeg hetzelfde bestand ook aan je webserver/repository toe voor andere apparaten.");
    } catch { status("Afbeelding kon niet lokaal worden opgeslagen; probeer een kleinere PNG."); }
    event.target.value = "";
  });
  initialize();
})();
