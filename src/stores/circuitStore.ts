import { create } from 'zustand';
import type {
  Circuit,
  Gate,
  GateType,
  MemoryState,
  Theme,
  Wire,
} from '../types/circuit';
import { GATE_META, DEFAULT_CLOCK_INTERVAL } from '../lib/circuit/gates';
import { evaluate } from '../lib/circuit/evaluate';
import { updateMemory } from '../lib/circuit/memory';

// localStorage キー
const THEME_KEY = 'lcs.theme';
const TUTORIAL_KEY = 'lcs.tutorialDone';

// 一意な ID を生成する（セッション内でカウンタ＋乱数）
let idCounter = 0;
function uid(prefix: string): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${idCounter.toString(36)}_${rand}`;
}

// 接続中のポート情報
export interface PendingPort {
  gateId: string;
  portIndex: number;
  type: 'input' | 'output';
}

// キャンバスの表示変換（パン＋ズーム）
export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

// 初期テーマを localStorage / OS 設定から決める
function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  const prefersLight = window.matchMedia?.(
    '(prefers-color-scheme: light)',
  ).matches;
  return prefersLight ? 'light' : 'dark';
}

// 初回チュートリアルを表示するか
function initialTutorial(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(TUTORIAL_KEY) !== '1';
}

export interface CircuitStore {
  // --- 状態 ---
  gates: Gate[];
  wires: Wire[];
  memory: MemoryState;
  selectedGateId: string | null;
  pending: PendingPort | null;
  theme: Theme;
  view: ViewTransform;
  fitNonce: number; // 「全体表示」要求のたびに増える（Canvas が監視してフィットする）
  showTutorial: boolean;
  showWaveform: boolean;
  infoSheetOpen: boolean; // モバイルの情報シートの開閉（長押しで開く）

  // --- ゲート操作 ---
  addGate: (type: GateType, x: number, y: number) => string;
  moveGate: (id: string, x: number, y: number) => void;
  removeGate: (id: string) => void;
  toggleInput: (id: string) => void;
  setClockInterval: (id: string, interval: number) => void;
  selectGate: (id: string | null) => void;

  // --- 配線操作 ---
  startConnection: (port: PendingPort) => void;
  completeConnection: (port: PendingPort) => void;
  cancelConnection: () => void;
  removeWire: (id: string) => void;

  // --- メモリ／クロック ---
  recompute: () => void;
  toggleClock: (id: string) => void;

  // --- ビュー操作 ---
  setView: (view: ViewTransform) => void;
  resetView: () => void;
  requestFit: () => void;

  // --- テーマ／チュートリアル ---
  toggleTheme: () => void;
  dismissTutorial: () => void;
  openTutorial: () => void;
  toggleWaveform: () => void;
  setInfoSheet: (open: boolean) => void;

  // --- 回路全体 ---
  loadCircuit: (circuit: Circuit) => void;
  clear: () => void;
  exportCircuit: () => Circuit;
}

export const useCircuitStore = create<CircuitStore>((set, get) => ({
  gates: [],
  wires: [],
  memory: {},
  selectedGateId: null,
  pending: null,
  theme: initialTheme(),
  view: { x: 0, y: 0, scale: 1 },
  fitNonce: 0,
  showTutorial: initialTutorial(),
  showWaveform: false,
  infoSheetOpen: false,

  addGate: (type, x, y) => {
    const id = uid('g');
    const gate: Gate = { id, type, x, y };
    if (type === 'INPUT') gate.inputValue = false;
    if (type === 'CLK') gate.clockInterval = DEFAULT_CLOCK_INTERVAL;
    set((s) => ({ gates: [...s.gates, gate], selectedGateId: id }));
    get().recompute();
    return id;
  },

  moveGate: (id, x, y) => {
    set((s) => ({
      gates: s.gates.map((g) => (g.id === id ? { ...g, x, y } : g)),
    }));
  },

  removeGate: (id) => {
    set((s) => ({
      gates: s.gates.filter((g) => g.id !== id),
      // つながっていた配線も削除する
      wires: s.wires.filter((w) => w.fromGateId !== id && w.toGateId !== id),
      selectedGateId: s.selectedGateId === id ? null : s.selectedGateId,
      pending: s.pending?.gateId === id ? null : s.pending,
    }));
    get().recompute();
  },

  toggleInput: (id) => {
    set((s) => ({
      gates: s.gates.map((g) =>
        g.id === id && g.type === 'INPUT'
          ? { ...g, inputValue: !g.inputValue }
          : g,
      ),
    }));
    get().recompute();
  },

  setClockInterval: (id, interval) => {
    set((s) => ({
      gates: s.gates.map((g) =>
        g.id === id ? { ...g, clockInterval: Math.max(100, interval) } : g,
      ),
    }));
  },

  selectGate: (id) => set({ selectedGateId: id }),

  startConnection: (port) => set({ pending: port }),

  completeConnection: (port) => {
    const { pending } = get();
    if (!pending) {
      set({ pending: port });
      return;
    }
    // 同じ向き同士は接続できない → クリックしたポートを新たな起点にする
    if (pending.type === port.type) {
      set({ pending: port });
      return;
    }
    const out = pending.type === 'output' ? pending : port;
    const inp = pending.type === 'input' ? pending : port;
    // 同一ゲート内の接続は不可
    if (out.gateId === inp.gateId) {
      set({ pending: null });
      return;
    }
    set((s) => {
      // 入力ポートは 1 本だけ：既存の配線があれば置き換える
      const filtered = s.wires.filter(
        (w) => !(w.toGateId === inp.gateId && w.toPortIndex === inp.portIndex),
      );
      const wire: Wire = {
        id: uid('w'),
        fromGateId: out.gateId,
        fromPortIndex: out.portIndex,
        toGateId: inp.gateId,
        toPortIndex: inp.portIndex,
      };
      return { wires: [...filtered, wire], pending: null };
    });
    get().recompute();
  },

  cancelConnection: () => set({ pending: null }),

  removeWire: (id) => {
    set((s) => ({ wires: s.wires.filter((w) => w.id !== id) }));
    get().recompute();
  },

  recompute: () => {
    const { gates, wires, memory } = get();
    const result = evaluate(gates, wires, memory);
    const nextMemory = updateMemory(gates, result, memory);
    set({ memory: nextMemory });
  },

  toggleClock: (id) => {
    const { gates, memory } = get();
    const clk = gates.find((g) => g.id === id && g.type === 'CLK');
    if (!clk) return;
    // 指定 CLK の出力をトグルする
    const prev = memory[id]?.clkValue ?? false;
    set({
      memory: { ...memory, [id]: { ...memory[id], clkValue: !prev } },
    });
    // CLK 変化を D-FF のエッジ検出に反映する
    get().recompute();
  },

  setView: (view) => set({ view }),
  resetView: () => set({ view: { x: 0, y: 0, scale: 1 } }),
  requestFit: () => set((s) => ({ fitNonce: s.fitNonce + 1 })),

  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_KEY, theme);
      }
      return { theme };
    }),

  dismissTutorial: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TUTORIAL_KEY, '1');
    }
    set({ showTutorial: false });
  },

  openTutorial: () => set({ showTutorial: true }),

  toggleWaveform: () => set((s) => ({ showWaveform: !s.showWaveform })),

  setInfoSheet: (open) => set({ infoSheetOpen: open }),

  loadCircuit: (circuit) => {
    // メモリを初期化（CLK は false 始まり）
    const memory: MemoryState = {};
    for (const g of circuit.gates) {
      if (g.type === 'CLK') memory[g.id] = { clkValue: false };
      else if (g.type === 'SR_LATCH') memory[g.id] = { q: false };
      else if (g.type === 'D_FF') memory[g.id] = { q: false, prevClk: false };
    }
    set({
      gates: circuit.gates,
      wires: circuit.wires,
      memory,
      selectedGateId: null,
      pending: null,
    });
    get().recompute();
  },

  clear: () => {
    set({
      gates: [],
      wires: [],
      memory: {},
      selectedGateId: null,
      pending: null,
    });
  },

  exportCircuit: () => {
    const { gates, wires } = get();
    return { version: '1.0', gates, wires };
  },
}));

// ゲート種類がメモリ素子かどうか（UI 用の再エクスポート）
export function gateInputCount(type: GateType): number {
  return GATE_META[type].inputs;
}
