import { useEffect, useMemo, useRef } from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import { evaluate, type EvalResult } from '../lib/circuit/evaluate';
import { DEFAULT_CLOCK_INTERVAL } from '../lib/circuit/gates';

/**
 * 現在の回路を評価して入出力値を返すフック。
 * gates / wires / memory が変わるたびに再計算する（純粋関数なのでメモ化可能）。
 */
export function useCircuit(): EvalResult {
  const gates = useCircuitStore((s) => s.gates);
  const wires = useCircuitStore((s) => s.wires);
  const memory = useCircuitStore((s) => s.memory);
  return useMemo(
    () => evaluate(gates, wires, memory),
    [gates, wires, memory],
  );
}

/**
 * CLK ゲートごとに周期タイマーを張り、出力を自動でトグルするフック。
 * ゲート構成や周期が変わるとタイマーを張り直す。
 */
export function useClocks(): void {
  const gates = useCircuitStore((s) => s.gates);
  const toggleClock = useCircuitStore((s) => s.toggleClock);

  // 依存判定用に「id:周期」のリストを作る
  const clockKey = gates
    .filter((g) => g.type === 'CLK')
    .map((g) => `${g.id}:${g.clockInterval ?? DEFAULT_CLOCK_INTERVAL}`)
    .join(',');

  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clocks = useCircuitStore
      .getState()
      .gates.filter((g) => g.type === 'CLK');
    // 各 CLK に独立した周期タイマーを設定する
    for (const clk of clocks) {
      const interval = clk.clockInterval ?? DEFAULT_CLOCK_INTERVAL;
      const handle = window.setInterval(() => toggleClock(clk.id), interval);
      timers.current.push(handle);
    }
    const handles = timers.current;
    return () => {
      for (const h of handles) window.clearInterval(h);
      timers.current = [];
    };
    // clockKey が変わったとき（CLK の追加・削除・周期変更）に張り直す
  }, [clockKey, toggleClock]);
}
