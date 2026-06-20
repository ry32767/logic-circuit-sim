import { useEffect, useRef, useState } from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import { PRESETS, clonePreset } from '../lib/presets';
import { Icon } from './Icon';

export function PresetMenu() {
  const [open, setOpen] = useState(false);
  const loadCircuit = useCircuitStore((s) => s.loadCircuit);
  const requestFit = useCircuitStore((s) => s.requestFit);
  const ref = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  function handleSelect(id: string) {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    loadCircuit(clonePreset(preset));
    requestFit();
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <Icon name="auto_awesome" size={18} />
        プリセット
        <Icon name="arrow_drop_down" size={18} />
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute left-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          {PRESETS.map((preset) => (
            <li key={preset.id} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => handleSelect(preset.id)}
                className="block w-full px-3 py-2 text-left transition-colors hover:bg-emerald-50 focus-visible:bg-emerald-50 focus-visible:outline-none dark:hover:bg-slate-700 dark:focus-visible:bg-slate-700"
              >
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                  {preset.name}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {preset.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
