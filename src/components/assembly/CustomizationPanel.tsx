import { useState, useEffect } from 'react';
import { presetColors, patternOptions } from '../../data/colors';
import { useTrainStore } from '../../stores/trainStore';
import { useUIStore } from '../../stores/uiStore';
import type { TrainStyle } from '../../types';

function ColorGrid({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {presetColors.map((color) => (
        <button
          key={color}
          onClick={() => onSelect(color)}
          title={color}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: color,
            border:
              selected === color ? '2px solid #ffffff' : '2px solid transparent',
            cursor: 'pointer',
            outline:
              selected === color ? `2px solid ${color}88` : 'none',
            outlineOffset: 2,
            transition: 'border 0.12s, outline 0.12s',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 'bold',
  letterSpacing: 1,
  color: '#dfe6e9',
  textTransform: 'uppercase',
  marginBottom: 6,
  fontFamily: 'Courier New, monospace',
};

export function CustomizationPanel() {
  const trains              = useTrainStore((s) => s.trains);
  const updateCarriageStyle = useTrainStore((s) => s.updateCarriageStyle);

  const assemblyPhase         = useUIStore((s) => s.assemblyPhase);
  const setAssemblyPhase      = useUIStore((s) => s.setAssemblyPhase);
  const selectedCarriageIndex = useUIStore((s) => s.selectedCarriageIndex);
  const activeTrainIndex      = useUIStore((s) => s.activeTrainIndex);

  const activeTrain      = trains[activeTrainIndex] ?? null;
  const selectedCarriage =
    activeTrain !== null && selectedCarriageIndex !== null
      ? (activeTrain.carriages[selectedCarriageIndex] ?? null)
      : null;

  const [bodyColor,   setBodyColor]   = useState<string>(selectedCarriage?.style.bodyColor   ?? '#0984e3');
  const [pattern,     setPattern]     = useState<TrainStyle['pattern']>(selectedCarriage?.style.pattern ?? 'solid');
  const [accentColor, setAccentColor] = useState<string>(selectedCarriage?.style.accentColor ?? '#ffd93d');

  // Sync local state whenever the selected carriage changes
  useEffect(() => {
    if (selectedCarriage) {
      setBodyColor(selectedCarriage.style.bodyColor);
      setPattern(selectedCarriage.style.pattern);
      setAccentColor(selectedCarriage.style.accentColor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCarriageIndex, activeTrain?.id]);

  function handleApply() {
    if (!activeTrain || selectedCarriageIndex === null) return;
    updateCarriageStyle(activeTrain.id, selectedCarriageIndex, { bodyColor, pattern, accentColor });
  }

  // ─── Phase 1: head-selection ─────────────────────────────────────────────

  if (assemblyPhase === 'head-selection') {
    return (
      <div style={{
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: '100%',
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 'bold', color: '#81ecec',
            letterSpacing: 1, fontFamily: 'Courier New, monospace', marginBottom: 2,
          }}>
            Head Selected
          </div>
          {activeTrain ? (
            <div style={{ fontSize: 9, color: '#b2bec3', lineHeight: 1.5 }}>
              {activeTrain.head.city.charAt(0).toUpperCase() + activeTrain.head.city.slice(1)} —{' '}
              {activeTrain.head.era.charAt(0).toUpperCase() + activeTrain.head.era.slice(1)} Era
            </div>
          ) : (
            <div style={{ fontSize: 9, color: '#b2bec3', lineHeight: 1.5 }}>
              Choose a head from the left panel
            </div>
          )}
        </div>

        {activeTrain && (
          <>
            <div style={{ fontSize: 9, color: '#b2bec3', lineHeight: 1.6 }}>
              Happy with this head? Press the button below to start adding carriages!
            </div>
            <button
              onClick={() => setAssemblyPhase('carriage-building')}
              style={{
                padding: '12px 0',
                background: '#00b894',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                letterSpacing: 1,
                width: '100%',
                transition: 'opacity 0.12s',
                boxShadow: '0 0 12px #00b89444',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.opacity = '1')
              }
            >
              Confirm Head
            </button>
          </>
        )}
      </div>
    );
  }

  // ─── Phase 2: carriage-building — no carriage selected ───────────────────

  if (selectedCarriage === null || selectedCarriageIndex === null) {
    return (
      <div style={{ padding: '14px 12px' }}>
        <div style={{
          fontSize: 10, fontWeight: 'bold', color: '#81ecec',
          letterSpacing: 1, fontFamily: 'Courier New, monospace', marginBottom: 6,
        }}>
          Customize Carriage
        </div>
        <div style={{
          fontSize: 9, color: '#b2bec3', lineHeight: 1.6, fontStyle: 'italic',
        }}>
          Click on a carriage in the canvas to customize it
        </div>
      </div>
    );
  }

  // ─── Phase 2: carriage selected — show editor ─────────────────────────────

  const isWidebody     = selectedCarriage.type === 'widebody';
  const carriageNumber = selectedCarriageIndex + 1;

  return (
    <div style={{
      padding: '10px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      overflowY: 'auto',
      height: '100%',
    }}>
      {/* Carriage info */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 'bold', color: '#81ecec',
          letterSpacing: 1, marginBottom: 2, fontFamily: 'Courier New, monospace',
        }}>
          Carriage {carriageNumber}
        </div>
        <div style={{ fontSize: 9, color: '#b2bec3' }}>
          {isWidebody ? 'Wide-body (XL) — extra passengers' : 'Standard — fits most lines'}
        </div>
      </div>

      {/* Body Color */}
      <div>
        <div style={sectionTitle}>Body Color</div>
        <ColorGrid selected={bodyColor} onSelect={setBodyColor} />
        <div style={{ fontSize: 9, color: '#b2bec3', marginTop: 5 }}>
          Selected:{' '}
          <span style={{ color: bodyColor, fontWeight: 'bold' }}>■</span>{' '}
          {bodyColor}
        </div>
      </div>

      {/* Pattern */}
      <div>
        <div style={sectionTitle}>Pattern</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {patternOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPattern(opt.value)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '5px 8px',
                background:
                  pattern === opt.value ? '#2d1b6988' : 'transparent',
                border:
                  pattern === opt.value
                    ? '1px solid #a29bfe'
                    : '1px solid #1a3a5c',
                borderRadius: 4,
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                transition: 'all 0.12s',
              }}
            >
              <span style={{
                fontSize: 10,
                fontWeight: 'bold',
                color: pattern === opt.value ? '#a29bfe' : '#dfe6e9',
                fontFamily: 'Courier New, monospace',
              }}>
                {opt.label}
              </span>
              <span style={{ fontSize: 8, color: '#b2bec3' }}>
                {opt.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div>
        <div style={sectionTitle}>Accent Color</div>
        <div style={{ fontSize: 8, color: '#b2bec3', marginBottom: 6 }}>
          The second color for details
        </div>
        <ColorGrid selected={accentColor} onSelect={setAccentColor} />
        <div style={{ fontSize: 9, color: '#b2bec3', marginTop: 5 }}>
          Selected:{' '}
          <span style={{ color: accentColor, fontWeight: 'bold' }}>■</span>{' '}
          {accentColor}
        </div>
      </div>

      {/* Apply */}
      <button
        onClick={handleApply}
        style={{
          padding: '8px 0',
          background: '#00b894',
          color: '#ffffff',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          letterSpacing: 1,
          width: '100%',
          transition: 'opacity 0.12s',
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.opacity = '1')
        }
      >
        Apply to Carriage {carriageNumber}
      </button>
    </div>
  );
}
