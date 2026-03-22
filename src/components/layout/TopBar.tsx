import { useUIStore } from '../../stores/uiStore';
import type { GameMode } from '../../types';

const TABS: { label: string; mode: GameMode; color: string }[] = [
  { label: 'TRACKS', mode: 'track-design', color: '#00b894' },
  { label: 'ASSEMBLY', mode: 'assembly', color: '#a29bfe' },
  { label: 'RUN', mode: 'simulation', color: '#00b894' },
];

export function TopBar() {
  const mode = useUIStore((s) => s.mode);
  const setMode = useUIStore((s) => s.setMode);

  return (
    <div className="top-bar">
      <div className="top-bar-title">SUBWAY</div>
      <div className="top-bar-tabs">
        {TABS.map(({ label, mode: tabMode, color }) => (
          <button
            key={tabMode}
            className={`tab-btn${mode === tabMode ? ' tab-btn--active' : ''}`}
            style={mode === tabMode ? { '--tab-color': color } as React.CSSProperties : {}}
            onClick={() => setMode(tabMode)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="top-bar-spacer" />
    </div>
  );
}
