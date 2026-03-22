import { useState, useEffect } from 'react';
import { presetColors, patternOptions } from '../../data/colors';
import { useTrainStore } from '../../stores/trainStore';
import { useUIStore } from '../../stores/uiStore';
import type { TrainStyle } from '../../types';

export function CustomizationPanel() {
  const trains = useTrainStore((s) => s.trains);
  const updateStyle = useTrainStore((s) => s.updateStyle);
  const selectedTrainId = useUIStore((s) => s.selectedTrainId);

  const activeTrain =
    trains.find((t) => t.id === selectedTrainId) ?? trains[0] ?? null;

  const [bodyColor, setBodyColor] = useState<string>(
    activeTrain?.style.bodyColor ?? '#0984e3'
  );
  const [pattern, setPattern] = useState<TrainStyle['pattern']>(
    activeTrain?.style.pattern ?? 'solid'
  );
  const [accentColor, setAccentColor] = useState<string>(
    activeTrain?.style.accentColor ?? '#ffd93d'
  );

  // Sync local state when the selected train changes
  const activeTrainId = activeTrain?.id;
  useEffect(() => {
    if (activeTrain) {
      setBodyColor(activeTrain.style.bodyColor);
      setPattern(activeTrain.style.pattern);
      setAccentColor(activeTrain.style.accentColor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrainId]);

  function handleApply() {
    if (!activeTrain) return;
    updateStyle(activeTrain.id, { bodyColor, pattern, accentColor });
  }

  function handleApplyAll() {
    trains.forEach((t) =>
      updateStyle(t.id, { bodyColor, pattern, accentColor })
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
                selected === color
                  ? '2px solid #ffffff'
                  : '2px solid transparent',
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

  if (!activeTrain) {
    return (
      <div style={{ padding: '10px 10px' }}>
        <div
          style={{
            fontSize: 10,
            color: '#b2bec3',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          Create a train first — pick a head from the catalog on the left!
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '10px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {/* Title */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 'bold',
            color: '#81ecec',
            letterSpacing: 1,
            marginBottom: 2,
            fontFamily: 'Courier New, monospace',
          }}
        >
          Customize Your Train
        </div>
        <div style={{ fontSize: 9, color: '#b2bec3' }}>
          Choose colors and patterns
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
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: pattern === opt.value ? '#a29bfe' : '#dfe6e9',
                  fontFamily: 'Courier New, monospace',
                }}
              >
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

      {/* Apply buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
          Apply to Train
        </button>
        <button
          onClick={handleApplyAll}
          style={{
            padding: '6px 0',
            background: 'transparent',
            color: '#b2bec3',
            border: '1px solid #1a3a5c',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 9,
            fontFamily: 'Courier New, monospace',
            letterSpacing: 1,
            width: '100%',
            transition: 'color 0.12s, border-color 0.12s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#dfe6e9';
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#b2bec3';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#b2bec3';
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a3a5c';
          }}
        >
          Apply to All Trains
        </button>
      </div>
    </div>
  );
}
