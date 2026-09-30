import { useUIStore } from '../../stores/uiStore';
import type { GameMode } from '../../types';
import { SpeedControls } from '../simulation/SpeedControls';
import { CHALLENGE_LEVELS } from '../../data/challengeLevels';

const TABS: { label: string; mode: GameMode; color: string }[] = [
  { label: 'TRACKS', mode: 'track-design', color: '#43b047' },
  { label: 'ASSEMBLY', mode: 'assembly', color: '#5c94fc' },
  { label: 'RUN', mode: 'simulation', color: '#43b047' },
];

export function TopBar() {
  const mode             = useUIStore((s) => s.mode);
  const setMode          = useUIStore((s) => s.setMode);
  const challengeId      = useUIStore((s) => s.challengeId);
  const setChallengeId   = useUIStore((s) => s.setChallengeId);
  const setShowLevelSelect = useUIStore((s) => s.setShowLevelSelect);

  const currentLevel = CHALLENGE_LEVELS.find((l) => l.id === challengeId);

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

      {/* Challenge button / status */}
      {challengeId && currentLevel ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16, flexShrink: 0 }}>
          <span className="hud-chip">
            ★ WORLD: {currentLevel.name.toUpperCase()}
          </span>
          <button className="hud-btn" onClick={() => setChallengeId(null)}>
            Exit Challenge
          </button>
        </div>
      ) : (
        <button
          className="hud-btn hud-btn--red"
          style={{ marginLeft: 16 }}
          onClick={() => setShowLevelSelect(true)}
        >
          ★ CHALLENGE
        </button>
      )}

      {mode === 'simulation' && <SpeedControls />}
      <div className="top-bar-spacer" />
    </div>
  );
}
