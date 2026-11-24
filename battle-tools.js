"use strict";

// The tracker is independent from the soundboard so audio continues between tabs.
(() => {
  const STORAGE_KEY = "dnd-homepage-initiative-v1";
  const list = document.getElementById("initiative-list");
  const empty = document.getElementById("initiative-empty");
  const count = document.getElementById("initiative-count");
  const form = document.getElementById("initiative-form");
  const nameInput = document.getElementById("initiative-name");
  const hpInput = document.getElementById("initiative-start-hp");
  const message = document.getElementById("initiative-message");
  let draggedId = null;

  function readSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(saved)) return [];
      return saved.filter(item => item && typeof item.id === "string" &&
        typeof item.name === "string" && typeof item.hp === "number" &&
        Number.isFinite(item.hp)).map(item => ({
          id: item.id, name: item.name.slice(0, 80), hp: item.hp
        }));
    } catch {
      message.textContent = "Saved combatants could not be restored.";
      return [];
    }
  }

  let combatants = readSaved();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(combatants));
    } catch {
      message.textContent = "Browser storage is unavailable; changes may be lost after refresh.";
    }
  }

  function reorder(fromId, toId) {
    const from = combatants.findIndex(item => item.id === fromId);
    const to = combatants.findIndex(item => item.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const [item] = combatants.splice(from, 1);
    combatants.splice(to, 0, item);
    save();
    render();
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= combatants.length) return;
    [combatants[index], combatants[target]] = [combatants[target], combatants[index]];
    save();
    render();
    const entry = list.children[target];
    entry?.querySelector(direction < 0 ? '[data-move="up"]' : '[data-move="down"]')?.focus();
  }

  function createButton(text, className, label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", action);
    return button;
  }

  function render() {
    const fragment = document.createDocumentFragment();
    combatants.forEach((item, index) => {
      const row = document.createElement("li");
      row.className = "initiative-entry";
      row.dataset.id = item.id;

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "initiative-handle";
      handle.textContent = "⠿";
      handle.draggable = true;
      handle.title = "Drag to reorder";
      handle.setAttribute("aria-label", "Drag " + item.name + " to reorder");
      handle.addEventListener("dragstart", event => {
        draggedId = item.id;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
        row.classList.add("is-dragging");
      });
      handle.addEventListener("dragend", () => {
        draggedId = null;
        list.querySelectorAll(".initiative-entry").forEach(element => {
          element.classList.remove("is-dragging", "drag-over");
        });
      });
      row.addEventListener("dragover", event => {
        if (!draggedId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        row.classList.add("drag-over");
      });
      row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
      row.addEventListener("drop", event => {
        event.preventDefault();
        row.classList.remove("drag-over");
        const source = draggedId;
        draggedId = null;
        if (source) reorder(source, item.id);
      });

      const rank = document.createElement("span");
      rank.className = "initiative-rank";
      rank.textContent = String(index + 1).padStart(2, "0");
      const name = document.createElement("strong");
      name.className = "initiative-name";
      name.textContent = item.name;
      const hpLabel = document.createElement("label");
      hpLabel.className = "initiative-hp-label";
      hpLabel.textContent = "HP";
      const hp = document.createElement("input");
      hp.className = "initiative-hp";
      hp.type = "number";
      hp.step = "1";
      hp.value = String(item.hp);
      hp.setAttribute("aria-label", "HP for " + item.name);
      hp.classList.toggle("is-zero", item.hp <= 0);
      hp.addEventListener("input", () => {
        const value = hp.valueAsNumber;
        if (!Number.isFinite(value)) return;
        item.hp = value;
        hp.classList.toggle("is-zero", value <= 0);
        save();
      });
      hp.addEventListener("change", () => {
        if (hp.value === "") hp.value = String(item.hp);
      });
      hpLabel.append(hp);

      const arrows = document.createElement("span");
      arrows.className = "initiative-mobile-order";
      const up = createButton("▲", "initiative-move", "Move " + item.name + " up", () => move(index, -1));
      up.dataset.move = "up";
      up.disabled = index === 0;
      const down = createButton("▼", "initiative-move", "Move " + item.name + " down", () => move(index, 1));
      down.dataset.move = "down";
      down.disabled = index === combatants.length - 1;
      arrows.append(up, down);
      const remove = createButton("Remove", "initiative-remove", "Remove " + item.name, () => {
        combatants = combatants.filter(entry => entry.id !== item.id);
        save();
        render();
      });
      row.append(handle, rank, name, hpLabel, arrows, remove);
      fragment.append(row);
    });
    list.replaceChildren(fragment);
    empty.hidden = combatants.length > 0;
    count.textContent = "(" + combatants.length + ")";
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const hp = hpInput.valueAsNumber;
    if (!name || !Number.isFinite(hp)) return;
    const id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    combatants.push({ id, name, hp });
    save();
    render();
    nameInput.value = "";
    nameInput.focus();
  });

  render();
})();
