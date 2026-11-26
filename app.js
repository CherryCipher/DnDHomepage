"use strict";

const byId = (id) => document.getElementById(id);
// Crossfades use two independent HTMLAudioElements so both tracks overlap.
let activeMusic = null; // { audio, track, gain: 0..1 }
let outgoingMusic = null;
let fadeFrame = null;
let transitionId = 0;
let paused = false;
const activeEffects = new Set();

function showMessage(id, message = "") {
  byId(id).textContent = message;
}

function musicVolume() {
  return Number(byId("music-volume").value) / 100;
}

function applyMusicVolume() {
  for (const player of [activeMusic, outgoingMusic]) {
    if (player) player.audio.volume = Math.max(0, Math.min(1, player.gain * musicVolume()));
  }
}

function discardPlayer(player) {
  if (!player) return;
  player.audio.pause();
  player.audio.removeAttribute("src");
  player.audio.load();
}

function cancelFade() {
  if (fadeFrame !== null) cancelAnimationFrame(fadeFrame);
  fadeFrame = null;
}

function updatePlayer() {
  const track = activeMusic?.track;
  byId("now-playing").textContent = track ? track.name : "Nothing playing";
  byId("player-status").textContent = track
    ? (paused ? "Paused · looping enabled" : outgoingMusic ? "Crossfading · looping enabled" : "Playing · looping enabled")
    : "Choose a track to begin";
  byId("pause-music").disabled = !track;
  byId("stop-music").disabled = !track;
  byId("pause-music").textContent = paused ? "Resume" : "Pause";
  document.querySelectorAll("#music-grid .sound-button").forEach(button => {
    const selected = !!track && button.dataset.id === track.id;
    button.classList.toggle("is-playing", selected);
    button.setAttribute("aria-pressed", String(selected && !paused));
  });
}

function finishFade() {
  cancelFade();
  discardPlayer(outgoingMusic);
  outgoingMusic = null;
  if (activeMusic) activeMusic.gain = 1;
  applyMusicVolume();
  updatePlayer();
}

function stopMusic() {
  transitionId++;
  cancelFade();
  discardPlayer(activeMusic);
  discardPlayer(outgoingMusic);
  activeMusic = null;
  outgoingMusic = null;
  paused = false;
  showMessage("soundboard-message");
  updatePlayer();
}

function crossfade(durationMs) {
  if (!activeMusic) return;
  if (durationMs === 0) {
    finishFade();
    return;
  }
  const incoming = activeMusic;
  const outgoing = outgoingMusic;
  const incomingStart = incoming.gain;
  const outgoingStart = outgoing?.gain ?? 0;
  const started = performance.now();
  function step(now) {
    // A newer transition, pause or stop cancels this animation frame.
    if (activeMusic !== incoming || outgoingMusic !== outgoing || paused) return;
    const progress = Math.min(1, (now - started) / durationMs);
    // Equal-power crossfade avoids an obvious volume dip in the middle.
    incoming.gain = incomingStart + (1 - incomingStart) * Math.sin(progress * Math.PI / 2);
    if (outgoing) outgoing.gain = outgoingStart * Math.cos(progress * Math.PI / 2);
    applyMusicVolume();
    if (progress >= 1) finishFade();
    else fadeFrame = requestAnimationFrame(step);
  }
  fadeFrame = requestAnimationFrame(step);
}

// Each sound may declare either a single "file" or a "files" array.
function soundFiles(sound) {
  const candidates = Array.isArray(sound.files) ? sound.files : [sound.file];
  return candidates.filter(file => typeof file === "string" &&
    file.startsWith("data/soundboard/") && !file.includes(".."));
}

function randomSoundFile(sound, excludeFile = null) {
  const candidates = soundFiles(sound);
  if (!candidates.length) return null;
  // When re-clicking a playing music button, prefer a different variation.
  const choices = candidates.length > 1 && excludeFile
    ? candidates.filter(file => file !== excludeFile)
    : candidates;
  const pool = choices.length ? choices : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function playMusic(track) {
  showMessage("soundboard-message");
  if (activeMusic?.track.id === track.id && paused) {
    await togglePause();
    return;
  }

  const selectedFile = randomSoundFile(track, activeMusic?.track.id === track.id ? activeMusic.file : null);
  if (!selectedFile) return;
  // One-clip buttons already playing keep their track running.
  if (activeMusic?.track.id === track.id && selectedFile === activeMusic.file) return;

  const requestId = ++transitionId;
  // A fast second click interrupts an earlier transition, retaining the
  // currently selected track as the one to fade out.
  cancelFade();
  discardPlayer(outgoingMusic);
  outgoingMusic = null;
  if (activeMusic) {
    activeMusic.gain = 1;
    applyMusicVolume();
  }
  const previous = activeMusic;
  const audio = new Audio(selectedFile);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0;
  const incoming = { audio, track, file: selectedFile, gain: 0 };
  try {
    await audio.play();
  } catch {
    discardPlayer(incoming);
    if (requestId === transitionId) {
      showMessage("soundboard-message", "Could not load “" + track.name + "”. Check " + selectedFile);
      updatePlayer();
    }
    return;
  }
  if (requestId !== transitionId) {
    discardPlayer(incoming);
    return;
  }
  activeMusic = incoming;
  outgoingMusic = previous;
  paused = false;
  if (outgoingMusic && outgoingMusic.audio.paused) {
    discardPlayer(outgoingMusic);
    outgoingMusic = null;
  }
  applyMusicVolume();
  updatePlayer();
  const durationMs = Number(byId("crossfade-duration").value) * 1000;
  crossfade(durationMs);
}

async function togglePause() {
  if (!activeMusic) return;
  if (!paused) {
    // Keep a single full-volume track paused; don't leave two half-faded tracks.
    finishFade();
    activeMusic.audio.pause();
    paused = true;
  } else {
    try {
      await activeMusic.audio.play();
      paused = false;
    } catch {
      showMessage("soundboard-message", "Could not resume this track.");
    }
  }
  updatePlayer();
}

function playSfx(effect, button) {
  showMessage("soundboard-message");
  const selectedFile = randomSoundFile(effect);
  if (!selectedFile) return;
  const audio = new Audio(selectedFile);
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
    showMessage("soundboard-message", "Could not load “" + effect.name + "”. Add its audio file at " + selectedFile);
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
  return Array.isArray(items) ? items.filter(item => item && typeof item.id === "string" && typeof item.name === "string" && soundFiles(item).length > 0) : [];
}

async function loadSoundboard() {
  try {
    const response = await fetch("data/soundboard/sounds.json");
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    const music = validSounds(data.music);
    const effects = validSounds(data.sfx);
    byId("music-grid").replaceChildren(...music.map(item => createSoundButton(item, "music")));
    byId("battle-sfx-grid").replaceChildren(...effects.filter(item => item.category === "battle").map(item => createSoundButton(item, "sfx")));
    byId("general-sfx-grid").replaceChildren(...effects.filter(item => item.category !== "battle").map(item => createSoundButton(item, "sfx")));
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
  const tabs = [byId("tab-battle-tools"), byId("tab-soundboard"), byId("tab-map"), byId("tab-tables")];
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
  byId("music-volume-value").textContent = event.target.value + "%";
  applyMusicVolume();
});
byId("sfx-volume").addEventListener("input", (event) => {
  const volume = Number(event.target.value) / 100;
  byId("sfx-volume-value").textContent = event.target.value + "%";
  activeEffects.forEach(audio => { audio.volume = volume; });
});
byId("pause-music").addEventListener("click", togglePause);
byId("stop-music").addEventListener("click", stopMusic);
setupTabs();
loadSoundboard();
loadTables();
