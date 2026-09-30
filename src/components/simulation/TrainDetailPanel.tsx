import { useTrainStore } from '../../stores/trainStore';

interface Props {
  trainId: string | null;
}

export function TrainDetailPanel({ trainId }: Props) {
  const trains = useTrainStore((s) => s.trains);
  const getTrainCapacity = useTrainStore((s) => s.getTrainCapacity);

  if (!trainId) return null;

  const train = trains.find((t) => t.id === trainId);
  if (!train) return null;

  const capacity = getTrainCapacity(trainId);
  // Passenger count will be wired to the simulation engine later
  const passengers = 0;
  const passengerPct = capacity > 0 ? (passengers / capacity) * 100 : 0;

  return (
    <div style={{
      padding: '12px',
      background: '#5c2e0e',
      border: '1px solid #a0521c',
      borderRadius: 6,
    }}>
      {/* Title */}
      <div style={{
        fontSize: 11,
        fontWeight: 'bold',
        color: '#ffcf3f',
        fontFamily: 'var(--font-ui)',
        letterSpacing: 1,
        marginBottom: 8,
      }}>
        Train Details
      </div>

      {/* Train type / era */}
      <div style={{
        fontSize: 12,
        color: '#fff8e7',
        fontFamily: 'var(--font-ui)',
        marginBottom: 8,
      }}>
        {train.head.type}{' '}
        <span style={{ color: '#f5d9a8', fontSize: 11 }}>({train.head.era})</span>
      </div>

      {/* Status badge */}
      <div style={{ marginBottom: 10 }}>
        <span style={{
          fontSize: 11,
          fontFamily: 'var(--font-ui)',
          fontWeight: 'bold',
          padding: '2px 7px',
          borderRadius: 3,
          background: train.lineId ? '#43b04722' : '#ffe06622',
          color: train.lineId ? '#43b047' : '#ffe066',
          border: `1px solid ${train.lineId ? '#43b047' : '#ffe066'}`,
        }}>
          {train.lineId ? 'Assigned' : 'Undeployed'}
        </span>
      </div>

      {/* Passengers */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#f5d9a8', fontFamily: 'var(--font-ui)', marginBottom: 3 }}>
          Passengers
        </div>
        <div style={{ fontSize: 18, fontWeight: 'bold', color: '#fff8e7', fontFamily: 'var(--font-ui)', lineHeight: 1 }}>
          {passengers}{' '}
          <span style={{ fontSize: 11, color: '#f5d9a8' }}>/ {capacity}</span>
        </div>
      </div>

      {/* Capacity bar */}
      <div style={{ height: 6, background: '#a0521c', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${passengerPct}%`,
          background: '#ffcf3f',
          borderRadius: 3,
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  );
}
