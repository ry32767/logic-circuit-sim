import { useMemo } from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import { GATE_META } from '../lib/circuit/gates';
import {
  isTraceable,
  useWaveform,
  WAVE_MAX_SAMPLES,
  type WaveSample,
} from '../hooks/useWaveform';

// 波形の描画寸法
const ROW_H = 34;
const DX = 7; // 1 サンプルあたりの横幅
const Y_HIGH = 7;
const Y_LOW = 26;

// トレース対象ゲートの表示ラベルを作る（同種は連番）
function buildSignals(
  gates: ReturnType<typeof useCircuitStore.getState>['gates'],
): { gateId: string; label: string; high: boolean }[] {
  const counters: Record<string, number> = {};
  return gates
    .filter((g) => isTraceable(g.type))
    .map((g) => {
      counters[g.type] = (counters[g.type] ?? 0) + 1;
      return {
        gateId: g.id,
        label: `${GATE_META[g.type].label}${counters[g.type]}`,
        high: false,
      };
    });
}

// 1 信号分のステップ波形パスを組み立てる
function buildPath(samples: WaveSample[], gateId: string): string {
  if (samples.length === 0) return '';
  const yOf = (v: 0 | 1) => (v ? Y_HIGH : Y_LOW);
  let prev = samples[0][gateId] ?? 0;
  let d = `M 0 ${yOf(prev)}`;
  for (let i = 1; i < samples.length; i++) {
    const v = samples[i][gateId] ?? 0;
    const x = i * DX;
    d += ` H ${x}`;
    if (v !== prev) d += ` V ${yOf(v)}`;
    prev = v;
  }
  return d;
}

export function WaveformView() {
  const gates = useCircuitStore((s) => s.gates);
  const toggleWaveform = useCircuitStore((s) => s.toggleWaveform);
  const { samples } = useWaveform(true);

  const signals = useMemo(() => buildSignals(gates), [gates]);
  const width = Math.max(WAVE_MAX_SAMPLES, samples.length) * DX;
  const last = samples[samples.length - 1];

  return (
    <section
      aria-label="波形ビュー"
      className="flex h-full flex-col bg-slate-50 dark:bg-slate-900"
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-1.5 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          波形ビュー
          <span className="ml-2 text-xs font-normal text-slate-400">
            INPUT / CLK / OUTPUT の信号変化
          </span>
        </h2>
        <button
          type="button"
          onClick={toggleWaveform}
          aria-label="波形ビューを閉じる"
          className="rounded px-2 py-0.5 text-sm text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          ✕
        </button>
      </header>

      {signals.length === 0 ? (
        <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
          INPUT / CLK / OUTPUT を配置すると、その信号の時間変化が波形で表示されます。
        </p>
      ) : (
        <div className="flex-1 overflow-auto">
          {signals.map((sig) => {
            const high = (last?.[sig.gateId] ?? 0) === 1;
            return (
              <div
                key={sig.gateId}
                className="flex items-stretch border-b border-slate-100 last:border-b-0 dark:border-slate-800"
              >
                {/* 信号名 + 現在値 */}
                <div className="flex w-20 shrink-0 items-center gap-1 border-r border-slate-200 px-2 dark:border-slate-800">
                  <span
                    aria-hidden="true"
                    className={
                      'inline-block h-2 w-2 rounded-full ' +
                      (high ? 'bg-emerald-500' : 'bg-slate-400')
                    }
                  />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {sig.label}
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-slate-400">
                    {high ? '1' : '0'}
                  </span>
                </div>
                {/* 波形 */}
                <svg
                  className="block"
                  width={width}
                  height={ROW_H}
                  role="img"
                  aria-label={`${sig.label} の波形（現在 ${high ? 'HIGH' : 'LOW'}）`}
                >
                  <line
                    x1={0}
                    y1={Y_LOW}
                    x2={width}
                    y2={Y_LOW}
                    className="lcs-wave-baseline"
                  />
                  <path
                    d={buildPath(samples, sig.gateId)}
                    className={'lcs-wave' + (high ? ' high' : '')}
                  />
                </svg>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
