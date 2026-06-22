import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import {
  CATEGORY_LABELS,
  GATE_META,
  GATE_ORDER,
  type GateCategory,
} from '../lib/circuit/gates';
import type { GateType } from '../types/circuit';

// GATE_ORDER をカテゴリごとにまとめる
function groupByCategory(): { category: GateCategory; types: GateType[] }[] {
  const groups: { category: GateCategory; types: GateType[] }[] = [];
  for (const type of GATE_ORDER) {
    const category = GATE_META[type].category;
    let group = groups.find((g) => g.category === category);
    if (!group) {
      group = { category, types: [] };
      groups.push(group);
    }
    group.types.push(type);
  }
  return groups;
}

export function Sidebar() {
  const startPaletteDrag = useCircuitStore((s) => s.startPaletteDrag);
  const groups = groupByCategory();

  // ボタンを押した時点でドラッグ配置を開始する（マウス・タッチ共通）。
  // 指を動かさず離せばタップ＝中央に追加、動かしてキャンバスで離せばその位置に配置。
  function handlePointerDown(e: ReactPointerEvent, type: GateType) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startPaletteDrag(type, e.clientX, e.clientY);
  }

  return (
    <nav
      aria-label="ゲート追加"
      className="flex gap-2 overflow-x-auto p-2 md:h-full md:flex-col md:gap-3 md:overflow-x-hidden md:overflow-y-auto"
    >
      {groups.map((group) => (
        <div
          key={group.category}
          className="flex shrink-0 items-center gap-2 md:flex-col md:items-stretch md:gap-1.5"
        >
          <h2 className="sr-only md:not-sr-only md:px-1 md:text-xs md:font-semibold md:uppercase md:tracking-wide md:text-slate-500 dark:md:text-slate-400">
            {CATEGORY_LABELS[group.category]}
          </h2>
          {group.types.map((type) => {
            const meta = GATE_META[type];
            return (
              <button
                key={type}
                type="button"
                onPointerDown={(e) => handlePointerDown(e, type)}
                title={`${meta.name}を追加（キャンバスへドラッグして配置）`}
                aria-label={`${meta.name}を追加`}
                className="flex shrink-0 cursor-grab touch-pan-x select-none flex-col items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-center shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-500 dark:hover:bg-slate-700 md:w-full md:touch-pan-y md:flex-row md:justify-start md:gap-2"
              >
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {meta.label}
                </span>
                <span className="hidden text-xs text-slate-500 dark:text-slate-400 md:inline">
                  {meta.name.replace(/（.*）/, '')}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
