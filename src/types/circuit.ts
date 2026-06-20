// 論理回路シミュレーターの中核となる型定義

// ゲート（素子）の種類
export type GateType =
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'XOR'
  | 'NAND'
  | 'NOR'
  | 'XNOR'
  | 'BUFFER'
  | 'INPUT'
  | 'OUTPUT'
  | 'SR_LATCH'
  | 'D_FF'
  | 'CLK';

// ポートの向き
export type PortType = 'input' | 'output';

// ポート（入出力の接続点）
export interface Port {
  id: string;
  gateId: string;
  type: PortType;
  index: number; // 複数ポートのうち何番目か
  position: { x: number; y: number }; // キャンバス上の絶対座標
}

// ゲート（素子）
export interface Gate {
  id: string;
  type: GateType;
  x: number; // キャンバス上の X 座標
  y: number; // キャンバス上の Y 座標
  inputValue?: boolean; // INPUT スイッチの現在値
  clockInterval?: number; // CLK の周期（ms）
}

// 配線
export interface Wire {
  id: string;
  fromGateId: string;
  fromPortIndex: number;
  toGateId: string;
  toPortIndex: number;
}

// 回路全体（JSON エクスポート / インポートの単位）
export interface Circuit {
  version: '1.0';
  gates: Gate[];
  wires: Wire[];
}

// メモリ素子の内部状態（評価関数の外＝Zustand ストアで保持する）
export interface MemoryCell {
  q?: boolean; // SR ラッチ / D-FF の保持値
  prevClk?: boolean; // D-FF のエッジ検出用：前回の CLK 値
  clkValue?: boolean; // CLK ゲートの現在出力
}

// gateId をキーにしたメモリ状態のマップ
export type MemoryState = Record<string, MemoryCell>;

// テーマ
export type Theme = 'light' | 'dark';
