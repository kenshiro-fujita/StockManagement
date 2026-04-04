/**
 * 設定画面フォーム
 * - APIキー設定（EDINET / ANTHROPIC）
 * - パスワード変更
 */
'use client';

import { useState } from 'react';
import { Key, Lock, Eye, EyeOff, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveSetting } from '@/actions/settings';
import { createClient } from '@/lib/supabase/client';

function ApiKeyField({
  label,
  settingKey,
  initialValue,
  placeholder,
  description,
}: {
  label: string;
  settingKey: string;
  initialValue: string;
  placeholder: string;
  description: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [isVisible, setIsVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveSetting(settingKey, value);
    setIsSaving(false);

    if (result.success) {
      toast.success(`${label} を保存しました`);
    } else {
      toast.error(result.error ?? '保存に失敗しました');
    }
  };

  const maskedValue = value ? '•'.repeat(Math.min(value.length, 20)) + value.slice(-4) : '';

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={isVisible ? 'text' : 'password'}
            value={isVisible ? value : maskedValue}
            onChange={(e) => {
              setValue(e.target.value);
              if (!isVisible) setIsVisible(true);
            }}
            onFocus={() => setIsVisible(true)}
            placeholder={placeholder}
            className="pr-10 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setIsVisible(!isVisible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={isVisible ? 'APIキーを隠す' : 'APIキーを表示'}
          >
            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  );
}

function PasswordChangeSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('新しいパスワードは8文字以上にしてください');
      return;
    }
    setIsChanging(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsChanging(false);

    if (error) {
      toast.error('パスワードの変更に失敗しました');
    } else {
      toast.success('パスワードを変更しました');
      setCurrentPassword('');
      setNewPassword('');
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">新しいパスワード</label>
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="8文字以上"
          className="mt-1"
        />
      </div>
      <Button onClick={handleChangePassword} disabled={isChanging} size="sm">
        {isChanging ? '変更中...' : 'パスワードを変更'}
      </Button>
    </div>
  );
}

function UserProfileSection({
  userId,
  email,
  displayName,
}: {
  userId: string;
  email: string;
  displayName: string;
}) {
  const [name, setName] = useState(displayName);
  const [newEmail, setNewEmail] = useState(email);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  const handleSaveName = async () => {
    setIsSavingName(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { display_name: name },
    });
    setIsSavingName(false);
    if (error) {
      toast.error('表示名の更新に失敗しました');
    } else {
      toast.success('表示名を更新しました');
    }
  };

  const handleSaveEmail = async () => {
    setIsSavingEmail(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setIsSavingEmail(false);
    if (error) {
      toast.error('メールアドレスの変更に失敗しました');
    } else {
      toast.success('確認メールを送信しました。メール内のリンクをクリックしてください。');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">ユーザーID</label>
        <Input value={userId} disabled className="mt-1 font-mono text-xs opacity-60" />
        <p className="text-xs text-muted-foreground mt-1">変更できません</p>
      </div>
      <div>
        <label className="text-sm font-medium">表示名</label>
        <div className="flex gap-2 mt-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="表示名を入力" />
          <Button onClick={handleSaveName} disabled={isSavingName} size="sm">
            {isSavingName ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">メールアドレス</label>
        <div className="flex gap-2 mt-1">
          <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <Button onClick={handleSaveEmail} disabled={isSavingEmail || newEmail === email} size="sm" variant="outline">
            {isSavingEmail ? '送信中...' : '変更'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SettingsForm({
  initialSettings,
  userId,
  email,
  displayName,
}: {
  initialSettings: Record<string, string>;
  userId: string;
  email: string;
  displayName: string;
}) {
  return (
    <div className="space-y-8">
      {/* ユーザー情報 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">ユーザー情報</h2>
        </div>
        <div className="rounded-lg border p-4">
          <UserProfileSection userId={userId} email={email} displayName={displayName} />
        </div>
      </section>

      {/* APIキー設定 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">APIキー設定</h2>
        </div>
        <div className="space-y-6 rounded-lg border p-4">
          <ApiKeyField
            label="EDINET APIキー"
            settingKey="edinet_api_key"
            initialValue={initialSettings['edinet_api_key'] ?? ''}
            placeholder="EDINET API Subscription Key"
            description="EDINET から有価証券報告書の財務データを自動取得するために必要です。api.edinet-fsa.go.jp から無料で取得できます。"
          />
          <ApiKeyField
            label="Anthropic APIキー"
            settingKey="anthropic_api_key"
            initialValue={initialSettings['anthropic_api_key'] ?? ''}
            placeholder="sk-ant-..."
            description="AI調査機能（Claude）を利用するために必要です。console.anthropic.com から取得できます。"
          />
        </div>
      </section>

      {/* アカウント設定 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">アカウント設定</h2>
        </div>
        <div className="rounded-lg border p-4">
          <PasswordChangeSection />
        </div>
      </section>
    </div>
  );
}
