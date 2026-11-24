import React from 'react';
import { useEditorStore } from '../store/editor-store.js';
export function StatusBar(): React.JSX.Element {
  const status = useEditorStore((s) => s.saveStatus);
  return <footer className="status-bar"><span><i className={status === 'saved' ? 'saved-dot' : 'pending-dot'} />{status === 'saved' ? 'Saved on this device' : status === 'saving' ? 'Saving on this device…' : 'Recovery unavailable · use Save Project'}</span><span>Local editing · No upload required</span></footer>;
}
