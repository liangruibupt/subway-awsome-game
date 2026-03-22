import { useUIStore } from '../../stores/uiStore';

export function RightPanel() {
  const mode = useUIStore((s) => s.mode);

  return (
    <div className="right-panel">
      {mode === 'track-design' && (
        <>
          <div className="panel-section">
            <div className="panel-section-title">LINE LIST</div>
            <div className="panel-empty-msg">No lines yet</div>
          </div>
          <div className="panel-section">
            <div className="panel-section-title">PROPERTIES</div>
            <div className="panel-empty-msg">Select an object</div>
          </div>
        </>
      )}
      {mode === 'assembly' && (
        <div className="panel-section">
          <div className="panel-section-title">CUSTOMIZE</div>
          <div className="panel-empty-msg">Select a train</div>
        </div>
      )}
      {mode === 'simulation' && (
        <div className="panel-section">
          <div className="panel-section-title">LIVE OPS</div>
          <div className="panel-empty-msg">Sim not running</div>
        </div>
      )}
    </div>
  );
}
