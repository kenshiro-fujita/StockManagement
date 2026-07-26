/**
 * アプリ境界で受け取る ISO 暦日の共通検証です。
 *
 * `Date.parse` は 2 月 30 日などを翌月へ自動補正するため、解析できるかだけでなく、
 * UTC で正規化した日付が入力値と一致するところまで確認します。
 */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}
