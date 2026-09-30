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
            color: i < earned ? '#ffe066' : '#a07850',
            textShadow: i < earned ? '0 0 6px #ffe06688' : 'none',
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
        background: 'rgba(26,15,8,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      {/* Panel */}
      <div
        style={{
          background: '#5c2e0e',
          border: '1px solid #a0521c',
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
              fontFamily: 'var(--font-ui)',
              fontSize: 22,
              fontWeight: 'bold',
              color: '#ffcf3f',
              letterSpacing: 3,
              textShadow: '0 0 10px #ffcf3f66',
              marginBottom: 6,
            }}
          >
            CHALLENGE MODE
          </div>
          <div style={{ color: '#f5d9a8', fontSize: 13 }}>
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
                background: locked ? '#4a2409' : '#6b3812',
                border: `1px solid ${locked ? '#a0521c' : '#b5651d'}`,
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
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 'bold',
                    fontSize: 14,
                    color: locked ? '#f5d9a8' : '#fff8e7',
                    letterSpacing: 1,
                  }}
                >
                  {`LEVEL ${idx + 1}: ${level.name.toUpperCase()}`}
                </span>
                <StarRow earned={earnedStars} />
              </div>

              {/* Description */}
              <div style={{ color: '#f5d9a8', fontSize: 12, lineHeight: 1.5 }}>
                {level.description}
              </div>

              {/* Objectives summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {level.objectives.map((obj) => (
                  <div
                    key={obj.type}
                    style={{ color: '#ffcf3f', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span style={{ color: '#ffcf3f' }}>›</span>
                    {obj.label}
                  </div>
                ))}
              </div>

              {/* Action button */}
              {locked ? (
                <div
                  style={{
                    background: '#a0521c',
                    borderRadius: 4,
                    padding: '7px 0',
                    textAlign: 'center',
                    fontSize: 11,
                    color: '#f5d9a8',
                    fontFamily: 'var(--font-ui)',
                    letterSpacing: 1,
                  }}
                >
                  Complete previous level first
                </div>
              ) : (
                <button
                  onClick={() => handlePlay(level.id)}
                  style={{
                    background: '#43b047',
                    border: 'none',
                    borderRadius: 4,
                    padding: '8px 0',
                    color: '#fff',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 'bold',
                    fontSize: 12,
                    letterSpacing: 2,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#5cc85c')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#43b047')}
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
            border: '1px solid #a0521c',
            borderRadius: 4,
            padding: '8px 0',
            color: '#f5d9a8',
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
            letterSpacing: 2,
            cursor: 'pointer',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff8e7';
            e.currentTarget.style.borderColor = '#d8903a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#f5d9a8';
            e.currentTarget.style.borderColor = '#a0521c';
          }}
        >
          BACK TO SANDBOX
        </button>
      </div>
    </div>
  );
}
