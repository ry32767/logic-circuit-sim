import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import type { GateType } from '../types/circuit';
import {
  gateHeight,
  gateWidth,
  portAtPoint,
  portPosition,
} from '../lib/circuit/geometry';

// キャンバス（SVG 内の論理）座標
export interface CanvasPoint {
  x: number;
  y: number;
}

const MOVE_THRESHOLD = 5; // タップとドラッグを区別する移動量（px）
const LONG_PRESS_MS = 500; // 長押しで情報パネルを開くまでの時間
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// 現在のジェスチャ種別。pointerId でどの指の操作かを区別する。
type Gesture =
  | { kind: 'none' }
  | {
      kind: 'gate';
      pointerId: number;
      primaryId: string;
      ids: string[];
      starts: Map<string, { x: number; y: number }>;
      grab: CanvasPoint;
      startX: number;
      startY: number;
      isInput: boolean;
    }
  | {
      kind: 'pan';
      pointerId: number;
      startX: number;
      startY: number;
      viewX: number;
      viewY: number;
    }
  | {
      kind: 'connect';
      pointerId: number;
      startX: number;
      startY: number;
      started: boolean; // pending を確立済みか（切断ドラッグは移動開始時に確立）
      detach?: {
        wireId: string;
        source: { gateId: string; portIndex: number; type: 'output' };
      };
    }
  | { kind: 'marquee'; pointerId: number; start: CanvasPoint };

// プレビュー線（接続中のラバーバンド）
export interface ConnectPreview {
  from: CanvasPoint;
  to: CanvasPoint;
}

// 矩形選択の領域（キャンバス座標）
export interface MarqueeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GateLike {
  id: string;
  type: GateType;
}

/**
 * キャンバス上のポインタ操作（ゲート移動・グループ移動・パン・ピンチ・
 * ドラッグ接続/切断・矩形選択・ゴミ箱削除）をまとめて扱うフック。
 * SVG への描画は呼び出し側（Canvas）が状態を読んで行う。
 */
export function useCanvasGestures(svgRef: RefObject<SVGSVGElement>) {
  const gesture = useRef<Gesture>({ kind: 'none' });
  const moved = useRef(false);
  const longPressTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{
    startDist: number;
    startScale: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);
  const trashRef = useRef<HTMLDivElement>(null);

  // 描画に使う一時状態
  const [draggingIds, setDraggingIds] = useState<string[]>([]);
  const [connect, setConnect] = useState<ConnectPreview | null>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  const [selectMode, setSelectMode] = useState(false);

  const setView = useCircuitStore((s) => s.setView);

  function cancelLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  // 画面座標をキャンバス（論理）座標へ変換する
  function toCanvas(cx: number, cy: number): CanvasPoint {
    const rect = svgRef.current?.getBoundingClientRect();
    const v = useCircuitStore.getState().view;
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return { x: (cx - left - v.x) / v.scale, y: (cy - top - v.y) / v.scale };
  }

  // 指が今ゴミ箱の上にあるか判定する
  function pointerOverTrash(cx: number, cy: number): boolean {
    const r = trashRef.current?.getBoundingClientRect();
    if (!r) return false;
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }

  // --- ピンチズーム ---
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
    cancelLongPress();
    // 進行中のドラッグ・接続・選択を中断する
    if (useCircuitStore.getState().pending) {
      useCircuitStore.getState().cancelConnection();
    }
    setDraggingIds([]);
    setConnect(null);
    setMarquee(null);
    setOverTrash(false);
    gesture.current = { kind: 'none' };
  }

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

  // --- ゲート本体の押下：1 本指でゲート（または選択グループ）移動を開始 ---
  function onBodyPointerDown(e: ReactPointerEvent, gate: GateLike) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      beginPinch();
      return;
    }
    const st = useCircuitStore.getState();
    const sel = st.selectedIds;
    // 既に複数選択されているゲートを掴んだらグループごと動かす
    const groupDrag = sel.includes(gate.id) && sel.length > 1;
    const ids = groupDrag ? sel : [gate.id];
    const starts = new Map<string, { x: number; y: number }>();
    for (const g of st.gates) {
      if (ids.includes(g.id)) starts.set(g.id, { x: g.x, y: g.y });
    }
    moved.current = false;
    longFired.current = false;
    gesture.current = {
      kind: 'gate',
      pointerId: e.pointerId,
      primaryId: gate.id,
      ids,
      starts,
      grab: toCanvas(e.clientX, e.clientY),
      startX: e.clientX,
      startY: e.clientY,
      isInput: gate.type === 'INPUT',
    };
    // 長押しで情報パネルを開く（選択モードでない・動かさずに押し続けた場合のみ）
    cancelLongPress();
    if (!selectMode) {
      longPressTimer.current = window.setTimeout(() => {
        if (!moved.current) {
          longFired.current = true;
          useCircuitStore.getState().setInfoSheet(true);
        }
      }, LONG_PRESS_MS);
    }
  }

  // --- ポートの押下：ドラッグで配線を接続。入力ポートは既存配線を掴んで切断/付け替え ---
  function onPortPointerDown(
    e: ReactPointerEvent,
    port: { gateId: string; portIndex: number; type: 'input' | 'output' },
  ) {
    e.stopPropagation();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      beginPinch();
      return;
    }
    const st = useCircuitStore.getState();
    const pending = st.pending;
    // タップ接続の 2 回目：別ゲートの逆向きポートなら即確定する
    if (pending && pending.type !== port.type && pending.gateId !== port.gateId) {
      st.completeConnection(port);
      setConnect(null);
      gesture.current = { kind: 'none' };
      return;
    }
    moved.current = false;
    // 入力ポートに既存配線があれば「外す」操作。ただしドラッグするまで実行せず、
    // 単なるタップでは切断しない（誤操作防止）。
    if (port.type === 'input') {
      const wire = st.wires.find(
        (w) => w.toGateId === port.gateId && w.toPortIndex === port.portIndex,
      );
      if (wire) {
        gesture.current = {
          kind: 'connect',
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          started: false,
          detach: {
            wireId: wire.id,
            source: {
              gateId: wire.fromGateId,
              portIndex: wire.fromPortIndex,
              type: 'output',
            },
          },
        };
        return;
      }
    }
    // 通常：このポートを起点に接続を開始する（タップ接続も可能）
    const srcGate = st.gates.find((g) => g.id === port.gateId);
    if (!srcGate) return;
    st.startConnection(port);
    const fromPos = portPosition(srcGate, port.type, port.portIndex);
    const here = toCanvas(e.clientX, e.clientY);
    setConnect({ from: fromPos, to: here });
    gesture.current = {
      kind: 'connect',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      started: true,
    };
  }

  // --- 背景の押下：選択モードなら矩形選択、通常はパン ---
  function onBackgroundPointerDown(e: ReactPointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      beginPinch();
      return;
    }
    const st = useCircuitStore.getState();
    if (st.pending) {
      st.cancelConnection();
      setConnect(null);
    }
    moved.current = false;
    if (selectMode) {
      const start = toCanvas(e.clientX, e.clientY);
      setMarquee({ x: start.x, y: start.y, w: 0, h: 0 });
      gesture.current = { kind: 'marquee', pointerId: e.pointerId, start };
    } else {
      st.selectGate(null);
      gesture.current = {
        kind: 'pan',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        viewX: st.view.x,
        viewY: st.view.y,
      };
    }
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
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (
        moved.current ||
        Math.abs(dx) > MOVE_THRESHOLD ||
        Math.abs(dy) > MOVE_THRESHOLD
      ) {
        if (!moved.current) {
          moved.current = true;
          cancelLongPress();
          // ドラッグ開始時：単一ゲートなら選択し、強調表示を始める
          if (g.ids.length === 1) {
            useCircuitStore.getState().selectGate(g.primaryId);
          }
          setDraggingIds(g.ids);
        }
        const cur = toCanvas(e.clientX, e.clientY);
        const ddx = cur.x - g.grab.x;
        const ddy = cur.y - g.grab.y;
        const positions = g.ids.map((id) => {
          const s = g.starts.get(id) ?? { x: 0, y: 0 };
          return { id, x: Math.round(s.x + ddx), y: Math.round(s.y + ddy) };
        });
        useCircuitStore.getState().moveGates(positions);
        setOverTrash(pointerOverTrash(e.clientX, e.clientY));
      }
    } else if (g.kind === 'pan' && g.pointerId === e.pointerId) {
      const v = useCircuitStore.getState().view;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        moved.current = true;
      }
      setView({ x: g.viewX + dx, y: g.viewY + dy, scale: v.scale });
    } else if (g.kind === 'connect' && g.pointerId === e.pointerId) {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        moved.current = true;
      }
      if (!moved.current) return;
      // 切断ドラッグ：移動を始めた時点で配線を外し、付け替え元から引き直す
      if (g.detach && !g.started) {
        const st = useCircuitStore.getState();
        st.removeWire(g.detach.wireId);
        st.startConnection(g.detach.source);
        g.started = true;
      }
      const to = toCanvas(e.clientX, e.clientY);
      setConnect((prev) => {
        if (prev) return { ...prev, to };
        // 切断直後で from 未設定なら付け替え元ポートから引く
        const st = useCircuitStore.getState();
        const src = st.pending;
        const srcGate = st.gates.find((gg) => gg.id === src?.gateId);
        if (!src || !srcGate) return prev;
        return { from: portPosition(srcGate, src.type, src.portIndex), to };
      });
    } else if (g.kind === 'marquee' && g.pointerId === e.pointerId) {
      moved.current = true;
      const cur = toCanvas(e.clientX, e.clientY);
      setMarquee({
        x: Math.min(g.start.x, cur.x),
        y: Math.min(g.start.y, cur.y),
        w: Math.abs(cur.x - g.start.x),
        h: Math.abs(cur.y - g.start.y),
      });
    }
  }

  // --- ポインタを離す ---
  function handleUp(e: PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const g = gesture.current;
    const st = useCircuitStore.getState();

    if (g.kind === 'gate' && g.pointerId === e.pointerId) {
      cancelLongPress();
      if (moved.current && pointerOverTrash(e.clientX, e.clientY)) {
        // ゴミ箱へドロップ：掴んでいたゲートを削除する
        st.removeGates(g.ids);
      } else if (!moved.current && !longFired.current) {
        // タップ扱い
        if (selectMode) {
          st.toggleSelect(g.primaryId);
        } else {
          st.selectGate(g.primaryId);
          if (g.isInput) st.toggleInput(g.primaryId);
        }
      }
      setDraggingIds([]);
      setOverTrash(false);
      gesture.current = { kind: 'none' };
    } else if (g.kind === 'connect' && g.pointerId === e.pointerId) {
      if (moved.current) {
        // ドラッグ接続：離した位置のポートへつなぐ。なければ切断のまま確定
        const p = toCanvas(e.clientX, e.clientY);
        const hit = portAtPoint(st.gates, p);
        const pending = st.pending;
        if (
          hit &&
          pending &&
          hit.type !== pending.type &&
          hit.gateId !== pending.gateId
        ) {
          st.completeConnection(hit);
        } else {
          st.cancelConnection();
        }
        setConnect(null);
        gesture.current = { kind: 'none' };
      }
      // 動いていなければタップ接続の起点として pending を保持する
      else gesture.current = { kind: 'none' };
    } else if (g.kind === 'marquee' && g.pointerId === e.pointerId) {
      const m = marquee;
      if (m && (m.w > 4 || m.h > 4)) {
        // 矩形に重なるゲートを選択する
        const ids = st.gates
          .filter((gt) => {
            const w = gateWidth();
            const h = gateHeight(gt.type);
            return (
              gt.x < m.x + m.w &&
              gt.x + w > m.x &&
              gt.y < m.y + m.h &&
              gt.y + h > m.y
            );
          })
          .map((gt) => gt.id);
        st.setSelection(ids);
      } else {
        st.selectGate(null);
      }
      setMarquee(null);
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
      if (longPressTimer.current !== null) {
        window.clearTimeout(longPressTimer.current);
      }
    };
  }, []);

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
      minX = Math.min(minX, g.x);
      minY = Math.min(minY, g.y);
      maxX = Math.max(maxX, g.x + gateWidth());
      maxY = Math.max(maxY, g.y + gateHeight(g.type));
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

  return {
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
    toggleSelectMode: () => setSelectMode((m) => !m),
  };
}
