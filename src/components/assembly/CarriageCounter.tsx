import { useTrainStore } from '../../stores/trainStore';
import { useUIStore } from '../../stores/uiStore';

const MAX_CARRIAGES = 7;

export function CarriageCounter() {
  const trains = useTrainStore((s) => s.trains);
  const selectedTrainId = useUIStore((s) => s.selectedTrainId);

  const activeTrain =
    trains.find((t) => t.id === selectedTrainId) ?? trains[0] ?? null;
  const carriageCount = activeTrain?.carriages.length ?? 0;
  const atMax = carriageCount >= MAX_CARRIAGES;

  return (
    <div
      style={{
        padding: '8px 10px',
        borderTop: '1px solid #1a3a5c44',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 'bold',
          letterSpacing: 1,
          color: '#dfe6e9',
          textTransform: 'uppercase',
          marginBottom: 5,
          fontFamily: 'Courier New, monospace',
        }}
      >
        Train Size
      </div>

      {!activeTrain ? (
        <div style={{ fontSize: 9, color: '#b2bec3', fontStyle: 'italic' }}>
          No carriages yet — add some from the catalog!
        </div>
      ) : atMax ? (
        <div
          style={{
            fontSize: 9,
            color: '#ffd93d',
            fontFamily: 'Courier New, monospace',
          }}
        >
          Maximum reached! (7 carriages + 1 head = 8 cars)
        </div>
      ) : (
        <div
          style={{
            fontSize: 10,
            color: '#81ecec',
            fontFamily: 'Courier New, monospace',
          }}
        >
          {carriageCount} / {MAX_CARRIAGES} Carriages
        </div>
      )}

      {activeTrain && (
        <div style={{ marginTop: 6, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* Head block */}
          <div
            style={{
              width: 14,
              height: 14,
              background: '#81ecec',
              borderRadius: 3,
              flexShrink: 0,
            }}
            title="Train head"
          />
          {/* Carriage slots */}
          {Array.from({ length: MAX_CARRIAGES }).map((_, i) => {
            const carriage = activeTrain.carriages[i];
            const filled = i < carriageCount;
            const isWidebody = carriage?.type === 'widebody';
            return (
              <div
                key={i}
                style={{
                  width: isWidebody ? 20 : 14,
                  height: 14,
                  background: filled ? '#a29bfe' : '#1a3a5c',
                  borderRadius: 3,
                  flexShrink: 0,
                  transition: 'background 0.2s, width 0.2s',
                }}
                title={
                  filled
                    ? `Carriage ${i + 1}${isWidebody ? ' (Wide-body)' : ''}`
                    : 'Empty slot'
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
