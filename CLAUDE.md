# CLAUDE.md

このファイルは AI エージェントがこのリポジトリで作業するときの前提・制約・確認手順・完了条件を定義します。
作業前にこのファイルを参照し、ここに書かれた方針に従ってください。

---

## Project Overview

- **Project name**: logic-circuit-sim
- **Purpose**: 論理回路をドラッグ＆ドロップで組み立て、信号の流れをリアルタイムで視覚的に体験できる教育向けシミュレーター
- **Target users**: 論理回路を学びたい一般ユーザー（学生・エンジニア志望者・好奇心旺盛な人）
- **Main value**: 回路を組んで INPUT を切り替えるだけで信号がアニメーションで流れ、直観的に論理回路を理解できる
- **Public URL**: `https://<user>.github.io/logic-circuit-sim/`
- **Repository type**: project pages
- **Production hosting**: GitHub Pages

---

## First Steps

作業を始める前に、まず以下を確認してください。

1. `README.md`
2. `package.json`（使用ライブラリとスクリプトを確認）
3. `vite.config.ts`（base path の設定を確認）
4. `.github/workflows/deploy.yml`（デプロイ設定を確認）
5. `src/types/circuit.ts`（Gate・Wire・Circuit の型定義を確認）
6. `src/lib/circuit/evaluate.ts`（回路評価ロジックを確認）
7. 既存のディレクトリ構成

実装に入る前に、以下を短く整理してください。

- 変更対象のコンポーネントと影響範囲
- 回路評価ロジックへの影響の有無
- タッチ操作への影響の有無
- ダーク/ライトテーマへの影響の有無
- 不明点

---

## Core Rules

作業時は以下を守ってください。

- 既存の設計・命名・ディレクトリ構成を尊重する
- 依頼された範囲に集中し、関係ない変更を避ける
- 大規模なリファクタリングは明示的に求められた場合のみ行う
- 変更はできるだけ小さく、レビューしやすい単位にする
- 実在しないコマンドを推測で実行しない
- `package.json` を確認し、存在するスクリプトだけを使う
- 依存関係を追加する場合は、目的と必要性を明確にする
- 不明点が作業結果に大きく影響する場合は、実装前に質問する
- 軽微な判断は自律的に行ってよい
- 最後に変更内容・検証結果・残課題を報告する

---

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js 20+
- **Package manager**: npm
- **Frontend framework**: React 18
- **Build tool**: Vite
- **Styling**: Tailwind CSS v3
- **State management**: Zustand（グローバル回路状態）/ useState（ローカルUI状態）
- **Animation**: CSS transitions + SVG アニメーション（Framer Motion は使わない）
- **Testing**: Vitest
- **Hosting**: GitHub Pages
- **CI/CD**: GitHub Actions

---

## Repository Structure

```
logic-circuit-sim/
├── src/
│   ├── components/
│   │   ├── Canvas.tsx           # メインSVGキャンバス（ゲート・配線の描画）
│   │   ├── Gate.tsx             # 個別ゲートコンポーネント
│   │   ├── Wire.tsx             # 配線（ベジェ曲線）コンポーネント
│   │   ├── Sidebar.tsx          # ゲート追加サイドバー
│   │   ├── Toolbar.tsx          # 上部ツールバー（保存・読込・テーマ切替）
│   │   ├── TruthTable.tsx       # 真理値表パネル
│   │   ├── GateInfo.tsx         # ゲート説明パネル
│   │   ├── PresetMenu.tsx       # プリセット回路メニュー
│   │   └── Tutorial.tsx         # チュートリアルモーダル
│   ├── hooks/
│   │   ├── useCircuit.ts        # 回路操作フック
│   │   ├── useDrag.ts           # ドラッグ＆ドロップ（マウス＋タッチ）
│   │   └── useConnect.ts        # 配線接続フック
│   ├── lib/
│   │   ├── circuit/
│   │   │   ├── evaluate.ts      # 回路評価ロジック（DFS で信号を伝播）
│   │   │   ├── gates.ts         # ゲート定義・真理値テーブル
│   │   │   └── memory.ts        # SR ラッチ・D フリップフロップのロジック
│   │   ├── storage/
│   │   │   └── json.ts          # JSON エクスポート・インポート
│   │   └── presets/
│   │       └── index.ts         # プリセット回路データ
│   ├── stores/
│   │   └── circuitStore.ts      # Zustand ストア（回路状態・テーマ）
│   ├── types/
│   │   └── circuit.ts           # Gate・Wire・Circuit・Port の型定義
│   ├── styles/
│   │   └── globals.css          # グローバルスタイル・CSS 変数
│   └── App.tsx
├── public/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── CLAUDE.md
├── logic-circuit-sim-spec.md
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Commands

```bash
# 依存パッケージをインストール
npm install

# 開発サーバーを起動（http://localhost:5173）
npm run dev

# production ビルド（dist/ に出力）
npm run build

# ビルド結果をローカルでプレビュー
npm run preview

# テスト実行
npm test

# 型チェック
npm run typecheck

# Lint
npm run lint
```

---

## Coding Rules

- **コンポーネントは関数コンポーネント（FC）のみ**使用する
- `any` 型は禁止。型不明な場合は `unknown` を使い、型ガードで絞る
- コメントは日本語で書く
- 1ファイル 250 行以内を目安にする（超える場合は分割を検討）
- `console.log` はデバッグ後に必ず削除する
- **SVG 描画は Canvas.tsx に集約する**（個別コンポーネントが DOM に直接 SVG を追加しない）
- 回路評価ロジック（`lib/circuit/`）は副作用なし（純粋関数）で実装する
- **メモリ素子（SR ラッチ・D-FF）は状態を Zustand ストアで管理する**（評価関数の外で）
- アニメーションは CSS transition / SVG animate を使い、JS タイマーは最小限にする

## Do NOT

- `npm install` で新しい依存を勝手に追加しない（相談すること）
- Framer Motion / GSAP などの重いアニメーションライブラリを追加しない
- `dangerouslySetInnerHTML` を使わない
- ゲートの評価ループ検出なしに無限再帰しない（サイクル検出を必ず行う）
- `localStorage` に大きなデータを無制限に保存しない
- サーバーサイド処理・API Routes を追加しない（GitHub Pages は静的のみ）
- `.env` ファイルをコミットしない

---

## GitHub Pages Requirements

- 静的サイトとしてビルドできる構成にする
- サーバー常駐処理・SSR・API Routes を追加しない
- **base path は `/logic-circuit-sim/`** を使う（vite.config.ts を参照）
- ルーティング・画像・CSS・JS のパスが本番 URL で壊れないようにする
- GitHub Actions で自動デプロイできる構成を維持する

### Vite base path 設定

```ts
// vite.config.ts
export default defineConfig({
  base: '/logic-circuit-sim/',
  plugins: [react()],
})
```

---

## GitHub Actions

`main` ブランチへの push で自動デプロイされます。
workflow を変更する場合は以下を満たしてください。

- `main` ブランチへの push でトリガーする
- `npm ci` で依存関係をインストールする
- `npm run build` で production ビルドを実行する
- `dist/` を GitHub Pages にデプロイする

---

## Design and UI

- **ダーク / ライトテーマの両方に対応する**（Tailwind の `dark:` クラスを使う）
- テーマ切替は Zustand ストアで管理し、`localStorage` に保存する
- HIGH 信号（1）：緑（`#00e676`）で表示、LOW 信号（0）：グレーで表示
- 信号の流れはワイヤーの色変化 + グロー効果でアニメーションする
- **スマホ対応必須**：タッチイベント（`touchstart` / `touchmove` / `touchend`）を実装する
- キャンバスはピンチズームとパン（スクロール）に対応する
- ゲートのドラッグはマウスとタッチの両方で動作するようにする
- 余白・コントラスト・フォントサイズをモバイルでも読みやすく保つ
- アニメーションは `prefers-reduced-motion` を尊重する

---

## Accessibility

- ボタン・アイコンには `aria-label` を付ける
- キーボード操作でゲート追加・削除ができるようにする（最低限）
- 色だけで信号の High/Low を伝えない（形状・ラベルも使う）
- フォーカス状態を見えるようにする

---

## Testing and Verification

変更後は可能な範囲で以下を確認してください。

1. 変更したロジックの単体テスト
2. `npm run build`
3. `npm run typecheck`
4. `npm run lint`
5. 開発サーバーでの動作確認（ダーク/ライト両テーマ）
6. スマホサイズでの表示確認（DevTools のモバイルエミュレーター）

標準的な確認コマンド:

```bash
npm run build
npm test
npm run lint
npm run typecheck
```

---

## Security Rules

- 秘密情報をハードコードしない
- 不要な依存関係を追加しない
- ユーザーが JSON インポートする際は、スキーマ検証を行う（不正データでクラッシュしない）
- 外部リンクは `rel="noopener noreferrer"` を付ける

---

## Git and Commit Policy

- 関係ないファイルを変更しない
- `dist/` や `node_modules/` をコミットしない（`.gitignore` で除外済み）
- ユーザーが明示的に求めない限り `git push` しない
- `git push --force` は明示的な許可なしに実行しない

---

## When to Ask Questions

以下の場合は実装前に質問してください。

- 新しいゲート種類を追加する場合（仕様確認）
- 回路評価アルゴリズムの大幅変更が必要な場合
- メモリ素子の動作仕様が不明な場合
- スマホ操作 UX に大きな変更が必要な場合
- 新しい npm パッケージの追加が必要な場合
- GitHub Pages では実現できない要件が出た場合

---

## When You May Decide Autonomously

依頼範囲内であれば自律的に判断して構いません。

- 明らかなバグ修正
- 型エラー・lint エラーの修正
- コンポーネントの小さなリファクタリング
- README の補足
- テストの追加
- アクセシビリティの軽微な改善
- レスポンシブ対応の調整
- 既存パターンに沿った実装詳細

---

## Prohibited Actions

明示的な許可なしに以下を行わないでください。

- 重いアニメーションライブラリ（Framer Motion / GSAP など）を追加する
- フレームワークを勝手に変更する（React → Vue など）
- 既存のゲート評価ロジックを理由なく書き換える
- `git push --force` を実行する
- ユーザーの明示的な依頼なしにデプロイする

---

## Definition of Done

作業完了条件は以下です。

- 要求された機能または修正が実装されている
- 依頼範囲外の不要な変更がない
- `npm run build` が成功する
- `npm run typecheck` が成功する
- `npm run lint` が成功する
- テストがある場合は成功する
- ダーク / ライト両テーマで表示崩れがない
- スマホサイズで主要操作が動作する
- GitHub Pages の base path でアセットが壊れない
- 未解決の問題や確認できなかった項目が明示されている

---

## Final Response Format

作業完了時は以下の形式で報告してください。

```md
## Summary

- 変更内容1
- 変更内容2

## Verification

- `npm run build`: passed / failed / not run
- `npm test`: passed / failed / not run
- `npm run lint`: passed / failed / not run
- `npm run typecheck`: passed / failed / not run
- Browser check (desktop): passed / not run
- Browser check (mobile): passed / not run
- Dark theme: passed / not run
- Light theme: passed / not run

## Notes

- 残課題
- 注意点
- 次にやるとよいこと
```
