import { useEffect, useRef } from 'react';

interface StationNameDialogProps {
  isOpen: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  /** World-space grid position of the pending station (for context display) */
  position: { x: number; y: number };
}

export function StationNameDialog({ isOpen, onConfirm, onCancel, position }: StationNameDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when the dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.value = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const name = inputRef.current?.value.trim() ?? '';
    if (name.length > 0) {
      onConfirm(name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Don't confirm during IME composition (Chinese input in progress)
      if (!e.nativeEvent.isComposing) {
        handleConfirm();
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        // Semi-transparent dark backdrop — pointer events block clicks reaching the canvas
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          background: '#3b1e08',
          border: '2px solid #3a6ee8',
          borderRadius: 12,
          padding: '28px 32px',
          minWidth: 320,
          boxShadow: '0 8px 40px rgba(26, 15, 8, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Title */}
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: '#5c94fc',
              letterSpacing: 0.5,
            }}
          >
            Name Your Station
          </h2>
          {/* Friendly subtitle hint */}
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 13,
              color: '#74b9ff',
              lineHeight: 1.4,
            }}
          >
            Give this station a name — like a real city place!
          </p>
        </div>

        {/* Grid position context */}
        <div
          style={{
            fontSize: 11,
            color: '#f5d9a8',
            fontFamily: 'var(--font-ui)',
          }}
        >
          Grid position: ({position.x}, {position.y})
        </div>

        {/* Name input — standard <input> supports Chinese IME correctly */}
        <input
          ref={inputRef}
          type="text"
          placeholder="Enter station name..."
          onKeyDown={handleKeyDown}
          style={{
            background: '#2a1405',
            border: '1.5px solid #3a6ee8',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 16,
            color: '#fff8e7',
            outline: 'none',
            fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: '1.5px solid #f5d9a8',
              background: 'transparent',
              color: '#f5d9a8',
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '9px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#43b047',
              color: '#ffffff',
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(26, 15, 8, 0.6)',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
