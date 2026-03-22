import { useState, useRef } from 'react';
import { useSaveStore } from '../../stores/saveStore';

export function SaveLoadBar() {
  const save = useSaveStore((s) => s.save);
  const exportJSON = useSaveStore((s) => s.exportJSON);
  const importJSON = useSaveStore((s) => s.importJSON);
  const [toast, setToast] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1500);
  }

  function handleSave() {
    save();
    showToast('Saved!');
  }

  function handleExport() {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subway-save.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      const ok = importJSON(json);
      showToast(ok ? 'Loaded!' : 'Bad file!');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="save-load-bar">
      {toast && <span className="save-toast">{toast}</span>}
      <button className="save-btn save-btn--green" onClick={handleSave}>Save</button>
      <button className="save-btn save-btn--cyan" onClick={handleExport}>Export</button>
      <button className="save-btn save-btn--purple" onClick={handleImportClick}>Import</button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
