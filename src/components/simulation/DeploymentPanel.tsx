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
        color: '#81ecec',
        letterSpacing: 1,
        fontFamily: 'Courier New, monospace',
        marginBottom: 2,
      }}>
        Deploy Your Trains
      </div>
      <div style={{ fontSize: 9, color: '#b2bec3', fontFamily: 'Courier New, monospace', marginBottom: 12 }}>
        Assign trains to lines before running the simulation
      </div>

      {/* No trains at all */}
      {trains.length === 0 && (
        <div style={{
          fontSize: 10,
          color: '#ffd93d',
          fontFamily: 'Courier New, monospace',
          padding: '8px 0',
          textAlign: 'center',
        }}>
          Build a train in Assembly mode first!
        </div>
      )}

      {/* All trains deployed banner */}
      {allDeployed && (
        <div style={{
          fontSize: 9,
          color: '#00b894',
          fontFamily: 'Courier New, monospace',
          marginBottom: 8,
          padding: '4px 8px',
          background: '#00b89418',
          border: '1px solid #00b89444',
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
                background: '#060e1f',
                border: '1px solid #1a3a5c',
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
                <div style={{ fontSize: 10, color: '#dfe6e9', fontFamily: 'Courier New, monospace', fontWeight: 'bold' }}>
                  {line.name}
                </div>
                <div style={{ fontSize: 8, color: '#b2bec3', fontFamily: 'Courier New, monospace', marginTop: 1 }}>
                  {line.stationIds.length} station{line.stationIds.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Action */}
              {assignedTrain ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                  <span style={{ fontSize: 8, color: '#00b894', fontFamily: 'Courier New, monospace' }}>
                    Deployed
                  </span>
                  <span style={{ fontSize: 8, color: '#b2bec3', fontFamily: 'Courier New, monospace' }}>
                    Train {trains.indexOf(assignedTrain) + 1}
                  </span>
                  <button
                    onClick={() => handleRemove(assignedTrain.id)}
                    style={{
                      padding: '2px 6px',
                      background: '#ff6b6b22',
                      border: '1px solid #ff6b6b',
                      borderRadius: 3,
                      color: '#ff6b6b',
                      fontSize: 8,
                      fontFamily: 'Courier New, monospace',
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
                    <div style={{ fontSize: 8, color: '#b2bec3', fontFamily: 'Courier New, monospace', fontStyle: 'italic' }}>
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
                            background: '#00b89433',
                            border: '1px solid #00b894',
                            borderRadius: 3,
                            color: '#00b894',
                            fontSize: 8,
                            fontFamily: 'Courier New, monospace',
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
                      border: '1px solid #1a3a5c',
                      borderRadius: 3,
                      color: '#b2bec3',
                      fontSize: 8,
                      fontFamily: 'Courier New, monospace',
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
                    background: unassignedTrains.length > 0 ? '#00b89433' : 'transparent',
                    border: `1px solid ${unassignedTrains.length > 0 ? '#00b894' : '#1a3a5c'}`,
                    borderRadius: 3,
                    color: unassignedTrains.length > 0 ? '#00b894' : '#b2bec3',
                    fontSize: 9,
                    fontFamily: 'Courier New, monospace',
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
          <div style={{ fontSize: 9, color: '#b2bec3', fontFamily: 'Courier New, monospace', textAlign: 'center', padding: '8px 0' }}>
            No lines yet — build tracks first!
          </div>
        )}
      </div>
    </div>
  );
}
