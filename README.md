# logic-circuit-sim

論理回路をドラッグ＆ドロップで組み立て、INPUT を切り替えるだけで信号の流れがリアルタイムにアニメーションする、教育向けの論理回路シミュレーターです。

> 「回路を繋いでスイッチを押すだけで、信号が光って流れる論理回路シミュレーター」

完全フロントエンド（React + TypeScript + Vite）の静的サイトで、GitHub Pages で公開できます。

## 主な機能

- **キャンバス操作**: ゲートのドラッグ配置・移動、ポートをタップして配線、配線タップで削除、パン、ピンチ／ホイールズーム
- **全 13 素子**: AND / OR / NOT / XOR / NAND / NOR / XNOR / バッファ / INPUT / OUTPUT / SR ラッチ / D フリップフロップ / CLK
- **信号の視覚化**: HIGH は緑＋グローで流れるアニメーション、LOW はグレー。ゲート本体も発光
- **真理値表**: 選択中ゲートの真理値表を表示し、現在の入力行をハイライト
- **プリセット回路**: 半加算器・全加算器・SR ラッチ（NOR 構成）・D フリップフロップ・NOT デモ
- **チュートリアル**: 初回起動時に 5 ステップで操作を説明（スキップ可）
- **テーマ切替**: ダーク／ライト（`localStorage` に保存）
- **JSON 入出力**: 回路を JSON で保存・読込（インポート時にスキーマ検証）
- **モバイル対応**: タッチ操作・横スクロールのゲートバー・情報のボトムシート
- **アクセシビリティ**: `aria-label`、フォーカス表示、`prefers-reduced-motion` 尊重、色だけに依存しない表示

### Phase 2 機能

- **URL シェア**: 回路を URL セーフな Base64 にエンコードして URL のハッシュ（`#c=...`）に埋め込み、共有 URL をクリップボードへコピー。リンクを開くと回路が自動復元（インポート時と同じスキーマ検証）
- **波形ビュー**: INPUT / CLK / OUTPUT の信号変化をタイムラインのデジタル波形（ステップ波形）で表示。CLK の周期動作やフリップフロップの取り込みを時間軸で観察できる

## 技術スタック

- React 18 / TypeScript / Vite
- Tailwind CSS v3
- Zustand（グローバル回路状態）
- Vitest（テスト）

## セットアップ

```bash
npm install      # 依存パッケージをインストール
npm run dev      # 開発サーバー (http://localhost:5173)
npm run build    # production ビルド (dist/)
npm run preview  # ビルド結果をプレビュー
npm test         # テスト
npm run lint     # Lint
npm run typecheck # 型チェック
```

## アーキテクチャ

```
src/
├── components/   SVG キャンバスと UI（描画は Canvas.tsx に集約）
├── hooks/        ドラッグ・配線接続・回路評価／クロックのフック
├── lib/
│   ├── circuit/  評価ロジック（純粋関数・循環検出）、ゲート定義、メモリ素子、座標計算
│   ├── storage/  JSON エクスポート／インポート、URL シェア（Base64 エンコード）
│   └── presets/  プリセット回路データ
├── stores/       Zustand ストア（回路・メモリ・テーマ・ビュー）
├── types/        Gate / Wire / Circuit / Port の型定義
└── styles/       グローバル CSS・テーマ変数
```

### 回路評価のしくみ

`src/lib/circuit/evaluate.ts` の `evaluate()` は副作用のない純粋関数で、DFS で信号を伝播します。訪問中セットで循環参照を検出し、無限ループを防ぎます。SR ラッチ・D フリップフロップ・CLK の内部状態は評価関数の外（Zustand ストア）で保持し、評価時に外から渡します。メモリ素子の出力は内部状態から決まるため、フィードバックループを自然に断ち切ります。

## デプロイ

`main` ブランチへ push すると、GitHub Actions（`.github/workflows/deploy.yml`）が `npm run build` を実行し、`dist/` を GitHub Pages へ自動デプロイします。Vite の `base` は `/logic-circuit-sim/` です。

公開 URL: `https://<user>.github.io/logic-circuit-sim/`
