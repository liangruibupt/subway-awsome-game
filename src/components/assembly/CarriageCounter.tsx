import { useTrainStore } from '../../stores/trainStore';
import { useUIStore } from '../../stores/uiStore';

const MAX_CARRIAGES = 7;
const MAX_CARS      = 1 + MAX_CARRIAGES; // 8

export function CarriageCounter() {
  const trains          = useTrainStore((s) => s.trains);
  const activeTrainIndex = useUIStore((s) => s.activeTrainIndex);

  const activeTrain    = trains[activeTrainIndex] ?? null;
  const carriageCount  = activeTrain?.carriages.length ?? 0;
  const totalCars      = 1 + carriageCount;
  const atMax          = carriageCount >= MAX_CARRIAGES;

  return (
    <div style={{
      padding: '8px 10px',
      borderTop: '1px solid #a0521c44',
      flexShrink: 0,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
        color: '#fff8e7',
        textTransform: 'uppercase',
        marginBottom: 5,
        fontFamily: 'var(--font-ui)',
      }}>
        Train Size
      </div>

      {!activeTrain ? (
        <div style={{ fontSize: 11, color: '#f5d9a8', fontStyle: 'italic' }}>
          No train yet — pick a head to start!
        </div>
      ) : atMax ? (
        <div style={{ fontSize: 11, color: '#ffe066', fontFamily: 'var(--font-ui)' }}>
          Maximum reached! (1 Head + 7 Carriages = 8 / 8 Cars)
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#ffcf3f', fontFamily: 'var(--font-ui)' }}>
          1 Head + {carriageCount} Carriages = {totalCars} / {MAX_CARS} Cars
        </div>
      )}

      {activeTrain && (
        <div style={{ marginTop: 6, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* Head block */}
          <div
            style={{
              width: 14, height: 14,
              background: '#ffcf3f',
              borderRadius: 3,
              flexShrink: 0,
            }}
            title="Train head"
          />
          {/* Carriage slots */}
          {Array.from({ length: MAX_CARRIAGES }).map((_, i) => {
            const carriage   = activeTrain.carriages[i];
            const filled     = i < carriageCount;
            const isWidebody = carriage?.type === 'widebody';
            return (
              <div
                key={i}
                style={{
                  width:      isWidebody ? 20 : 14,
                  height:     14,
                  background: filled ? '#5c94fc' : '#a0521c',
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
