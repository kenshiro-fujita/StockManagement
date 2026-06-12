/**
 * 計算エンジン共通の端数処理・入力解決ユーティリティ
 *
 * 端数処理ルールを一箇所に集約することで、ゴールデンテストとの一致を保証する。
 *
 * 丸め仕様（v1.1.0 で明文化）:
 * - 「四捨五入」= 絶対値基準の四捨五入（half away from zero）。
 *   スプレッドシートの ROUND 関数と同一挙動にする（本アプリはスプシ移行のため）。
 *   JS の Math.round は負のタイ値を +∞ 方向に丸める（Math.round(-2.5) === -2）ため、
 *   そのまま使うと負値で「四捨五入」表記と食い違う。
 * - 「切捨て」= 0 方向への切捨て（truncate）。
 *   スプレッドシートの ROUNDDOWN と同一挙動。Math.floor は負値で絶対値が増えるため使わない。
 */

/** パーセンテージ・小数指標用: 小数点以下第2位を四捨五入（絶対値基準） */
export function roundPercent(value: number): number {
  return Math.sign(value) * (Math.round(Math.abs(value) * 100) / 100);
}

/** 円単位の四捨五入（絶対値基準）。事業価値・時価総額等の金額丸めに使用 */
export function roundYen(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** 円未満切捨て（0方向）。理論株価・理想購入株価の丸めに使用 */
export function truncateYen(value: number): number {
  return Math.trunc(value);
}

/**
 * 計算に使う「自己資本」を解決する
 *
 * 山口式の資産価値・ROE・PBR 等で使う自己資本は、本来は株主資本
 * （非支配株主持分・新株予約権を含まない）が適切。
 * EDINET から株主資本（shareholders_equity）が取れている場合はそれを優先し、
 * 無い場合は従来どおり純資産（equity）にフォールバックする。
 * どちらを使ったかは field で返し、計算根拠表示（CalcLogicPanel）で確認できるようにする。
 */
export function resolveEquity(fd: {
  equity: number;
  shareholders_equity: number | null;
}): { value: number; field: string; label: string } {
  if (fd.shareholders_equity != null) {
    return { value: fd.shareholders_equity, field: 'shareholders_equity', label: '自己資本（株主資本）' };
  }
  return { value: fd.equity, field: 'equity', label: '自己資本（純資産で代用）' };
}
