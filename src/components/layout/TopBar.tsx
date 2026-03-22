import { useUIStore } from '../../stores/uiStore';
import type { GameMode } from '../../types';
import { SpeedControls } from '../simulation/SpeedControls';
import { CHALLENGE_LEVELS } from '../../data/challengeLevels';

const TABS: { label: string; mode: GameMode; color: string }[] = [
  { label: 'TRACKS', mode: 'track-design', color: '#00b894' },
  { label: 'ASSEMBLY', mode: 'assembly', color: '#a29bfe' },
  { label: 'RUN', mode: 'simulation', color: '#00b894' },
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
          <span
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 10,
              letterSpacing: 1,
              color: '#ffd93d',
              textShadow: '0 0 6px #ffd93d66',
            }}
          >
            CHALLENGE: {currentLevel.name.toUpperCase()}
          </span>
          <button
            onClick={() => setChallengeId(null)}
            style={{
              background: 'transparent',
              border: '1px solid #636e72',
              borderRadius: 3,
              padding: '2px 8px',
              color: '#b2bec3',
              fontFamily: "'Courier New', monospace",
              fontSize: 10,
              letterSpacing: 1,
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#dfe6e9';
              e.currentTarget.style.borderColor = '#b2bec3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#b2bec3';
              e.currentTarget.style.borderColor = '#636e72';
            }}
          >
            Exit Challenge
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowLevelSelect(true)}
          style={{
            marginLeft: 16,
            background: 'transparent',
            border: '1px solid #a29bfe',
            borderRadius: 3,
            padding: '2px 12px',
            color: '#a29bfe',
            fontFamily: "'Courier New', monospace",
            fontSize: 10,
            fontWeight: 'bold',
            letterSpacing: 2,
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#a29bfe22';
            e.currentTarget.style.color = '#b8b0ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#a29bfe';
          }}
        >
          CHALLENGE
        </button>
      )}

      {mode === 'simulation' && <SpeedControls />}
      <div className="top-bar-spacer" />
    </div>
  );
}
