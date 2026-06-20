import type { Circuit, Gate, GateType, Wire } from '../../types/circuit';
import { DEFAULT_CLOCK_INTERVAL } from '../circuit/gates';

// プリセット定義
export interface Preset {
  id: string;
  name: string;
  description: string;
  circuit: Circuit;
}

// ゲート生成ヘルパー
function g(
  id: string,
  type: GateType,
  x: number,
  y: number,
  extra: Partial<Gate> = {},
): Gate {
  return { id, type, x, y, ...extra };
}

// 配線生成ヘルパー
function w(
  id: string,
  fromGateId: string,
  fromPortIndex: number,
  toGateId: string,
  toPortIndex: number,
): Wire {
  return { id, fromGateId, fromPortIndex, toGateId, toPortIndex };
}

// NOT ゲートのデモ
const notDemo: Circuit = {
  version: '1.0',
  gates: [
    g('in1', 'INPUT', 80, 150, { inputValue: false }),
    g('not1', 'NOT', 280, 144),
    g('out1', 'OUTPUT', 480, 150),
  ],
  wires: [w('w1', 'in1', 0, 'not1', 0), w('w2', 'not1', 0, 'out1', 0)],
};

// 半加算器（XOR で和、AND で桁上げ）
const halfAdder: Circuit = {
  version: '1.0',
  gates: [
    g('a', 'INPUT', 60, 100, { inputValue: false }),
    g('b', 'INPUT', 60, 240, { inputValue: false }),
    g('xor', 'XOR', 320, 110),
    g('and', 'AND', 320, 250),
    g('sum', 'OUTPUT', 560, 116),
    g('carry', 'OUTPUT', 560, 256),
  ],
  wires: [
    w('w1', 'a', 0, 'xor', 0),
    w('w2', 'b', 0, 'xor', 1),
    w('w3', 'a', 0, 'and', 0),
    w('w4', 'b', 0, 'and', 1),
    w('w5', 'xor', 0, 'sum', 0),
    w('w6', 'and', 0, 'carry', 0),
  ],
};

// 全加算器
const fullAdder: Circuit = {
  version: '1.0',
  gates: [
    g('a', 'INPUT', 40, 80, { inputValue: false }),
    g('b', 'INPUT', 40, 200, { inputValue: false }),
    g('cin', 'INPUT', 40, 340, { inputValue: false }),
    g('xor1', 'XOR', 240, 110),
    g('and1', 'AND', 240, 250),
    g('xor2', 'XOR', 460, 180),
    g('and2', 'AND', 460, 320),
    g('or1', 'OR', 680, 350),
    g('sum', 'OUTPUT', 700, 186),
    g('cout', 'OUTPUT', 880, 356),
  ],
  wires: [
    w('w1', 'a', 0, 'xor1', 0),
    w('w2', 'b', 0, 'xor1', 1),
    w('w3', 'a', 0, 'and1', 0),
    w('w4', 'b', 0, 'and1', 1),
    w('w5', 'xor1', 0, 'xor2', 0),
    w('w6', 'cin', 0, 'xor2', 1),
    w('w7', 'xor1', 0, 'and2', 0),
    w('w8', 'cin', 0, 'and2', 1),
    w('w9', 'and1', 0, 'or1', 0),
    w('w10', 'and2', 0, 'or1', 1),
    w('w11', 'xor2', 0, 'sum', 0),
    w('w12', 'or1', 0, 'cout', 0),
  ],
};

// SR ラッチ（NOR ゲート 2 個の交差結合）
const srLatchNor: Circuit = {
  version: '1.0',
  gates: [
    g('s', 'INPUT', 60, 90, { inputValue: false }),
    g('r', 'INPUT', 60, 280, { inputValue: false }),
    g('nor1', 'NOR', 300, 110), // 出力 Q
    g('nor2', 'NOR', 300, 280), // 出力 Q̅
    g('q', 'OUTPUT', 540, 116),
    g('qb', 'OUTPUT', 540, 286),
  ],
  wires: [
    w('w1', 'r', 0, 'nor1', 0),
    w('w2', 'nor2', 0, 'nor1', 1),
    w('w3', 's', 0, 'nor2', 0),
    w('w4', 'nor1', 0, 'nor2', 1),
    w('w5', 'nor1', 0, 'q', 0),
    w('w6', 'nor2', 0, 'qb', 0),
  ],
};

// D フリップフロップ（専用素子 + CLK）
const dFlipFlop: Circuit = {
  version: '1.0',
  gates: [
    g('d', 'INPUT', 60, 90, { inputValue: false }),
    g('clk', 'CLK', 60, 260, { clockInterval: DEFAULT_CLOCK_INTERVAL }),
    g('dff', 'D_FF', 300, 130),
    g('q', 'OUTPUT', 540, 146),
    g('qb', 'OUTPUT', 540, 216),
  ],
  wires: [
    w('w1', 'd', 0, 'dff', 0),
    w('w2', 'clk', 0, 'dff', 1),
    w('w3', 'dff', 0, 'q', 0),
    w('w4', 'dff', 1, 'qb', 0),
  ],
};

export const PRESETS: Preset[] = [
  {
    id: 'not-demo',
    name: 'NOT ゲートのデモ',
    description: '入力を反転する最小の回路。まずはここから。',
    circuit: notDemo,
  },
  {
    id: 'half-adder',
    name: '半加算器',
    description: 'XOR で和、AND で桁上げを計算する 1 桁の足し算回路。',
    circuit: halfAdder,
  },
  {
    id: 'full-adder',
    name: '全加算器',
    description: '桁上げ入力を含めて 3 入力を足す回路。',
    circuit: fullAdder,
  },
  {
    id: 'sr-latch-nor',
    name: 'SR ラッチ（NOR 構成）',
    description: 'NOR ゲート 2 個を交差結合した記憶回路。',
    circuit: srLatchNor,
  },
  {
    id: 'd-ff',
    name: 'D フリップフロップ',
    description: 'CLK の立ち上がりで D を取り込む記憶素子。',
    circuit: dFlipFlop,
  },
];

// プリセットを読み込むたびに新しいオブジェクトを返す（参照共有を防ぐ）
export function clonePreset(preset: Preset): Circuit {
  return structuredClone(preset.circuit);
}
