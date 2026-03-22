import { useMapStore } from '../../stores/mapStore';
import { useSimulationStore } from '../../stores/simulationStore';
import { useUIStore } from '../../stores/uiStore';
import { CHALLENGE_LEVELS, computeStars } from '../../data/challengeLevels';
import type { ChallengeLevel, ObjectiveType } from '../../data/challengeLevels';

function StarDisplay({ stars, total = 3 }: { stars: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            fontSize: 36,
            color: i < stars ? '#ffd93d' : '#2d4a6e',
            textShadow: i < stars ? '0 0 12px #ffd93daa' : 'none',
            transition: 'color 0.3s',
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

const UNLOCK_TEXT: Record<string, string> = {
  'level-1': 'Level 2: Crosstown is now unlocked!',
  'level-2': 'Level 3: Rush Hour is now unlocked!',
  'level-3': 'You have mastered all three challenges!',
};

const NEXT_LEVEL: Record<string, string | null> = {
  'level-1': 'level-2',
  'level-2': 'level-3',
  'level-3': null,
};

export function VictoryScreen() {
  const challengeId        = useUIStore((s) => s.challengeId);
  const setChallengeId     = useUIStore((s) => s.setChallengeId);
  const setShowVictory     = useUIStore((s) => s.setShowVictory);
  const setShowLevelSelect = useUIStore((s) => s.setShowLevelSelect);
  const setChallengeStars  = useUIStore((s) => s.setChallengeStars);
  const challengeStars     = useUIStore((s) => s.challengeStars);

  const stations        = useMapStore((s) => s.stations);
  const totalPassengers = useSimulationStore((s) => s.stats.totalPassengers);
  const onTimeRate      = useSimulationStore((s) => s.stats.onTimeRate);

  const maybeLevel = CHALLENGE_LEVELS.find((l) => l.id === challengeId);
  if (!maybeLevel) return null;
  // Explicit typed binding so TypeScript knows it is non-null inside closures.
  const level: ChallengeLevel = maybeLevel;

  function getCurrentValue(type: ObjectiveType): number {
    switch (type) {
      case 'connect-stations': return stations.filter((s) => s.lineIds.length > 0).length;
      case 'transport-passengers': return totalPassengers;
      case 'on-time-rate': return onTimeRate;
    }
  }

  const currentValues = level.objectives.map((obj) => getCurrentValue(obj.type));
  const stars = computeStars(level, currentValues);

  // Save the best star score for this level.
  const bestStars = Math.max(stars, challengeStars[level.id] ?? 0);

  function saveThenDo(fn: () => void) {
    setChallengeStars({ ...challengeStars, [level.id]: bestStars });
    fn();
  }

  function handleNextLevel() {
    const nextId = NEXT_LEVEL[level.id];
    if (!nextId) {
      saveThenDo(() => {
        setShowVictory(false);
        setChallengeId(null);
        setShowLevelSelect(true);
      });
      return;
    }
    const nextLevel = CHALLENGE_LEVELS.find((l) => l.id === nextId);
    if (!nextLevel) return;

    saveThenDo(() => {
      useMapStore.getState().reset();
      useSimulationStore.getState().reset();
      useMapStore.getState().loadState(nextLevel.prebuiltMap);
      setChallengeId(nextId);
      setShowVictory(false);
    });
  }

  function handleReplay() {
    saveThenDo(() => {
      useMapStore.getState().reset();
      useSimulationStore.getState().reset();
      useMapStore.getState().loadState(level.prebuiltMap);
      setShowVictory(false);
    });
  }

  function handleBackToSandbox() {
    saveThenDo(() => {
      setShowVictory(false);
      setChallengeId(null);
    });
  }

  const nextId = NEXT_LEVEL[level.id];

  return (
    /* Full-screen backdrop */
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(6,14,31,0.90)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      {/* Modal */}
      <div
        style={{
          background: '#0d1f3c',
          border: '2px solid #ffd93d44',
          borderRadius: 14,
          padding: '32px 28px',
          width: 340,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          textAlign: 'center',
        }}
      >
        {/* Title */}
        <div>
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 20,
              fontWeight: 'bold',
              color: '#ffd93d',
              letterSpacing: 3,
              textShadow: '0 0 12px #ffd93d88',
              marginBottom: 4,
            }}
          >
            CHALLENGE COMPLETE!
          </div>
          <div style={{ color: '#b2bec3', fontSize: 13 }}>
            Great job, subway builder!
          </div>
        </div>

        {/* Stars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <StarDisplay stars={stars} />
          <div style={{ color: '#b2bec3', fontSize: 12 }}>
            {stars === 3 ? 'Perfect run — 3 stars!' : stars === 2 ? 'Solid work — 2 stars!' : 'You did it — 1 star!'}
          </div>
        </div>

        {/* Unlock message */}
        <div
          style={{
            background: '#112240',
            border: '1px solid #1e4976',
            borderRadius: 6,
            padding: '10px 14px',
            color: '#81ecec',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {UNLOCK_TEXT[level.id] ?? ''}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nextId && (
            <button
              onClick={handleNextLevel}
              style={{
                background: '#a29bfe',
                border: 'none',
                borderRadius: 6,
                padding: '10px 0',
                color: '#fff',
                fontFamily: "'Courier New', monospace",
                fontWeight: 'bold',
                fontSize: 12,
                letterSpacing: 2,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#b8b0ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#a29bfe')}
            >
              NEXT LEVEL
            </button>
          )}

          <button
            onClick={handleReplay}
            style={{
              background: '#00b894',
              border: 'none',
              borderRadius: 6,
              padding: '10px 0',
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
            REPLAY
          </button>

          <button
            onClick={handleBackToSandbox}
            style={{
              background: 'transparent',
              border: '1px solid #1a3a5c',
              borderRadius: 6,
              padding: '10px 0',
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
    </div>
  );
}
