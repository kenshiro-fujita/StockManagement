/**
 * 設定画面フォーム
 * - APIキー設定（EDINET / ANTHROPIC）
 * - パスワード変更
 */
'use client';

import { useState } from 'react';
import { Key, Lock, Eye, EyeOff } from 'lucide-react';
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

export function SettingsForm({
  initialSettings,
}: {
  initialSettings: Record<string, string>;
}) {
  return (
    <div className="space-y-8">
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
