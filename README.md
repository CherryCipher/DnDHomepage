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
