import { useUIStore } from '../../stores/uiStore';
import type { TrackTool } from '../../types';
import { TrainCatalog } from '../assembly/TrainCatalog';

const TRACK_TOOLS: { tool: TrackTool; icon: string; label: string }[] = [
  { tool: 'station', icon: '⬡', label: 'Station' },
  { tool: 'connect', icon: '━', label: 'Connect' },
  { tool: 'edit', icon: '✎', label: 'Edit' },
  { tool: 'delete', icon: '✕', label: 'Delete' },
  { tool: 'pan', icon: '✥', label: 'Move' },
];

export function LeftToolBar() {
  const mode = useUIStore((s) => s.mode);
  const tool = useUIStore((s) => s.tool);
  const setTool = useUIStore((s) => s.setTool);

  const isAssembly = mode === 'assembly';

  return (
    <div className={`left-toolbar${isAssembly ? ' left-toolbar--wide' : ''}`}>
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
      {mode === 'assembly' && <TrainCatalog />}
      {mode === 'simulation' && (
        <div style={{
          padding: '16px 6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}>
          <div style={{
            fontSize: 9,
            fontWeight: 'bold',
            color: '#81ecec',
            fontFamily: 'Courier New, monospace',
            letterSpacing: 1,
          }}>
            Simulation
          </div>
          <div style={{
            fontSize: 8,
            color: '#b2bec3',
            fontFamily: 'Courier New, monospace',
            textAlign: 'center',
            lineHeight: 1.4,
          }}>
            Watch your trains run!
          </div>
        </div>
      )}
    </div>
  );
}
