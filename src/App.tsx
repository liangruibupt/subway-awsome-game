import { TopBar } from './components/layout/TopBar';
import { LeftToolBar } from './components/layout/LeftToolBar';
import { RightPanel } from './components/layout/RightPanel';
import { BottomBar } from './components/layout/BottomBar';
import { GameCanvas } from './components/layout/GameCanvas';
import './App.css';

export default function App() {
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
