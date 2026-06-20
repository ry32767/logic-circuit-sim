import { useCallback, useRef } from 'react';
import type { Gate } from '../types/circuit';
import { useCircuitStore } from '../stores/circuitStore';

// キャンバス座標（SVG 内の論理座標）
export interface CanvasPoint {
  x: number;
  y: number;
}

/**
 * ゲートのドラッグ移動を扱うフック（マウス・タッチ共通のポインタイベント前提）。
 * 実際のポインタイベントの取得は Canvas 側で行い、論理座標を渡してもらう。
 */
export function useDrag() {
  const moveGate = useCircuitStore((s) => s.moveGate);
  const selectGate = useCircuitStore((s) => s.selectGate);
  // ドラッグ中のゲート ID と、つかんだ位置とゲート原点のオフセット
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  // ドラッグ開始：つかんだ点とゲート左上のずれを記録する
  const startGateDrag = useCallback(
    (gate: Gate, point: CanvasPoint) => {
      selectGate(gate.id);
      drag.current = { id: gate.id, dx: point.x - gate.x, dy: point.y - gate.y };
    },
    [selectGate],
  );

  // ドラッグ中：新しい位置にゲートを移動する
  const dragTo = useCallback(
    (point: CanvasPoint) => {
      const d = drag.current;
      if (!d) return;
      moveGate(d.id, Math.round(point.x - d.dx), Math.round(point.y - d.dy));
    },
    [moveGate],
  );

  // ドラッグ終了
  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  const isDragging = useCallback(() => drag.current !== null, []);

  return { startGateDrag, dragTo, endDrag, isDragging };
}
