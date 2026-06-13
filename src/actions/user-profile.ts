/**
 * ユーザープロフィール更新の Server Actions
 *
 * Supabase Auth の updateUser はサーバーサイドで実行することで、
 * セッション管理の問題を回避し、確実に動作させる。
 *
 * エラー方針: 他アクションと統一し、ユーザーには日本語固定メッセージを返し、
 * プロバイダの生エラー（英語・内部情報）はサーバーログにのみ残す。
 */
'use server';

import { createClient } from '@/lib/supabase/server';
import { passwordSchema, emailSchema } from '@/lib/schemas/auth';
import { z } from 'zod';

const displayNameSchema = z
  .string()
  .trim()
  .min(1, '表示名を入力してください')
  .max(50, '表示名は50文字以内で入力してください');

/** 表示名を更新する */
export async function updateDisplayName(
  displayName: string,
): Promise<{ success: boolean; error?: string }> {
  const parsed = displayNameSchema.safeParse(displayName);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '入力内容に誤りがあります' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { display_name: parsed.data },
  });

  if (error) {
    console.error('updateDisplayName failed:', error);
    return { success: false, error: '表示名の更新に失敗しました' };
  }
  return { success: true };
}

/** パスワードを変更する */
export async function updatePassword(
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  // 文字数ルールは schemas/auth の passwordSchema を共有（サインアップとズレないように）
  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'パスワードが不正です' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data,
  });

  if (error) {
    console.error('updatePassword failed:', error);
    return { success: false, error: 'パスワードの変更に失敗しました' };
  }
  return { success: true };
}

/** メールアドレスを変更する */
export async function updateEmail(
  newEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const parsed = emailSchema.safeParse(newEmail);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'メールアドレスが不正です' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    email: parsed.data,
  });

  if (error) {
    console.error('updateEmail failed:', error);
    return { success: false, error: 'メールアドレスの変更に失敗しました' };
  }
  return { success: true };
}
