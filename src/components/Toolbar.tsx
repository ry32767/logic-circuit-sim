import { useEffect, useState } from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import { PresetMenu } from './PresetMenu';
import {
  downloadCircuit,
  importCircuitFromFile,
} from '../lib/storage/json';
import { buildShareUrl, updateUrlHash } from '../lib/storage/share';

// ツールバー共通のボタンスタイル
const btn =
  'flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

export function Toolbar() {
  const theme = useCircuitStore((s) => s.theme);
  const toggleTheme = useCircuitStore((s) => s.toggleTheme);
  const exportCircuit = useCircuitStore((s) => s.exportCircuit);
  const loadCircuit = useCircuitStore((s) => s.loadCircuit);
  const clear = useCircuitStore((s) => s.clear);
  const resetView = useCircuitStore((s) => s.resetView);
  const openTutorial = useCircuitStore((s) => s.openTutorial);
  const showWaveform = useCircuitStore((s) => s.showWaveform);
  const toggleWaveform = useCircuitStore((s) => s.toggleWaveform);
  const [error, setError] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  // 共有メッセージは数秒で自動的に消す
  useEffect(() => {
    if (!shareMsg) return;
    const h = window.setTimeout(() => setShareMsg(null), 2500);
    return () => window.clearTimeout(h);
  }, [shareMsg]);

  function handleSave() {
    downloadCircuit(exportCircuit());
  }

  // 回路を URL に埋め込み、クリップボードへコピーする
  async function handleShare() {
    const circuit = exportCircuit();
    const url = buildShareUrl(circuit);
    updateUrlHash(circuit); // アドレスバーも更新（再読込・ブックマーク用）
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg('共有 URL をコピーしました');
    } catch {
      // クリップボード不可（非セキュアコンテキスト等）でも URL は反映済み
      setShareMsg('アドレスバーの URL を共有できます');
    }
  }

  async function handleLoad() {
    setError(null);
    try {
      const circuit = await importCircuitFromFile();
      loadCircuit(circuit);
      resetView();
    } catch (err) {
      if (err instanceof Error && err.message !== 'ファイルが選択されませんでした') {
        setError(err.message);
      }
    }
  }

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">
          🔌
        </span>
        <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">
          Logic Circuit Sim
        </h1>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <PresetMenu />
        <button type="button" className={btn} onClick={handleSave} aria-label="回路を JSON で保存">
          <span aria-hidden="true">💾</span>
          <span className="hidden sm:inline">保存</span>
        </button>
        <button type="button" className={btn} onClick={handleLoad} aria-label="JSON から回路を読込">
          <span aria-hidden="true">📂</span>
          <span className="hidden sm:inline">読込</span>
        </button>
        <button type="button" className={btn} onClick={handleShare} aria-label="回路の共有 URL を作成">
          <span aria-hidden="true">🔗</span>
          <span className="hidden sm:inline">共有</span>
        </button>
        <button
          type="button"
          className={btn}
          onClick={toggleWaveform}
          aria-pressed={showWaveform}
          aria-label="波形ビューを表示／非表示"
        >
          <span aria-hidden="true">📈</span>
          <span className="hidden sm:inline">波形</span>
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => {
            if (window.confirm('キャンバスを空にしますか？')) clear();
          }}
          aria-label="キャンバスをクリア"
        >
          <span aria-hidden="true">🗑️</span>
          <span className="hidden sm:inline">クリア</span>
        </button>
        <button type="button" className={btn} onClick={resetView} aria-label="表示位置をリセット">
          <span aria-hidden="true">🎯</span>
          <span className="hidden sm:inline">表示</span>
        </button>
        <button type="button" className={btn} onClick={openTutorial} aria-label="使い方を表示">
          <span aria-hidden="true">❓</span>
          <span className="hidden sm:inline">使い方</span>
        </button>
        <button
          type="button"
          className={btn}
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'ライトテーマに切替' : 'ダークテーマに切替'}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="w-full rounded-md bg-red-100 px-3 py-1.5 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          読み込みエラー: {error}
        </div>
      )}

      {shareMsg && (
        <div
          role="status"
          className="w-full rounded-md bg-emerald-100 px-3 py-1.5 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
        >
          {shareMsg}
        </div>
      )}
    </header>
  );
}
