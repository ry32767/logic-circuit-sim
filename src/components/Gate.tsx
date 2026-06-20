import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Gate as GateModel } from '../types/circuit';
import type { PendingPort } from '../stores/circuitStore';
import { GATE_META } from '../lib/circuit/gates';
import {
  gateHeight,
  gateWidth,
  portPosition,
  PORT_RADIUS,
} from '../lib/circuit/geometry';

interface GateProps {
  gate: GateModel;
  outputs: boolean[];
  inputs: boolean[];
  selected: boolean;
  forbidden: boolean; // SR ラッチの禁止状態
  pending: PendingPort | null;
  onBodyPointerDown: (e: ReactPointerEvent, gate: GateModel) => void;
  onPortPointerDown: (e: ReactPointerEvent, port: PendingPort) => void;
  onDelete: (id: string) => void;
}

// このゲートが発光（HIGH 表示）すべきか
function isGlowing(gate: GateModel, outputs: boolean[], inputs: boolean[]) {
  if (gate.type === 'INPUT') return gate.inputValue ?? false;
  if (gate.type === 'OUTPUT') return inputs[0] ?? false;
  return outputs[0] ?? false;
}

// ポートが接続候補（接続中で、向きが逆かつ別ゲート）か
function isCandidate(
  pending: PendingPort | null,
  gateId: string,
  type: 'input' | 'output',
) {
  return (
    pending !== null && pending.type !== type && pending.gateId !== gateId
  );
}

export function Gate({
  gate,
  outputs,
  inputs,
  selected,
  forbidden,
  pending,
  onBodyPointerDown,
  onPortPointerDown,
  onDelete,
}: GateProps) {
  const meta = GATE_META[gate.type];
  const w = gateWidth();
  const h = gateHeight(gate.type);
  const glow = isGlowing(gate, outputs, inputs);

  // 入力ポート
  const inputPorts = Array.from({ length: meta.inputs }, (_, i) => {
    const pos = portPosition(gate, 'input', i);
    return { i, pos, value: inputs[i] ?? false };
  });
  // 出力ポート
  const outputPorts = Array.from({ length: meta.outputs }, (_, i) => {
    const pos = portPosition(gate, 'output', i);
    return { i, pos, value: outputs[i] ?? false };
  });

  return (
    <g
      className="lcs-gate"
      role="button"
      tabIndex={0}
      aria-label={`${meta.name}${glow ? '（出力 HIGH）' : '（出力 LOW）'}`}
      onPointerDown={(e) => onBodyPointerDown(e, gate)}
    >
      {/* 本体 */}
      <rect
        x={gate.x}
        y={gate.y}
        width={w}
        height={h}
        rx={10}
        className={
          'lcs-gate-body' +
          (glow ? ' active' : '') +
          (selected ? ' selected' : '') +
          (forbidden ? ' forbidden' : '')
        }
      />

      {/* ラベル / 種類ごとの表示 */}
      {gate.type === 'INPUT' ? (
        <text
          x={gate.x + w / 2}
          y={gate.y + h / 2}
          className="lcs-gate-value"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {gate.inputValue ? '1' : '0'}
        </text>
      ) : gate.type === 'OUTPUT' ? (
        <>
          <circle
            cx={gate.x + w / 2}
            cy={gate.y + h / 2 - 4}
            r={11}
            className={'lcs-lamp' + (glow ? ' on' : '')}
          />
          <text
            x={gate.x + w / 2}
            y={gate.y + h - 9}
            className="lcs-gate-sublabel"
            textAnchor="middle"
          >
            {glow ? '1' : '0'}
          </text>
        </>
      ) : (
        <text
          x={gate.x + w / 2}
          y={gate.y + h / 2}
          className="lcs-gate-label"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {meta.label}
        </text>
      )}

      {/* SR ラッチ禁止状態の警告アイコン */}
      {forbidden && (
        <text
          x={gate.x + w - 8}
          y={gate.y + 14}
          className="lcs-warning"
          textAnchor="middle"
          aria-label="禁止状態"
        >
          ⚠
        </text>
      )}

      {/* 入力ポート */}
      {inputPorts.map(({ i, pos, value }) => (
        <g key={`in-${i}`}>
          {meta.inputLabels && (
            <text
              x={pos.x + 11}
              y={pos.y}
              className="lcs-port-label"
              dominantBaseline="central"
            >
              {meta.inputLabels[i]}
            </text>
          )}
          <circle
            cx={pos.x}
            cy={pos.y}
            r={PORT_RADIUS}
            className={
              'lcs-port' +
              (value ? ' high' : '') +
              (isCandidate(pending, gate.id, 'input') ? ' candidate' : '')
            }
            onPointerDown={(e) =>
              onPortPointerDown(e, {
                gateId: gate.id,
                portIndex: i,
                type: 'input',
              })
            }
          />
        </g>
      ))}

      {/* 出力ポート */}
      {outputPorts.map(({ i, pos, value }) => (
        <g key={`out-${i}`}>
          {meta.outputLabels && (
            <text
              x={pos.x - 11}
              y={pos.y}
              className="lcs-port-label end"
              textAnchor="end"
              dominantBaseline="central"
            >
              {meta.outputLabels[i]}
            </text>
          )}
          <circle
            cx={pos.x}
            cy={pos.y}
            r={PORT_RADIUS}
            className={
              'lcs-port' +
              (value ? ' high' : '') +
              (isCandidate(pending, gate.id, 'output') ? ' candidate' : '')
            }
            onPointerDown={(e) =>
              onPortPointerDown(e, {
                gateId: gate.id,
                portIndex: i,
                type: 'output',
              })
            }
          />
        </g>
      ))}

      {/* 削除ボタン（選択時のみ表示） */}
      {selected && (
        <g
          className="lcs-delete"
          role="button"
          aria-label={`${meta.name}を削除`}
          onPointerDown={(e) => {
            e.stopPropagation();
            onDelete(gate.id);
          }}
        >
          <circle cx={gate.x + w} cy={gate.y} r={9} className="lcs-delete-bg" />
          <text
            x={gate.x + w}
            y={gate.y + 1}
            textAnchor="middle"
            dominantBaseline="central"
            className="lcs-delete-x"
          >
            ✕
          </text>
        </g>
      )}
    </g>
  );
}
