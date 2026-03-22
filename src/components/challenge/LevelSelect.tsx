import { useMapStore } from '../../stores/mapStore';
import { useSimulationStore } from '../../stores/simulationStore';
import { useUIStore } from '../../stores/uiStore';
import { CHALLENGE_LEVELS } from '../../data/challengeLevels';

function StarRow({ earned, total = 3 }: { earned: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            fontSize: 18,
            color: i < earned ? '#ffd93d' : '#636e72',
            textShadow: i < earned ? '0 0 6px #ffd93d88' : 'none',
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function LevelSelect() {
  const setShowLevelSelect = useUIStore((s) => s.setShowLevelSelect);
  const setChallengeId     = useUIStore((s) => s.setChallengeId);
  const challengeStars     = useUIStore((s) => s.challengeStars);

  function handlePlay(levelId: string) {
    const level = CHALLENGE_LEVELS.find((l) => l.id === levelId);
    if (!level) return;

    // Reset all game state before loading the challenge map.
    useMapStore.getState().reset();
    useSimulationStore.getState().reset();
    useMapStore.getState().loadState(level.prebuiltMap);

    setChallengeId(levelId);
    setShowLevelSelect(false);
  }

  function handleBack() {
    setShowLevelSelect(false);
  }

  return (
    /* Full-screen semi-transparent backdrop */
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(6,14,31,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      {/* Panel */}
      <div
        style={{
          background: '#0d1f3c',
          border: '1px solid #1a3a5c',
          borderRadius: 12,
          padding: '28px 24px',
          width: 340,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Title */}
        <div>
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 22,
              fontWeight: 'bold',
              color: '#81ecec',
              letterSpacing: 3,
              textShadow: '0 0 10px #81ecec66',
              marginBottom: 6,
            }}
          >
            CHALLENGE MODE
          </div>
          <div style={{ color: '#b2bec3', fontSize: 13 }}>
            Test your subway building skills!
          </div>
        </div>

        {/* Level cards */}
        {CHALLENGE_LEVELS.map((level, idx) => {
          const previousId   = idx > 0 ? CHALLENGE_LEVELS[idx - 1].id : null;
          const locked       = previousId !== null && !(previousId in challengeStars);
          const earnedStars  = challengeStars[level.id] ?? 0;

          return (
            <div
              key={level.id}
              style={{
                background: locked ? '#0a1a30' : '#112240',
                border: `1px solid ${locked ? '#1a3a5c' : '#1e4976'}`,
                borderRadius: 8,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                opacity: locked ? 0.65 : 1,
              }}
            >
              {/* Level name + stars */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontWeight: 'bold',
                    fontSize: 14,
                    color: locked ? '#b2bec3' : '#dfe6e9',
                    letterSpacing: 1,
                  }}
                >
                  {`LEVEL ${idx + 1}: ${level.name.toUpperCase()}`}
                </span>
                <StarRow earned={earnedStars} />
              </div>

              {/* Description */}
              <div style={{ color: '#b2bec3', fontSize: 12, lineHeight: 1.5 }}>
                {level.description}
              </div>

              {/* Objectives summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {level.objectives.map((obj) => (
                  <div
                    key={obj.type}
                    style={{ color: '#81ecec', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span style={{ color: '#81ecec' }}>›</span>
                    {obj.label}
                  </div>
                ))}
              </div>

              {/* Action button */}
              {locked ? (
                <div
                  style={{
                    background: '#1a3a5c',
                    borderRadius: 4,
                    padding: '7px 0',
                    textAlign: 'center',
                    fontSize: 11,
                    color: '#b2bec3',
                    fontFamily: "'Courier New', monospace",
                    letterSpacing: 1,
                  }}
                >
                  Complete previous level first
                </div>
              ) : (
                <button
                  onClick={() => handlePlay(level.id)}
                  style={{
                    background: '#00b894',
                    border: 'none',
                    borderRadius: 4,
                    padding: '8px 0',
                    color: '#fff',
                    fontFamily: "'Courier New', monospace",
                    fontWeight: 'bold',
                    fontSize: 12,
                    letterSpacing: 2,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#00d1a7')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#00b894')}
                >
                  PLAY
                </button>
              )}
            </div>
          );
        })}

        {/* Back button */}
        <button
          onClick={handleBack}
          style={{
            background: 'transparent',
            border: '1px solid #1a3a5c',
            borderRadius: 4,
            padding: '8px 0',
            color: '#b2bec3',
            fontFamily: "'Courier New', monospace",
            fontSize: 12,
            letterSpacing: 2,
            cursor: 'pointer',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#dfe6e9';
            e.currentTarget.style.borderColor = '#3d6e9c';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#b2bec3';
            e.currentTarget.style.borderColor = '#1a3a5c';
          }}
        >
          BACK TO SANDBOX
        </button>
      </div>
    </div>
  );
}
