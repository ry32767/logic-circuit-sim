import { describe, it, expect } from 'vitest';
import type { Circuit } from '../../types/circuit';
import { encodeCircuit, decodeCircuit } from './share';

const sample: Circuit = {
  version: '1.0',
  gates: [
    { id: 'g1', type: 'INPUT', x: 100, y: 150, inputValue: true },
    { id: 'g2', type: 'AND', x: 300, y: 130 },
    { id: 'g3', type: 'CLK', x: 60, y: 260, clockInterval: 500 },
  ],
  wires: [
    { id: 'w1', fromGateId: 'g1', fromPortIndex: 0, toGateId: 'g2', toPortIndex: 0 },
  ],
};

describe('share - URL エンコード/デコード', () => {
  it('エンコード→デコードで回路が復元される', () => {
    const encoded = encodeCircuit(sample);
    const decoded = decodeCircuit(encoded);
    expect(decoded).toEqual(sample);
  });

  it('URL セーフな文字だけを含む（+ / = を含まない）', () => {
    const encoded = encodeCircuit(sample);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('不正な Base64 はデコードで例外を投げる', () => {
    expect(() => decodeCircuit('!!!not-valid-json!!!')).toThrow();
  });
});
