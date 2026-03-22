import { useRef } from 'react';
import { useMapStore } from '../../stores/mapStore';
import { useUIStore } from '../../stores/uiStore';

/**
 * StationProperties — shows details about the selected station.
 * Only renders when a station is selected (uiStore.selectedStationId is set).
 * Designed for 10-year-old players: full words, friendly labels.
 */
export function StationProperties() {
  const selectedId = useUIStore((s) => s.selectedStationId);
  const stations = useMapStore((s) => s.stations);
  const lines = useMapStore((s) => s.lines);
  const renameStation = useMapStore((s) => s.renameStation);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!selectedId) return null;

  const station = stations.find((s) => s.id === selectedId);
  if (!station) return null;

  const stationLines = lines.filter((l) => station.lineIds.includes(l.id));
  const isTransfer = station.lineIds.length >= 2;
  const isTerminal = station.type === 'terminal';

  // Kid-friendly type label
  const typeLabel = isTerminal
    ? 'End Station'
    : isTransfer
      ? 'Transfer Station'
      : 'Normal Station';

  const typeColor = isTerminal
    ? '#ffd93d'
    : isTransfer
      ? '#a29bfe'
      : '#55efc4';

  const handleRename = () => {
    const val = inputRef.current?.value.trim() ?? '';
    if (val && val !== station.name) {
      renameStation(station.id, val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleRename();
      inputRef.current?.blur();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#dfe6e9', letterSpacing: 0.4 }}>
          Station Details
        </div>
        <div style={{ fontSize: 11, color: '#74b9ff', marginTop: 3 }}>
          Info about the station you picked
        </div>
      </div>

      {/* Editable name */}
      <div>
        <div style={{ fontSize: 11, color: '#b2bec3', marginBottom: 5 }}>Station Name</div>
        <input
          ref={inputRef}
          type="text"
          defaultValue={station.name}
          key={station.id} // re-mount when selection changes
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          style={{
            background: '#0d0b1e',
            border: '1.5px solid #6c5ce7',
            borderRadius: 6,
            padding: '7px 10px',
            fontSize: 13,
            color: '#dfe6e9',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Type badge */}
      <div>
        <div style={{ fontSize: 11, color: '#b2bec3', marginBottom: 5 }}>Station Type</div>
        <span
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: 20,
            background: `${typeColor}22`,
            border: `1px solid ${typeColor}88`,
            color: typeColor,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {typeLabel}
        </span>
        {isTransfer && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: '#a29bfe',
              fontStyle: 'italic',
            }}
          >
            This station connects multiple lines!
          </div>
        )}
      </div>

      {/* Lines this station belongs to */}
      {stationLines.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#b2bec3', marginBottom: 6 }}>On These Lines</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stationLines.map((line) => (
              <div
                key={line.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: line.color,
                    flexShrink: 0,
                    boxShadow: `0 0 4px ${line.color}88`,
                  }}
                />
                <div style={{ fontSize: 12, color: '#dfe6e9' }}>{line.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stationLines.length === 0 && (
        <div style={{ fontSize: 11, color: '#b2bec3', fontStyle: 'italic' }}>
          Not on any line yet — use the Connect tool to link it!
        </div>
      )}
    </div>
  );
}
