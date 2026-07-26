/**
 * EDINET 関連 Server Actions だけが共有する証券コード整合性ロジックです。
 *
 * EDINET の secCode は末尾の業種桁を含む5文字、銘柄マスタは4文字で保持するため、
 * 保存・取込のどの経路でも同じ正規化を使って別企業のデータ混入を防ぎます。
 */

/** EDINET の5文字コードをアプリの4文字コードへ正規化します。 */
export function normalizeEdinetSecurityCode(secCode: string): string {
  const normalized = secCode.trim().toUpperCase();
  return normalized.length === 5 ? normalized.slice(0, 4) : normalized;
}

/** EDINET 書類と取込先銘柄の証券コードが一致するかを判定します。 */
export function matchesStockCode(
  stockCode: string,
  edinetSecCode: string
): boolean {
  return (
    stockCode.trim().toUpperCase() ===
    normalizeEdinetSecurityCode(edinetSecCode)
  );
}
