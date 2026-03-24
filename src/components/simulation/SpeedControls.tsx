import { useSimulationStore } from '../../stores/simulationStore';

function formatTime(minutes: number): string {
  // minutes=0 => 6:00 AM, minutes=720 => 6:00 PM, minutes=1080 => 12:00 AM
  const totalMinsFromMidnight = Math.floor((minutes + 360) % 1440);
  const h24 = Math.floor(totalMinsFromMidnight / 60);
  const m = Math.floor(totalMinsFromMidnight % 60);
  const s = Math.floor((minutes * 60) % 60);
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${period}`;
}

export function SpeedControls() {
  const speed = useSimulationStore((s) => s.speed);
  const paused = useSimulationStore((s) => s.paused);
  const time = useSimulationStore((s) => s.time);
  const dwellTime = useSimulationStore((s) => s.dwellTime);
  const boardingPerStation = useSimulationStore((s) => s.boardingPerStation);
  const alightingPerStation = useSimulationStore((s) => s.alightingPerStation);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const togglePause = useSimulationStore((s) => s.togglePause);
  const setDwellTime = useSimulationStore((s) => s.setDwellTime);
  const setBoardingPerStation = useSimulationStore((s) => s.setBoardingPerStation);
  const setAlightingPerStation = useSimulationStore((s) => s.setAlightingPerStation);

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

      {/* Dwell time slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontFamily: 'Courier New, monospace',
          fontSize: 10,
          color: '#b2bec3',
          whiteSpace: 'nowrap',
        }}>
          Station Wait Time
        </span>
        <input
          type="range"
          min={2}
          max={30}
          step={1}
          value={dwellTime}
          onChange={(e) => setDwellTime(Number(e.target.value))}
          style={{ width: 80 }}
        />
        <span style={{
          fontFamily: 'Courier New, monospace',
          fontSize: 10,
          color: '#81ecec',
          minWidth: 60,
        }}>
          {dwellTime} seconds
        </span>
      </div>

      {/* Boarding slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontFamily: 'Courier New, monospace',
          fontSize: 10,
          color: '#b2bec3',
          whiteSpace: 'nowrap',
        }}>
          Boarding
        </span>
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={boardingPerStation}
          onChange={(e) => setBoardingPerStation(Number(e.target.value))}
          style={{ width: 80 }}
        />
        <span style={{
          fontFamily: 'Courier New, monospace',
          fontSize: 10,
          color: '#81ecec',
          minWidth: 20,
        }}>
          {boardingPerStation}
        </span>
      </div>

      {/* Alighting slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontFamily: 'Courier New, monospace',
          fontSize: 10,
          color: '#b2bec3',
          whiteSpace: 'nowrap',
        }}>
          Alighting
        </span>
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={alightingPerStation}
          onChange={(e) => setAlightingPerStation(Number(e.target.value))}
          style={{ width: 80 }}
        />
        <span style={{
          fontFamily: 'Courier New, monospace',
          fontSize: 10,
          color: '#81ecec',
          minWidth: 20,
        }}>
          {alightingPerStation}
        </span>
      </div>

      {/* Capacity label */}
      <span style={{
        fontFamily: 'Courier New, monospace',
        fontSize: 10,
        color: '#b2bec3',
        whiteSpace: 'nowrap',
      }}>
        Max 20 per car
      </span>
    </div>
  );
}
