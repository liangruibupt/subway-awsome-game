import { useState } from 'react';
import { useMapStore } from '../../stores/mapStore';
import { useUIStore } from '../../stores/uiStore';

const PRESET_COLORS = [
  '#ff6b6b', '#74b9ff', '#55efc4', '#ffd93d',
  '#a29bfe', '#fd79a8', '#e17055', '#00cec9',
];

/**
 * LineList — shown in the right panel during track-design mode.
 * Lists all subway lines and lets the player add new ones.
 * Designed for 10-year-old players: full words, friendly tone.
 */
export function LineList() {
  const lines = useMapStore((s) => s.lines);
  const stations = useMapStore((s) => s.stations);
  const addLine = useMapStore((s) => s.addLine);
  const selectedLineId = useUIStore((s) => s.selectedLineId);
  const selectLine = useUIStore((s) => s.selectLine);

  const [showForm, setShowForm] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [pickedColor, setPickedColor] = useState(PRESET_COLORS[0]);

  const handleAddLine = () => {
    const name = newLineName.trim() || `Line ${lines.length + 1}`;
    addLine(name, pickedColor);
    // Auto-select the newly created line
    const newLines = useMapStore.getState().lines;
    if (newLines.length > 0) {
      selectLine(newLines[newLines.length - 1].id);
    }
    setShowForm(false);
    setNewLineName('');
    setPickedColor(PRESET_COLORS[0]);
  };

  // Count stations on each line from the mapStore
  const stationCountForLine = (lineId: string) => {
    return stations.filter((s) => s.lineIds.includes(lineId)).length;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#dfe6e9',
            letterSpacing: 0.4,
          }}
        >
          Your Lines
        </div>
        <div style={{ fontSize: 11, color: '#74b9ff', marginTop: 3 }}>
          Each line is a subway route with its own color
        </div>
      </div>

      {/* Line list */}
      {lines.length === 0 && (
        <div style={{ fontSize: 12, color: '#b2bec3', fontStyle: 'italic' }}>
          No lines yet — add one below!
        </div>
      )}

      {lines.map((line) => {
        const count = stationCountForLine(line.id);
        const isSelected = line.id === selectedLineId;
        return (
          <div
            key={line.id}
            onClick={() => selectLine(isSelected ? null : line.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 8,
              background: isSelected ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
              border: `1.5px solid ${isSelected ? line.color : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {/* Color circle */}
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: line.color,
                flexShrink: 0,
                boxShadow: `0 0 6px ${line.color}88`,
              }}
            />
            {/* Name + station count */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#dfe6e9',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {line.name}
              </div>
              <div style={{ fontSize: 11, color: '#b2bec3' }}>
                {count} {count === 1 ? 'station' : 'stations'}
              </div>
            </div>
          </div>
        );
      })}

      {/* Add New Line button / mini form */}
      {!showForm ? (
        <button
          onClick={() => {
            setPickedColor(PRESET_COLORS[lines.length % PRESET_COLORS.length]);
            setNewLineName(`Line ${lines.length + 1}`);
            setShowForm(true);
          }}
          style={{
            padding: '9px 0',
            borderRadius: 8,
            border: '1.5px dashed #6c5ce7',
            background: 'transparent',
            color: '#a29bfe',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: 0.3,
          }}
        >
          + Add New Line
        </button>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 12,
            borderRadius: 8,
            background: 'rgba(108,92,231,0.08)',
            border: '1px solid rgba(108,92,231,0.3)',
          }}
        >
          {/* Name input */}
          <input
            type="text"
            value={newLineName}
            onChange={(e) => setNewLineName(e.target.value)}
            placeholder="Line name..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddLine();
              if (e.key === 'Escape') setShowForm(false);
            }}
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

          {/* Color picker — preset swatches */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map((c) => (
              <div
                key={c}
                onClick={() => setPickedColor(c)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: c,
                  cursor: 'pointer',
                  boxShadow: pickedColor === c ? `0 0 0 2px #fff, 0 0 8px ${c}` : `0 0 4px ${c}66`,
                  transition: 'box-shadow 0.15s',
                }}
              />
            ))}
          </div>

          {/* Confirm / Cancel */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowForm(false)}
              style={{
                flex: 1,
                padding: '7px 0',
                borderRadius: 6,
                border: '1px solid #b2bec3',
                background: 'transparent',
                color: '#b2bec3',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddLine}
              style={{
                flex: 2,
                padding: '7px 0',
                borderRadius: 6,
                border: 'none',
                background: pickedColor,
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 700,
                boxShadow: `0 2px 8px ${pickedColor}66`,
              }}
            >
              Create Line
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
