import { useUIStore } from '../../stores/uiStore';

export function BottomBar() {
  const zoomLevel = useUIStore((s) => s.zoomLevel);
  const zoomPercent = Math.round(zoomLevel * 100);

  return (
    <div className="bottom-bar">
      <span className="bottom-bar-item">GRID: 30px</span>
      <span className="bottom-bar-sep">|</span>
      <span className="bottom-bar-item">ZOOM: {zoomPercent}%</span>
      <span className="bottom-bar-sep">|</span>
      <span className="bottom-bar-item">POS: (0, 0)</span>
    </div>
  );
}
