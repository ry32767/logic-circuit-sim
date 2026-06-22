import { useState, type PointerEvent as ReactPointerEvent } from 'react';
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
  // モバイル：表示中のカテゴリ（タブ切替）
  const [activeCategory, setActiveCategory] = useState<GateCategory>(
    groups[0]?.category ?? 'basic',
  );
  const activeGroup =
    groups.find((g) => g.category === activeCategory) ?? groups[0];

  // ボタンを押した時点でドラッグ配置を開始する（マウス・タッチ共通）。
  // 指を動かさず離せばタップ＝中央に追加、動かしてキャンバスで離せばその位置に配置。
  function handlePointerDown(e: ReactPointerEvent, type: GateType) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startPaletteDrag(type, e.clientX, e.clientY);
  }

  // ゲートボタンを描画する（desktop=横長の行 / mobile=グリッドのタイル）
  function gateButton(type: GateType, variant: 'desktop' | 'mobile') {
    const meta = GATE_META[type];
    const base =
      'flex shrink-0 cursor-grab select-none items-center justify-center rounded-lg border border-slate-300 bg-white text-center shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-500 dark:hover:bg-slate-700';
    const shape =
      variant === 'desktop'
        ? 'w-full flex-row justify-start gap-2 px-3 py-2 touch-pan-y'
        : 'w-[4.75rem] flex-col gap-0.5 px-2 py-2 touch-none';
    return (
      <button
        key={type}
        type="button"
        onPointerDown={(e) => handlePointerDown(e, type)}
        title={`${meta.name}を追加（キャンバスへドラッグして配置）`}
        aria-label={`${meta.name}を追加`}
        className={`${base} ${shape}`}
      >
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {meta.label}
        </span>
        <span className="text-[10px] leading-tight text-slate-500 dark:text-slate-400 md:text-xs">
          {meta.name.replace(/（.*）/, '')}
        </span>
      </button>
    );
  }

  return (
    <>
      {/* デスクトップ：カテゴリ別の縦リスト */}
      <nav
        aria-label="ゲート追加"
        className="hidden h-full flex-col gap-3 overflow-y-auto p-2 md:flex"
      >
        {groups.map((group) => (
          <div
            key={group.category}
            className="flex flex-col items-stretch gap-1.5"
          >
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {CATEGORY_LABELS[group.category]}
            </h2>
            {group.types.map((type) => gateButton(type, 'desktop'))}
          </div>
        ))}
      </nav>

      {/* モバイル：カテゴリタブ＋グリッド（横スクロールしない） */}
      <div className="md:hidden">
        <div
          role="tablist"
          aria-label="ゲートのカテゴリ"
          className="flex flex-wrap gap-1.5 px-2 pt-2"
        >
          {groups.map((group) => {
            const active = group.category === activeCategory;
            return (
              <button
                key={group.category}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveCategory(group.category)}
                className={
                  'rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 ' +
                  (active
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300')
                }
              >
                {CATEGORY_LABELS[group.category]}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 p-2">
          {activeGroup?.types.map((type) => gateButton(type, 'mobile'))}
        </div>
      </div>
    </>
  );
}
