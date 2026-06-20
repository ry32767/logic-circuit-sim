import { useEffect, useState } from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import { Icon } from './Icon';
import type { IconName } from '../lib/icons';

// チュートリアルの各ステップ
const STEPS: { title: string; body: string; icon: IconName }[] = [
  {
    icon: 'add_box',
    title: 'ゲートを置く',
    body: 'サイドバーのゲートをキャンバスへドラッグ、またはタップして配置します。',
  },
  {
    icon: 'share',
    title: '配線でつなぐ',
    body: '出力ポート（右側）→ 入力ポート（左側）の順にタップすると配線できます。配線をタップすると削除します。',
  },
  {
    icon: 'toggle_on',
    title: 'スイッチを切り替える',
    body: 'INPUT スイッチをタップすると 0 / 1 が切り替わり、信号が緑色に光って流れます。',
  },
  {
    icon: 'grid_on',
    title: '真理値表で確かめる',
    body: 'ゲートを選ぶと右パネルに真理値表が出ます（スマホはゲートを長押し、または右下のℹ️ボタン）。今の入力に対応する行がハイライトされます。',
  },
  {
    icon: 'auto_awesome',
    title: 'プリセットで遊ぶ',
    body: '上部の「プリセット」から半加算器やフリップフロップを読み込めます。保存・読込で回路を持ち出せます。',
  },
];

export function Tutorial() {
  const showTutorial = useCircuitStore((s) => s.showTutorial);
  const dismissTutorial = useCircuitStore((s) => s.dismissTutorial);
  const [step, setStep] = useState(0);

  // 開くたびに最初のステップへ戻す
  useEffect(() => {
    if (showTutorial) setStep(0);
  }, [showTutorial]);

  // Esc で閉じる
  useEffect(() => {
    if (!showTutorial) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dismissTutorial();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showTutorial, dismissTutorial]);

  if (!showTutorial) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <div className="mb-4 text-center">
          <div className="mb-3 flex justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
              <Icon name={current.icon} size={30} />
            </span>
          </div>
          <h2
            id="tutorial-title"
            className="text-lg font-bold text-slate-800 dark:text-slate-100"
          >
            {current.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {current.body}
          </p>
        </div>

        {/* ステップインジケータ */}
        <div className="mb-4 flex justify-center gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                'h-2 w-2 rounded-full transition-colors ' +
                (i === step ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')
              }
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={dismissTutorial}
            className="rounded-md px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            スキップ
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                戻る
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? dismissTutorial() : setStep((s) => s + 1))}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
            >
              {isLast ? 'はじめる' : '次へ'}
            </button>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-slate-400">
          ステップ {step + 1} / {STEPS.length}
        </p>
      </div>
    </div>
  );
}
