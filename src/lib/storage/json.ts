import type { Circuit, Gate, GateType, Wire } from '../../types/circuit';
import { GATE_META } from '../circuit/gates';

const VALID_TYPES = new Set<string>(Object.keys(GATE_META));

// unknown 値が Record か判定する型ガード
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Gate の検証
function parseGate(v: unknown): Gate {
  if (!isRecord(v)) throw new Error('gate がオブジェクトではありません');
  const { id, type, x, y, inputValue, clockInterval } = v;
  if (typeof id !== 'string') throw new Error('gate.id が不正です');
  if (typeof type !== 'string' || !VALID_TYPES.has(type)) {
    throw new Error(`未知のゲート種類です: ${String(type)}`);
  }
  if (typeof x !== 'number' || typeof y !== 'number') {
    throw new Error('gate の座標が不正です');
  }
  const gate: Gate = { id, type: type as GateType, x, y };
  if (typeof inputValue === 'boolean') gate.inputValue = inputValue;
  if (typeof clockInterval === 'number') gate.clockInterval = clockInterval;
  return gate;
}

// Wire の検証
function parseWire(v: unknown): Wire {
  if (!isRecord(v)) throw new Error('wire がオブジェクトではありません');
  const { id, fromGateId, fromPortIndex, toGateId, toPortIndex } = v;
  if (typeof id !== 'string') throw new Error('wire.id が不正です');
  if (typeof fromGateId !== 'string' || typeof toGateId !== 'string') {
    throw new Error('wire の接続先が不正です');
  }
  if (typeof fromPortIndex !== 'number' || typeof toPortIndex !== 'number') {
    throw new Error('wire のポート番号が不正です');
  }
  return { id, fromGateId, fromPortIndex, toGateId, toPortIndex };
}

/**
 * 任意の文字列を Circuit としてパース・検証する。
 * スキーマに合わない場合は Error を投げる（呼び出し側で捕捉する）。
 */
export function parseCircuit(text: string): Circuit {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSON として解析できませんでした');
  }
  if (!isRecord(data)) throw new Error('回路データがオブジェクトではありません');
  if (data.version !== '1.0') {
    throw new Error('対応していないバージョンです（version: 1.0 が必要）');
  }
  if (!Array.isArray(data.gates) || !Array.isArray(data.wires)) {
    throw new Error('gates / wires が配列ではありません');
  }
  const gates = data.gates.map(parseGate);
  const wires = data.wires.map(parseWire);

  // 配線が存在しないゲートを参照していないかチェック
  const ids = new Set(gates.map((g) => g.id));
  for (const w of wires) {
    if (!ids.has(w.fromGateId) || !ids.has(w.toGateId)) {
      throw new Error('存在しないゲートを参照する配線があります');
    }
  }
  return { version: '1.0', gates, wires };
}

// Circuit を整形済み JSON 文字列にする
export function serializeCircuit(circuit: Circuit): string {
  return JSON.stringify(circuit, null, 2);
}

// 回路を JSON ファイルとしてダウンロードする
export function downloadCircuit(circuit: Circuit, filename = 'circuit.json') {
  const blob = new Blob([serializeCircuit(circuit)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ファイル選択ダイアログを開いて回路を読み込む
export function importCircuitFromFile(): Promise<Circuit> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('ファイルが選択されませんでした'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(parseCircuit(String(reader.result)));
        } catch (err) {
          reject(err instanceof Error ? err : new Error('読み込みに失敗しました'));
        }
      };
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
      reader.readAsText(file);
    };
    input.click();
  });
}
