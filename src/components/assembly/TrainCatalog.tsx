import { useState } from 'react';
import { trainCatalog } from '../../data/trainCatalog';
import type { CatalogItem } from '../../data/trainCatalog';
import { useTrainStore } from '../../stores/trainStore';
import { useUIStore } from '../../stores/uiStore';
import type { TrainHead } from '../../types';

type Era = 'classic' | 'modern' | 'future';

const ERA_TABS: { era: Era; label: string }[] = [
  { era: 'classic', label: 'Classic' },
  { era: 'modern',  label: 'Modern'  },
  { era: 'future',  label: 'Future'  },
];

const sectionTitle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 'bold',
  letterSpacing: 1,
  color: '#dfe6e9',
  marginBottom: 4,
  textTransform: 'uppercase',
  fontFamily: 'Courier New, monospace',
};

function CatalogCard({
  item,
  onClick,
  disabled,
  accentColor,
  badge,
}: {
  item: CatalogItem;
  onClick: () => void;
  disabled?: boolean;
  accentColor?: string;
  badge?: React.ReactNode;
}) {
  const borderColor = accentColor ?? '#81ecec';
  return (
    <button
      key={item.type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '6px 8px',
        background: disabled ? '#060e1f' : '#0d1f3c',
        border: '1px solid #1a3a5c',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        width: '100%',
        opacity: disabled ? 0.45 : 1,
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.borderColor = borderColor;
        (e.currentTarget as HTMLButtonElement).style.background  = '#1a3a5c55';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a3a5c';
        (e.currentTarget as HTMLButtonElement).style.background  = '#0d1f3c';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
        <span style={{
          fontSize: 10,
          fontWeight: 'bold',
          color: '#dfe6e9',
          fontFamily: 'Courier New, monospace',
        }}>
          {item.label}
        </span>
        {badge}
      </div>
      <div style={{ fontSize: 8, color: '#b2bec3', marginTop: 2, lineHeight: 1.3 }}>
        {item.description}
      </div>
    </button>
  );
}

export function TrainCatalog() {
  const [selectedEra, setSelectedEra] = useState<Era>('modern');

  const trains         = useTrainStore((s) => s.trains);
  const createTrain    = useTrainStore((s) => s.createTrain);
  const resetTrains    = useTrainStore((s) => s.reset);
  const addCarriage    = useTrainStore((s) => s.addCarriage);
  const assemblyPhase  = useUIStore((s) => s.assemblyPhase);
  const setPhase       = useUIStore((s) => s.setAssemblyPhase);

  const activeTrain     = trains[0] ?? null;
  const carriageCount   = activeTrain?.carriages.length ?? 0;
  const atMaxCarriages  = carriageCount >= 7;

  const headsForEra   = trainCatalog.filter((i) => i.kind === 'head' && i.era === selectedEra);
  const carriageItems = trainCatalog.filter((i) => i.kind === 'carriage');

  function handleHeadClick(item: CatalogItem) {
    const head: TrainHead = { type: item.type, era: item.era, city: item.city };
    resetTrains();
    createTrain(head);
  }

  function handleCarriageClick(item: CatalogItem) {
    if (!activeTrain || atMaxCarriages) return;
    addCarriage(activeTrain.id, {
      type: item.carriageType ?? 'standard',
      city: item.city,
    });
  }

  // ─── Phase 1: head selection ──────────────────────────────────────────────

  if (assemblyPhase === 'head-selection') {
    return (
      <div style={{
        width: '100%', height: '100%', overflowY: 'auto',
        padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Title */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 'bold', color: '#81ecec',
            letterSpacing: 1, fontFamily: 'Courier New, monospace',
          }}>
            Pick Your Head
          </div>
          <div style={{ fontSize: 9, color: '#b2bec3', marginTop: 2 }}>
            Choose the front of your train
          </div>
        </div>

        {/* Era tabs */}
        <div style={{ display: 'flex', gap: 3 }}>
          {ERA_TABS.map(({ era, label }) => (
            <button
              key={era}
              onClick={() => setSelectedEra(era)}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: 9,
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                cursor: 'pointer',
                border: selectedEra === era ? '1px solid #a29bfe' : '1px solid #1a3a5c',
                background: selectedEra === era ? '#2d1b6988' : 'transparent',
                color: selectedEra === era ? '#a29bfe' : '#b2bec3',
                borderRadius: 3,
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Train Heads */}
        <div>
          <div style={sectionTitle}>Train Heads</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {headsForEra.map((item) => (
              <CatalogCard
                key={item.type}
                item={item}
                onClick={() => handleHeadClick(item)}
                accentColor="#81ecec"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Phase 2: carriage building ───────────────────────────────────────────

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Change Head button */}
      <button
        onClick={() => setPhase('head-selection')}
        style={{
          padding: '7px 0',
          background: 'transparent',
          color: '#a29bfe',
          border: '1px solid #a29bfe',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 10,
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          letterSpacing: 1,
          width: '100%',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = '#2d1b6944')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
        }
      >
        Change Head
      </button>

      {/* Title */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 'bold', color: '#81ecec',
          letterSpacing: 1, fontFamily: 'Courier New, monospace',
        }}>
          Add Carriages
        </div>
        <div style={{ fontSize: 9, color: '#b2bec3', marginTop: 2 }}>
          Click the catalog or tap a + slot
        </div>
      </div>

      {/* Max warning */}
      {atMaxCarriages && (
        <div style={{ fontSize: 9, color: '#ffd93d', fontFamily: 'Courier New, monospace' }}>
          Maximum 7 carriages reached!
        </div>
      )}

      {/* Carriage list */}
      <div>
        <div style={sectionTitle}>Carriages</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {carriageItems.map((item) => {
            const xlBadge =
              item.carriageType === 'widebody' ? (
                <span style={{
                  fontSize: 7,
                  background: '#ffd93d',
                  color: '#060e1f',
                  padding: '1px 4px',
                  borderRadius: 2,
                  fontWeight: 'bold',
                  fontFamily: 'Courier New, monospace',
                }}>
                  XL
                </span>
              ) : undefined;
            return (
              <CatalogCard
                key={item.type}
                item={item}
                onClick={() => handleCarriageClick(item)}
                disabled={atMaxCarriages}
                accentColor="#00b894"
                badge={xlBadge}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
