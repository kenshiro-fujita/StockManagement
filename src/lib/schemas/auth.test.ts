import { describe, it, expect } from 'vitest';
import { signUpSchema } from './auth';

describe('signUpSchema', () => {
  const validData = {
    email: 'test@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  };

  it('有効なデータを受け付ける', () => {
    const result = signUpSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('空のメールアドレスを拒否する', () => {
    const result = signUpSchema.safeParse({ ...validData, email: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'メールアドレスを入力してください'
      );
    }
  });

  it('無効なメールアドレスを拒否する', () => {
    const result = signUpSchema.safeParse({ ...validData, email: 'invalid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        '有効なメールアドレスを入力してください'
      );
    }
  });

  it('8文字未満のパスワードを拒否する', () => {
    const result = signUpSchema.safeParse({
      ...validData,
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'パスワードは8文字以上で入力してください'
      );
    }
  });

  it('空のパスワードを拒否する', () => {
    const result = signUpSchema.safeParse({
      ...validData,
      password: '',
      confirmPassword: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'パスワードを入力してください'
      );
    }
  });

  it('パスワード不一致を拒否する', () => {
    const result = signUpSchema.safeParse({
      ...validData,
      confirmPassword: 'different123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mismatchError = result.error.issues.find(
        (issue) =>
          issue.path.includes('confirmPassword') &&
          issue.message === 'パスワードが一致しません'
      );
      expect(mismatchError).toBeDefined();
    }
  });

  it('ちょうど8文字のパスワードを受け付ける', () => {
    const result = signUpSchema.safeParse({
      ...validData,
      password: '12345678',
      confirmPassword: '12345678',
    });
    expect(result.success).toBe(true);
  });
});
