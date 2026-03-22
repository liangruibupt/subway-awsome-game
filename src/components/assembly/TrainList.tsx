import { useTrainStore } from '../../stores/trainStore';
import { useUIStore } from '../../stores/uiStore';
import type { Train } from '../../types';

function trainHeadName(head: Train['head']): string {
  const city = head.city.charAt(0).toUpperCase() + head.city.slice(1);
  const era  = head.era.charAt(0).toUpperCase()  + head.era.slice(1);
  return `${city} ${era}`;
}

export function TrainList() {
  const trains      = useTrainStore((s) => s.trains);
  const deleteTrain = useTrainStore((s) => s.deleteTrain);

  const activeIndex    = useUIStore((s) => s.activeTrainIndex);
  const setActiveIndex = useUIStore((s) => s.setActiveTrainIndex);
  const setPhase       = useUIStore((s) => s.setAssemblyPhase);

  function handleNewTrain() {
    setActiveIndex(trains.length); // index of the train about to be created
    setPhase('head-selection');
  }

  function handleSelect(index: number) {
    setActiveIndex(index);
    const train = trains[index];
    setPhase(train ? 'carriage-building' : 'head-selection');
  }

  function handleDelete(e: React.MouseEvent, index: number) {
    e.stopPropagation();
    if (trains.length <= 1) return;
    deleteTrain(trains[index].id);
    const newLength = trains.length - 1;
    if (index === activeIndex) {
      // Deleted the active train — move to an adjacent one
      setActiveIndex(Math.min(index, newLength - 1));
      setPhase('carriage-building');
    } else if (index < activeIndex) {
      // Deleted before active — shift active index down by 1
      setActiveIndex(activeIndex - 1);
    }
    // If index > activeIndex: no change needed
  }

  const hasNewSlot = activeIndex >= trains.length;

  return (
    <div style={{
      padding: '10px 8px',
      borderBottom: '1px solid #1a3a5c',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      flexShrink: 0,
    }}>
      {/* Title */}
      <div style={{
        fontSize: 9,
        fontWeight: 'bold',
        letterSpacing: 1,
        color: '#81ecec',
        textTransform: 'uppercase',
        fontFamily: 'Courier New, monospace',
      }}>
        Your Trains
      </div>

      {/* Train list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {trains.map((train, index) => {
          const isActive  = index === activeIndex;
          const totalCars = 1 + train.carriages.length;
          return (
            <div
              key={train.id}
              onClick={() => handleSelect(index)}
              style={{
                padding: '6px 8px',
                background: isActive ? '#1a3a5c55' : '#060e1f',
                border: isActive ? '1px solid #81ecec' : '1px solid #1a3a5c',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: isActive ? '#81ecec' : '#dfe6e9',
                  fontFamily: 'Courier New, monospace',
                }}>
                  Train {index + 1}
                </span>
                {trains.length > 1 && (
                  <button
                    onClick={(e) => handleDelete(e, index)}
                    style={{
                      padding: '1px 5px',
                      background: '#ff6b6b22',
                      border: '1px solid #ff6b6b',
                      borderRadius: 2,
                      color: '#ff6b6b',
                      fontSize: 8,
                      fontFamily: 'Courier New, monospace',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      lineHeight: 1.2,
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div style={{ fontSize: 9, color: '#b2bec3', fontFamily: 'Courier New, monospace' }}>
                {trainHeadName(train.head)}
              </div>
              <div style={{ fontSize: 8, color: '#b2bec3', fontFamily: 'Courier New, monospace' }}>
                1 + {train.carriages.length} = {totalCars} car{totalCars !== 1 ? 's' : ''}
              </div>
            </div>
          );
        })}

        {/* Placeholder shown while creating a new train (head not picked yet) */}
        {hasNewSlot && (
          <div style={{
            padding: '6px 8px',
            background: '#1a3a5c22',
            border: '1px dashed #81ecec88',
            borderRadius: 4,
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 'bold',
              color: '#81ecec88',
              fontFamily: 'Courier New, monospace',
            }}>
              Train {trains.length + 1} (new)
            </div>
            <div style={{
              fontSize: 8,
              color: '#b2bec388',
              fontFamily: 'Courier New, monospace',
              marginTop: 2,
            }}>
              Pick a head from the list below
            </div>
          </div>
        )}
      </div>

      {/* New Train button */}
      <button
        onClick={handleNewTrain}
        style={{
          padding: '6px 0',
          background: '#00b89422',
          border: '1px solid #00b894',
          borderRadius: 4,
          color: '#00b894',
          fontSize: 10,
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          cursor: 'pointer',
          width: '100%',
          transition: 'background 0.15s',
          letterSpacing: 0.5,
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = '#00b89444')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = '#00b89422')
        }
      >
        + New Train
      </button>
    </div>
  );
}
