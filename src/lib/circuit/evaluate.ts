import type { Gate, GateType, MemoryState, Wire } from '../../types/circuit';
import { GATE_META } from './gates';

// 回路評価の結果
export interface EvalResult {
  // gateId -> 出力ポートごとの値
  outputs: Record<string, boolean[]>;
  // gateId -> 入力ポートごとの値（メモリ更新・真理値表ハイライト用）
  inputs: Record<string, boolean[]>;
}

// メモリ素子かどうか（出力は memoryState から直接決まり、再帰を打ち切る）
function isMemoryGate(type: GateType): boolean {
  return type === 'SR_LATCH' || type === 'D_FF' || type === 'CLK';
}

// 組み合わせゲートの評価式を適用する
function applyCombinational(type: GateType, inputs: boolean[]): boolean[] {
  const a = inputs[0] ?? false;
  const b = inputs[1] ?? false;
  switch (type) {
    case 'AND':
      return [a && b];
    case 'OR':
      return [a || b];
    case 'NOT':
      return [!a];
    case 'XOR':
      return [a !== b];
    case 'NAND':
      return [!(a && b)];
    case 'NOR':
      return [!(a || b)];
    case 'XNOR':
      return [a === b];
    case 'BUFFER':
      return [a];
    case 'OUTPUT':
      return []; // 出力ポートを持たない（表示のみ）
    default:
      return [];
  }
}

// メモリ素子の出力を memoryState から取り出す
function memoryOutputs(gate: Gate, memory: MemoryState): boolean[] {
  const cell = memory[gate.id];
  switch (gate.type) {
    case 'CLK':
      return [cell?.clkValue ?? false];
    case 'SR_LATCH':
    case 'D_FF': {
      const q = cell?.q ?? false;
      return [q, !q]; // Q と Q̅
    }
    default:
      return [];
  }
}

/**
 * 回路を評価して全ゲートの入出力値を返す純粋関数。
 * DFS で信号を伝播し、訪問中セットで循環参照（無限ループ）を防ぐ。
 * メモリ素子の出力は memoryState から決まるため、フィードバックループを自然に断ち切る。
 */
export function evaluate(
  gates: Gate[],
  wires: Wire[],
  memory: MemoryState,
): EvalResult {
  const gateMap = new Map<string, Gate>();
  for (const g of gates) gateMap.set(g.id, g);

  const outputs: Record<string, boolean[]> = {};
  const inputs: Record<string, boolean[]> = {};
  const visiting = new Set<string>();

  // 指定ゲートの出力配列を計算（メモ化＋循環検出）
  function computeOutputs(gateId: string): boolean[] {
    const cached = outputs[gateId];
    if (cached) return cached;

    const gate = gateMap.get(gateId);
    if (!gate) return [];

    // 循環を検出したら安全な既定値（false）で打ち切る
    if (visiting.has(gateId)) {
      const meta = GATE_META[gate.type];
      return new Array(meta.outputs).fill(false);
    }

    // メモリ素子は memoryState から出力が決まる（再帰しない）
    if (isMemoryGate(gate.type)) {
      const out = memoryOutputs(gate, memory);
      outputs[gateId] = out;
      // メモリ素子の入力値も配線から集める（メモリ更新で使う）
      inputs[gateId] = collectInputs(gate);
      return out;
    }

    visiting.add(gateId);
    const inputValues = collectInputs(gate);
    inputs[gateId] = inputValues;

    let out: boolean[];
    if (gate.type === 'INPUT') {
      out = [gate.inputValue ?? false];
    } else {
      out = applyCombinational(gate.type, inputValues);
    }
    visiting.delete(gateId);

    outputs[gateId] = out;
    return out;
  }

  // 指定ゲートの全入力ポートの値を配線から集める
  function collectInputs(gate: Gate): boolean[] {
    const meta = GATE_META[gate.type];
    const values: boolean[] = [];
    for (let i = 0; i < meta.inputs; i++) {
      const wire = wires.find(
        (w) => w.toGateId === gate.id && w.toPortIndex === i,
      );
      if (!wire) {
        values.push(false);
        continue;
      }
      const srcOut = computeOutputs(wire.fromGateId);
      values.push(srcOut[wire.fromPortIndex] ?? false);
    }
    return values;
  }

  // 全ゲートを評価
  for (const g of gates) computeOutputs(g.id);

  return { outputs, inputs };
}

// 1 本の配線が運ぶ信号値を求める（描画用）
export function wireValue(wire: Wire, result: EvalResult): boolean {
  return result.outputs[wire.fromGateId]?.[wire.fromPortIndex] ?? false;
}
