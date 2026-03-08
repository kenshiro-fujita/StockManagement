# Story 1.1: プロジェクトスキャフォールドと開発ツール基盤

Status: review

## Story

As a 開発者,
I want プロジェクトの技術基盤（Next.js + Supabase + shadcn/ui）が初期化され、CI/CDパイプラインが動作する状態にしたい,
so that 以降のすべてのストーリーを安全かつ効率的に実装できる。

## Acceptance Criteria

1. **AC1: プロジェクト初期化**
   - Given プロジェクトリポジトリが存在する
   - When `create-next-app --example with-supabase` と `npx shadcn@latest init` を実行する
   - Then Next.js + Supabase + shadcn/ui のプロジェクトが生成される
   - And ディレクトリ構成が architecture.md に準拠している（src/app/, src/components/ui/, src/lib/, src/actions/）

2. **AC2: CI/CD パイプライン**
   - Given プロジェクトがセットアップされている
   - When GitHub にプッシュする
   - Then GitHub Actions CI が実行され、型チェック + ESLint + ビルドが通る

3. **AC3: フォーマッター設定**
   - Given 開発環境が構築されている
   - When コードを編集して保存する
   - Then Prettier + Tailwind CSS プラグインによってフォーマットされる

4. **AC4: 環境変数テンプレート**
   - Given 新しい開発者がプロジェクトをクローンする
   - When `.env.example` を参照する
   - Then 必要な環境変数（NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY）が確認できる

## Tasks / Subtasks

- [x] Task 1: プロジェクト初期化 (AC: #1)
  - [x] 1.1 既存の _bmad 関連ファイルをバックアップ（退避）
  - [x] 1.2 `npx create-next-app --example with-supabase .` を実行（現在のディレクトリに展開）
  - [x] 1.3 `npx shadcn@latest init` を実行（shadcn/ui 初期化）
  - [x] 1.4 _bmad 関連ファイルを復元
  - [x] 1.5 不要なスターターファイルを整理（デモページ等の削除）
- [x] Task 2: ディレクトリ構造の整備 (AC: #1)
  - [x] 2.1 Architecture 準拠のディレクトリを作成（src/components/stocks/, src/components/layout/, src/lib/calc/, src/lib/supabase/, src/lib/schemas/, src/lib/types/, src/actions/, src/utils/）
  - [x] 2.2 app/(auth)/ ルートグループを作成
  - [x] 2.3 app/stocks/ ディレクトリを作成
- [x] Task 3: 開発ツール設定 (AC: #3)
  - [x] 3.1 Prettier + prettier-plugin-tailwindcss をインストール・設定
  - [x] 3.2 .prettierrc を作成
  - [x] 3.3 ESLint 設定の確認（スターター付属の設定を利用）
- [x] Task 4: テストフレームワーク設定 (AC: #2)
  - [x] 4.1 Vitest をインストール・設定（vitest.config.mts）
  - [x] 4.2 `@` パスエイリアスの Vitest 対応
  - [x] 4.3 サンプルテスト作成（セットアップ確認用）
- [x] Task 5: CI/CD パイプライン (AC: #2)
  - [x] 5.1 `.github/workflows/ci.yml` を作成
  - [x] 5.2 ステップ: tsc --noEmit → ESLint → Vitest → Next.js build
  - [x] 5.3 Node.js バージョン指定（LTS）
- [x] Task 6: 環境変数とドキュメント (AC: #4)
  - [x] 6.1 `.env.example` を作成（NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY）
  - [x] 6.2 `.env.local` が `.gitignore` に含まれていることを確認
- [x] Task 7: shadcn/ui 基盤コンポーネントのインストール
  - [x] 7.1 Phase 1 で必要なコンポーネントを一括インストール: Button, Card, Dialog, Form, Input, Select, Badge, Tooltip, Tabs, Table, NavigationMenu, Sheet, Slider, Sonner
- [x] Task 8: Tailwind CSS テーマ設定
  - [x] 8.1 フォント設定: Source Sans 3（EN）, Noto Sans JP（JA）, system-ui fallback
  - [x] 8.2 カラーパレット: teal（primary）, amber/coral（accent）, semantic colors
  - [x] 8.3 スペーシング: 8px ベースユニット（Tailwind デフォルト互換）
  - [x] 8.4 タイポグラフィ: type scale（h1: 1.875rem 〜 caption: 0.75rem）、tabular-nums
- [x] Task 9: 動作確認
  - [x] 9.1 `npm run build` でビルド成功確認
  - [x] 9.2 `npx vitest run` でテスト実行確認（3/3 passed）
  - [x] 9.3 Prettier フォーマット確認（npm run format 適用済み）

## Dev Notes

### プロジェクト初期化の注意点

- **スターターテンプレートの選定理由**: `create-next-app --example with-supabase` は Vercel/Supabase 公式メンテナンスで、Supabase Auth（Cookie ベース）+ RLS 連携がプリセット済み。T3 は Prisma/NextAuth が Supabase と競合するため不採用。
- **既存ファイルの保護**: リポジトリには既に `_bmad/`, `_bmad-output/`, `CLAUDE.md`, `.claude/`, `.claudeignore`, `docs/` が存在する。スターター展開時にこれらを破壊しないよう注意すること。
- **src/ ディレクトリ**: スターターは `app/` を直接配置する可能性があるが、Architecture では `src/app/` を採用。`create-next-app` の `--src-dir` オプション、またはスターター展開後に手動で `src/` 配下に移動すること。

### 技術スタック（確定バージョン指針）

| カテゴリ | 技術 | 備考 |
|---------|------|------|
| 言語 | TypeScript | strict mode |
| フレームワーク | Next.js (App Router) | Turbopack（開発時） |
| スタイリング | Tailwind CSS | スターターに含まれる |
| UI | shadcn/ui | Radix UI ベース |
| フォーム | React Hook Form + Zod | 後続ストーリーで使用 |
| テスト | Vitest | Jest 互換 API |
| リンター | ESLint | Next.js 標準設定 |
| フォーマッター | Prettier | + Tailwind CSS プラグイン |
| DB/認証 | Supabase (PostgreSQL + Auth) | Cookie ベース認証 |
| ホスティング | Vercel | 無料枠 |

### ディレクトリ構造（最終形）

```
src/
├── app/
│   ├── (auth)/             # 認証関連ページ（Story 1.2-1.3 で実装）
│   ├── stocks/             # 銘柄関連ページ（Epic 2 で実装）
│   │   └── [id]/           # 銘柄詳細（タブ構成、Epic 3-4 で実装）
│   ├── layout.tsx          # ルートレイアウト
│   └── page.tsx            # ダッシュボード（リダイレクト先）
├── components/
│   ├── ui/                 # shadcn/ui コンポーネント（CLI 生成）
│   ├── stocks/             # 銘柄関連カスタムコンポーネント（後続 Epic で実装）
│   └── layout/             # レイアウトコンポーネント（Story 1.4 で実装）
├── lib/
│   ├── calc/               # 計算エンジン（Epic 4 で実装）
│   ├── supabase/           # Supabase クライアント（スターター提供）
│   ├── schemas/            # Zod スキーマ（Epic 2 以降で追加）
│   └── types/              # TypeScript 型定義
├── actions/                # Server Actions（Epic 2 以降で追加）
└── utils/                  # 汎用ユーティリティ
```

**注意**: このストーリーでは空ディレクトリに `.gitkeep` を配置してディレクトリ構造を Git 管理する。実装コードは後続ストーリーで追加される。

### Tailwind CSS テーマ設計

**フォント設定（tailwind.config.ts）:**
```typescript
fontFamily: {
  sans: ['"Source Sans 3"', '"Noto Sans JP"', 'system-ui', 'sans-serif'],
}
```

**カラーパレット方針:**
- Primary: teal 系（信頼感、フレッシュ、重くない）
- Accent: amber/coral 系（スクリーニングヒット、発見の瞬間）
- Semantic: green（成功）, amber（警告）, red（エラー）, blue（情報）
- WCAG AA コントラスト比: テキスト 4.5:1 以上、大テキスト/UI 3:1 以上

**スペーシング:**
- 8px ベースユニット（Tailwind デフォルト互換）
- コンポーネント間: 24px、セクション間: 48px

**タイポグラフィ:**
- type scale: h1(1.875rem) → h2(1.5rem) → h3(1.25rem) → body(1rem) → data(0.875rem) → caption(0.75rem)
- line-height: body 1.6, data 1.4, headings 1.3
- 数値表示: `tabular-nums`（テーブルでの縦揃え）

### CI/CD パイプライン構成

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit        # 型チェック
      - run: npx eslint .             # リント
      - run: npx vitest run           # テスト
      - run: npm run build            # ビルド確認
```

### Prettier 設定

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### 環境変数

**.env.example:**
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### コードパターン

- **インポート**: `@` パスエイリアス（`import { Button } from '@/components/ui/button'`）
- **ファイル命名**: ケバブケース（`stock-banner.tsx`, `calc-logic-panel.tsx`）
- **Server Actions 戻り値**: `{ success: boolean; error?: string; data?: T }`（後続ストーリー向けの規約）
- **Zod → TypeScript 型**: `type MyType = z.infer<typeof schema>`（後続ストーリー向けの規約）

### Project Structure Notes

- `src/` 配下に全ソースコードを配置する（Next.js の `--src-dir` 相当）
- `app/(auth)/` は Route Group パターンでURLに `(auth)` は含まれない
- `lib/supabase/` にはスターターテンプレートが `server.ts`, `client.ts`, `middleware.ts` を提供する
- `components/ui/` は shadcn/ui CLI が自動生成するディレクトリ

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — スターターテンプレート選定、ディレクトリ構造、技術スタック]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — デザインシステム、タイポグラフィ、カラー、コンポーネント一覧]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 1.1 Acceptance Criteria]
- [Source: _bmad-output/planning-artifacts/prd.md — NFR要件（パフォーマンス、セキュリティ、アクセシビリティ）]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- vitest.config.ts → vitest.config.mts: ESM require() エラー回避のため .mts 拡張子に変更
- shadcn toast → sonner: toast コンポーネントが deprecated のため sonner に変更
- Prettier format: スターターテンプレートの34ファイルにフォーマット適用

### Completion Notes List

- スターターテンプレート（with-supabase）を temp ディレクトリ経由で展開し、既存ファイル（_bmad/, CLAUDE.md, .claude/）を保護した
- src/ ディレクトリ構造に移行（tsconfig.json パスエイリアス、components.json を更新）
- Tailwind CSS テーマ: teal primary + amber accent のカラーパレット、Source Sans 3 + Noto Sans JP フォント、カスタム type scale を設定
- shadcn/ui 14コンポーネント（+ sonner）をインストール済み
- Vitest 3/3 テスト通過、npm run build 成功、Prettier フォーマット適用済み
- CI/CD パイプライン: GitHub Actions でビルド時に placeholder Supabase 環境変数を使用

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-09 | Initial story creation | Sprint planning → first story |
| 2026-03-09 | All tasks implemented | Story 1.1 全9タスク完了 |

### File List

- `.github/workflows/ci.yml` — CI/CD パイプライン
- `.prettierrc` — Prettier 設定
- `.env.example` — 環境変数テンプレート
- `.gitignore` — Git 除外設定（更新）
- `package.json` — 依存関係・スクリプト（更新）
- `tsconfig.json` — TypeScript 設定（パスエイリアス更新）
- `components.json` — shadcn/ui 設定（CSS パス更新）
- `tailwind.config.ts` — Tailwind テーマ設定（フォント、カラー、タイポグラフィ）
- `vitest.config.mts` — Vitest 設定
- `src/app/layout.tsx` — ルートレイアウト
- `src/app/page.tsx` — ダッシュボード（/stocks へリダイレクト）
- `src/app/globals.css` — グローバルCSS（teal テーマ）
- `src/app/stocks/page.tsx` — 銘柄一覧プレースホルダー
- `src/app/stocks/[id]/.gitkeep` — 銘柄詳細ディレクトリ
- `src/app/(auth)/.gitkeep` — 認証ルートグループディレクトリ
- `src/app/auth/**` — Supabase Auth コールバック・認証ページ（スターター提供）
- `src/components/ui/**` — shadcn/ui コンポーネント（14種 + utils）
- `src/components/auth-button.tsx` — 認証ボタン（スターター提供）
- `src/components/stocks/.gitkeep` — 銘柄コンポーネントディレクトリ
- `src/components/layout/.gitkeep` — レイアウトコンポーネントディレクトリ
- `src/lib/supabase/client.ts` — Supabase クライアント（スターター提供）
- `src/lib/supabase/server.ts` — Supabase サーバー（スターター提供）
- `src/lib/calc/.gitkeep` — 計算エンジンディレクトリ
- `src/lib/schemas/.gitkeep` — Zod スキーマディレクトリ
- `src/lib/types/.gitkeep` — TypeScript 型定義ディレクトリ
- `src/lib/utils.ts` — ユーティリティ関数（cn）
- `src/lib/utils.test.ts` — ユーティリティテスト
- `src/actions/.gitkeep` — Server Actions ディレクトリ
- `src/utils/.gitkeep` — 汎用ユーティリティディレクトリ
- `src/middleware.ts` — Next.js ミドルウェア（Supabase セッション更新）
