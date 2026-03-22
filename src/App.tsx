import { useEffect } from 'react';
import { TopBar } from './components/layout/TopBar';
import { LeftToolBar } from './components/layout/LeftToolBar';
import { RightPanel } from './components/layout/RightPanel';
import { BottomBar } from './components/layout/BottomBar';
import { GameCanvas } from './components/layout/GameCanvas';
import { useSaveStore, initAutoSave } from './stores/saveStore';
import { useUIStore } from './stores/uiStore';
import { LevelSelect } from './components/challenge/LevelSelect';
import { ObjectiveTracker } from './components/challenge/ObjectiveTracker';
import { VictoryScreen } from './components/challenge/VictoryScreen';
import './App.css';

export default function App() {
  useEffect(() => {
    useSaveStore.getState().load();
    const cleanup = initAutoSave();
    return cleanup;
  }, []);

  const showLevelSelect = useUIStore((s) => s.showLevelSelect);
  const challengeId     = useUIStore((s) => s.challengeId);
  const showVictory     = useUIStore((s) => s.showVictory);

  return (
    <div className="app" style={{ position: 'relative' }}>
      <TopBar />
      <div className="main-area">
        <LeftToolBar />
        <GameCanvas />
        <RightPanel />
      </div>
      <BottomBar />

      {/* Challenge overlays */}
      {challengeId && !showVictory && <ObjectiveTracker />}
      {showLevelSelect && <LevelSelect />}
      {showVictory && <VictoryScreen />}
    </div>
  );
}
