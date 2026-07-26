/**
 * CSV と XBRL が共有する Fact 名の正規化を提供する。
 *
 * 名前空間の除去を各パーサーで個別実装すると、区切り文字や空文字の扱いが
 * 入力形式ごとにずれるため、EDINET Fact の入口で同じ規則を使用する。
 */

/** `jppfs_cor:NetSales` のような QName から `NetSales` を取り出す。 */
export function extractLocalName(qualifiedName: string): string {
  const namespaceSeparator = qualifiedName.lastIndexOf(':');
  return namespaceSeparator >= 0
    ? qualifiedName.slice(namespaceSeparator + 1)
    : qualifiedName;
}

/**
 * 日本の開示書類で使われる数値表記を JavaScript の number に正規化する。
 *
 * CSV と iXBRL の双方が同じ表記を含むため、入力形式ではなく Fact の共通責務として
 * ここで扱う。ダッシュや非数値文字列は、欠損を表す null のまま抽出層へ渡す。
 */
export function normalizeNumber(raw: string): number | null {
  if (!raw) return null;

  let normalized = raw
    .replace(/[０-９]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0xfee0)
    )
    .replace(/[,，\s]/g, '')
    .replace(/[△▲]/g, '-')
    .replace(/[−–—―‐]/g, '-');

  // 括弧は会計表示上の負数なので、通常のマイナス表記へ統一する。
  const parenthesized = normalized.match(/^\((.+)\)$/);
  if (parenthesized) {
    normalized = `-${parenthesized[1]}`;
  }

  if (normalized === '-' || normalized === '') return null;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
