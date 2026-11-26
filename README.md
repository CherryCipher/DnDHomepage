# Dungeon Master's Toolkit

A simple, locally hosted D&D DM dashboard with looping music, one-shot sound effects and JSON-driven random tables.

## Start locally

1. Clone/download this repository.
2. Open a terminal in the project folder.
3. Run **one** of these local web servers:
   - Python: `python -m http.server 8000`
   - Windows (if Python uses the launcher): `py -m http.server 8000`
4. Visit http://localhost:8000

Do **not** open `index.html` directly using `file://`: browsers block loading the JSON files that way.

## Battle Tools: initiative tracker

The first tab provides an initiative tracker. Enter a combatant's name and starting HP, then press **Add to initiative**. Drag the handle to reorder the turn list, or use the arrow controls as an alternative (also useful on touchscreens). HP is a directly editable number input; **Remove** removes the combatant. The list, order, and HP are saved automatically in this browser's `localStorage` and are restored after a refresh. No server or account is required. Data is per browser/device and is not synced between devices.

## Add music and sound effects

1. Put music files in `data/soundboard/music/` and sound effects in `data/soundboard/sfx/`.
2. Edit `data/soundboard/sounds.json` to add an item to `music` or `sfx`, for example:

```json
{
  "id": "rain",
  "name": "Rain Outside",
  "file": "data/soundboard/sfx/rain.mp3",
  "category": "general"
}
```

### Random audio variations

A button can refer to a single audio file using `"file"`, or to multiple variants using `"files"`. Every click picks a random file. Use the same format for **music** and **SFX**:

```json
{
  "id": "fireball",
  "name": "Fireball",
  "category": "battle",
  "files": [
    "data/soundboard/sfx/Fireball 1.wav",
    "data/soundboard/sfx/Fireball 2.wav",
    "data/soundboard/sfx/Fireball 3.wav"
  ]
}
```

The example assumes you have all three audio files in that folder. The label remains **Fireball** regardless of which file is chosen. SFX plays once per click (with overlapping sounds allowed). Music loops its selected file and crossfades to another track; clicking the same music button again selects a new variant if more than one is configured, preferably avoiding the currently playing one. `"file"` remains fully supported for older entries. The repository includes one-item `"files"` examples; add more paths when you have the audio.

Music displays full-width above two side-by-side sound-effect panels: Battle SFX and General SFX. Add `"category": "battle"` or `"category": "general"` to each object in the `sfx` array; missing categories default to General SFX. No separate sound folders are necessary.\n\nMusic loops until stopped or another track is selected. Switching tracks plays both simultaneously during an equal-power crossfade (default 4 seconds). Choose Off, 1, 2, 4, 6, 8 or 12 seconds in the music player. Pause and Stop remain immediate. Sound FX play once and can overlap, including while music plays. Track names shown on the buttons come from JSON. The included entries are **examples only**: place actual audio files with matching names into the folders, or replace their JSON entries. No audio files are bundled.

## Add random tables

Edit `data/tables/tables.json`. Add another object to the `tables` array with `id`, `name`, `description`, `die` (e.g. `1d20`), and `rows`. Each row uses `roll` and `result`. Tables appear automatically in the dropdown. You roll physical dice; the app does not roll.

## Notes

- Music continues when changing tabs because the audio players stay alive in JavaScript.
- The browser may require the first playback to be started with a click.
- Music **does not continue** if the browser tab is closed, refreshed, or the device goes to sleep; some mobile browsers also restrict background playback.
- MP3 is broadly compatible; other browser-supported audio types may work.
- No build tools, framework, database, or remote services are needed.

## Hempstead Wiki shortcut

The final navigation item opens https://hempstead.cherrynuggetgames.nl/ in a new browser tab. This keeps the DM toolkit (including any playing audio and initiative state) open in its original tab.

## Deploying online

This is a static HTML/CSS/JavaScript site. Serve the repository contents through HTTPS from any static web host (or an Nginx web root behind a reverse proxy); no database, Python server or backend is required in production. Use the Python command above only for local development. Upload the actual music/SFX files into the paths specified by `sounds.json`, and verify playback and crossfades over HTTPS. Large WAV files can be slow to load remotely; consider compressing them. Ensure you have permission to distribute or stream the audio, and protect any DM-only tables or confidential notes before publishing: everything in the static site, including JSON, is accessible to site visitors. The initiative tracker stores data in each browser's localStorage, not on the server, and does not sync between devices or domains.

## Interactive Map (first version)

The Interactive Map tab loads `data/map/map.json` and displays your own city map plus category markers for shops, houses, taverns, locations, and POIs. It opens a left-hand detail panel with descriptions, optional images, DM-only notes, fixed people, sampled random people, and linked random tables from `data/tables/tables.json`.

To add a map:
1. Copy your actual Hempstead PNG to `data/map/hempstead.png` (create the file locally) and push/deploy it, or choose **Kaart bewerken → PNG/JPG lokaal bekijken** to preview and store a local copy in this browser.
2. In edit mode click **+ Hotspot plaatsen**, then click the desired map location, fill out the form, and save. To move a marker, open its edit form and choose **Pin verplaatsen**.
3. House entries omit random-table links; shops and taverns support all fields. Other types are flexible.
4. Use **Export JSON** to save the entire map's data. Copy the downloaded file to `data/map/map.json` and commit/deploy it. **Import JSON** restores an export on the current device.
5. The editor uses `localStorage` for hotspot edits and IndexedDB for a local preview image. Edits **do not automatically update GitHub, the server, or other devices**. Committing a new map.json alone does not upload the actual PNG; the image must be added separately.

**Security:** This browser-only editor is not an authenticated administration interface or shared database. Any data in public `data/map/map.json`, including DM notes, can be read by anybody who can access the website. If the site is publicly accessible to players, protect the DM toolkit with real authentication before publishing your private lore. A future Flask + SQLite admin API with server-side authorization can replace the local editor when multi-device editing is required.
