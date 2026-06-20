import { useCircuitStore } from '../stores/circuitStore';
import { GATE_META } from '../lib/circuit/gates';

export function GateInfo() {
  const selectedGateId = useCircuitStore((s) => s.selectedGateId);
  const gates = useCircuitStore((s) => s.gates);
  const toggleInput = useCircuitStore((s) => s.toggleInput);
  const setClockInterval = useCircuitStore((s) => s.setClockInterval);
  const removeGate = useCircuitStore((s) => s.removeGate);

  const gate = gates.find((g) => g.id === selectedGateId);
  if (!gate) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        ゲートをタップ（クリック）すると説明が表示されます。
      </p>
    );
  }

  const meta = GATE_META[gate.type];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {meta.name}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {meta.description}
        </p>
      </div>

      {/* INPUT スイッチの操作 */}
      {gate.type === 'INPUT' && (
        <button
          type="button"
          onClick={() => toggleInput(gate.id)}
          aria-pressed={gate.inputValue ?? false}
          className="w-full rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
        >
          現在: {gate.inputValue ? '1 (HIGH)' : '0 (LOW)'} — タップで切替
        </button>
      )}

      {/* CLK の周期設定 */}
      {gate.type === 'CLK' && (
        <label className="block text-sm text-slate-600 dark:text-slate-300">
          周期: {gate.clockInterval ?? 1000} ms
          <input
            type="range"
            min={200}
            max={2000}
            step={100}
            value={gate.clockInterval ?? 1000}
            onChange={(e) => setClockInterval(gate.id, Number(e.target.value))}
            className="mt-1 w-full accent-emerald-500"
            aria-label="クロック周期（ミリ秒）"
          />
        </label>
      )}

      <button
        type="button"
        onClick={() => removeGate(gate.id)}
        className="w-full rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
      >
        このゲートを削除
      </button>
    </div>
  );
}
