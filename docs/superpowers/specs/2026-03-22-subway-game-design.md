# Subway Awesome Game - Design Spec

## Overview

A web-based subway building game targeting 10-year-old boys. Players design subway track networks, build and customize trains, and watch them run on their created routes. The game combines a blueprint/tech aesthetic for track design with isometric 2.5D views for train assembly.

## Target Audience

- Primary: 10-year-old boys
- Requirements: strong tech/sci-fi feel, smooth performance, visually impressive, intuitive drag-based interaction

## Platform & Tech Stack

- **Platform:** Web (browser-based)
- **Rendering:** PixiJS (WebGL 2D)
- **UI Layer:** React (menus, panels, input dialogs)
- **State Management:** zustand
- **Language:** TypeScript
- **Build Tool:** Vite

### Architecture

```
App Shell (React)
├── Top Bar         — mode switching (Tracks / Assembly / Run)
├── Left Tool Bar   — context-sensitive tools per mode
├── PixiJS Canvas   — main game rendering area
├── Right Panel     — properties, catalog, live data
└── Bottom Bar      — status info, simulation controls
```

React owns all UI chrome. PixiJS owns the game canvas. They communicate through zustand stores.

## Game Modes

### 1. Track Design Mode (Blueprint/Tech Style)

**Visual Style:**
- Dark background (#0a1628) with grid lines
- Glowing neon track lines per line color
- Stations as glowing circular nodes
- Interchange stations larger with gold glow
- Monospace/tech fonts, Chinese station names supported

**Interaction:**
1. **Place Station** — select station tool, click grid intersection, station snaps to grid, popup to enter name (React `<input>` for IME support)
2. **Connect Tracks** — select connect tool, click station A, drag to station B, path auto-generated along grid, choose line color
3. **Edit Path** — click track segment, drag waypoints to adjust route along grid lines
4. **Manage Lines** — right panel shows all lines, click to select/highlight, change color; interchange stations auto-detected

**Canvas System:**
- Infinite canvas, no fixed boundaries
- Scroll wheel zoom: 25% - 400%
- Pinch-to-zoom for trackpad/touch
- Pan: middle-click drag / space+left-click / two-finger swipe
- Mini-map in bottom-right corner with viewport indicator, click to jump
- Quick locate: click station name in line list to center view

**LOD (Level of Detail):**

| Zoom | Detail |
|------|--------|
| 100%+ | Full: station names, glow effects, trains, interchange markers |
| 50-100% | Station circles + names, track glow, trains hidden |
| 25-50% | Stations as dots, names hidden, tracks as thin colored lines |

**Performance:**
- Viewport culling: only render visible elements
- Spatial index (quadtree) for fast hit-testing on click/drag

**Chinese Station Name Support:**
- Font stack: `"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`
- Blueprint mode: tech-style rendering, optional format `S-01 中央枢纽`
- Input: React `<input>` element (native IME support)
- Label collision detection: auto-offset or truncate overlapping names

### 2. Train Assembly Mode (Isometric 2.5D Style)

**Visual Style:**
- Dark purple background (#1a1a2e) with isometric platform grid
- Train displayed on a rotating turntable with glow effect
- Catalog panel on left, customization panel on right

**Train Structure:**
- 1 head car + up to 7 carriages = max 8 total
- Head and carriages are separate draggable pieces

**Train Catalog (Left Panel):**

Organized by two dimensions:
- **Era tabs:** Classic / Modern / Future
- **City styles within each era:** Tokyo, Beijing, London, New York, etc.

Separate sections for heads and carriages. Each item shows a small isometric preview with city name label.

**Carriage Types:**
- **Standard (2.8m width):** narrower body, smaller windows, single sliding doors, compact silhouette
- **Wide-body (3.2m width):** visibly wider and taller, bigger windows, double sliding doors, XL badge

Visual difference must be immediately obvious in the isometric view.

**Assembly Interaction:**
1. Drag head from catalog onto turntable platform
2. Drag carriages to attach (auto-snap to end of train)
3. Reorder carriages by dragging
4. Empty slots shown as dashed ghost outlines with "+" indicator
5. Counter shows current/max: "3 / 8 CARRIAGES"

**360 Turntable:**
- Train sits on a glowing circular platform
- Mouse drag left/right to rotate
- Auto-rotates slowly when idle
- 5 view angles at 72 intervals:
  1. **Front** (0) - head-on, facing player. Shows windshield, headlights, route display, coupling
  2. **Front 3/4** (72) - classic hero angle
  3. **Right Side** (144) - full side profile with wheels on rail
  4. **Rear 3/4** (216) - shows tail lights, rear coupler, emergency door
  5. **Left Side** (288) - mirrored side view
- Current view name and angle displayed below turntable
- Touch support for mobile

**Customization (Right Panel):**
- **Body Color:** color palette with 10+ preset colors + custom color picker
- **Pattern:** Solid / Stripe / Gradient / Tech Lines
- **Accent Color:** secondary color for trim and details
- Apply per-carriage or whole train
- Real-time preview on turntable

**Train Head Design:**
- Rounded, realistic proportions (not abstract geometric)
- Distinguishing features per city style:
  - Tokyo: streamlined rounded nose, large curved windshield, red stripe band
  - Beijing: rounded flat face, dual round headlights, blue-white scheme, LED route number display
  - (More styles to be designed for London, New York, Future, etc.)

### 3. Run Simulation Mode (Blueprint/Tech Style)

**Visual Style:**
- Same blueprint aesthetic as track design mode
- Trains represented as colored blocks moving along tracks
- Motion trail effect behind moving trains
- Pulsing ring animation when trains approach stations
- Passenger dots animate during boarding/alighting

**Train Animation:**
- Smooth movement along track paths using PixiJS ticker
- Easing on curves (decelerate into curve, accelerate out)
- Trains slow down approaching stations, stop for dwell time, accelerate out
- Motion trail: fading colored line behind train

**Station Stops:**
- Train stops at station, "STOPPED" label appears
- Small yellow dots animate from station to train (boarding) and train to station (alighting)
- Dwell time: configurable per station (default ~10 simulated seconds)

**Speed Controls (Top Bar):**
- 1x / 2x / 4x speed multiplier buttons
- Play / Pause toggle
- Simulated time clock: 6:00 AM to midnight
- Rush hour peaks at 8 AM and 6 PM (higher passenger generation)

**Live Operations Panel (Right Side):**
- Total passengers today + growth percentage
- On-time rate progress bar
- Per-line status: line color, name, status (RUNNING/AT STN), train count, passenger count
- Click any train to see detail: car count, capacity bar (passengers/max), next station, speed, current status

**Bottom Status Bar:**
- Simulated time display
- Current speed multiplier
- Active trains count
- Active lines count
- Mini-map

## Station Design

**Station Types:**

| Type | Appearance | Trigger |
|------|-----------|---------|
| Normal | Single platform + canopy + name sign | Default |
| Interchange | Multi-level/cross structure, larger, brighter glow | Auto-detected: 2+ lines crossing |
| Terminal | End-of-line with depot entrance | Line endpoint |

**Editable Properties:**
- Station name (Chinese supported, displayed on platform sign)
- Assigned lines (auto-tagged with line colors)
- Platform length (determines max train length, default: 8 cars)

## Game Modes

### Sandbox Mode
- No objectives or constraints
- Free building on blank grid with optional simple city elements (buildings, rivers)
- All train types and customization options available
- Focus on creative expression

### Challenge Mode

**Level Structure:**
- Each level provides a city layout with buildings, rivers, residential zones
- Objective conditions, examples:
  - "Connect all 5 residential zones using no more than 3 lines"
  - "Transport 5,000 passengers within 10 simulated minutes"
  - "Maintain 90%+ on-time rate for a full day"

**Star Rating:**
- 1 star: complete basic objective
- 2 stars: complete within budget/time constraints
- 3 stars: optimal solution (fewest lines, highest efficiency)

**Rewards:**
- Unlock new train head types
- Unlock new city styles
- Unlock new patterns and colors

## Map / Canvas

**MVP:**
- Blank grid canvas (infinite, no boundaries)
- Simple city elements as background: basic building blocks, river/water areas

**Future Expansion:**
- Real city map loading: player enters a city name, game downloads and renders a simplified map
- Build subway system on top of real geography

## Data Model

```typescript
interface GameSave {
  map: {
    gridSize: number;              // default 30
    stations: Station[];
    tracks: Track[];
    lines: Line[];
  };
  trains: Train[];
  simulation: SimulationState;
  meta: {
    saveName: string;
    createdAt: string;
    lastModified: string;
    version: string;
  };
}

interface Station {
  id: string;
  name: string;                    // supports Chinese
  x: number;                       // grid coordinate
  y: number;
  type: 'normal' | 'interchange' | 'terminal';
  lineIds: string[];
}

interface Track {
  id: string;
  lineId: string;
  path: { x: number; y: number }[];  // grid waypoints
  stationAId: string;
  stationBId: string;
}

interface Line {
  id: string;
  name: string;
  color: string;                   // hex color
}

interface Train {
  id: string;
  lineId: string;
  head: {
    type: string;                  // e.g. 'tokyo-modern'
    era: 'classic' | 'modern' | 'future';
    city: string;
  };
  carriages: {
    type: 'standard' | 'widebody';
    city: string;
  }[];                             // max 7
  style: {
    bodyColor: string;
    pattern: 'solid' | 'stripe' | 'gradient' | 'tech';
    accentColor: string;
  };
}

interface SimulationState {
  time: number;                    // simulated minutes from 6:00 AM
  speed: 1 | 2 | 4;
  paused: boolean;
  stats: {
    totalPassengers: number;
    onTimeRate: number;
    byLine: Record<string, { passengers: number; onTime: number }>;
  };
}
```

## State Management (zustand stores)

- **mapStore** — grid map, station positions, track routes, line definitions
- **trainStore** — train assembly configs (head + carriages), style customization
- **simulationStore** — run state, passenger data, speed control, time
- **uiStore** — current mode, selected object, panel visibility, zoom level

## Save System

- **Auto-save:** localStorage, debounced after each operation
- **Export/Import:** JSON file download/upload for sharing with friends
- **Save Slots:** 3-5 slots, each a separate subway system
- **Undo/Redo:** operation history stack, Ctrl+Z / Ctrl+Y, available in track design and assembly modes

## Future Expansions (Not in MVP)

- **Driver Mode:** first-person/cab view, manual speed control and station stops
- **Real City Maps:** enter city name to download and load simplified map data
- **More Train Styles:** additional cities and eras
- **Multiplayer:** share and visit friends' subway systems
