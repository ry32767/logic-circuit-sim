import {
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
import { GATE_HEIGHT, GATE_WIDTH, portPosition } from '../lib/circuit/geometry';
import { isSrForbidden } from '../lib/circuit/memory';
import { GATE_META } from '../lib/circuit/gates';
import type { GateType } from '../types/circuit';

const MOVE_THRESHOLD = 4; // タップとドラッグを区別する移動量（px）
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;
const GATE_DND_TYPE = 'application/gate-type';

// 現在のジェスチャ種別
type Gesture =
  | { kind: 'none' }
  | { kind: 'gate'; gateId: string; isInput: boolean; moved: boolean }
  | { kind: 'pan'; startX: number; startY: number; viewX: number; viewY: number };

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// ポインタキャプチャは無効な pointerId で例外を投げ得るので安全に呼ぶ
function capture(el: SVGSVGElement | null, id: number) {
  try {
    el?.setPointerCapture(id);
  } catch {
    /* 無視 */
  }
}
function release(el: SVGSVGElement | null, id: number) {
  try {
    el?.releasePointerCapture(id);
  } catch {
    /* 無視 */
  }
}

export function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture>({ kind: 'none' });
  // ピンチズーム用に押下中ポインタを記録する
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

  // ピンチ開始：2 本目のポインタが乗ったとき
  function beginPinch() {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const anchor = toCanvas(midX, midY);
    pinch.current = {
      startDist: Math.hypot(a.x - b.x, a.y - b.y),
      startScale: useCircuitStore.getState().view.scale,
      anchorX: anchor.x,
      anchorY: anchor.y,
    };
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
    const scale = clamp(
      (p.startScale * dist) / p.startDist,
      MIN_SCALE,
      MAX_SCALE,
    );
    const rect = svgRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    setView({
      x: midX - left - p.anchorX * scale,
      y: midY - top - p.anchorY * scale,
      scale,
    });
  }

  // --- ゲート本体の押下：ドラッグ開始 ---
  function onBodyPointerDown(e: ReactPointerEvent, gate: { id: string; type: GateType }) {
    e.stopPropagation();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    capture(svgRef.current, e.pointerId);
    if (pointers.current.size === 2) {
      beginPinch();
      return;
    }
    const g = gates.find((gg) => gg.id === gate.id);
    if (!g) return;
    startGateDrag(g, toCanvas(e.clientX, e.clientY));
    gesture.current = {
      kind: 'gate',
      gateId: gate.id,
      isInput: gate.type === 'INPUT',
      moved: false,
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

  // --- 背景の押下：パン開始（選択・接続を解除） ---
  function onBackgroundPointerDown(e: ReactPointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    capture(svgRef.current, e.pointerId);
    if (pointers.current.size === 2) {
      beginPinch();
      return;
    }
    selectGate(null);
    if (useCircuitStore.getState().pending) cancel();
    const v = useCircuitStore.getState().view;
    gesture.current = {
      kind: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      viewX: v.x,
      viewY: v.y,
    };
  }

  // --- ポインタ移動 ---
  function onPointerMove(e: ReactPointerEvent) {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pinch.current && pointers.current.size >= 2) {
      updatePinch();
      return;
    }

    const g = gesture.current;
    if (g.kind === 'gate') {
      const p = toCanvas(e.clientX, e.clientY);
      dragTo(p);
      if (
        !g.moved &&
        (Math.abs(e.movementX) > MOVE_THRESHOLD ||
          Math.abs(e.movementY) > MOVE_THRESHOLD)
      ) {
        g.moved = true;
      }
    } else if (g.kind === 'pan') {
      const v = useCircuitStore.getState().view;
      setView({
        x: g.viewX + (e.clientX - g.startX),
        y: g.viewY + (e.clientY - g.startY),
        scale: v.scale,
      });
    }

    // 配線接続中はプレビュー線の終点を更新する
    if (useCircuitStore.getState().pending) {
      updatePreview(toCanvas(e.clientX, e.clientY));
    }
  }

  // --- ポインタを離す ---
  function onPointerUp(e: ReactPointerEvent) {
    pointers.current.delete(e.pointerId);
    release(svgRef.current, e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;

    const g = gesture.current;
    if (g.kind === 'gate') {
      // 動いていなければタップ扱い：INPUT は値をトグルする
      if (!g.moved && g.isInput) toggleInput(g.gateId);
      endDrag();
    }
    gesture.current = { kind: 'none' };
  }

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
    setView({
      x: e.clientX - left - cx * scale,
      y: e.clientY - top - cy * scale,
      scale,
    });
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

  return (
    <svg
      ref={svgRef}
      className="lcs-canvas"
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
  );
}
