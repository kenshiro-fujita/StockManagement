# StockManagement

StockManagement は、中長期の個人投資家が財務データと定性情報を一元管理し、理論に基づいて投資判断を行うための Web アプリケーションです。

結果だけを提示するブラックボックス型の分析ツールではなく、計算式・入力値・丸め規則・計算バージョンを確認できる「透明性」を設計の中心に置いています。アプリは判断材料を整理しますが、売買判断そのものはユーザーに委ねます。

## 主な機能

- 銘柄情報と投資ロースターの管理
- 年度別財務データの入力・編集・比較
- EDINET からの財務データ取得支援
- 理論株価、ROE、ROA、ROIC、安全率などの算出過程表示
- 銘柄ごとの計算パラメータ調整
- AI による定性調査の支援
- 売買取引、保有ポジション、損益、売買シグナルの管理
- 複数銘柄の比較とポートフォリオ表示

## 技術構成

- Next.js 16（App Router）/ React 19 / TypeScript
- Supabase（Auth / PostgreSQL / RLS）
- Tailwind CSS / shadcn/ui
- Zod / React Hook Form
- Vitest / ESLint / Prettier

主要な責務は次のように分離しています。

```text
src/
├── app/          ルーティングとServer Component
├── actions/      認証・検証を伴うServer Action
├── components/   画面と再利用可能なUI
├── lib/calc/     副作用を持たない計算エンジン
├── lib/edinet/   外部開示データの取得・抽出
├── lib/schemas/  入力境界のZodスキーマ
├── lib/stocks/   一覧・比較・ポートフォリオ用の集約
└── lib/supabase/ DBクライアント、認証、認可境界
```

## ローカル開発

Node.js の LTS 版と Supabase プロジェクトを用意してください。

```bash
npm ci
cp .env.example .env.local
npm run dev
```

`.env.local` に設定する値は [環境変数一覧](docs/environment-variables.md) を参照してください。秘密情報を Git に追加しないでください。

## 品質チェック

```bash
npm run check
```

このコマンドでフォーマット、lint、型検査、テストをまとめて実行します。本番ビルドは別途 `npm run build` で確認できます。

計算ロジックを変更する場合は、既存スプレッドシートとの一致を保つゴールデンテストを必ず更新・実行してください。DB には金額を円単位で保存し、単位変換や丸めを画面ごとに再実装しないことを前提にしています。

## 設計資料

- [プロダクトブリーフ](_bmad-output/planning-artifacts/product-brief-StockManagement-2026-03-03.md)
- [アーキテクチャ決定書](_bmad-output/planning-artifacts/architecture.md)
- [コードベース監査レポート](docs/code-audit-2026-06-13.md)
- [開発エージェント向け規約](AGENTS.md)
