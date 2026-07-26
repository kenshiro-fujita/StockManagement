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

import type { UserAttributes } from '@supabase/supabase-js';
import { getAuthenticatedContext } from '@/lib/supabase/auth';
import { passwordSchema, emailSchema } from '@/lib/schemas/auth';
import type { ActionResult } from '@/lib/types/action';
import { z } from 'zod';

const displayNameSchema = z
  .string()
  .trim()
  .min(1, '表示名を入力してください')
  .max(50, '表示名は50文字以内で入力してください');

/**
 * 現在の認証ユーザーを更新し、SDK の生エラーをサーバーログへ閉じ込めます。
 */
async function updateCurrentUser(
  attributes: UserAttributes,
  operation: string,
  publicError: string
): Promise<ActionResult> {
  const context = await getAuthenticatedContext();
  if (!context) {
    return { success: false, error: '認証が必要です' };
  }

  const { error } = await context.supabase.auth.updateUser(attributes);
  if (error) {
    console.error(`${operation} failed:`, error);
    return { success: false, error: publicError };
  }

  return { success: true };
}

/** 表示名を更新する */
export async function updateDisplayName(
  displayName: string
): Promise<ActionResult> {
  const parsed = displayNameSchema.safeParse(displayName);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? '入力内容に誤りがあります',
    };
  }

  return updateCurrentUser(
    { data: { display_name: parsed.data } },
    'updateDisplayName',
    '表示名の更新に失敗しました'
  );
}

/** パスワードを変更する */
export async function updatePassword(
  newPassword: string
): Promise<ActionResult> {
  // 文字数ルールは schemas/auth の passwordSchema を共有（サインアップとズレないように）
  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'パスワードが不正です',
    };
  }

  return updateCurrentUser(
    { password: parsed.data },
    'updatePassword',
    'パスワードの変更に失敗しました'
  );
}

/** メールアドレスを変更する */
export async function updateEmail(newEmail: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(newEmail);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'メールアドレスが不正です',
    };
  }

  return updateCurrentUser(
    { email: parsed.data },
    'updateEmail',
    'メールアドレスの変更に失敗しました'
  );
}
