import { useUIStore } from '../../stores/uiStore';
import { LineList } from '../track-design/LineList';
import { StationProperties } from '../track-design/StationProperties';
import { CustomizationPanel } from '../assembly/CustomizationPanel';
import { CarriageCounter } from '../assembly/CarriageCounter';
import { DeploymentPanel } from '../simulation/DeploymentPanel';
import { LiveOpsPanel } from '../simulation/LiveOpsPanel';

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
        <>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <CustomizationPanel />
          </div>
          <CarriageCounter />
        </>
      )}
      {mode === 'simulation' && (
        <>
          <div className="panel-section">
            <DeploymentPanel />
          </div>
          <div className="panel-section">
            <LiveOpsPanel />
          </div>
        </>
      )}
    </div>
  );
}
