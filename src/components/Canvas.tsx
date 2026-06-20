import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  type DragEvent as ReactDragEvent,
} from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import { useCircuit } from '../hooks/useCircuit';
import { useDrag } from '../hooks/useDrag';
import { useConnect } from '../hooks/useConnect';
import { Gate } from './Gate';
import { Wire } from './Wire';
import { Icon } from './Icon';
import {
  GATE_HEIGHT,
  GATE_WIDTH,
  gateHeight,
  gateWidth,
  portPosition,
} from '../lib/circuit/geometry';
import { isSrForbidden } from '../lib/circuit/memory';
import { GATE_META } from '../lib/circuit/gates';
import type { GateType } from '../types/circuit';

const MOVE_THRESHOLD = 5; // タップとドラッグを区別する移動量（px）
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const GATE_DND_TYPE = 'application/gate-type';

// 現在のジェスチャ種別。pointerId でどの指の操作かを区別する。
type Gesture =
  | { kind: 'none' }
  | { kind: 'gate'; pointerId: number; gateId: string; isInput: boolean }
  | {
      kind: 'pan';
      pointerId: number;
      startX: number;
      startY: number;
      viewX: number;
      viewY: number;
    };

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture>({ kind: 'none' });
  const moved = useRef(false); // ゲート/パンが実際に動いたか（タップ判定用）
  // 押下中のポインタ（ピンチ判定に使う）
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{
    startDist: number;
    startScale: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  const gates = useCircuitStore((s) => s.gates);
  const wires = useCircuitStore((s) => s.wires);
  const view = useCircuitStore((s) => s.view);
  const selectedGateId = useCircuitStore((s) => s.selectedGateId);
  const fitNonce = useCircuitStore((s) => s.fitNonce);

  const setView = useCircuitStore((s) => s.setView);
  const selectGate = useCircuitStore((s) => s.selectGate);
  const removeGate = useCircuitStore((s) => s.removeGate);
  const removeWire = useCircuitStore((s) => s.removeWire);
  const toggleInput = useCircuitStore((s) => s.toggleInput);
  const addGate = useCircuitStore((s) => s.addGate);

  const result = useCircuit();
  const { startGateDrag, dragTo, endDrag } = useDrag();
  const { pending, preview, handlePortClick, updatePreview, cancel } =
    useConnect();

  // 画面座標をキャンバス（論理）座標へ変換する
  function toCanvas(cx: number, cy: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    const v = useCircuitStore.getState().view;
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return { x: (cx - left - v.x) / v.scale, y: (cy - top - v.y) / v.scale };
  }

  // ピンチ開始：2 本目のポインタが乗ったとき（進行中のドラッグは中断）
  function beginPinch() {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const anchor = toCanvas((a.x + b.x) / 2, (a.y + b.y) / 2);
    pinch.current = {
      startDist: Math.hypot(a.x - b.x, a.y - b.y),
      startScale: useCircuitStore.getState().view.scale,
      anchorX: anchor.x,
      anchorY: anchor.y,
    };
    endDrag();
    gesture.current = { kind: 'none' };
  }

  // ピンチ中：距離の比でスケールし、中点をアンカーに固定する
  function updatePinch() {
    const p = pinch.current;
    const pts = [...pointers.current.values()];
    if (!p || pts.length < 2) return;
    const [a, b] = pts;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const scale = clamp((p.startScale * dist) / p.startDist, MIN_SCALE, MAX_SCALE);
    const rect = svgRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    setView({
      x: midX - left - p.anchorX * scale,
      y: midY - top - p.anchorY * scale,
      scale,
    });
  }

  // --- ゲート本体の押下：1 本指ならゲート移動を開始 ---
  function onBodyPointerDown(
    e: ReactPointerEvent,
    gate: { id: string; type: GateType },
  ) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      beginPinch();
      return;
    }
    const g = gates.find((gg) => gg.id === gate.id);
    if (!g) return;
    selectGate(gate.id);
    startGateDrag(g, toCanvas(e.clientX, e.clientY));
    moved.current = false;
    gesture.current = {
      kind: 'gate',
      pointerId: e.pointerId,
      gateId: gate.id,
      isInput: gate.type === 'INPUT',
    };
  }

  // --- ポートの押下：配線接続 ---
  function onPortPointerDown(
    e: ReactPointerEvent,
    port: { gateId: string; portIndex: number; type: 'input' | 'output' },
  ) {
    e.stopPropagation();
    handlePortClick(port);
    updatePreview(toCanvas(e.clientX, e.clientY));
  }

  // --- 背景の押下：1 本指なら視点パンを開始（選択・接続を解除） ---
  function onBackgroundPointerDown(e: ReactPointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      beginPinch();
      return;
    }
    selectGate(null);
    if (useCircuitStore.getState().pending) cancel();
    const v = useCircuitStore.getState().view;
    moved.current = false;
    gesture.current = {
      kind: 'pan',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      viewX: v.x,
      viewY: v.y,
    };
  }

  // --- ポインタ移動（window で受ける：要素外へ出ても追従する）---
  function handleMove(e: PointerEvent) {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pinch.current && pointers.current.size >= 2) {
      updatePinch();
      return;
    }

    const g = gesture.current;
    if (g.kind === 'gate' && g.pointerId === e.pointerId) {
      dragTo(toCanvas(e.clientX, e.clientY));
      moved.current = true;
    } else if (g.kind === 'pan' && g.pointerId === e.pointerId) {
      const v = useCircuitStore.getState().view;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        moved.current = true;
      }
      setView({ x: g.viewX + dx, y: g.viewY + dy, scale: v.scale });
    }

    // 配線接続中はプレビュー線の終点を更新する
    if (useCircuitStore.getState().pending) {
      updatePreview(toCanvas(e.clientX, e.clientY));
    }
  }

  // --- ポインタを離す ---
  function handleUp(e: PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;

    const g = gesture.current;
    if (g.kind === 'gate' && g.pointerId === e.pointerId) {
      // ほとんど動いていなければタップ扱い：INPUT は値をトグルする
      if (!moved.current && g.isInput) toggleInput(g.gateId);
      endDrag();
      gesture.current = { kind: 'none' };
    } else if (g.kind === 'pan' && g.pointerId === e.pointerId) {
      gesture.current = { kind: 'none' };
    }
  }

  // window にポインタ移動/解放のリスナーを張る（最新クロージャを ref 経由で呼ぶ）
  const handlersRef = useRef({ move: handleMove, up: handleUp });
  handlersRef.current = { move: handleMove, up: handleUp };
  useEffect(() => {
    const move = (e: PointerEvent) => handlersRef.current.move(e);
    const up = (e: PointerEvent) => handlersRef.current.up(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  // ビューポート中央を基準にズームする
  function zoomBy(factor: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const v = useCircuitStore.getState().view;
    const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const canX = (cx - v.x) / v.scale;
    const canY = (cy - v.y) / v.scale;
    setView({ x: cx - canX * scale, y: cy - canY * scale, scale });
  }

  // 全ゲートが収まるようにビューを合わせる
  function fitAll() {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gs = useCircuitStore.getState().gates;
    if (gs.length === 0) {
      setView({ x: 0, y: 0, scale: 1 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const g of gs) {
      const w = gateWidth();
      const h = gateHeight(g.type);
      minX = Math.min(minX, g.x);
      minY = Math.min(minY, g.y);
      maxX = Math.max(maxX, g.x + w);
      maxY = Math.max(maxY, g.y + h);
    }
    const pad = 56;
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2;
    const scale = clamp(
      Math.min(rect.width / bw, rect.height / bh),
      MIN_SCALE,
      MAX_SCALE,
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setView({
      x: rect.width / 2 - centerX * scale,
      y: rect.height / 2 - centerY * scale,
      scale,
    });
  }

  // 「全体表示」要求（fitNonce）に反応してフィットする。初回(0)は無視。
  useEffect(() => {
    if (fitNonce === 0) return;
    fitAll();
    // fitNonce が増えたときだけ実行する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce]);

  // --- ホイールズーム（カーソル位置を固定） ---
  function onWheel(e: ReactWheelEvent) {
    const v = useCircuitStore.getState().view;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
    const rect = svgRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    const cx = (e.clientX - left - v.x) / v.scale;
    const cy = (e.clientY - top - v.y) / v.scale;
    setView({ x: e.clientX - left - cx * scale, y: e.clientY - top - cy * scale, scale });
  }

  // --- サイドバーからのドロップで新規ゲートを配置 ---
  function onDragOver(e: ReactDragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function onDrop(e: ReactDragEvent) {
    e.preventDefault();
    const type = e.dataTransfer.getData(GATE_DND_TYPE);
    if (!(type in GATE_META)) return;
    const p = toCanvas(e.clientX, e.clientY);
    addGate(type as GateType, p.x - GATE_WIDTH / 2, p.y - GATE_HEIGHT / 2);
  }

  // ゲート ID から座標を引くためのマップ
  const gateMap = new Map(gates.map((g) => [g.id, g]));

  // 接続中プレビュー線の始点
  let previewStart: { x: number; y: number } | null = null;
  if (pending) {
    const g = gateMap.get(pending.gateId);
    if (g) previewStart = portPosition(g, pending.type, pending.portIndex);
  }

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
        onDragOver={onDragOver}
        onDrop={onDrop}
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

          {/* 接続中のプレビュー線 */}
          {previewStart && preview && (
            <line
              className="lcs-preview"
              x1={previewStart.x}
              y1={previewStart.y}
              x2={preview.x}
              y2={preview.y}
            />
          )}

          {/* ゲート */}
          {gates.map((g) => (
            <Gate
              key={g.id}
              gate={g}
              outputs={result.outputs[g.id] ?? []}
              inputs={result.inputs[g.id] ?? []}
              selected={selectedGateId === g.id}
              forbidden={g.type === 'SR_LATCH' && isSrForbidden(result, g.id)}
              pending={pending}
              onBodyPointerDown={onBodyPointerDown}
              onPortPointerDown={onPortPointerDown}
              onDelete={removeGate}
            />
          ))}
        </g>
      </svg>

      {/* ズーム/フィットの操作（ジェスチャと分離した明示的なコントロール） */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2">
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
    </>
  );
}
