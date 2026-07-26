import { z } from 'zod';

/** パスワードの最小文字数（登録・変更で共有し、二重定義によるズレを防ぐ） */
export const PASSWORD_MIN_LENGTH = 8;

/** パスワード単体のスキーマ（サインアップとパスワード変更で共有） */
export const passwordSchema = z
  .string()
  .min(1, 'パスワードを入力してください')
  .min(
    PASSWORD_MIN_LENGTH,
    `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`
  );

/**
 * メールアドレス単体のスキーマ。
 * 「未入力」と「形式エラー」で別メッセージを出すため、min(1) の後に
 * Zod v4 のトップレベル z.email() へ pipe する
 */
export const emailSchema = z
  .string()
  .min(1, 'メールアドレスを入力してください')
  .pipe(z.email('有効なメールアドレスを入力してください'));

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'パスワード（確認）を入力してください'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'パスワードを入力してください'),
});

export type LoginInput = z.infer<typeof loginSchema>;
