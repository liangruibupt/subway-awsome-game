import { useSimulationStore } from '../../stores/simulationStore';
import { useMapStore } from '../../stores/mapStore';

export function LiveOpsPanel() {
  const stats = useSimulationStore((s) => s.stats);
  const lines = useMapStore((s) => s.lines);

  const onTimeRate = stats.onTimeRate;
  const barColor =
    onTimeRate > 85 ? '#00b894' :
    onTimeRate >= 70 ? '#ffd93d' :
    '#ff6b6b';

  return (
    <div style={{ padding: '12px' }}>
      {/* Title */}
      <div style={{
        fontSize: 11,
        fontWeight: 'bold',
        color: '#81ecec',
        letterSpacing: 1,
        fontFamily: 'Courier New, monospace',
        marginBottom: 12,
      }}>
        Live Operations
      </div>

      {/* Total passengers */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: '#b2bec3', fontFamily: 'Courier New, monospace', marginBottom: 3 }}>
          Total Passengers
        </div>
        <div style={{ fontSize: 26, fontWeight: 'bold', color: '#dfe6e9', fontFamily: 'Courier New, monospace', lineHeight: 1 }}>
          {stats.totalPassengers.toLocaleString()}
        </div>
      </div>

      {/* On-time rate */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: '#b2bec3', fontFamily: 'Courier New, monospace' }}>
            On-Time Rate
          </span>
          <span style={{ fontSize: 9, fontWeight: 'bold', color: barColor, fontFamily: 'Courier New, monospace' }}>
            {Math.round(onTimeRate)}%
          </span>
        </div>
        <div style={{ height: 6, background: '#1a3a5c', borderRadius: 3, overflow: 'hidden' }}>
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
                background: '#060e1f',
                border: '1px solid #1a3a5c',
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
              <div style={{ flex: 1, fontSize: 10, color: '#dfe6e9', fontFamily: 'Courier New, monospace' }}>
                {line.name}
              </div>

              {/* Status */}
              <div style={{
                fontSize: 9,
                color: hasData ? '#00b894' : '#b2bec3',
                fontFamily: 'Courier New, monospace',
              }}>
                {hasData ? 'Running' : 'Idle'}
              </div>

              {/* Passenger count */}
              <div style={{
                fontSize: 10,
                color: '#81ecec',
                fontFamily: 'Courier New, monospace',
                minWidth: 28,
                textAlign: 'right',
              }}>
                {passengers}
              </div>
            </div>
          );
        })}

        {lines.length === 0 && (
          <div style={{ fontSize: 9, color: '#b2bec3', fontFamily: 'Courier New, monospace', textAlign: 'center', padding: '8px 0' }}>
            No lines yet — build tracks first!
          </div>
        )}
      </div>
    </div>
  );
}
