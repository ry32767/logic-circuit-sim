import { useCircuitStore } from '../stores/circuitStore';
import { useCircuit } from '../hooks/useCircuit';
import { GATE_META } from '../lib/circuit/gates';

export function TruthTable() {
  const selectedGateId = useCircuitStore((s) => s.selectedGateId);
  const gates = useCircuitStore((s) => s.gates);
  const result = useCircuit();

  const gate = gates.find((g) => g.id === selectedGateId);
  if (!gate) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        ゲートを選択すると真理値表が表示されます。
      </p>
    );
  }

  const meta = GATE_META[gate.type];
  const table = meta.truthTable;
  if (!table) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {meta.name} は真理値表を持ちません。
      </p>
    );
  }

  // 現在の入力（0/1 配列）。一致する行をハイライトする。
  const current = (result.inputs[gate.id] ?? []).map((b) => (b ? 1 : 0));
  const inLabels =
    meta.inputLabels ?? (meta.inputs === 1 ? ['A'] : ['A', 'B']);
  const outLabels = meta.outputLabels ?? ['Y'];

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {meta.name} の真理値表
      </h3>
      <table className="w-full border-collapse text-center text-sm">
        <thead>
          <tr className="border-b border-slate-300 dark:border-slate-600">
            {inLabels.map((l) => (
              <th key={`h-in-${l}`} className="px-2 py-1 font-semibold text-slate-600 dark:text-slate-300">
                {l}
              </th>
            ))}
            {outLabels.map((l) => (
              <th
                key={`h-out-${l}`}
                className="px-2 py-1 font-semibold text-emerald-600 dark:text-emerald-400"
              >
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row, ri) => {
            const isCurrent =
              current.length === row.inputs.length &&
              row.inputs.every((v, i) => v === current[i]);
            return (
              <tr
                key={ri}
                className={
                  'border-b border-slate-100 dark:border-slate-800 ' +
                  (isCurrent
                    ? 'bg-emerald-100 font-bold dark:bg-emerald-900/50'
                    : '')
                }
              >
                {row.inputs.map((v, ci) => (
                  <td key={`in-${ci}`} className="px-2 py-1 tabular-nums text-slate-700 dark:text-slate-200">
                    {v}
                  </td>
                ))}
                {row.outputs.map((v, ci) => (
                  <td
                    key={`out-${ci}`}
                    className={
                      'px-2 py-1 tabular-nums ' +
                      (v ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')
                    }
                  >
                    {v}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {isCurrentHidden(current, table) && (
        <p className="mt-2 text-xs text-slate-400">
          ※ 現在の入力に一致する行をハイライトしています。
        </p>
      )}
    </div>
  );
}

// ハイライト中の行があるか（注記の表示判定）
function isCurrentHidden(
  current: number[],
  table: { inputs: number[] }[],
): boolean {
  return table.some(
    (row) =>
      current.length === row.inputs.length &&
      row.inputs.every((v, i) => v === current[i]),
  );
}
