import { useEffect } from 'react';
import { useCircuitStore } from './stores/circuitStore';
import { useClocks } from './hooks/useCircuit';
import { usePaletteDrag } from './hooks/usePaletteDrag';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { TruthTable } from './components/TruthTable';
import { GateInfo } from './components/GateInfo';
import { Tutorial } from './components/Tutorial';
import { WaveformView } from './components/WaveformView';
import { Icon } from './components/Icon';
import { GATE_META } from './lib/circuit/gates';
import { readCircuitFromUrl } from './lib/storage/share';

export default function App() {
  const theme = useCircuitStore((s) => s.theme);
  const showWaveform = useCircuitStore((s) => s.showWaveform);
  const sheetOpen = useCircuitStore((s) => s.infoSheetOpen);
  const setInfoSheet = useCircuitStore((s) => s.setInfoSheet);

  // CLK タイマーを起動する
  useClocks();

  // サイドバーからのドラッグ配置を駆動し、追従するゴーストの状態を得る
  const paletteDrag = usePaletteDrag();

  // 起動時に URL ハッシュへ回路が埋め込まれていれば読み込む（共有リンク）
  useEffect(() => {
    const shared = readCircuitFromUrl();
    if (shared) {
      useCircuitStore.getState().loadCircuit(shared);
      useCircuitStore.getState().requestFit(); // 共有回路は全体が見えるようにフィット
      useCircuitStore.getState().dismissTutorial(); // 共有閲覧時はチュートリアルを出さない
    }
  }, []); // 初回マウント時のみ

  // テーマを html 要素に反映する
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Toolbar />

      <div className="relative flex flex-1 overflow-hidden">
        {/* サイドバー（デスクトップ：左の縦列） */}
        <aside className="hidden w-48 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 md:block">
          <Sidebar />
        </aside>

        {/* キャンバス（＋波形ビュー） */}
        <main className="relative flex flex-1 flex-col overflow-hidden">
          <div className="relative flex-1 overflow-hidden">
            <Canvas />
          </div>
          {showWaveform && (
            <div className="h-44 shrink-0 overflow-hidden border-t border-slate-200 dark:border-slate-800">
              <WaveformView />
            </div>
          )}
        </main>

        {/* 情報パネル（デスクトップ：右） */}
        <aside className="hidden w-72 shrink-0 space-y-4 overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 md:block">
          <section>
            <GateInfo />
          </section>
          <hr className="border-slate-200 dark:border-slate-800" />
          <section>
            <TruthTable />
          </section>
        </aside>
      </div>

      {/* サイドバー（モバイル：下の横スクロール） */}
      <div className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 md:hidden">
        <Sidebar />
      </div>

      {/* 情報シートを開くフローティングボタン（モバイル） */}
      <button
        type="button"
        onClick={() => setInfoSheet(!sheetOpen)}
        className="fixed bottom-24 right-4 z-30 rounded-full bg-emerald-500 p-3 text-white shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 md:hidden"
        aria-label={sheetOpen ? '情報パネルを閉じる' : '情報パネルを開く'}
      >
        <Icon name={sheetOpen ? 'close' : 'info'} size={24} />
      </button>

      {/* 情報ボトムシート（モバイル） */}
      {sheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-20 max-h-[60vh] space-y-4 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-800 md:hidden">
          <section>
            <GateInfo />
          </section>
          <hr className="border-slate-200 dark:border-slate-700" />
          <section>
            <TruthTable />
          </section>
        </div>
      )}

      {/* パレットからのドラッグ配置中に指へ追従するゴースト */}
      {paletteDrag && (
        <div
          className="lcs-palette-ghost pointer-events-none fixed z-50 flex h-12 w-16 items-center justify-center rounded-lg border-2 border-emerald-500 bg-white text-sm font-bold text-slate-800 shadow-xl dark:bg-slate-800 dark:text-slate-100"
          style={{
            left: paletteDrag.x,
            top: paletteDrag.y,
            transform: 'translate(-50%, -50%)',
          }}
          aria-hidden="true"
        >
          {GATE_META[paletteDrag.type].label}
        </div>
      )}

      <Tutorial />
    </div>
  );
}
