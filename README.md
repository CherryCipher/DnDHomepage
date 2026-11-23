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

## Add music and sound effects

1. Put music files in `data/soundboard/music/` and sound effects in `data/soundboard/sfx/`.
2. Edit `data/soundboard/sounds.json` to add an item to `music` or `sfx`, for example:

```json
{
  "id": "rain",
  "name": "Rain Outside",
  "file": "data/soundboard/sfx/rain.mp3"
}
```

Music loops until stopped or another track is selected. Switching tracks plays both simultaneously during an equal-power crossfade (default 4 seconds). Choose Off, 1, 2, 4, 6, 8 or 12 seconds in the music player. Pause and Stop remain immediate. Sound FX play once and can overlap, including while music plays. Track names shown on the buttons come from JSON. The included entries are **examples only**: place actual audio files with matching names into the folders, or replace their JSON entries. No audio files are bundled.

## Add random tables

Edit `data/tables/tables.json`. Add another object to the `tables` array with `id`, `name`, `description`, `die` (e.g. `1d20`), and `rows`. Each row uses `roll` and `result`. Tables appear automatically in the dropdown. You roll physical dice; the app does not roll.

## Notes

- Music continues when changing tabs because the audio players stay alive in JavaScript.
- The browser may require the first playback to be started with a click.
- Music **does not continue** if the browser tab is closed, refreshed, or the device goes to sleep; some mobile browsers also restrict background playback.
- MP3 is broadly compatible; other browser-supported audio types may work.
- No build tools, framework, database, or remote services are needed.
