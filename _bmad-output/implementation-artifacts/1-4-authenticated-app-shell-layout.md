# Story 1.4: 認証済みアプリシェルとレイアウト

Status: done

## Story

As a ログイン済みユーザー,
I want サイドバー付きのアプリレイアウトを見たい,
so that アプリの全体構造を把握し、今後追加される機能に自然にアクセスできる。（FR35）

## Acceptance Criteria

1. **AC1: サイドバー + メインコンテンツレイアウト**
   - Given ユーザーがログインしている
   - When ダッシュボード（`/stocks`）にアクセスする
   - Then サイドバー（240px固定）+ メインコンテンツ領域のレイアウトが表示される

2. **AC2: サイドバーナビゲーション**
   - Given サイドバーが表示されている
   - When ナビゲーションを確認する
   - Then 「銘柄一覧」へのリンクが表示されている
   - And 銘柄リスト部分は「銘柄を登録しましょう」の Empty State ガイダンスが表示される

3. **AC3: レスポンシブ対応（サイドバー非表示）**
   - Given ウィンドウ幅が768px以下の場合
   - When ページを表示する
   - Then サイドバーが非表示になり、メインコンテンツが全幅で表示される

4. **AC4: キーボード操作とフォーカス可視**
   - Given アプリシェルが表示されている
   - When キーボードで操作する
   - Then サイドバーのナビゲーション要素にフォーカスが移動でき、フォーカスリングが視認できる

## Tasks / Subtasks

- [x] Task 1: shadcn/ui Sidebar コンポーネントの導入 (AC: #1, #3)
  - [x] 1.1 `npx shadcn@latest add sidebar` で Sidebar コンポーネントをインストールする
  - [x] 1.2 インストール後に生成されるファイル（`src/components/ui/sidebar.tsx` 等）を確認する

- [x] Task 2: アプリシェルレイアウトの実装 (AC: #1, #3)
  - [x] 2.1 `src/app/stocks/layout.tsx` を新規作成する
    - `SidebarProvider` + `SidebarInset` でサイドバー + メインコンテンツの2カラムレイアウトを構成する
    - サイドバー幅: 240px（`--sidebar-width: 15rem`）
    - md(768px) 以下ではサイドバーが非表示（Sheet で開閉）になるようにする
  - [x] 2.2 `src/components/layout/app-sidebar.tsx` を新規作成する
    - shadcn/ui の `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` を使用する
    - Header: アプリ名「StockManagement」を表示する
    - Content: 「銘柄一覧」ナビゲーションリンク（`/stocks` へのリンク、アイコン付き）
    - Content: 銘柄リスト部分に Empty State ガイダンス（「銘柄を登録しましょう」）
    - Footer: ログアウトボタンを配置する（Story 1.3 の `LogoutButton` を移動）
  - [x] 2.3 モバイル用のサイドバートリガー（ハンバーガーメニュー）を配置する
    - `SidebarTrigger` コンポーネントをメインコンテンツ上部に配置する
    - md 以上ではトリガーを非表示にする

- [x] Task 3: /stocks ページの更新 (AC: #1, #2)
  - [x] 3.1 `src/app/stocks/page.tsx` から `LogoutButton` の仮配置を削除する
    - ログアウトボタンはサイドバーの Footer に正式配置されるため、ページからは削除する
  - [x] 3.2 メインコンテンツ部分に銘柄一覧の Empty State を表示する
    - 「銘柄を登録して分析を始めましょう」のガイダンスを表示する
    - **注意**: 銘柄登録機能は Epic 2 で実装するため、現時点ではガイダンステキストのみ

- [x] Task 4: アクセシビリティ対応 (AC: #4)
  - [x] 4.1 セマンティック HTML の確認
    - サイドバー: `<aside>` + `<nav>` を正しく使用する（shadcn/ui Sidebar が自動設定）
    - メインコンテンツ: `<main>` タグで囲む
  - [x] 4.2 キーボード操作の確認
    - Tab キーでサイドバーのナビゲーション要素にフォーカスが移動することを確認する
    - フォーカスリングが視認できることを確認する
    - Enter キーでナビゲーションリンクが動作することを確認する
  - [x] 4.3 アクティブ状態の視覚的フィードバック
    - 現在のページに対応するナビゲーションアイテムをアクティブ状態で表示する（`isActive` プロパティ）

- [x] Task 5: テストとビルド確認 (AC: #1, #2, #3, #4)
  - [x] 5.1 `npm run build` でビルドが通ることを確認する
  - [x] 5.2 Prettier フォーマット適用
  - [x] 5.3 ESLint チェック通過確認

## Dev Notes

### shadcn/ui Sidebar コンポーネントについて

shadcn/ui は公式の Sidebar コンポーネントを提供している。`npx shadcn@latest add sidebar` でインストールすると、以下のファイルが生成される：

- `src/components/ui/sidebar.tsx` — Sidebar 本体（SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger 等のサブコンポーネントを含む）

**重要**: 独自のサイドバーを一からスクラッチで作るのではなく、**必ず shadcn/ui の Sidebar コンポーネントをベースにする**こと。このコンポーネントは以下の機能を内蔵している：

- レスポンシブ対応（md 以下で Sheet に自動切替）
- キーボードナビゲーション
- ARIA 属性の自動設定
- CSS 変数ベースの幅設定（`--sidebar-width`）
- アニメーション付き開閉

### レイアウト構成

```
src/app/stocks/layout.tsx        ← 新規: SidebarProvider でラップ
src/components/layout/app-sidebar.tsx  ← 新規: サイドバー本体
```

```tsx
// src/app/stocks/layout.tsx の構成
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';

export default function StocksLayout({ children }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="...">
          <SidebarTrigger className="md:hidden" />
        </header>
        <main>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

### LogoutButton の移動

Story 1.3 で `/stocks/page.tsx` に仮配置した `LogoutButton` を、サイドバーの Footer に正式配置する。`/stocks/page.tsx` からは削除する。

```tsx
// app-sidebar.tsx の Footer 部分
<SidebarFooter>
  <SidebarMenu>
    <SidebarMenuItem>
      <LogoutButton />
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarFooter>
```

### Empty State デザイン

銘柄リスト部分は Epic 2 まで空の状態が続く。UX Design Specification に準拠した Empty State を表示する：

- サイドバー内: 「銘柄を登録しましょう」のテキスト（`text-muted-foreground` + `text-sm`）
- メインコンテンツ: 「銘柄を登録して分析を始めましょう」のガイダンス

### レスポンシブ戦略

UX Design Specification に準拠：

| ブレークポイント | サイドバー | メインコンテンツ |
|---|---|---|
| `lg` (1024px以上) | 常時表示（240px固定） | フルード幅 |
| `md` (768px〜1023px) | 非表示（Sheet で開閉） | 全幅 |
| `sm` (767px以下) | 非表示（Sheet で開閉） | 全幅 |

shadcn/ui Sidebar の `collapsible="offcanvas"` を使用すると、md 以下で自動的に Sheet（オーバーレイ）に切り替わる。

### アクティブ状態の表示

`SidebarMenuButton` の `isActive` プロパティで現在のページを示す。`usePathname()` で判定する。

```tsx
import { usePathname } from 'next/navigation';

const pathname = usePathname();

<SidebarMenuButton isActive={pathname === '/stocks'} asChild>
  <Link href="/stocks">銘柄一覧</Link>
</SidebarMenuButton>
```

### Story 1.2-1.3 で確立されたコードパターン（踏襲すること）

- **インポート**: `@` パスエイリアス
- **ファイル命名**: ケバブケース
- **'use client'**: クライアントコンポーネントに明示的に記述する
- **フォーマッター**: Prettier + Tailwind CSS プラグイン（`npm run format`）
- **テスト**: Vitest（`vitest.config.mts`）
- **shadcn/ui**: `src/components/ui/` に配置される標準コンポーネントを利用する
- **UI テキスト**: すべて日本語化する

### 既存ファイルへの影響

| ファイル | 影響 |
|---------|------|
| `src/app/stocks/page.tsx` | 変更 — LogoutButton 仮配置を削除 |
| `src/app/layout.tsx` | **変更不要** — ルートレイアウトはそのまま |
| `src/components/logout-button.tsx` | **変更不要** — コンポーネント自体は変更なし |
| `src/app/stocks/layout.tsx` | **新規作成** — サイドバー付きレイアウト |
| `src/components/layout/app-sidebar.tsx` | **新規作成** — サイドバー本体 |

### Project Structure Notes

- `src/components/layout/` ディレクトリは architecture.md で定義済みだが、現時点では空（.gitkeep のみ）。ここに `app-sidebar.tsx` を配置する
- `src/components/stocks/` ディレクトリも空（.gitkeep のみ）。Story 1.4 では使用しない
- `src/app/stocks/[id]/` ディレクトリも空（.gitkeep のみ）。Epic 2 以降で使用する

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 1.4 Acceptance Criteria, FR35]
- [Source: _bmad-output/planning-artifacts/architecture.md — サイドバー240px固定 + メインコンテンツ（フルード）]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — タブ整理型ベース + サイドバー理論株価サマリー、レスポンシブ戦略]
- [Source: _bmad-output/implementation-artifacts/1-3-user-login-logout-session.md — LogoutButton 仮配置の移動が必要]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

なし

### Completion Notes List

- shadcn/ui Sidebar コンポーネントをインストール（sidebar.tsx, separator.tsx, skeleton.tsx, use-mobile.ts が生成）
- サイドバーの CSS 変数をプロジェクトのティールテーマに合わせて更新（globals.css）
- `src/app/stocks/layout.tsx` を新規作成: SidebarProvider + SidebarInset で2カラムレイアウトを構成、サイドバー幅 15rem (240px)
- `src/components/layout/app-sidebar.tsx` を新規作成: ナビゲーション（銘柄一覧リンク）、銘柄リスト Empty State、ログアウトボタンをサイドバーに配置
- モバイル用 SidebarTrigger を md 以下でのみ表示するよう配置
- `/stocks/page.tsx` から LogoutButton 仮配置を削除し、銘柄一覧 Empty State に変更
- アクティブ状態は `usePathname()` + `isActive` プロパティで判定
- ビルド成功、16テスト全パス、Prettier/ESLint クリア

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-10 | Initial story creation | Story 1.4 context engine analysis |
| 2026-03-10 | Implementation complete | All tasks 1-5 completed |
| 2026-03-13 | Code review fixes | 5 issues fixed: dead code removal, isActive startsWith, router.refresh, File List correction |

### File List

| ファイル | 変更種別 |
|---------|---------|
| `src/components/ui/sidebar.tsx` | 新規（shadcn/ui インストール） |
| `src/components/ui/separator.tsx` | 新規（shadcn/ui インストール） |
| `src/components/ui/skeleton.tsx` | 新規（shadcn/ui インストール） |
| `src/hooks/use-mobile.ts` | 新規（shadcn/ui インストール） |
| `src/components/ui/input.tsx` | 変更（shadcn/ui 更新） |
| `src/components/logout-button.tsx` | 削除（サイドバーに統合） |
| `src/components/auth-button.tsx` | 削除（未使用スターターテンプレート残骸） |
| `src/app/globals.css` | 変更（サイドバー CSS 変数をティールテーマに更新） |
| `src/app/stocks/layout.tsx` | 新規（サイドバー付きレイアウト） |
| `src/components/layout/app-sidebar.tsx` | 新規（サイドバー本体） |
| `src/app/stocks/page.tsx` | 変更（LogoutButton 削除、Empty State 更新） |
