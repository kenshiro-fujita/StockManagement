# Story 1.3: ユーザーログイン・ログアウトとセッション管理

Status: done

## Story

As a 登録済みユーザー,
I want メールアドレスとパスワードでログイン・ログアウトしたい,
so that 安全に自分のデータにアクセスでき、使い終わったらログアウトできる。（FR34）

## Acceptance Criteria

1. **AC1: ログイン成功フロー**
   - Given 登録済みユーザーがログインページにアクセスする
   - When 正しい認証情報を入力して送信する
   - Then Cookie ベースのセッションが作成され、ダッシュボード（`/stocks`）にリダイレクトされる

2. **AC2: ログイン失敗時のエラー表示**
   - Given 誤った認証情報を入力する
   - When フォームを送信する
   - Then 「メールアドレスまたはパスワードが正しくありません」と表示される（具体的にどちらが間違いかは漏らさない）

3. **AC3: ログアウト**
   - Given ログイン済みのユーザーがアプリを使用している
   - When ログアウトボタンをクリックする
   - Then セッションが破棄され、ログインページにリダイレクトされる

4. **AC4: 未認証アクセスのリダイレクト**
   - Given 未認証のユーザーが保護されたページにアクセスする
   - When URLを直接入力する
   - Then ログインページにリダイレクトされる

5. **AC5: フォームバリデーション（onBlur + aria-describedby）**
   - Given ユーザーがログインフォームを表示している
   - When 無効なメールアドレスまたは空のパスワードを入力する
   - Then onBlur でバリデーションエラーが表示され、aria-describedby でエラーメッセージが関連付けられる

6. **AC6: キーボード操作**
   - Given ログインフォームが表示されている
   - When キーボードのみで操作する
   - Then すべてのフォーム要素にフォーカスが移動でき、Tab/Enter で操作が完了できる

## Tasks / Subtasks

- [x] Task 1: ログインフォームの日本語化と RHF + Zod 移行 (AC: #1, #2, #5, #6)
  - [x] 1.1 Zod バリデーションスキーマの追加（`src/lib/schemas/auth.ts` に `loginSchema` を追加）
    - email: 有効なメールアドレス形式
    - password: 必須（min(1)）— ログインではパスワード長チェック不要
  - [x] 1.2 `login-form.tsx` をリファクタリング:
    - React Hook Form + Zod resolver に移行（`mode: 'onBlur'`）
    - shadcn/ui `<Form>` コンポーネントに置き換え（`aria-describedby` 自動設定）
    - UI テキストを日本語化（ラベル、エラーメッセージ、ボタン）
    - リダイレクト先を `/protected` → `/stocks` に修正
    - サーバーエラーメッセージを日本語にマッピング（セキュリティ考慮: 汎用メッセージ使用）
  - [x] 1.3 ログインページのリンクテキストを日本語化

- [x] Task 2: ログアウト機能の実装 (AC: #3)
  - [x] 2.1 `src/components/logout-button.tsx` を更新
    - `supabase.auth.signOut()` を呼び出す
    - ログアウト後 `/auth/login` にリダイレクト
    - ボタンテキスト: 「ログアウト」、ローディング状態追加
  - [x] 2.2 ログアウトボタンの仮配置（`/stocks` ページ）
    - **注意**: Story 1.4 でアプリシェル（サイドバー）に正式配置されるため、現時点では `/stocks` ページに仮配置

- [x] Task 3: パスワードリセットページの日本語化 (AC: #1)
  - [x] 3.1 `forgot-password-form.tsx` の日本語化
    - UI テキストを日本語化
    - エラーメッセージを日本語にマッピング
  - [x] 3.2 `update-password-form.tsx` の日本語化

- [x] Task 4: 未認証リダイレクトの確認 (AC: #4)
  - [x] 4.1 `proxy.ts` の既存リダイレクトロジックが正しく動作することを確認
    - `/stocks` → 未認証の場合 `/auth/login` にリダイレクト
    - `/auth/*` → 認証不要
  - [x] 4.2 ビルド確認（`npm run build`）— 成功

- [x] Task 5: テスト (AC: #1, #2, #5)
  - [x] 5.1 `loginSchema` のユニットテスト（`src/lib/schemas/auth.test.ts` に追加）
    - 有効なデータの通過
    - 空のメールアドレスの拒否
    - 無効なメールアドレスの拒否
    - 空のパスワードの拒否
    - 短いパスワードの受け付け（ログインでは長さチェック不要）
  - [x] 5.2 全テスト実行確認 — 13テスト全パス

- [x] Task 6: 動作確認 (AC: #1, #2, #3, #4, #5, #6)
  - [x] 6.1 Prettier フォーマット適用
  - [x] 6.2 ESLint チェック通過確認

## Dev Notes

### スターターテンプレートの既存ファイル活用

Story 1.1 で `create-next-app --example with-supabase` から以下のファイルが既に配置されている。**これらをゼロから作り直すのではなく、リファクタリングして拡張する**こと：

| ファイル | 状態 | 対応方針 |
|---------|------|---------|
| `src/components/login-form.tsx` | 存在（useState ベース、英語） | RHF + Zod に移行、日本語化 |
| `src/app/auth/login/page.tsx` | 存在 | **変更不要** — LoginForm をレンダリングするだけ |
| `src/components/forgot-password-form.tsx` | 存在（useState ベース、英語） | 日本語化 |
| `src/app/auth/forgot-password/page.tsx` | 存在 | **変更不要** |
| `src/app/auth/update-password/page.tsx` | 存在 | 日本語化（update-password-form.tsx があれば） |
| `src/middleware.ts` | 存在（Story 1.2 で作成） | **変更不要** |
| `src/lib/supabase/proxy.ts` | 存在 | **変更不要** — 未認証リダイレクトロジック |
| `src/lib/supabase/client.ts` | 存在 | **変更不要** |
| `src/lib/schemas/auth.ts` | 存在（Story 1.2 で作成） | `loginSchema` を追加 |

### Story 1.2 で確立されたパターン（必ず踏襲すること）

```typescript
// React Hook Form + Zod パターン
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm<LoginInput>({
  resolver: zodResolver(loginSchema),
  mode: 'onBlur',
  defaultValues: { email: '', password: '' },
});
```

```typescript
// shadcn/ui Form コンポーネント（aria-describedby 自動設定）
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField control={form.control} name="email" render={({ field }) => (
      <FormItem>
        <FormLabel>メールアドレス</FormLabel>
        <FormControl><Input type="email" {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  </form>
</Form>
```

```typescript
// Supabase エラー日本語マッピングパターン（Story 1.2 コードレビューで確立）
function getJapaneseErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'エラーが発生しました';
  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
    // ... 他のエラー
  };
  return errorMap[message] ?? 'ログインに失敗しました';
}
```

### ログインスキーマ設計

```typescript
// src/lib/schemas/auth.ts に追加
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('有効なメールアドレスを入力してください'),
  password: z
    .string()
    .min(1, 'パスワードを入力してください'),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

**注意**: ログインではパスワード長のバリデーション（min(8)）は不要。既に登録済みのパスワードであるため、フロントでの長さチェックは不要。

### ログインエラーのセキュリティ考慮

Supabase Auth は `"Invalid login credentials"` という汎用メッセージを返す。これはセキュリティ上の正しい設計（メールアドレスの存在/不存在を漏らさない）。

**重要**: エラーメッセージを「メールアドレスが見つかりません」「パスワードが間違っています」のように詳細にしてはいけない。常に「メールアドレスまたはパスワードが正しくありません」と汎用メッセージを使用すること。

### ログアウトの実装

```typescript
// src/components/logout-button.tsx
'use client';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  };
  return <button onClick={handleLogout}>ログアウト</button>;
}
```

**注意**: Story 1.4 でアプリシェル（サイドバー）が実装される際に正式配置される。Story 1.3 では `/stocks` ページに仮配置して AC3 の動作確認ができるようにする。

### ログイン後のリダイレクト先

スターターの `login-form.tsx` は `router.push('/protected')` だが、`/protected` は Story 1.1 で削除済み。`/stocks` に変更する。

```typescript
router.push('/stocks');
```

### proxy.ts のリダイレクトロジック（既存・変更不要）

`proxy.ts` の `updateSession()` は以下のパスを認証不要として扱う：
- `/` — ルート
- `/login` から始まるパス
- `/auth` から始まるパス（ログイン、サインアップ、パスワードリセット等）

それ以外のパスは未認証の場合 `/auth/login` にリダイレクトされる。AC4 はこのロジックにより既に動作する。

### パスワードリセットフローの全体像

```
1. ユーザーがログインページで「パスワードをお忘れですか？」をクリック
2. forgot-password ページでメールアドレスを入力
3. Supabase Auth がパスワードリセットメールを送信
4. ユーザーがメール内のリンクをクリック
5. update-password ページで新しいパスワードを入力
6. パスワード更新後、ログインページにリダイレクト
```

### アクセシビリティ要件（CLAUDE.md 準拠）

PRでのセルフチェック項目：
1. **キーボード操作**: Tab でフォームフィールド間を移動、Enter で送信
2. **フォーカス可視**: すべてのインタラクティブ要素にフォーカスリングが表示される
3. **フォームエラーの読み上げ**: `aria-describedby` でエラーメッセージがフィールドに関連付けられる
4. **セマンティック HTML**: `<form>`, `<label>`, `<button>` を正しく使用

### コードパターン（Story 1.1-1.2 で確立済み）

- **インポート**: `@` パスエイリアス
- **ファイル命名**: ケバブケース
- **Zod → TypeScript 型**: `type LoginInput = z.infer<typeof loginSchema>`
- **フォーマッター**: Prettier + Tailwind CSS プラグイン（`npm run format`）
- **テスト**: Vitest（`vitest.config.mts`, `src/**/*.test.{ts,tsx}`）
- **エラー表示**: `role="alert"` 付き `<p>` タグ

### Project Structure Notes

- `src/lib/schemas/auth.ts` — `loginSchema` を追加（既存の `signUpSchema` と同じファイル）
- `src/lib/schemas/auth.test.ts` — `loginSchema` のテストを追加
- `src/components/login-form.tsx` — RHF + Zod に移行、日本語化
- `src/components/logout-button.tsx` — **新規作成**
- `src/components/forgot-password-form.tsx` — 日本語化
- `src/app/auth/update-password/page.tsx` — 日本語化

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 1.3 Acceptance Criteria, FR34]
- [Source: _bmad-output/planning-artifacts/architecture.md — Supabase Auth Cookie ベース認証]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — onBlur バリデーション、aria-describedby、キーボード操作]
- [Source: _bmad-output/implementation-artifacts/1-2-user-registration-signup.md — RHF + Zod パターン、エラー日本語マッピング]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

なし

### Completion Notes List

- loginSchema を auth.ts に追加（パスワード長チェックなし、min(1)のみ）
- login-form.tsx を RHF + Zod + shadcn/ui Form に全面リファクタリング、日本語化完了
- logout-button.tsx は既存スターターテンプレートを更新（新規作成ではなく）、ローディング状態追加
- forgot-password-form.tsx と update-password-form.tsx を日本語化、エラー表示を text-destructive + role="alert" に統一
- proxy.ts の未認証リダイレクトロジックは既存のまま正常動作を確認
- loginSchema のユニットテスト5件追加（合計13テスト全パス）
- ビルド成功、Prettier/ESLint クリア

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-10 | Initial story creation | Story 1.3 context engine analysis |
| 2026-03-10 | Implementation complete | All tasks 1-6 completed |
| 2026-03-10 | Code review fixes | 3 issues fixed: Japanese error mapping for forgot-password/update-password, logout error handling |

### File List

| ファイル | 変更種別 |
|---------|---------|
| `src/lib/schemas/auth.ts` | 変更（loginSchema, LoginInput 追加） |
| `src/lib/schemas/auth.test.ts` | 変更（loginSchema テスト5件追加） |
| `src/components/login-form.tsx` | 変更（RHF + Zod 移行、日本語化） |
| `src/components/logout-button.tsx` | 変更（日本語化、ローディング状態追加） |
| `src/components/forgot-password-form.tsx` | 変更（日本語化） |
| `src/components/update-password-form.tsx` | 変更（日本語化、リダイレクト先修正） |
| `src/app/stocks/page.tsx` | 変更（LogoutButton 仮配置） |
