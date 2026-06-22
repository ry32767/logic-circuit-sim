import { useEffect, useRef } from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import { useCircuit } from '../hooks/useCircuit';
import { useCanvasGestures } from '../hooks/useCanvasGestures';
import { Gate } from './Gate';
import { Wire } from './Wire';
import { Icon } from './Icon';
import { portPosition } from '../lib/circuit/geometry';
import { isSrForbidden } from '../lib/circuit/memory';

export function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null);

  const gates = useCircuitStore((s) => s.gates);
  const wires = useCircuitStore((s) => s.wires);
  const view = useCircuitStore((s) => s.view);
  const selectedIds = useCircuitStore((s) => s.selectedIds);
  const pending = useCircuitStore((s) => s.pending);
  const fitNonce = useCircuitStore((s) => s.fitNonce);
  const removeGate = useCircuitStore((s) => s.removeGate);
  const removeWire = useCircuitStore((s) => s.removeWire);

  const result = useCircuit();

  const {
    onBodyPointerDown,
    onPortPointerDown,
    onBackgroundPointerDown,
    onWheel,
    zoomBy,
    fitAll,
    trashRef,
    draggingIds,
    connect,
    marquee,
    overTrash,
    selectMode,
    toggleSelectMode,
  } = useCanvasGestures(svgRef);

  // 「全体表示」要求（fitNonce）に反応してフィットする。初回(0)は無視。
  useEffect(() => {
    if (fitNonce === 0) return;
    fitAll();
    // fitNonce が増えたときだけ実行する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce]);

  // ゲート ID から座標を引くためのマップ
  const gateMap = new Map(gates.map((g) => [g.id, g]));
  const selectedSet = new Set(selectedIds);
  const draggingSet = new Set(draggingIds);

  // ズーム/フィットのオーバーレイボタン共通スタイル
  const zoomBtn =
    'flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-md transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

  return (
    <>
      <svg
        ref={svgRef}
        className="lcs-canvas"
        onPointerDown={onBackgroundPointerDown}
        onWheel={onWheel}
        style={{ touchAction: 'none' }}
        role="application"
        aria-label="回路キャンバス"
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {/* パン用の広い背景 */}
          <rect
            className="lcs-canvas-bg"
            x={-100000}
            y={-100000}
            width={200000}
            height={200000}
            onPointerDown={onBackgroundPointerDown}
          />

          {/* 配線 */}
          {wires.map((w) => {
            const from = gateMap.get(w.fromGateId);
            const to = gateMap.get(w.toGateId);
            if (!from || !to) return null;
            return (
              <Wire
                key={w.id}
                id={w.id}
                from={portPosition(from, 'output', w.fromPortIndex)}
                to={portPosition(to, 'input', w.toPortIndex)}
                value={result.outputs[w.fromGateId]?.[w.fromPortIndex] ?? false}
                onDelete={removeWire}
              />
            );
          })}

          {/* 接続中のプレビュー線（ドラッグ配線のラバーバンド） */}
          {connect && (
            <line
              className="lcs-preview"
              x1={connect.from.x}
              y1={connect.from.y}
              x2={connect.to.x}
              y2={connect.to.y}
            />
          )}

          {/* 矩形選択 */}
          {marquee && (
            <rect
              className="lcs-marquee"
              x={marquee.x}
              y={marquee.y}
              width={marquee.w}
              height={marquee.h}
            />
          )}

          {/* ゲート */}
          {gates.map((g) => (
            <Gate
              key={g.id}
              gate={g}
              outputs={result.outputs[g.id] ?? []}
              inputs={result.inputs[g.id] ?? []}
              selected={selectedSet.has(g.id)}
              dragging={draggingSet.has(g.id)}
              forbidden={g.type === 'SR_LATCH' && isSrForbidden(result, g.id)}
              pending={pending}
              onBodyPointerDown={onBodyPointerDown}
              onPortPointerDown={onPortPointerDown}
              onDelete={removeGate}
            />
          ))}
        </g>
      </svg>

      {/* ズーム/フィット・選択モードの操作（ジェスチャと分離した明示的なコントロール） */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          className={
            zoomBtn +
            (selectMode
              ? ' !border-emerald-500 !bg-emerald-500 !text-white'
              : '')
          }
          onClick={toggleSelectMode}
          aria-pressed={selectMode}
          aria-label={
            selectMode ? '選択モードを終了' : '範囲選択モードに切替'
          }
          title={
            selectMode
              ? '選択モード：ドラッグで範囲選択。もう一度押すと解除'
              : '範囲選択モード（複数ゲートをまとめて移動）'
          }
        >
          <Icon name="select_all" size={20} />
        </button>
        <button
          type="button"
          className={zoomBtn}
          onClick={() => zoomBy(1.25)}
          aria-label="拡大"
        >
          <Icon name="add" size={20} />
        </button>
        <button
          type="button"
          className={zoomBtn}
          onClick={() => zoomBy(0.8)}
          aria-label="縮小"
        >
          <Icon name="remove" size={20} />
        </button>
        <button
          type="button"
          className={zoomBtn}
          onClick={fitAll}
          aria-label="全体を表示"
        >
          <Icon name="center_focus" size={20} />
        </button>
      </div>

      {/* ゴミ箱ゾーン：ゲートをドラッグ中だけ表示。ここで離すと削除する */}
      {draggingIds.length > 0 && (
        <div
          ref={trashRef}
          className={
            'lcs-trash absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-6 py-3 text-sm font-semibold transition-colors' +
            (overTrash
              ? ' scale-110 border-red-500 bg-red-500 text-white'
              : ' border-red-400 bg-white/90 text-red-600 dark:bg-slate-800/90 dark:text-red-300')
          }
          aria-hidden="true"
        >
          <Icon name="delete" size={24} />
          <span>ここで離して削除</span>
        </div>
      )}
    </>
  );
}
