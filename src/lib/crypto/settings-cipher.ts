/**
 * ユーザー設定値（APIキー等）の暗号化・復号ユーティリティ
 *
 * user_settings テーブルに機密値を平文で置かないために、
 * AES-256-GCM（認証付き暗号）でアプリ層暗号化してから保存する。
 * DB バックアップ流出や service_role キー漏洩時の被害を限定するのが目的。
 *
 * 保存形式: "enc:v1:<iv(base64)>:<authTag(base64)>:<ciphertext(base64)>"
 * - プレフィックスでバージョン管理し、将来のアルゴリズム変更に備える
 * - プレフィックスが無い値は「暗号化導入前の平文」とみなして後方互換で扱う
 *
 * 鍵は環境変数 SETTINGS_ENCRYPTION_KEY（32バイトを base64 した文字列）。
 * 生成例: `openssl rand -base64 32`
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** 暗号化済み値の識別プレフィックス（バージョン付き） */
const ENC_PREFIX = 'enc:v1:';

/** GCM 推奨の IV 長（96bit） */
const IV_LENGTH = 12;

/**
 * 環境変数から暗号鍵を取得する。
 * 未設定時は null を返し、呼び出し側で「本番なら拒否・開発なら平文許容」を判断する。
 */
function getEncryptionKey(): Buffer | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) return null;

  const key = Buffer.from(raw, 'base64');
  // 鍵長が誤っていると暗号強度が保証できないため、フォールバックせず明示的に失敗させる
  if (key.length !== 32) {
    throw new Error(
      'SETTINGS_ENCRYPTION_KEY は 32 バイトを base64 エンコードした値にしてください（生成例: openssl rand -base64 32）',
    );
  }
  return key;
}

/**
 * 設定値を暗号化する。
 * 鍵未設定の場合、本番ではエラー（機密の平文保存を防ぐ）、
 * 開発では警告付きで平文を返す（ローカルのセットアップ障壁を下げるための妥協）。
 */
export function encryptSetting(plaintext: string): string {
  const key = getEncryptionKey();

  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SETTINGS_ENCRYPTION_KEY が未設定です。本番環境では必須です。');
    }
    console.warn(
      '[settings-cipher] SETTINGS_ENCRYPTION_KEY が未設定のため平文で保存します（開発環境のみ許容）',
    );
    return plaintext;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return (
    ENC_PREFIX +
    [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
  );
}

/**
 * 保存値を復号する。
 * プレフィックスの無い値は暗号化導入前の平文レガシー値として、そのまま返す
 * （再保存時に encryptSetting を通るので自然に暗号化へ移行される）。
 */
export function decryptSetting(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;

  const key = getEncryptionKey();
  if (!key) {
    throw new Error('SETTINGS_ENCRYPTION_KEY が未設定のため、暗号化済みの設定値を復号できません。');
  }

  const [ivB64, tagB64, dataB64] = stored.slice(ENC_PREFIX.length).split(':');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
