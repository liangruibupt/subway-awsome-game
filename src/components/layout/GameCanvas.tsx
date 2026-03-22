import { useRef } from 'react';
import { useUIStore } from '../../stores/uiStore';

const BG_COLORS: Record<string, string> = {
  'track-design': '#0a1628',
  'assembly': '#1a1a2e',
  'simulation': '#0a1628',
};

export function GameCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mode = useUIStore((s) => s.mode);
  const bgColor = BG_COLORS[mode] ?? '#0a1628';

  return (
    <div
      ref={canvasRef}
      className="game-canvas"
      style={{ backgroundColor: bgColor }}
    />
  );
}
