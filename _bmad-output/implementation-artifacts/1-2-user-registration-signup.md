# Story 1.2: ユーザー登録（サインアップ）

Status: ready-for-dev

## Story

As a 新規ユーザー,
I want メールアドレスとパスワードでアカウントを作成したい,
so that 自分専用の銘柄データを管理できるようになる。（FR34）

## Acceptance Criteria

1. **AC1: サインアップ成功フロー**
   - Given 未認証のユーザーがサインアップページにアクセスする
   - When メールアドレスとパスワードを入力して送信する
   - Then Supabase Auth でアカウントが作成され、確認メールが送信される
   - And サインアップ成功ページにリダイレクトされる

2. **AC2: フォームバリデーション（onBlur + aria-describedby）**
   - Given ユーザーがサインアップフォームを表示している
   - When 無効なメールアドレスまたは短すぎるパスワードを入力する
   - Then onBlur でバリデーションエラーが表示され、aria-describedby でエラーメッセージが関連付けられる

3. **AC3: キーボード操作**
   - Given サインアップフォームが表示されている
   - When キーボードのみで操作する
   - Then すべてのフォーム要素にフォーカスが移動でき、Tab/Enter で操作が完了できる

4. **AC4: 登録済みメールアドレスのエラー**
   - Given 既に登録済みのメールアドレスで登録を試みる
   - When フォームを送信する
   - Then 適切なエラーメッセージが表示される

5. **AC5: middleware.ts によるセッション管理基盤**
   - Given アプリにアクセスする
   - When リクエストが処理される
   - Then middleware.ts が updateSession() を呼び出し、Supabase セッション Cookie が正しく管理される

## Tasks / Subtasks

- [ ] Task 1: middleware.ts の作成 (AC: #5)
  - [ ] 1.1 `src/middleware.ts` を作成し、`updateSession()` を呼び出す
  - [ ] 1.2 matcher 設定: `/((?!_next/static|_next/image|favicon.ico).*)` で静的ファイルを除外
  - [ ] 1.3 動作確認（ビルドが通ること、既存テスト通過）

- [ ] Task 2: サインアップフォームの日本語化とバリデーション強化 (AC: #1, #2, #4)
  - [ ] 2.1 Zod バリデーションスキーマの作成（`src/lib/schemas/auth.ts`）
    - email: 有効なメールアドレス形式
    - password: 8文字以上（Supabase Auth デフォルト最小長）
    - confirmPassword: password と一致
  - [ ] 2.2 `sign-up-form.tsx` をリファクタリング:
    - React Hook Form + Zod resolver に移行
    - onBlur バリデーションモードに設定（`mode: 'onBlur'`）
    - 各フィールドに `aria-describedby` でエラーメッセージを関連付け
    - UI テキストを日本語化（ラベル、エラーメッセージ、ボタン）
    - `emailRedirectTo` を `/protected` → `/stocks` に修正
  - [ ] 2.3 サインアップ成功ページの日本語化（`sign-up-success/page.tsx`）

- [ ] Task 3: サインアップページの整備 (AC: #1, #3)
  - [ ] 3.1 `src/app/auth/sign-up/page.tsx` のレイアウト確認
  - [ ] 3.2 ログインページへのリンクテキストを日本語化
  - [ ] 3.3 キーボード操作のセルフチェック（Tab/Enter/Escape）

- [ ] Task 4: エラーページの整備 (AC: #4)
  - [ ] 4.1 `src/app/auth/error/page.tsx` の日本語化（エラーメッセージ表示）
  - [ ] 4.2 エラーページからサインアップ・ログインページへの導線を追加

- [ ] Task 5: テスト (AC: #1, #2, #4)
  - [ ] 5.1 Zod スキーマのユニットテスト（`src/lib/schemas/auth.test.ts`）
    - 有効なメールアドレスの通過
    - 無効なメールアドレスの拒否
    - パスワード8文字未満の拒否
    - パスワード不一致の拒否
  - [ ] 5.2 ビルド確認（`npm run build`）
  - [ ] 5.3 全テスト実行確認（`npm test`）

- [ ] Task 6: 動作確認 (AC: #1, #2, #3, #4, #5)
  - [ ] 6.1 Prettier フォーマット適用
  - [ ] 6.2 ESLint チェック通過確認

## Dev Notes

### スターターテンプレートの既存ファイル活用

Story 1.1 で `create-next-app --example with-supabase` から以下のファイルが既に配置されている。**これらをゼロから作り直すのではなく、リファクタリングして拡張する**こと：

| ファイル | 状態 | 対応方針 |
|---------|------|---------|
| `src/components/sign-up-form.tsx` | 存在（useState ベース） | React Hook Form + Zod に移行、日本語化 |
| `src/app/auth/sign-up/page.tsx` | 存在 | レイアウト微調整のみ |
| `src/app/auth/sign-up-success/page.tsx` | 存在（英語） | 日本語化 |
| `src/app/auth/confirm/route.ts` | 存在 | **変更不要** — メール確認トークン検証 |
| `src/app/auth/error/page.tsx` | 存在 | 日本語化、導線追加 |
| `src/lib/supabase/client.ts` | 存在 | **変更不要** |
| `src/lib/supabase/server.ts` | 存在 | **変更不要** |
| `src/lib/supabase/proxy.ts` | 存在 | **変更不要** — middleware から呼び出す |

### middleware.ts が必要な理由

Story 1.1 のコードレビューで `src/middleware.ts` が欠落していることが発覚した。`proxy.ts` に `updateSession()` が実装されているが、呼び出し元がない。middleware.ts を作成して Supabase セッション Cookie の管理を有効化する。

```typescript
// src/middleware.ts
import { updateSession } from '@/lib/supabase/proxy';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

### Zod スキーマ設計

```typescript
// src/lib/schemas/auth.ts
import { z } from 'zod';

export const signUpSchema = z
  .object({
    email: z.string().email('有効なメールアドレスを入力してください'),
    password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
```

### React Hook Form + Zod の統合パターン

スターターの `sign-up-form.tsx` は `useState` でフォーム状態を管理している。これを以下のパターンに移行する：

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema, type SignUpInput } from '@/lib/schemas/auth';

const form = useForm<SignUpInput>({
  resolver: zodResolver(signUpSchema),
  mode: 'onBlur', // フォーカスが外れた時にバリデーション
  defaultValues: { email: '', password: '', confirmPassword: '' },
});
```

**重要**: shadcn/ui の `<Form>` コンポーネントは React Hook Form を前提としている。`<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` を使用すると `aria-describedby` が自動的に設定される。

### emailRedirectTo の修正

スターターのサインアップフォームでは `emailRedirectTo` が `/protected` に設定されている。このプロジェクトでは `/protected` は削除済みなので、`/stocks` に変更する：

```typescript
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/confirm`,
  },
});
```

**注意**: `emailRedirectTo` は確認メール内のリンク先。Supabase Auth は確認後に `auth/confirm` Route Handler にリダイレクトし、そこから最終的に `/` (= `/stocks`) にリダイレクトされる。

### Supabase Auth のメール確認フロー

```
1. ユーザーがサインアップフォームを送信
2. Supabase Auth がアカウントを作成、確認メールを送信
3. アプリは sign-up-success ページにリダイレクト
4. ユーザーがメール内のリンクをクリック
5. リンクは auth/confirm Route Handler に到着（token_hash + type パラメータ付き）
6. Route Handler が supabase.auth.verifyOtp() でトークンを検証
7. 検証成功 → / にリダイレクト（→ /stocks にリダイレクト）
8. 検証失敗 → auth/error ページにリダイレクト
```

### proxy.ts のリダイレクトロジック

`proxy.ts` の `updateSession()` は以下のパスを認証不要として扱う：
- `/` — ルート（/stocks にリダイレクト）
- `/login` から始まるパス
- `/auth` から始まるパス（サインアップ、ログイン、確認、エラーすべて）

それ以外のパスは未認証の場合 `/auth/login` にリダイレクトされる。

### コードパターン（Story 1.1 で確立済み）

- **インポート**: `@` パスエイリアス（`import { Button } from '@/components/ui/button'`）
- **ファイル命名**: ケバブケース
- **Zod → TypeScript 型**: `type SignUpInput = z.infer<typeof signUpSchema>`
- **フォーマッター**: Prettier + Tailwind CSS プラグイン（`npm run format`）
- **テスト**: Vitest（`vitest.config.mts`, `src/**/*.test.{ts,tsx}`）

### Supabase プロジェクトの前提

このストーリーの動作確認には **Supabase プロジェクトのセットアップ** が必要。`.env.local` に以下が設定されていること：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Supabase ダッシュボードで **メール認証** が有効になっていること（デフォルトで有効）。

### アクセシビリティ要件（CLAUDE.md 準拠）

PRでのセルフチェック項目：
1. **キーボード操作**: Tab でフォームフィールド間を移動、Enter で送信
2. **フォーカス可視**: すべてのインタラクティブ要素にフォーカスリングが表示される
3. **フォームエラーの読み上げ**: `aria-describedby` でエラーメッセージがフィールドに関連付けられる
4. **セマンティック HTML**: `<form>`, `<label>`, `<button>` を正しく使用

### Project Structure Notes

- `src/lib/schemas/auth.ts` — **新規作成**（Zod スキーマ）
- `src/lib/schemas/auth.test.ts` — **新規作成**（テスト）
- `src/middleware.ts` — **新規作成**
- `src/components/sign-up-form.tsx` — **リファクタリング**（RHF + Zod 移行、日本語化）
- `src/app/auth/sign-up-success/page.tsx` — **日本語化**
- `src/app/auth/error/page.tsx` — **日本語化**

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 1.2 Acceptance Criteria, FR34]
- [Source: _bmad-output/planning-artifacts/architecture.md — Supabase Auth Cookie ベース認証、Zod バリデーション、React Hook Form]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — onBlur バリデーション、aria-describedby、キーボード操作、フォームパターン]
- [Source: _bmad-output/implementation-artifacts/1-1-project-scaffold-dev-tooling.md — 既存ディレクトリ構造、コードパターン、shadcn/ui コンポーネント]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-09 | Initial story creation | Story 1.2 context engine analysis |

### File List
