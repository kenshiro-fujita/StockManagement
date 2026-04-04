/**
 * ユーザープロフィール更新の Server Actions
 *
 * Supabase Auth の updateUser はサーバーサイドで実行することで、
 * セッション管理の問題を回避し、確実に動作させる。
 */
'use server';

import { createClient } from '@/lib/supabase/server';

/** 表示名を更新する */
export async function updateDisplayName(
  displayName: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { display_name: displayName },
  });

  if (error) {
    console.error('updateDisplayName failed:', error);
    return { success: false, error: `表示名の更新に失敗しました: ${error.message}` };
  }
  return { success: true };
}

/** パスワードを変更する */
export async function updatePassword(
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 8) {
    return { success: false, error: '新しいパスワードは8文字以上にしてください' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error('updatePassword failed:', error);
    return { success: false, error: `パスワードの変更に失敗しました: ${error.message}` };
  }
  return { success: true };
}

/** メールアドレスを変更する */
export async function updateEmail(
  newEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    email: newEmail,
  });

  if (error) {
    console.error('updateEmail failed:', error);
    return { success: false, error: `メールアドレスの変更に失敗しました: ${error.message}` };
  }
  return { success: true };
}
