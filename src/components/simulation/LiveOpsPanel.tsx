import { useSimulationStore } from '../../stores/simulationStore';
import { useMapStore } from '../../stores/mapStore';

export function LiveOpsPanel() {
  const stats = useSimulationStore((s) => s.stats);
  const lines = useMapStore((s) => s.lines);

  const onTimeRate = stats.onTimeRate;
  const barColor =
    onTimeRate > 85 ? '#43b047' :
    onTimeRate >= 70 ? '#ffe066' :
    '#e52521';

  return (
    <div style={{ padding: '12px' }}>
      {/* Title */}
      <div style={{
        fontSize: 11,
        fontWeight: 'bold',
        color: '#ffcf3f',
        letterSpacing: 1,
        fontFamily: 'var(--font-ui)',
        marginBottom: 12,
      }}>
        Live Operations
      </div>

      {/* Total passengers */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#f5d9a8', fontFamily: 'var(--font-ui)', marginBottom: 3 }}>
          Total Passengers
        </div>
        <div style={{ fontSize: 26, fontWeight: 'bold', color: '#fff8e7', fontFamily: 'var(--font-ui)', lineHeight: 1 }}>
          {stats.totalPassengers.toLocaleString()}
        </div>
      </div>

      {/* On-time rate */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#f5d9a8', fontFamily: 'var(--font-ui)' }}>
            On-Time Rate
          </span>
          <span style={{ fontSize: 11, fontWeight: 'bold', color: barColor, fontFamily: 'var(--font-ui)' }}>
            {Math.round(onTimeRate)}%
          </span>
        </div>
        <div style={{ height: 6, background: '#a0521c', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${onTimeRate}%`,
            background: barColor,
            borderRadius: 3,
            transition: 'width 0.3s, background 0.3s',
          }} />
        </div>
      </div>

      {/* Per-line stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {lines.map((line) => {
          const lineStats = stats.byLine[line.id];
          const passengers = lineStats?.passengers ?? 0;
          const hasData = !!lineStats;

          return (
            <div
              key={line.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                background: '#3b1e08',
                border: '1px solid #a0521c',
                borderRadius: 4,
              }}
            >
              {/* Color dot */}
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: line.color,
                flexShrink: 0,
              }} />

              {/* Name */}
              <div style={{ flex: 1, fontSize: 12, color: '#fff8e7', fontFamily: 'var(--font-ui)' }}>
                {line.name}
              </div>

              {/* Status */}
              <div style={{
                fontSize: 11,
                color: hasData ? '#43b047' : '#f5d9a8',
                fontFamily: 'var(--font-ui)',
              }}>
                {hasData ? 'Running' : 'Idle'}
              </div>

              {/* Passenger count */}
              <div style={{
                fontSize: 12,
                color: '#ffcf3f',
                fontFamily: 'var(--font-ui)',
                minWidth: 28,
                textAlign: 'right',
              }}>
                {passengers}
              </div>
            </div>
          );
        })}

        {lines.length === 0 && (
          <div style={{ fontSize: 11, color: '#f5d9a8', fontFamily: 'var(--font-ui)', textAlign: 'center', padding: '8px 0' }}>
            No lines yet — build tracks first!
          </div>
        )}
      </div>
    </div>
  );
}
