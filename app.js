"use strict";

const byId = (id) => document.getElementById(id);
const musicAudio = new Audio();
musicAudio.loop = true;
musicAudio.preload = "none";
let currentTrack = null;
let paused = false;
const activeEffects = new Set();

function showMessage(id, message = "") {
  byId(id).textContent = message;
}

function updatePlayer() {
  byId("now-playing").textContent = currentTrack ? currentTrack.name : "Nothing playing";
  byId("player-status").textContent = currentTrack ? (paused ? "Paused · looping enabled" : "Playing · looping enabled") : "Choose a track to begin";
  byId("pause-music").disabled = !currentTrack;
  byId("stop-music").disabled = !currentTrack;
  byId("pause-music").textContent = paused ? "Resume" : "Pause";
  document.querySelectorAll("#music-grid .sound-button").forEach(button => {
    const selected = !!currentTrack && button.dataset.id === currentTrack.id;
    button.classList.toggle("is-playing", selected);
    button.setAttribute("aria-pressed", String(selected && !paused));
  });
}

function stopMusic() {
  musicAudio.pause();
  musicAudio.removeAttribute("src");
  musicAudio.load();
  currentTrack = null;
  paused = false;
  showMessage("soundboard-message");
  updatePlayer();
}

async function playMusic(track) {
  showMessage("soundboard-message");
  if (currentTrack?.id === track.id) {
    if (!paused) return;
    try { await musicAudio.play(); paused = false; }
    catch { showMessage("soundboard-message", "Unable to play this file. Check its name and location."); }
    updatePlayer();
    return;
  }
  musicAudio.pause();
  currentTrack = track;
  paused = false;
  musicAudio.src = track.file;
  musicAudio.loop = true;
  updatePlayer();
  try { await musicAudio.play(); }
  catch {
    if (currentTrack?.id === track.id) {
      stopMusic();
      showMessage("soundboard-message", "Could not load “" + track.name + "”. Add its audio file at " + track.file);
    }
  }
}

function playSfx(effect, button) {
  showMessage("soundboard-message");
  const audio = new Audio(effect.file);
  audio.volume = byId("sfx-volume").value / 100;
  activeEffects.add(audio);
  button.classList.add("is-triggered");
  function cleanup() {
    activeEffects.delete(audio);
    button.classList.remove("is-triggered");
    audio.removeEventListener("ended", cleanup);
    audio.removeEventListener("error", onError);
  }
  function onError() {
    cleanup();
    showMessage("soundboard-message", "Could not load “" + effect.name + "”. Add its audio file at " + effect.file);
  }
  audio.addEventListener("ended", cleanup);
  audio.addEventListener("error", onError);
  audio.play().catch(onError);
}

function createSoundButton(item, kind) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sound-button";
  button.dataset.id = item.id;
  button.setAttribute("aria-label", (kind === "music" ? "Play music: " : "Play effect: ") + item.name);
  if (kind === "music") button.setAttribute("aria-pressed", "false");
  const icon = document.createElement("span");
  icon.className = "sound-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = kind === "music" ? "♫" : "✧";
  const name = document.createElement("span");
  name.className = "sound-name";
  name.textContent = item.name;
  button.append(icon, name);
  button.addEventListener("click", () => kind === "music" ? playMusic(item) : playSfx(item, button));
  return button;
}

function validSounds(items) {
  return Array.isArray(items) ? items.filter(item => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.file === "string" && item.file.startsWith("data/soundboard/") && !item.file.includes("..")) : [];
}

async function loadSoundboard() {
  try {
    const response = await fetch("data/soundboard/sounds.json");
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    const music = validSounds(data.music);
    const effects = validSounds(data.sfx);
    byId("music-grid").replaceChildren(...music.map(item => createSoundButton(item, "music")));
    byId("sfx-grid").replaceChildren(...effects.map(item => createSoundButton(item, "sfx")));
    if (!music.length || !effects.length) showMessage("soundboard-message", "Add tracks to both sections in data/soundboard/sounds.json.");
  } catch (error) {
    showMessage("soundboard-message", "Could not load sounds.json. Run this website through a local web server, not file://.");
    console.error(error);
  }
}

function renderTable(table) {
  byId("table-title").textContent = table.name;
  byId("table-description").textContent = table.description || "";
  byId("table-die").textContent = table.die || "";
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const fragment = document.createDocumentFragment();
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const roll = document.createElement("td");
    const result = document.createElement("td");
    roll.textContent = String(row.roll ?? "");
    result.textContent = String(row.result ?? "");
    tr.append(roll, result);
    fragment.append(tr);
  });
  byId("table-rows").replaceChildren(fragment);
}

async function loadTables() {
  try {
    const response = await fetch("data/tables/tables.json");
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    const tables = Array.isArray(data.tables) ? data.tables.filter(item => item && typeof item.id === "string" && typeof item.name === "string") : [];
    const select = byId("table-select");
    select.replaceChildren();
    if (!tables.length) {
      select.add(new Option("No tables configured", ""));
      showMessage("tables-message", "Add a table to data/tables/tables.json.");
      return;
    }
    tables.forEach(table => select.add(new Option(table.name, table.id)));
    select.addEventListener("change", () => {
      const table = tables.find(item => item.id === select.value);
      if (table) renderTable(table);
    });
    renderTable(tables[0]);
  } catch (error) {
    showMessage("tables-message", "Could not load tables.json. Run this website through a local web server, not file://.");
    console.error(error);
  }
}

function setupTabs() {
  const tabs = [byId("tab-soundboard"), byId("tab-tables")];
  tabs.forEach(tab => tab.addEventListener("click", () => {
    tabs.forEach(item => {
      const selected = item === tab;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-selected", String(selected));
      byId(item.getAttribute("aria-controls")).hidden = !selected;
    });
  }));
}

byId("music-volume").addEventListener("input", (event) => {
  musicAudio.volume = Number(event.target.value) / 100;
  byId("music-volume-value").textContent = event.target.value + "%";
});
byId("sfx-volume").addEventListener("input", (event) => {
  const volume = Number(event.target.value) / 100;
  byId("sfx-volume-value").textContent = event.target.value + "%";
  activeEffects.forEach(audio => { audio.volume = volume; });
});
byId("pause-music").addEventListener("click", async () => {
  if (!currentTrack) return;
  if (paused) {
    try { await musicAudio.play(); paused = false; }
    catch { showMessage("soundboard-message", "Could not resume this track."); }
  } else {
    musicAudio.pause();
    paused = true;
  }
  updatePlayer();
});
byId("stop-music").addEventListener("click", stopMusic);
musicAudio.addEventListener("error", () => {
  if (currentTrack) {
    const track = currentTrack;
    stopMusic();
    showMessage("soundboard-message", "Unable to play “" + track.name + "”. Check " + track.file);
  }
});
musicAudio.volume = Number(byId("music-volume").value) / 100;
setupTabs();
loadSoundboard();
loadTables();
