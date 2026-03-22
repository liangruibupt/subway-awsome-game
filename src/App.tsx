import { useEffect } from 'react';
import { TopBar } from './components/layout/TopBar';
import { LeftToolBar } from './components/layout/LeftToolBar';
import { RightPanel } from './components/layout/RightPanel';
import { BottomBar } from './components/layout/BottomBar';
import { GameCanvas } from './components/layout/GameCanvas';
import { useSaveStore, initAutoSave } from './stores/saveStore';
import './App.css';

export default function App() {
  useEffect(() => {
    useSaveStore.getState().load();
    const cleanup = initAutoSave();
    return cleanup;
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="main-area">
        <LeftToolBar />
        <GameCanvas />
        <RightPanel />
      </div>
      <BottomBar />
    </div>
  );
}
