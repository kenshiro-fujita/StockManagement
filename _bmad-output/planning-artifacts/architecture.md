---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - "prd.md"
  - "product-brief-StockManagement-2026-03-03.md"
  - "ux-design-specification.md"
workflowType: 'architecture'
project_name: 'StockManagement'
user_name: 'Fujita_kenshirou'
date: '2026-03-05'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

Phase 1 のスコープには15の機能要件が含まれる（FR1-4, FR8-12, FR18-23, FR27-28, FR34-35）。アーキテクチャ上、以下の4つの機能グループに分類される：

1. **銘柄管理（FR1-4）**: 銘柄の CRUD 操作と一覧表示。一覧画面で理論株価・主要指標を一目で確認できる必要があるため、効率的なクエリ設計が求められる
2. **財務データ管理（FR8-12）**: 手動入力フォーム、バリデーション、期間属性（年度/四半期、連結/単体）の管理。単位（百万円/千円/円）の混在を安全に扱うデータモデルが重要である
3. **計算エンジン（FR18-23）**: パラメータ管理（ユーザー調整可能 / 自動算出 / 入力値の3分類）、20以上の指標の自動算出、即時再計算。アプリケーションの中核であり、テスト可能な純粋関数として設計する必要がある
4. **透明性（FR27-28）**: すべての計算ロジック（数式・入力参照・端数処理・calc_version）の閲覧機能。計算エンジンのメタデータ出力設計に直結する

Phase 2-4 の拡張（EDINET連携、ロースター管理、AI定性分析）は初期アーキテクチャで接続点を想定しておく必要があるが、過剰な設計は避ける。

**Non-Functional Requirements:**

アーキテクチャ決定に影響する NFR:

| カテゴリ | 要件 | アーキテクチャへの影響 |
|---------|------|---------------------|
| **パフォーマンス** | NFR1: 理論株価算出3秒以内、NFR4: パラメータ変更→再計算1秒以内 | 計算エンジンをクライアントサイドに配置。サーバーラウンドトリップなしの即時計算 |
| **パフォーマンス** | NFR2: 50銘柄一覧1秒以内 | 一覧用のサマリーデータを効率的に取得するクエリ設計 |
| **セキュリティ** | NFR7: Supabase RLS を Phase 1 から有効化 | 全テーブルに RLS ポリシーを設定。認証とデータアクセス制御の基盤 |
| **セキュリティ** | NFR9: OSS公開時にユーザーデータが開発者に渡らない設計 | セルフホスト可能なアーキテクチャ。環境変数でDB接続先を切替可能に |
| **アクセシビリティ** | NFR10-15: WCAG 2.1 Level AA | セマンティックHTML + Radix UI(shadcn/ui)のARIAサポートを活用 |
| **コスト** | Supabase 無料枠（500MB, 50,000行）+ Vercel 無料枠 | ワイドテーブル設計で行数を最小化。バンドルサイズの最適化 |

**Scale & Complexity:**

- Primary domain: フルスタック Web アプリケーション（Next.js + Supabase + Vercel）
- Complexity level: Medium
- Estimated architectural components: 6-8（認証、銘柄管理、財務データ管理、計算エンジン、透明性レイヤー、UIコンポーネント群、API Routes、DB層）

### Technical Constraints & Dependencies

1. **コスト制約（月額 ¥0）**: Supabase 無料枠（500MB DB, 50,000行）+ Vercel 無料枠。この制約がデータモデル設計（ワイドテーブル）とインフラ選択を規定する
2. **1人開発（週7-8時間）**: アーキテクチャの過剰な複雑性は避け、理解・メンテナンスが容易な構成にする必要がある
3. **技術スタック（暫定）**: Next.js (App Router) + TypeScript + Supabase + Vercel。学習コストを考慮したスコープ設計が必要である
4. **計算精度**: 既存スプレッドシートとの完全一致が求められる。端数処理・単位変換・期ズレの検証をテストで担保する
5. **Phase 2 でのPython**: EDINET XBRL解析にPythonスクリプトが想定されている。Next.js アプリとの連携方式を事前に考慮しておく必要がある

### Cross-Cutting Concerns Identified

1. **透明性レイヤー**: 全計算指標に対して数式・入力参照・端数処理・calc_version を提供する仕組み。計算エンジンの出力形式とUIの表示パターンの両方に影響する
2. **認証 + RLS**: Supabase Auth でのメール認証 + 全テーブルへの RLS ポリシー適用。すべてのデータアクセスの前提条件となる
3. **単位管理**: 百万円/千円/円の混在。入力時の単位選択、DB保存時の統一、表示時の変換を一貫して管理する仕組みが必要である
4. **期間管理**: 年度/四半期、連結/単体の属性管理。財務データの時系列表示と計算エンジンへの正確な入力に影響する
5. **calc_version 追跡**: 計算ロジックの変更管理。バージョニングにより、過去の計算結果がどのロジックで算出されたかを追跡可能にする
6. **エラーハンドリング**: バリデーション（入力値の妥当性チェック）、前期比異常値検出、外部API障害時のフォールバック。各層で一貫したパターンが必要である

## Starter Template Evaluation

### Primary Technology Domain

フルスタック Web アプリケーション（Next.js + Supabase + Vercel）。PRD・プロダクトブリーフ・UXデザイン仕様のすべてがこの技術スタックを前提としている。

### Starter Options Considered

| スターター | 概要 | 適合性 |
|-----------|------|--------|
| **`create-next-app --example with-supabase`** | Vercel/Supabase 公式テンプレート。App Router + Cookie ベース認証 + Supabase クライアント | ✅ 最適 |
| **`create-t3-app`** | T3 Stack（Next.js + tRPC + Prisma + NextAuth）。GitHub 30,000+ Stars | ❌ Prisma/NextAuth が Supabase と競合。過剰な構成 |
| **`supa-next-starter`** | コミュニティテンプレート。Next.js + Supabase + Tailwind + shadcn/ui | △ 構成は理想的だが、個人メンテナンスで継続性に不安 |

### Selected Starter: `create-next-app --example with-supabase` + shadcn/ui

**Rationale for Selection:**

1. Vercel/Supabase 公式メンテナンスで長期的な信頼性が高い
2. Supabase Auth（Cookie ベース）が正しくセットアップされており、RLS との連携が確実である
3. 最小限の構成から始められるため、1人開発で把握しやすい
4. shadcn/ui は CLI 一発で追加可能であり、追加の手間はほぼない
5. T3 のように不要な依存（Prisma, NextAuth）を持ち込まない

**Initialization Command:**

```bash
npx create-next-app --example with-supabase stock-management
cd stock-management
npx shadcn@latest init
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript（strict mode）、Node.js ランタイム

**Styling Solution:**
- Tailwind CSS（スターターに含まれる）+ shadcn/ui（Radix UI ベース、CLI で追加）

**Build Tooling:**
- Turbopack（開発時、Next.js 16 のデフォルト）、Next.js built-in（本番ビルド）

**Testing Framework:**
- スターターには含まれない。アーキテクチャ決定ステップで選定する

**Code Organization:**
- Next.js App Router 規約（app/ ディレクトリ、Server Components デフォルト）
- Supabase クライアントユーティリティ（utils/supabase/）
- 認証ミドルウェア（middleware.ts）

**Development Experience:**
- HMR（Turbopack による高速リロード）
- TypeScript LSP によるエディタ支援
- ESLint（Next.js 推奨設定）

**Note:** プロジェクト初期化はこのコマンドを使用する最初の実装ストーリーとする。

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- データモデリング（ワイドテーブル + 円統一保存）
- データアクセスパターン（Server Components + Server Actions）
- 計算エンジンの配置（クライアントサイド純粋関数）
- 認証 + RLS（Supabase Auth + user_id ベース RLS）

**Important Decisions (Shape Architecture):**
- バリデーション（Zod）
- フォームハンドリング（React Hook Form + Zod）
- テスティング（Vitest）
- プロジェクト構造（機能ドメイン別）
- CI/CD（GitHub Actions）

**Deferred Decisions (Post-MVP):**
- クライアントサイドキャッシュ（React Query / SWR）— Phase 2 でリアルタイム性が必要になった場合に検討する
- EDINET Python スクリプトの連携方式 — Phase 2 で決定する
- 国際化（i18n）— Phase 5 以降で検討する

### Data Architecture

**データモデリング:**
- ワイドテーブル設計（1期=1行、指標を列で保持）。Supabase 無料枠の行数制約（50,000行）下で銘柄数を最大化するための方針である
- テーブル構成: `stocks`（銘柄マスタ）、`financial_data`（財務データ、1期=1行）、`parameters`（銘柄ごとのユーザー調整パラメータ）
- 全テーブルに `user_id` カラムを持たせ、RLS で認証済みユーザーの自身のデータのみアクセス可能とする

**単位保存方式:**
- **円に統一して保存する**。入力時にフロントエンドで単位変換し、DB には常に「円」で格納する
- 入力時の元単位（百万円/千円/円）はメタデータとして `input_unit` カラムに保存し、表示時の参照・再編集時の復元に使用する
- 計算エンジンは「常に円で受け取る」ことが保証されるため、計算ロジックがシンプルになる

**バリデーション:**
- **Zod** をスキーマバリデーションライブラリとして採用する
- フォーム入力値の型安全性確保、Server Actions でのサーバーサイドバリデーション、DB 保存前のデータ整合性チェックに使用する
- TypeScript の型推論と統合し、フロントエンド〜バックエンドで一貫した型定義を実現する

**マイグレーション:**
- **Supabase CLI 標準マイグレーション**（`supabase migration new`）を使用する
- SQL ベースのマイグレーションファイルを Git 管理し、スキーマ変更の追跡と再現性を確保する

### Authentication & Security

**認証方式:**
- Supabase Auth（Cookie ベース）。スターターテンプレートでプリセット済み
- Phase 1 はメール認証のみ。OAuth 等の追加は Phase 2 以降で検討する

**RLS ポリシー:**
- 全テーブルに共通パターンを適用する: `USING (auth.uid() = user_id)`
- Phase 1 は個人利用だが、OSS 公開（Phase 5）を見据えて初期からマルチユーザー対応の RLS を設定する
- RLS ポリシーは `supabase/migrations/` 内の SQL ファイルで管理する

**API セキュリティ:**
- Server Actions は Next.js の CSRF 保護が組み込まれている
- Supabase クライアントは `@supabase/ssr` を使用し、サーバーサイドで認証済みクライアントを生成する
- 環境変数（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`）で DB 接続先を切替可能にし、OSS 公開時のセルフホストに対応する

### API & Communication Patterns

**データアクセスパターン:**
- **読み取り**: Server Components 内で直接 Supabase クライアントを呼び出す。サーバーサイドで認証済みクライアントを生成し、RLS を通してデータを取得する
- **書き込み**: Server Actions を使用する。フォーム送信やデータの作成・更新・削除は Server Actions 経由で Supabase に書き込む
- **外部API連携**: API Routes を使用する（Phase 2 以降、EDINET 連携で必要になった場合）

**データ再取得:**
- Server Actions 内で `revalidatePath` を呼び出し、関連する Server Components を再レンダリングさせる
- Phase 1 ではクライアントサイドのキャッシュライブラリ（React Query / SWR）は導入しない。Phase 2 以降でリアルタイム性が必要になった場合に検討する

**エラーハンドリング:**
- Server Actions はエラーオブジェクトを返す統一パターンを採用する（`{ success: boolean; error?: string; data?: T }`）
- フロントエンドでは Toast 通知（shadcn/ui）でユーザーにフィードバックする
- バリデーションエラーは Zod のエラーメッセージを `aria-describedby` 経由でフォームフィールドに紐付ける

### Frontend Architecture

**計算エンジン:**
- クライアントサイドに配置する。`lib/calc/` ディレクトリに純粋な TypeScript 関数として実装する
- サーバー/クライアントの両方で使用可能（Server Components での初回計算 + クライアントでのパラメータ変更時の即時再計算）
- 各計算関数は結果値だけでなく透明性メタデータ（数式文字列、入力参照、端数処理ルール、calc_version）も返す
- テスト可能な純粋関数として設計し、Vitest でゴールデンテスト（1銘柄×3期）を実行する

**フォームハンドリング:**
- **React Hook Form + Zod** を使用する。shadcn/ui の Form コンポーネントがこの組み合わせを前提としている
- 財務データ入力フォーム（20以上のフィールド）の状態管理、バリデーション、エラー表示を統合的に扱う

**状態管理:**
- グローバル状態管理ライブラリは導入しない。Server Components でのデータフェッチ + React の useState/useReducer で十分対応できる
- パラメータ調整時の即時再計算は、コンポーネントローカルの state で管理する

**プロジェクト構造:**

```
src/
├── app/                    # ルーティング（App Router）
│   ├── (auth)/             # 認証関連ページ（ログイン、サインアップ）
│   ├── stocks/             # 銘柄関連ページ
│   │   ├── [id]/           # 銘柄詳細（タブ構成: 概要/理論株価/財務データ/パラメータ）
│   │   └── page.tsx        # 銘柄一覧
│   ├── layout.tsx          # ルートレイアウト（サイドバー含む）
│   └── page.tsx            # ダッシュボード
├── components/
│   ├── ui/                 # shadcn/ui コンポーネント（CLI で生成）
│   ├── stocks/             # 銘柄関連カスタムコンポーネント
│   │   ├── stock-banner.tsx
│   │   ├── calc-logic-panel.tsx
│   │   ├── theory-price-summary.tsx
│   │   ├── financial-data-form.tsx
│   │   └── parameter-adjust-panel.tsx
│   └── layout/             # レイアウトコンポーネント（サイドバー等）
├── lib/
│   ├── calc/               # 計算エンジン（純粋関数 + 透明性メタデータ）
│   ├── supabase/           # Supabase クライアント（server/client/middleware）
│   ├── schemas/            # Zod スキーマ定義
│   └── types/              # TypeScript 型定義
├── actions/                # Server Actions
└── utils/                  # 汎用ユーティリティ（単位変換等）
```

### Infrastructure & Deployment

**テスティング:**
- **Vitest** を採用する。TypeScript ネイティブサポート、高速な実行、Jest 互換 API による低い学習コストが利点である
- 最優先: 計算エンジンのユニットテスト（ゴールデンテスト: 1銘柄×3期でスプレッドシートとの一致を検証）
- Phase 1 では E2E テストは実施しない

**CI/CD:**
- **GitHub Actions** を使用する。PR 作成時に以下を自動実行する：
  - TypeScript 型チェック（`tsc --noEmit`）
  - ESLint
  - Vitest（計算エンジンのテスト）
  - Next.js ビルド
- Vercel の GitHub 連携により、`main` ブランチへのマージで自動デプロイする

**フォーマッター / リンター:**
- **ESLint**: Next.js 標準設定（スターターに含まれる）
- **Prettier**: コードフォーマッター + Tailwind CSS プラグイン（クラスの自動並び替え）

**環境設定:**
- `.env.local` に Supabase の接続情報を格納する（Git 管理外）
- Vercel の環境変数設定で本番環境の値を管理する
- `.env.example` をリポジトリに含め、必要な環境変数の一覧を明示する

### Decision Impact Analysis

**Implementation Sequence:**
1. プロジェクト初期化（スターターテンプレート + shadcn/ui + Vitest + Prettier）
2. Supabase セットアップ（テーブル作成、RLS ポリシー、マイグレーション）
3. 認証フロー（ログイン/サインアップ、ミドルウェア）
4. 計算エンジン（純粋関数 + ゴールデンテスト）
5. 銘柄管理 CRUD（Server Components + Server Actions）
6. 財務データ入力フォーム（React Hook Form + Zod）
7. 透明性レイヤー（CalcLogicPanel）
8. レイアウト統合（サイドバー + ストックバナー + タブ構成）

**Cross-Component Dependencies:**
- 計算エンジン → 透明性レイヤー: 計算関数が透明性メタデータを返す設計が前提
- Zod スキーマ → Server Actions + React Hook Form: バリデーションスキーマを共有する
- Supabase クライアント → RLS: すべてのデータアクセスが認証済みクライアント経由であること
- 単位変換ユーティリティ → 財務データ入力フォーム + 計算エンジン: 入力時の変換と計算時の一貫性を保証する
