import { useState } from 'react';
import { useMapStore } from '../../stores/mapStore';
import { useTrainStore } from '../../stores/trainStore';
import type { Train } from '../../types';

function trainHeadName(head: Train['head']): string {
  const city = head.city.charAt(0).toUpperCase() + head.city.slice(1);
  const era  = head.era.charAt(0).toUpperCase()  + head.era.slice(1);
  return `${city} ${era}`;
}

export function DeploymentPanel() {
  const lines        = useMapStore((s) => s.lines);
  const trains       = useTrainStore((s) => s.trains);
  const assignToLine = useTrainStore((s) => s.assignToLine);

  const [deployingLineId, setDeployingLineId] = useState<string | null>(null);

  const unassignedTrains = trains.filter((t) => t.lineId === '');
  const allDeployed      = trains.length > 0 && trains.every((t) => t.lineId !== '');

  function handleDeployTrain(lineId: string, trainId: string) {
    assignToLine(trainId, lineId);
    setDeployingLineId(null);
  }

  function handleRemove(trainId: string) {
    assignToLine(trainId, '');
  }

  return (
    <div style={{ padding: '12px' }}>
      {/* Title */}
      <div style={{
        fontSize: 11,
        fontWeight: 'bold',
        color: '#ffcf3f',
        letterSpacing: 1,
        fontFamily: 'var(--font-ui)',
        marginBottom: 2,
      }}>
        Deploy Your Trains
      </div>
      <div style={{ fontSize: 11, color: '#f5d9a8', fontFamily: 'var(--font-ui)', marginBottom: 12 }}>
        Assign trains to lines before running the simulation
      </div>

      {/* No trains at all */}
      {trains.length === 0 && (
        <div style={{
          fontSize: 12,
          color: '#ffe066',
          fontFamily: 'var(--font-ui)',
          padding: '8px 0',
          textAlign: 'center',
        }}>
          Build a train in Assembly mode first!
        </div>
      )}

      {/* All trains deployed banner */}
      {allDeployed && (
        <div style={{
          fontSize: 11,
          color: '#43b047',
          fontFamily: 'var(--font-ui)',
          marginBottom: 8,
          padding: '4px 8px',
          background: '#43b04718',
          border: '1px solid #43b04744',
          borderRadius: 4,
        }}>
          All trains are deployed!
        </div>
      )}

      {/* Per-line rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lines.map((line) => {
          const assignedTrain  = trains.find((t) => t.lineId === line.id);
          const isDeploying    = deployingLineId === line.id;

          return (
            <div
              key={line.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '7px 8px',
                background: '#3b1e08',
                border: '1px solid #a0521c',
                borderRadius: 4,
              }}
            >
              {/* Color circle */}
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: line.color,
                flexShrink: 0,
                marginTop: 2,
              }} />

              {/* Line info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#fff8e7', fontFamily: 'var(--font-ui)', fontWeight: 'bold' }}>
                  {line.name}
                </div>
                <div style={{ fontSize: 10, color: '#f5d9a8', fontFamily: 'var(--font-ui)', marginTop: 1 }}>
                  {line.stationIds.length} station{line.stationIds.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Action */}
              {assignedTrain ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: '#43b047', fontFamily: 'var(--font-ui)' }}>
                    Deployed
                  </span>
                  <span style={{ fontSize: 10, color: '#f5d9a8', fontFamily: 'var(--font-ui)' }}>
                    Train {trains.indexOf(assignedTrain) + 1}
                  </span>
                  <button
                    onClick={() => handleRemove(assignedTrain.id)}
                    style={{
                      padding: '2px 6px',
                      background: '#e5252122',
                      border: '1px solid #e52521',
                      borderRadius: 3,
                      color: '#e52521',
                      fontSize: 10,
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : isDeploying ? (
                /* Train picker */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, minWidth: 100 }}>
                  {unassignedTrains.length === 0 ? (
                    <div style={{ fontSize: 10, color: '#f5d9a8', fontFamily: 'var(--font-ui)', fontStyle: 'italic' }}>
                      No available trains
                    </div>
                  ) : (
                    unassignedTrains.map((train) => {
                      const trainNum = trains.indexOf(train) + 1;
                      return (
                        <button
                          key={train.id}
                          onClick={() => handleDeployTrain(line.id, train.id)}
                          style={{
                            padding: '3px 6px',
                            background: '#43b04733',
                            border: '1px solid #43b047',
                            borderRadius: 3,
                            color: '#43b047',
                            fontSize: 10,
                            fontFamily: 'var(--font-ui)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          Train {trainNum} — {trainHeadName(train.head)}
                        </button>
                      );
                    })
                  )}
                  <button
                    onClick={() => setDeployingLineId(null)}
                    style={{
                      padding: '2px 6px',
                      background: 'transparent',
                      border: '1px solid #a0521c',
                      borderRadius: 3,
                      color: '#f5d9a8',
                      fontSize: 10,
                      fontFamily: 'var(--font-ui)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => unassignedTrains.length > 0 ? setDeployingLineId(line.id) : undefined}
                  disabled={unassignedTrains.length === 0}
                  style={{
                    padding: '3px 8px',
                    background: unassignedTrains.length > 0 ? '#43b04733' : 'transparent',
                    border: `1px solid ${unassignedTrains.length > 0 ? '#43b047' : '#a0521c'}`,
                    borderRadius: 3,
                    color: unassignedTrains.length > 0 ? '#43b047' : '#f5d9a8',
                    fontSize: 11,
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 'bold',
                    cursor: unassignedTrains.length > 0 ? 'pointer' : 'not-allowed',
                    opacity: unassignedTrains.length > 0 ? 1 : 0.5,
                    flexShrink: 0,
                  }}
                >
                  Deploy Train
                </button>
              )}
            </div>
          );
        })}

        {lines.length === 0 && trains.length > 0 && (
          <div style={{ fontSize: 11, color: '#f5d9a8', fontFamily: 'var(--font-ui)', textAlign: 'center', padding: '8px 0' }}>
            No lines yet — build tracks first!
          </div>
        )}
      </div>
    </div>
  );
}
