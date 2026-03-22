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
      background: '#0d1f3c',
      border: '1px solid #1a3a5c',
      borderRadius: 6,
    }}>
      {/* Title */}
      <div style={{
        fontSize: 11,
        fontWeight: 'bold',
        color: '#81ecec',
        fontFamily: 'Courier New, monospace',
        letterSpacing: 1,
        marginBottom: 8,
      }}>
        Train Details
      </div>

      {/* Train type / era */}
      <div style={{
        fontSize: 10,
        color: '#dfe6e9',
        fontFamily: 'Courier New, monospace',
        marginBottom: 8,
      }}>
        {train.head.type}{' '}
        <span style={{ color: '#b2bec3', fontSize: 9 }}>({train.head.era})</span>
      </div>

      {/* Status badge */}
      <div style={{ marginBottom: 10 }}>
        <span style={{
          fontSize: 9,
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          padding: '2px 7px',
          borderRadius: 3,
          background: train.lineId ? '#00b89422' : '#ffd93d22',
          color: train.lineId ? '#00b894' : '#ffd93d',
          border: `1px solid ${train.lineId ? '#00b894' : '#ffd93d'}`,
        }}>
          {train.lineId ? 'Assigned' : 'Undeployed'}
        </span>
      </div>

      {/* Passengers */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: '#b2bec3', fontFamily: 'Courier New, monospace', marginBottom: 3 }}>
          Passengers
        </div>
        <div style={{ fontSize: 18, fontWeight: 'bold', color: '#dfe6e9', fontFamily: 'Courier New, monospace', lineHeight: 1 }}>
          {passengers}{' '}
          <span style={{ fontSize: 11, color: '#b2bec3' }}>/ {capacity}</span>
        </div>
      </div>

      {/* Capacity bar */}
      <div style={{ height: 6, background: '#1a3a5c', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${passengerPct}%`,
          background: '#81ecec',
          borderRadius: 3,
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  );
}
