import React from 'react';
const paths: Record<string, React.ReactNode> = {
  move: <path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" />,
  crop: <path d="M6 3v15h15M3 6h15v15" />,
  adjust: <><path d="M3 6h18M3 12h18M3 18h18" /><circle cx="8" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="9" cy="18" r="2" /></>,
  text: <path d="M4 5h16M12 5v15M8 20h8" />,
  shapes: <><rect x="3" y="3" width="13" height="13" rx="2" /><circle cx="15" cy="15" r="6" /></>,
  cut: <path d="M8 3h8l5 7-3 10H6L3 10z" strokeDasharray="3 3" />,
  eraser: <path d="m4 13 9-10 8 8-9 10H7l-5-5 2-3ZM8 9l8 8M12 21h9" />,
  font: <><path d="m3 19 6-14 6 14M5 14h8" /><circle cx="19" cy="15" r="3" /><path d="M22 12v7" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" /><path d="m3 17 6-6 4 4 3-3 5 5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  camera: <><path d="m8 5 2-2h4l2 2h4v15H4V5z" /><circle cx="12" cy="12" r="4" /></>,
  folder: <path d="M3 6V4h6l3 3h9v13H3z" />,
  save: <path d="M4 3h13l4 4v14H3V3zM7 3v6h9V3M7 21v-8h10v8" />,
  export: <path d="M4 13v8h16v-8M12 16V3M7 8l5-5 5 5" />,
  undo: <path d="M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12" />,
  redo: <path d="m16 4 5 5-5 5M21 9H10a6 6 0 0 0 0 12" />,
  minus: <path d="M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <><circle cx="12" cy="12" r="9" /><path d="m7 12 3 3 7-7" /></>,
  spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  hidden: <path d="m3 3 18 18M9 5a12 12 0 0 1 13 7s-2 4-6 6M6 6a18 18 0 0 0-4 6s4 7 10 7a12 12 0 0 0 4-1" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></>,
  unlock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0" /></>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
  trash: <path d="M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />,
  up: <path d="m5 14 7-7 7 7" />, down: <path d="m5 10 7 7 7-7" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M3 15v6h18v-6" />,
};
export function Icon({ name, size = 18 }: { name: string; size?: number }): React.JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.image}</svg>;
}
