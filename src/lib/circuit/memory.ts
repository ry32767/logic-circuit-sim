import type { Gate, MemoryCell, MemoryState } from '../../types/circuit';
import type { EvalResult } from './evaluate';

/**
 * 評価結果（各メモリ素子の入力値）をもとにメモリ状態を 1 ステップ更新する純粋関数。
 * 元の memory は変更せず、新しい MemoryState を返す。
 *
 * - SR ラッチ: S/R 入力から Q を決める（保持・禁止状態に対応）
 * - D-FF: CLK の立ち上がりエッジで D を取り込む
 * - CLK ゲートの clkValue は別途タイマーで更新するためここでは引き継ぐだけ
 */
export function updateMemory(
  gates: Gate[],
  result: EvalResult,
  memory: MemoryState,
): MemoryState {
  const next: MemoryState = {};

  for (const gate of gates) {
    const prev = memory[gate.id];
    if (gate.type === 'SR_LATCH') {
      const [s = false, r = false] = result.inputs[gate.id] ?? [];
      next[gate.id] = nextSrLatch(s, r, prev);
    } else if (gate.type === 'D_FF') {
      const [d = false, clk = false] = result.inputs[gate.id] ?? [];
      next[gate.id] = nextDFlipFlop(d, clk, prev);
    } else if (gate.type === 'CLK') {
      // タイマー由来の clkValue はそのまま維持する
      next[gate.id] = { clkValue: prev?.clkValue ?? false };
    }
  }

  return next;
}

// SR ラッチの次状態
export function nextSrLatch(
  s: boolean,
  r: boolean,
  prev: MemoryCell | undefined,
): MemoryCell {
  const held = prev?.q ?? false;
  if (s && r) return { q: false }; // 禁止状態：Q=0 として扱う
  if (s) return { q: true }; // セット
  if (r) return { q: false }; // リセット
  return { q: held }; // 保持
}

// D フリップフロップの次状態（CLK の 0→1 で D を取込）
export function nextDFlipFlop(
  d: boolean,
  clk: boolean,
  prev: MemoryCell | undefined,
): MemoryCell {
  const held = prev?.q ?? false;
  const risingEdge = clk && !(prev?.prevClk ?? false);
  return {
    q: risingEdge ? d : held,
    prevClk: clk,
  };
}

// SR ラッチが禁止状態（S=R=1）かどうか
export function isSrForbidden(result: EvalResult, gateId: string): boolean {
  const [s = false, r = false] = result.inputs[gateId] ?? [];
  return s && r;
}
