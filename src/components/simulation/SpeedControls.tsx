import { useSimulationStore } from '../../stores/simulationStore';

function formatTime(minutes: number): string {
  // minutes=0 => 6:00 AM, minutes=720 => 6:00 PM, minutes=1080 => 12:00 AM
  const totalMinsFromMidnight = (minutes + 360) % 1440;
  const h24 = Math.floor(totalMinsFromMidnight / 60);
  const m = totalMinsFromMidnight % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function SpeedControls() {
  const speed = useSimulationStore((s) => s.speed);
  const paused = useSimulationStore((s) => s.paused);
  const time = useSimulationStore((s) => s.time);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const togglePause = useSimulationStore((s) => s.togglePause);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 12px',
    }}>
      {/* Time display */}
      <div style={{
        fontFamily: 'Courier New, monospace',
        fontSize: 12,
        fontWeight: 'bold',
        color: '#81ecec',
        minWidth: 80,
      }}>
        {formatTime(time)}
      </div>

      {/* Play/Pause */}
      <button
        onClick={togglePause}
        style={{
          padding: '4px 10px',
          background: paused ? '#00b89422' : '#ffd93d22',
          border: `1px solid ${paused ? '#00b894' : '#ffd93d'}`,
          borderRadius: 4,
          color: paused ? '#00b894' : '#ffd93d',
          fontSize: 11,
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          cursor: 'pointer',
          letterSpacing: 0.5,
        }}
      >
        {paused ? '\u25B6 Play' : '\u275A\u275A Pause'}
      </button>

      {/* Speed buttons */}
      <div style={{ display: 'flex', gap: 3 }}>
        {([1, 2, 4] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            style={{
              padding: '4px 8px',
              background: speed === s ? '#00b89433' : 'transparent',
              border: `1px solid ${speed === s ? '#00b894' : '#1a3a5c'}`,
              borderRadius: 4,
              color: speed === s ? '#00b894' : '#b2bec3',
              fontSize: 10,
              fontFamily: 'Courier New, monospace',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
