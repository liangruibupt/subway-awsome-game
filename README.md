# Subway Awesome Game

A web-based subway building game where players design track networks, build and customize trains, and watch them run.

## Features

- **Track Design** — Drag-and-drop subway track building on a grid with blueprint/tech visual style. Place stations, name them (Chinese supported), and connect with color-coded lines.
- **Train Assembly** — Build trains with up to 8 cars (1 head + 7 carriages) in an isometric 2.5D workshop. Choose from different eras (Classic/Modern/Future) and city styles (Tokyo, Beijing, etc.). 360° turntable preview.
- **Customization** — Change train body color, patterns (solid/stripe/gradient/tech lines), and accent colors. Standard and wide-body carriage types.
- **Run Simulation** — Watch trains run on your designed routes with smooth animations, station stops, passenger boarding, and live operation data (passenger count, on-time rate, capacity).
- **Game Modes** — Sandbox mode for free creative building, plus challenge levels with star ratings and unlockable rewards.

## Tech Stack

- **PixiJS** — WebGL 2D rendering (blueprint glow effects, train animations)
- **React** — UI layer (menus, panels, input dialogs)
- **zustand** — State management
- **TypeScript** — Type-safe codebase
- **Vite** — Build tool

## Getting Started

```bash
npm install
npm run dev
```

## Project Structure

```
subway-awsome-game/
├── docs/
│   └── superpowers/
│       └── specs/          # Design specifications
├── src/                    # Source code (coming soon)
└── README.md
```

## Design

See the full design spec at [`docs/superpowers/specs/2026-03-22-subway-game-design.md`](docs/superpowers/specs/2026-03-22-subway-game-design.md).

## License

MIT
