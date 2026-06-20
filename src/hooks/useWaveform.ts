import { useEffect, useRef, useState } from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import { evaluate } from '../lib/circuit/evaluate';
import type { GateType } from '../types/circuit';

// 波形に記録する素子（境界の信号）
const TRACE_TYPES: GateType[] = ['INPUT', 'CLK', 'OUTPUT'];

// 1 サンプル：gateId -> 0/1
export type WaveSample = Record<string, 0 | 1>;

// サンプリング設定
export const WAVE_MAX_SAMPLES = 160; // 保持するサンプル数（横幅）
const SAMPLE_INTERVAL = 100; // サンプリング周期（ms）

// この素子が波形トレース対象か
export function isTraceable(type: GateType): boolean {
  return TRACE_TYPES.includes(type);
}

/**
 * 一定周期で回路を評価し、境界信号（INPUT / CLK / OUTPUT）の値を
 * リングバッファに記録するフック。波形パネル表示中だけ動作する。
 */
export function useWaveform(active: boolean): {
  samples: WaveSample[];
  version: number;
} {
  const buffer = useRef<WaveSample[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!active) {
      buffer.current = [];
      setVersion((v) => v + 1);
      return;
    }
    const handle = window.setInterval(() => {
      const { gates, wires, memory } = useCircuitStore.getState();
      const result = evaluate(gates, wires, memory);
      const sample: WaveSample = {};
      for (const g of gates) {
        if (g.type === 'INPUT') sample[g.id] = g.inputValue ? 1 : 0;
        else if (g.type === 'CLK') sample[g.id] = memory[g.id]?.clkValue ? 1 : 0;
        else if (g.type === 'OUTPUT')
          sample[g.id] = result.inputs[g.id]?.[0] ? 1 : 0;
      }
      buffer.current.push(sample);
      if (buffer.current.length > WAVE_MAX_SAMPLES) buffer.current.shift();
      setVersion((v) => v + 1);
    }, SAMPLE_INTERVAL);
    return () => window.clearInterval(handle);
  }, [active]);

  return { samples: buffer.current, version };
}
