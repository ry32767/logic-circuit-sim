import type { GateType } from '../../types/circuit';

// ゲートのカテゴリ
export type GateCategory = 'basic' | 'extra' | 'io' | 'memory' | 'special';

// 真理値表の 1 行（inputs と outputs はビット配列）
export interface TruthRow {
  inputs: number[];
  outputs: number[];
}

// 各ゲートのメタ情報
export interface GateMeta {
  type: GateType;
  label: string; // キャンバス内に表示する短いラベル
  name: string; // 正式名称（説明パネル用）
  category: GateCategory;
  inputs: number; // 入力ポート数
  outputs: number; // 出力ポート数
  description: string; // ゲートの説明文
  inputLabels?: string[]; // ポートの個別ラベル（S/R, D/CLK など）
  outputLabels?: string[];
  truthTable?: TruthRow[]; // 真理値表（組み合わせ回路のみ）
}

// 2 入力 1 出力ゲートの真理値表を生成するヘルパー
function table2(fn: (a: boolean, b: boolean) => boolean): TruthRow[] {
  const rows: TruthRow[] = [];
  for (const a of [0, 1]) {
    for (const b of [0, 1]) {
      rows.push({
        inputs: [a, b],
        outputs: [fn(a === 1, b === 1) ? 1 : 0],
      });
    }
  }
  return rows;
}

// 1 入力 1 出力ゲートの真理値表を生成するヘルパー
function table1(fn: (a: boolean) => boolean): TruthRow[] {
  return [0, 1].map((a) => ({
    inputs: [a],
    outputs: [fn(a === 1) ? 1 : 0],
  }));
}

// 全 13 種のゲート定義
export const GATE_META: Record<GateType, GateMeta> = {
  AND: {
    type: 'AND',
    label: 'AND',
    name: 'AND ゲート',
    category: 'basic',
    inputs: 2,
    outputs: 1,
    description: '2 つの入力が両方とも 1 のときだけ 1 を出力します。',
    truthTable: table2((a, b) => a && b),
  },
  OR: {
    type: 'OR',
    label: 'OR',
    name: 'OR ゲート',
    category: 'basic',
    inputs: 2,
    outputs: 1,
    description: '2 つの入力のどちらかが 1 なら 1 を出力します。',
    truthTable: table2((a, b) => a || b),
  },
  NOT: {
    type: 'NOT',
    label: 'NOT',
    name: 'NOT ゲート（インバータ）',
    category: 'basic',
    inputs: 1,
    outputs: 1,
    description: '入力を反転します。1 なら 0、0 なら 1 を出力します。',
    truthTable: table1((a) => !a),
  },
  XOR: {
    type: 'XOR',
    label: 'XOR',
    name: 'XOR ゲート（排他的論理和）',
    category: 'basic',
    inputs: 2,
    outputs: 1,
    description: '2 つの入力が異なるときだけ 1 を出力します。',
    truthTable: table2((a, b) => a !== b),
  },
  NAND: {
    type: 'NAND',
    label: 'NAND',
    name: 'NAND ゲート',
    category: 'extra',
    inputs: 2,
    outputs: 1,
    description: 'AND の否定。両方 1 のときだけ 0、それ以外は 1 を出力します。',
    truthTable: table2((a, b) => !(a && b)),
  },
  NOR: {
    type: 'NOR',
    label: 'NOR',
    name: 'NOR ゲート',
    category: 'extra',
    inputs: 2,
    outputs: 1,
    description: 'OR の否定。両方 0 のときだけ 1 を出力します。',
    truthTable: table2((a, b) => !(a || b)),
  },
  XNOR: {
    type: 'XNOR',
    label: 'XNOR',
    name: 'XNOR ゲート',
    category: 'extra',
    inputs: 2,
    outputs: 1,
    description: 'XOR の否定。2 つの入力が同じときだけ 1 を出力します。',
    truthTable: table2((a, b) => a === b),
  },
  BUFFER: {
    type: 'BUFFER',
    label: 'BUF',
    name: 'バッファ',
    category: 'extra',
    inputs: 1,
    outputs: 1,
    description: '入力をそのまま出力します（信号の中継）。',
    truthTable: table1((a) => a),
  },
  INPUT: {
    type: 'INPUT',
    label: 'IN',
    name: 'INPUT スイッチ',
    category: 'io',
    inputs: 0,
    outputs: 1,
    description: 'クリック（タップ）で 0 / 1 を切り替えるスイッチです。',
  },
  OUTPUT: {
    type: 'OUTPUT',
    label: 'OUT',
    name: 'OUTPUT ランプ',
    category: 'io',
    inputs: 1,
    outputs: 0,
    description: '入力された信号を光で表示するランプです。',
  },
  SR_LATCH: {
    type: 'SR_LATCH',
    label: 'SR',
    name: 'SR ラッチ',
    category: 'memory',
    inputs: 2,
    outputs: 2,
    description:
      'S=1 でセット(Q=1)、R=1 でリセット(Q=0)。両方 0 なら状態を保持します。S=R=1 は禁止状態です。',
    inputLabels: ['S', 'R'],
    outputLabels: ['Q', 'Q̅'],
  },
  D_FF: {
    type: 'D_FF',
    label: 'D-FF',
    name: 'D フリップフロップ',
    category: 'memory',
    inputs: 2,
    outputs: 2,
    description:
      'CLK の立ち上がり(0→1)のときに D の値を取り込み、次の立ち上がりまで保持します。',
    inputLabels: ['D', 'CLK'],
    outputLabels: ['Q', 'Q̅'],
  },
  CLK: {
    type: 'CLK',
    label: 'CLK',
    name: 'クロック',
    category: 'special',
    inputs: 0,
    outputs: 1,
    description: '一定周期で 0 / 1 を自動的に切り替える信号源です。',
  },
};

// CLK の初期周期（ms）。UI から変更できる。
export const DEFAULT_CLOCK_INTERVAL = 1000;

// サイドバーに並べる順番
export const GATE_ORDER: GateType[] = [
  'INPUT',
  'OUTPUT',
  'AND',
  'OR',
  'NOT',
  'XOR',
  'NAND',
  'NOR',
  'XNOR',
  'BUFFER',
  'SR_LATCH',
  'D_FF',
  'CLK',
];

// カテゴリの表示名
export const CATEGORY_LABELS: Record<GateCategory, string> = {
  basic: '基本ゲート',
  extra: '追加ゲート',
  io: '入出力',
  memory: 'メモリ',
  special: '特殊',
};
