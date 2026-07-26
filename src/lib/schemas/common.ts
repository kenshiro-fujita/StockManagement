/**
 * Server Action 境界で共有するプリミティブ入力スキーマです。
 *
 * TypeScript の型は直接 POST された引数を保護しないため、ID・年度・EDINET 識別子の
 * 最低限の制約を一箇所に集約し、アクションごとの検証漏れを防ぎます。
 */
import { z } from 'zod';

/** DB の主キーとして受け付ける UUID です。 */
export const idSchema = z.uuid({ error: '無効なIDです' });

/** 銘柄を参照する Server Action で受け付ける UUID です。 */
export const stockIdSchema = z.uuid({ error: '無効な銘柄IDです' });

/** アプリが扱う会計年度の範囲です。 */
export const fiscalYearSchema = z
  .number()
  .int('年度は整数で入力してください')
  .min(1900, '1900年以降を指定してください')
  .max(2100, '2100年以前を指定してください');

/** EDINET 検索で受け付ける日本株の4桁証券コードです。 */
export const fourDigitStockCodeSchema = z
  .string()
  .regex(/^\d{4}$/, '証券コードは4桁の数字で入力してください');

/**
 * EDINET が発行する書類IDです。
 *
 * 現行IDは英数字ですが、将来の桁数変更を不要に拒否しないよう長さには余裕を持たせます。
 */
export const edinetDocumentIdSchema = z
  .string()
  .trim()
  .min(1, '書類IDが不正です')
  .max(64, '書類IDが不正です')
  .regex(/^[0-9A-Za-z]+$/, '書類IDが不正です');
