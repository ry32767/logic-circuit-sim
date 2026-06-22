import type { Gate, GateType, Port, PortType } from '../../types/circuit';
import { GATE_META } from './gates';

// ゲート本体の標準サイズ
export const GATE_WIDTH = 76;
export const GATE_HEIGHT = 56;
// メモリ素子（SR ラッチ / D-FF）は入出力が 2 つずつなので縦長にする
export const MEMORY_HEIGHT = 76;
// ポートの表示半径（タップしやすいよう少し大きめ）
export const PORT_RADIUS = 9;
// ポートのタップ当たり判定半径（見た目より広くして押しやすくする）
export const PORT_HIT_RADIUS = 15;

// ゲートの高さ（メモリ素子だけ高い）
export function gateHeight(type: GateType): number {
  return type === 'SR_LATCH' || type === 'D_FF' ? MEMORY_HEIGHT : GATE_HEIGHT;
}

// ゲートの幅（現状は種類によらず一定）
export function gateWidth(): number {
  return GATE_WIDTH;
}

// 出力→入力を結ぶベジェ曲線のパスを作る
export function bezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dx = Math.max(40, Math.abs(to.x - from.x) / 2);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

// ゲートの矩形（描画・当たり判定用）
export function gateRect(gate: Gate): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: gate.x,
    y: gate.y,
    width: gateWidth(),
    height: gateHeight(gate.type),
  };
}

// 指定ポートのキャンバス上の絶対座標を求める
export function portPosition(
  gate: Gate,
  type: PortType,
  index: number,
): { x: number; y: number } {
  const meta = GATE_META[gate.type];
  const count = type === 'input' ? meta.inputs : meta.outputs;
  const w = gateWidth();
  const h = gateHeight(gate.type);
  const px = type === 'input' ? gate.x : gate.x + w;
  // 縦方向に等間隔で配置する
  const spacing = h / (count + 1);
  const py = gate.y + spacing * (index + 1);
  return { x: px, y: py };
}

// 当たり判定したポート（ドラッグ接続のドロップ先判定に使う）
export interface PortHit {
  gateId: string;
  portIndex: number;
  type: PortType;
}

// 指定した点に最も近いポートを探す（タッチでも掴みやすいよう半径は広め）。
// filter を渡すと条件に合うポートだけを対象にする（自動接続の候補探索に使う）。
export function portAtPoint(
  gates: Gate[],
  point: { x: number; y: number },
  radius = PORT_RADIUS * 3,
  filter?: (hit: PortHit) => boolean,
): PortHit | null {
  let best: PortHit | null = null;
  let bestDist = radius;
  for (const gate of gates) {
    const meta = GATE_META[gate.type];
    const check = (type: PortType, count: number) => {
      for (let i = 0; i < count; i++) {
        const hit: PortHit = { gateId: gate.id, portIndex: i, type };
        if (filter && !filter(hit)) continue;
        const pos = portPosition(gate, type, i);
        const d = Math.hypot(pos.x - point.x, pos.y - point.y);
        if (d <= bestDist) {
          bestDist = d;
          best = hit;
        }
      }
    };
    check('input', meta.inputs);
    check('output', meta.outputs);
  }
  return best;
}

// ゲートが持つ全ポートを列挙する
export function gatePorts(gate: Gate): Port[] {
  const meta = GATE_META[gate.type];
  const ports: Port[] = [];
  for (let i = 0; i < meta.inputs; i++) {
    ports.push({
      id: `${gate.id}:in:${i}`,
      gateId: gate.id,
      type: 'input',
      index: i,
      position: portPosition(gate, 'input', i),
    });
  }
  for (let i = 0; i < meta.outputs; i++) {
    ports.push({
      id: `${gate.id}:out:${i}`,
      gateId: gate.id,
      type: 'output',
      index: i,
      position: portPosition(gate, 'output', i),
    });
  }
  return ports;
}
