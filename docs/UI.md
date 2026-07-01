# UI Notes

The interface should feel like a creative tool, not a game HUD.

## Main layout

Draft layout:

```text
┌──────────────────────────────────────────────┐
│ Story Worlds Editor                          │
├───────────────┬──────────────────────────────┤
│ Sidebar       │                              │
│               │                              │
│ Project       │          3D Canvas           │
│ Terrain       │                              │
│ Water         │                              │
│ Biomes        │                              │
│ Places        │                              │
│ Scenes        │                              │
│ Cameras       │                              │
│ Export        │                              │
├───────────────┴──────────────────────────────┤
│ Status | Tool | Coordinates | Autosave        │
└──────────────────────────────────────────────┘
```

## Tool groups

Tools should be grouped by purpose.

### Project

- New project
- Save project
- Open project

### Terrain

- Raise
- Lower
- Smooth
- Flatten

### Water

- River
- Lake
- Ocean

### Biomes

- Forest
- Grassland
- Coast
- Mountain

### Places

- Create place
- Rename place
- Add notes

### Scenes

- Create scene
- Assign place
- Set time of day
- Set weather

### Cameras

- Save camera
- Return to camera

## Interaction principles

- One active tool at a time
- Clear visual feedback
- No hidden complex behavior early on
- Touch-friendly controls
- Simple language
- Every tool should answer: what am I changing?

## Mobile consideration

The editor may be used on a phone, but the interface should avoid tiny crowded buttons.

Prefer panels and modes over many floating icons.
