import { useUIStore } from '../../stores/uiStore';
import { LineList } from '../track-design/LineList';
import { StationProperties } from '../track-design/StationProperties';

export function RightPanel() {
  const mode = useUIStore((s) => s.mode);
  const selectedStationId = useUIStore((s) => s.selectedStationId);

  return (
    <div className="right-panel">
      {mode === 'track-design' && (
        <>
          <div className="panel-section">
            <LineList />
          </div>
          {selectedStationId && (
            <div className="panel-section">
              <StationProperties />
            </div>
          )}
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
