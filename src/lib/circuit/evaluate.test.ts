import { describe, it, expect } from 'vitest';
import type { Gate, MemoryState, Wire } from '../../types/circuit';
import { evaluate } from './evaluate';
import {
  nextSrLatch,
  nextDFlipFlop,
  updateMemory,
  isSrForbidden,
} from './memory';

// テスト用のゲート生成ヘルパー
function input(id: string, value: boolean): Gate {
  return { id, type: 'INPUT', x: 0, y: 0, inputValue: value };
}
function wire(
  id: string,
  fromGateId: string,
  toGateId: string,
  toPortIndex = 0,
  fromPortIndex = 0,
): Wire {
  return { id, fromGateId, fromPortIndex, toGateId, toPortIndex };
}

describe('evaluate - 基本ゲート', () => {
  it('AND は両方 1 のときだけ 1', () => {
    const gates: Gate[] = [
      input('a', true),
      input('b', true),
      { id: 'and', type: 'AND', x: 0, y: 0 },
    ];
    const wires = [wire('w1', 'a', 'and', 0), wire('w2', 'b', 'and', 1)];
    const r = evaluate(gates, wires, {});
    expect(r.outputs['and']).toEqual([true]);

    const gates2 = [input('a', true), input('b', false), gates[2]];
    const r2 = evaluate(gates2, wires, {});
    expect(r2.outputs['and']).toEqual([false]);
  });

  it('OR / NAND / NOR / XOR / XNOR を評価する', () => {
    const make = (type: Gate['type'], a: boolean, b: boolean) => {
      const gates: Gate[] = [
        input('a', a),
        input('b', b),
        { id: 'g', type, x: 0, y: 0 },
      ];
      const wires = [wire('w1', 'a', 'g', 0), wire('w2', 'b', 'g', 1)];
      return evaluate(gates, wires, {}).outputs['g'][0];
    };
    expect(make('OR', false, false)).toBe(false);
    expect(make('OR', true, false)).toBe(true);
    expect(make('NAND', true, true)).toBe(false);
    expect(make('NOR', false, false)).toBe(true);
    expect(make('XOR', true, false)).toBe(true);
    expect(make('XOR', true, true)).toBe(false);
    expect(make('XNOR', true, true)).toBe(true);
  });

  it('NOT / BUFFER（1 入力）を評価する', () => {
    const gates: Gate[] = [
      input('a', true),
      { id: 'not', type: 'NOT', x: 0, y: 0 },
      { id: 'buf', type: 'BUFFER', x: 0, y: 0 },
    ];
    const wires = [wire('w1', 'a', 'not', 0), wire('w2', 'a', 'buf', 0)];
    const r = evaluate(gates, wires, {});
    expect(r.outputs['not']).toEqual([false]);
    expect(r.outputs['buf']).toEqual([true]);
  });

  it('未接続の入力は false として扱う', () => {
    const gates: Gate[] = [{ id: 'and', type: 'AND', x: 0, y: 0 }];
    const r = evaluate(gates, [], {});
    expect(r.outputs['and']).toEqual([false]);
  });
});

describe('evaluate - 半加算器', () => {
  it('1 + 1 = 桁上げ 1・和 0', () => {
    const gates: Gate[] = [
      input('a', true),
      input('b', true),
      { id: 'xor', type: 'XOR', x: 0, y: 0 },
      { id: 'and', type: 'AND', x: 0, y: 0 },
    ];
    const wires = [
      wire('w1', 'a', 'xor', 0),
      wire('w2', 'b', 'xor', 1),
      wire('w3', 'a', 'and', 0),
      wire('w4', 'b', 'and', 1),
    ];
    const r = evaluate(gates, wires, {});
    expect(r.outputs['xor']).toEqual([false]); // 和
    expect(r.outputs['and']).toEqual([true]); // 桁上げ
  });
});

describe('evaluate - 循環参照', () => {
  it('循環があっても無限ループせず値を返す', () => {
    // buf1 -> buf2 -> buf1 の循環
    const gates: Gate[] = [
      { id: 'b1', type: 'BUFFER', x: 0, y: 0 },
      { id: 'b2', type: 'BUFFER', x: 0, y: 0 },
    ];
    const wires = [wire('w1', 'b1', 'b2', 0), wire('w2', 'b2', 'b1', 0)];
    const r = evaluate(gates, wires, {});
    expect(r.outputs['b1']).toEqual([false]);
    expect(r.outputs['b2']).toEqual([false]);
  });
});

describe('memory - SR ラッチ', () => {
  it('セット・リセット・保持・禁止状態', () => {
    expect(nextSrLatch(true, false, { q: false }).q).toBe(true); // セット
    expect(nextSrLatch(false, true, { q: true }).q).toBe(false); // リセット
    expect(nextSrLatch(false, false, { q: true }).q).toBe(true); // 保持
    expect(nextSrLatch(false, false, { q: false }).q).toBe(false); // 保持
    expect(nextSrLatch(true, true, { q: true }).q).toBe(false); // 禁止
  });
});

describe('memory - D フリップフロップ', () => {
  it('CLK の立ち上がりで D を取り込む', () => {
    // 立ち上がり前は保持
    let cell = nextDFlipFlop(true, false, { q: false, prevClk: false });
    expect(cell.q).toBe(false);
    // 0->1 の立ち上がりで D=1 を取込
    cell = nextDFlipFlop(true, true, cell);
    expect(cell.q).toBe(true);
    // CLK が 1 のまま D を変えても保持
    cell = nextDFlipFlop(false, true, cell);
    expect(cell.q).toBe(true);
    // 1->0 では取り込まない
    cell = nextDFlipFlop(false, false, cell);
    expect(cell.q).toBe(true);
  });
});

describe('memory - updateMemory と禁止状態判定', () => {
  it('SR ラッチの入力からメモリを更新する', () => {
    const gates: Gate[] = [
      input('s', true),
      input('r', false),
      { id: 'sr', type: 'SR_LATCH', x: 0, y: 0 },
    ];
    const wires = [wire('w1', 's', 'sr', 0), wire('w2', 'r', 'sr', 1)];
    const memory: MemoryState = { sr: { q: false } };
    const result = evaluate(gates, wires, memory);
    const next = updateMemory(gates, result, memory);
    expect(next['sr'].q).toBe(true);
    expect(isSrForbidden(result, 'sr')).toBe(false);
  });

  it('S=R=1 を禁止状態と判定する', () => {
    const gates: Gate[] = [
      input('s', true),
      input('r', true),
      { id: 'sr', type: 'SR_LATCH', x: 0, y: 0 },
    ];
    const wires = [wire('w1', 's', 'sr', 0), wire('w2', 'r', 'sr', 1)];
    const result = evaluate(gates, wires, { sr: { q: false } });
    expect(isSrForbidden(result, 'sr')).toBe(true);
  });
});
