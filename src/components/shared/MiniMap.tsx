import React, { useRef, useEffect, useCallback } from 'react';
import { useMapStore } from '../../stores/mapStore';
import { useUIStore } from '../../stores/uiStore';
import type { Station, Track, Line } from '../../types';

const MM_WIDTH  = 150;
const MM_HEIGHT = 100;
const GRID_SIZE = 30;
const WORLD_PAD = 300; // world-pixel padding around mapped content

// ─── Helpers ────────────────────────────────────────────────────────────────

/** World-pixel bounding box of all stations and track waypoints. */
function computeBounds(stations: Station[], tracks: Track[]) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const s of stations) {
    const wx = s.x * GRID_SIZE, wy = s.y * GRID_SIZE;
    if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
  }
  for (const t of tracks) {
    for (const p of t.path) {
      const wx = p.x * GRID_SIZE, wy = p.y * GRID_SIZE;
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
    }
  }

  if (!isFinite(minX)) {
    // No content yet — use a sensible default window
    return { minX: -300, maxX: 300, minY: -200, maxY: 200 };
  }

  return {
    minX: minX - WORLD_PAD,
    maxX: maxX + WORLD_PAD,
    minY: minY - WORLD_PAD,
    maxY: maxY + WORLD_PAD,
  };
}

/** Returns the uniform scale and pixel offsets to map world coords into the mini-map canvas. */
function computeMapping(stations: Station[], tracks: Track[]) {
  const bounds = computeBounds(stations, tracks);
  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;

  const scaleX = MM_WIDTH  / worldW;
  const scaleY = MM_HEIGHT / worldH;
  const scale  = Math.min(scaleX, scaleY);

  // Centre the content in the mini-map canvas
  const offsetX = (MM_WIDTH  - worldW * scale) / 2 - bounds.minX * scale;
  const offsetY = (MM_HEIGHT - worldH * scale) / 2 - bounds.minY * scale;

  return { scale, offsetX, offsetY };
}

function worldToMM(worldX: number, worldY: number, scale: number, offsetX: number, offsetY: number) {
  return { x: worldX * scale + offsetX, y: worldY * scale + offsetY };
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface MiniMapProps {
  onJump: (worldX: number, worldY: number) => void;
}

export function MiniMap({ onJump }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stations  = useMapStore(s => s.stations);
  const tracks    = useMapStore(s => s.tracks);
  const lines     = useMapStore(s => s.lines);
  const cameraX   = useUIStore(s => s.cameraX);
  const cameraY   = useUIStore(s => s.cameraY);
  const zoomLevel = useUIStore(s => s.zoomLevel);

  // ── Drawing ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#0d1f3c';
    ctx.fillRect(0, 0, MM_WIDTH, MM_HEIGHT);

    const { scale, offsetX, offsetY } = computeMapping(stations, tracks);
    const toMM = (wx: number, wy: number) => worldToMM(wx, wy, scale, offsetX, offsetY);

    // Build line-id → colour lookup
    const lineColorMap = new Map<string, string>();
    for (const line of lines as Line[]) {
      lineColorMap.set(line.id, line.color);
    }

    // Tracks
    for (const track of tracks) {
      if (track.path.length < 2) continue;
      const color = lineColorMap.get(track.lineId) ?? '#ffffff';
      ctx.beginPath();
      const start = toMM(track.path[0].x * GRID_SIZE, track.path[0].y * GRID_SIZE);
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < track.path.length; i++) {
        const pt = toMM(track.path[i].x * GRID_SIZE, track.path[i].y * GRID_SIZE);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    // Stations — cyan dots 2 px radius
    ctx.fillStyle = '#00cec9';
    for (const station of stations) {
      const pt = toMM(station.x * GRID_SIZE, station.y * GRID_SIZE);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Viewport rectangle
    // The worldContainer is positioned at (cameraX, cameraY) screen pixels,
    // with scale = zoomLevel.  Visible world-pixel region:
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const viewLeft   = -cameraX / zoomLevel;
    const viewTop    = -cameraY / zoomLevel;
    const viewRight  = viewLeft  + screenW / zoomLevel;
    const viewBottom = viewTop   + screenH / zoomLevel;

    const vTL = toMM(viewLeft,  viewTop);
    const vBR = toMM(viewRight, viewBottom);

    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(vTL.x, vTL.y, vBR.x - vTL.x, vBR.y - vTL.y);
  }, [stations, tracks, lines, cameraX, cameraY, zoomLevel]);

  // ── Click → jump ─────────────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Normalise to canvas pixel space (handles CSS scaling)
    const mmX = (e.clientX - rect.left) * (MM_WIDTH  / rect.width);
    const mmY = (e.clientY - rect.top)  * (MM_HEIGHT / rect.height);

    const { scale, offsetX, offsetY } = computeMapping(stations, tracks);
    const worldX = (mmX - offsetX) / scale;
    const worldY = (mmY - offsetY) / scale;

    onJump(worldX, worldY);
  }, [stations, tracks, onJump]);

  return (
    <canvas
      ref={canvasRef}
      width={MM_WIDTH}
      height={MM_HEIGHT}
      style={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        zIndex: 10,
        background: '#0d1f3c',
        border: '1px solid #1a3a5c',
        borderRadius: 4,
        cursor: 'pointer',
      }}
      onClick={handleClick}
    />
  );
}
