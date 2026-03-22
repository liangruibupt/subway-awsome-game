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
          background: '#15132b',
          border: '2px solid #6c5ce7',
          borderRadius: 12,
          padding: '28px 32px',
          minWidth: 320,
          boxShadow: '0 8px 40px rgba(108, 92, 231, 0.4)',
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
              color: '#a29bfe',
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
            color: '#b2bec3',
            fontFamily: 'monospace',
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
            background: '#0d0b1e',
            border: '1.5px solid #6c5ce7',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 16,
            color: '#dfe6e9',
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
              border: '1.5px solid #b2bec3',
              background: 'transparent',
              color: '#b2bec3',
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
              background: '#00b894',
              color: '#ffffff',
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(0, 184, 148, 0.4)',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
