import { useUIStore } from '../../stores/uiStore';
import type { TrackTool } from '../../types';

const TRACK_TOOLS: { tool: TrackTool; icon: string; label: string }[] = [
  { tool: 'station', icon: '⬡', label: 'STN' },
  { tool: 'connect', icon: '━', label: 'CON' },
  { tool: 'edit', icon: '✎', label: 'EDT' },
  { tool: 'delete', icon: '✕', label: 'DEL' },
  { tool: 'pan', icon: '✥', label: 'PAN' },
];

export function LeftToolBar() {
  const mode = useUIStore((s) => s.mode);
  const tool = useUIStore((s) => s.tool);
  const setTool = useUIStore((s) => s.setTool);

  return (
    <div className="left-toolbar">
      {mode === 'track-design' && (
        <div className="tool-list">
          {TRACK_TOOLS.map(({ tool: t, icon, label }) => (
            <button
              key={t}
              className={`tool-btn${tool === t ? ' tool-btn--active' : ''}`}
              title={t.toUpperCase()}
              onClick={() => setTool(t)}
            >
              <span className="tool-icon">{icon}</span>
              <span className="tool-label">{label}</span>
            </button>
          ))}
        </div>
      )}
      {mode === 'assembly' && (
        <div className="toolbar-placeholder">
          <span className="placeholder-text-vertical">CATALOG</span>
        </div>
      )}
      {mode === 'simulation' && (
        <div className="toolbar-placeholder">
          <span className="placeholder-text-vertical">DEPLOY</span>
        </div>
      )}
    </div>
  );
}
