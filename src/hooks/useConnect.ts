import { useCallback, useState } from 'react';
import { useCircuitStore, type PendingPort } from '../stores/circuitStore';
import type { CanvasPoint } from './useDrag';

/**
 * ポートのクリックで配線を接続するフック。
 * 1 回目のクリックで起点を記録し、2 回目のクリックで接続を確定する。
 * 接続中はカーソル位置までのプレビュー線（ラバーバンド）を描く。
 */
export function useConnect() {
  const pending = useCircuitStore((s) => s.pending);
  const completeConnection = useCircuitStore((s) => s.completeConnection);
  const cancelConnection = useCircuitStore((s) => s.cancelConnection);
  // プレビュー線の終点（カーソル位置）
  const [preview, setPreview] = useState<CanvasPoint | null>(null);

  // ポートがクリックされたとき
  const handlePortClick = useCallback(
    (port: PendingPort) => {
      completeConnection(port);
    },
    [completeConnection],
  );

  // 接続中にカーソルが動いたとき、プレビュー終点を更新する
  const updatePreview = useCallback(
    (point: CanvasPoint) => {
      setPreview(point);
    },
    [],
  );

  // 接続をキャンセルする（背景クリックなど）
  const cancel = useCallback(() => {
    cancelConnection();
    setPreview(null);
  }, [cancelConnection]);

  return { pending, preview, handlePortClick, updatePreview, cancel };
}
