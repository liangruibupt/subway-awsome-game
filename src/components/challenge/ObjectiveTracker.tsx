import { useEffect } from 'react';
import { useMapStore } from '../../stores/mapStore';
import { useSimulationStore } from '../../stores/simulationStore';
import { useUIStore } from '../../stores/uiStore';
import { CHALLENGE_LEVELS } from '../../data/challengeLevels';
import type { ObjectiveType } from '../../data/challengeLevels';

function ProgressBar({ value, max, color = '#81ecec' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div
      style={{
        height: 6,
        background: '#1a3a5c',
        borderRadius: 3,
        overflow: 'hidden',
        marginTop: 3,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: pct >= 100 ? '#00b894' : color,
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

function formatValue(type: ObjectiveType, value: number): string {
  if (type === 'on-time-rate') return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}

export function ObjectiveTracker() {
  const challengeId     = useUIStore((s) => s.challengeId);
  const setShowVictory  = useUIStore((s) => s.setShowVictory);

  // Map store selectors
  const stations = useMapStore((s) => s.stations);

  // Simulation store selectors
  const totalPassengers = useSimulationStore((s) => s.stats.totalPassengers);
  const onTimeRate      = useSimulationStore((s) => s.stats.onTimeRate);

  const level = CHALLENGE_LEVELS.find((l) => l.id === challengeId);
  if (!level) return null;

  // Compute current value for each objective type.
  function getCurrentValue(type: ObjectiveType): number {
    switch (type) {
      case 'connect-stations':
        return stations.filter((s) => s.lineIds.length > 0).length;
      case 'transport-passengers':
        return totalPassengers;
      case 'on-time-rate':
        return onTimeRate;
    }
  }

  const currentValues = level.objectives.map((obj) => getCurrentValue(obj.type));
  const allMet = level.objectives.every((obj, i) => currentValues[i] >= obj.target);

  // Trigger victory when all objectives are satisfied.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (allMet) {
      setShowVictory(true);
    }
  }, [allMet, setShowVictory]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 50,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        background: 'rgba(13,31,60,0.92)',
        border: '1px solid #1e4976',
        borderRadius: 10,
        padding: '12px 18px',
        minWidth: 260,
        maxWidth: 340,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      {/* Level name */}
      <div
        style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 11,
          fontWeight: 'bold',
          color: '#81ecec',
          letterSpacing: 2,
          marginBottom: 10,
          textTransform: 'uppercase',
        }}
      >
        {level.name}
      </div>

      {/* Objectives */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {level.objectives.map((obj, i) => {
          const current = currentValues[i];
          const met     = current >= obj.target;
          return (
            <div key={obj.type}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  color: met ? '#00b894' : '#dfe6e9',
                }}
              >
                <span>{obj.label}</span>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: met ? '#00b894' : '#81ecec' }}>
                  {formatValue(obj.type, current)} / {formatValue(obj.type, obj.target)}
                </span>
              </div>
              <ProgressBar
                value={current}
                max={obj.target}
                color={met ? '#00b894' : '#81ecec'}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
