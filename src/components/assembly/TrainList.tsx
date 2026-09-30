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
      borderBottom: '1px solid #a0521c',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      flexShrink: 0,
    }}>
      {/* Title */}
      <div style={{
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
        color: '#ffcf3f',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-ui)',
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
                background: isActive ? '#a0521c55' : '#3b1e08',
                border: isActive ? '1px solid #ffcf3f' : '1px solid #a0521c',
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
                  fontSize: 12,
                  fontWeight: 'bold',
                  color: isActive ? '#ffcf3f' : '#fff8e7',
                  fontFamily: 'var(--font-ui)',
                }}>
                  Train {index + 1}
                </span>
                {trains.length > 1 && (
                  <button
                    onClick={(e) => handleDelete(e, index)}
                    style={{
                      padding: '1px 5px',
                      background: '#e5252122',
                      border: '1px solid #e52521',
                      borderRadius: 2,
                      color: '#e52521',
                      fontSize: 10,
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      lineHeight: 1.2,
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#f5d9a8', fontFamily: 'var(--font-ui)' }}>
                {trainHeadName(train.head)}
              </div>
              <div style={{ fontSize: 10, color: '#f5d9a8', fontFamily: 'var(--font-ui)' }}>
                1 + {train.carriages.length} = {totalCars} car{totalCars !== 1 ? 's' : ''}
              </div>
            </div>
          );
        })}

        {/* Placeholder shown while creating a new train (head not picked yet) */}
        {hasNewSlot && (
          <div style={{
            padding: '6px 8px',
            background: '#a0521c22',
            border: '1px dashed #ffcf3f88',
            borderRadius: 4,
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 'bold',
              color: '#ffcf3f88',
              fontFamily: 'var(--font-ui)',
            }}>
              Train {trains.length + 1} (new)
            </div>
            <div style={{
              fontSize: 10,
              color: '#f5d9a888',
              fontFamily: 'var(--font-ui)',
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
          background: '#43b04722',
          border: '1px solid #43b047',
          borderRadius: 4,
          color: '#43b047',
          fontSize: 12,
          fontFamily: 'var(--font-ui)',
          fontWeight: 'bold',
          cursor: 'pointer',
          width: '100%',
          transition: 'background 0.15s',
          letterSpacing: 0.5,
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = '#43b04744')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = '#43b04722')
        }
      >
        + New Train
      </button>
    </div>
  );
}
