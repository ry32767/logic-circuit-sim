import { useEffect } from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import { GATE_HEIGHT, GATE_WIDTH } from '../lib/circuit/geometry';

const MOVE_THRESHOLD = 6; // タップとドラッグを区別する移動量（px）

/**
 * サイドバー（パレット）からゲートをドラッグして配置する操作を扱うフック。
 * - サイドバーのボタンが startPaletteDrag を呼ぶと、ここが window の
 *   pointermove / pointerup を監視してゴーストを追従させる。
 * - キャンバス上で離せばその位置に、それ以外で離せば（動かしていなければ）
 *   ビューポート中央に新規ゲートを追加する。
 * アプリ内で 1 度だけマウントする。
 */
export function usePaletteDrag() {
  const paletteDrag = useCircuitStore((s) => s.paletteDrag);
  const active = paletteDrag !== null;

  useEffect(() => {
    if (!active) return;
    const store = useCircuitStore.getState();
    const start = store.paletteDrag;
    if (!start) return;
    const startX = start.x;
    const startY = start.y;
    let movedFar = false;

    const move = (e: PointerEvent) => {
      e.preventDefault();
      if (
        Math.abs(e.clientX - startX) > MOVE_THRESHOLD ||
        Math.abs(e.clientY - startY) > MOVE_THRESHOLD
      ) {
        movedFar = true;
      }
      useCircuitStore.getState().movePaletteDrag(e.clientX, e.clientY);
    };

    const up = (e: PointerEvent) => {
      const s = useCircuitStore.getState();
      const drag = s.paletteDrag;
      if (drag) {
        const svg = document.querySelector<SVGSVGElement>('.lcs-canvas');
        const rect = svg?.getBoundingClientRect();
        const overCanvas =
          rect &&
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        const v = s.view;
        if (overCanvas) {
          // 指の位置（ゲート中央）に配置する
          const cx = (e.clientX - rect.left - v.x) / v.scale;
          const cy = (e.clientY - rect.top - v.y) / v.scale;
          s.addGate(drag.type, cx - GATE_WIDTH / 2, cy - GATE_HEIGHT / 2);
        } else if (!movedFar) {
          // タップ：ビューポート中央付近へ追加する（フォールバック）
          const cx = (window.innerWidth / 2 - v.x) / v.scale;
          const cy = (window.innerHeight / 2 - v.y) / v.scale;
          s.addGate(drag.type, cx - GATE_WIDTH / 2, cy - GATE_HEIGHT / 2);
        }
      }
      useCircuitStore.getState().endPaletteDrag();
    };

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [active]);

  return paletteDrag;
}
