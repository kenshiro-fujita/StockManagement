# コードベース監査レポート兼改善プラン（v2）

- **作成日**: 2026-06-13（v2: Fable 5 による再監査。同日付の旧版を全面置き換え）
- **対象**: StockManagement（Next.js App Router + React 19 + Supabase）
- **監査範囲**: `src/` 全体（約130ファイル / 約16,600行）+ `supabase/migrations/` + リポジトリ設定ファイル
- **観点**: 保守性・拡張性・可読性・パフォーマンス・セキュリティ
- **手法**: 領域別に4つの調査エージェントで並列精査（セキュリティ / 計算エンジン・パース層 / サーバーアクション・データ層 / UI）。全ファイル実読、丸め挙動はコード実行で検証、EDINETタクソノミは外部資料と照合、シークレットのgit追跡はメインセッションで再検証済み。

## v1からの主な差分

- **新規 Critical 3件**: ①Supabase service_role キーのgitコミット（S-0）、②EDINETタクソノミ候補タグの実在性疑義（C-1）、③XBRLパーサが文字列ファクトを破壊し会計基準判定が恒久的に機能しない（C-2）
- **訂正**: v1は「RLSポリシー定義が見当たらない」としていたが、`supabase/migrations/` に全ユーザーデータ系テーブルのRLSが存在することを確認。IDOR評価を「現状は防止済み・多層防御の欠如（Low）」に下方修正
- **新規 High 多数**: グリッド保存による精度破壊、負の理論株価での安全率符号反転、星評価のstale props、タブ切替での編集消失、約1,060行のデッドコード 他

## 重大度サマリー

| 重大度 | 件数 | 代表例 |
|---|---|---|
| Critical | 6 | シークレットコミット、認証無効化、資格情報のバンドル露出、タクソノミタグ疑義、XBRL文字列破壊、デフォルト値不整合 |
| High | 16 | 自己昇格、キーのクロスユーザー混線、セグメント値混入、安全率符号反転、精度破壊保存、二重実装、DB型未導入、編集消失 他 |
| Medium | 20 | edinet_master書込開放、平文キー保存、revalidate不整合、N+1、a11y欠落 他 |
| Low | 12 | 防御二重化不足、Zod記法混在、デッドコード、依存管理 他 |

---

## 1. セキュリティ

### [Critical] S-0. Supabase service_role シークレットキーが git にコミットされている 【v2新規】
- **該当**: `.claude/settings.json`（git追跡対象であることをメインセッションで再確認済み。キー `sb_secret_N7UND0UgjKTVK-...` が複数箇所に出現）
- **問題**: Bash許可リスト内のcurlコマンドにservice_roleキーがベタ書きされコミットされている。service_roleはRLSを完全バイパスし全テーブルを読み書きできる最上位権限。同ファイルには `/auth/v1/admin/users` を叩くadmin API呼び出しも含まれる。ローカル（127.0.0.1:54321）向けキーだが、リポジトリ公開/共有で即悪用可能。
- **推奨**: キーの即時無効化・ローテーション。`.claude/settings.json` をgit管理から外し `.gitignore` へ。git履歴からの除去（filter-repo等）。シークレットを許可リストにベタ書きしない運用へ変更。

### [Critical] S-1. 認証ミドルウェアが完全に無効化されている
- **該当**: `src/lib/supabase/proxy.ts:47-53`、`src/middleware.ts:1-12`
- **問題**: `updateSession` がユーザー取得後に `void user;` で破棄し、未認証リダイレクトを行わない（コメント「開発中は認証必須を解除」）。`/stocks`、`/settings`、`/ops-819a1ec26e72` を含む全ページに未認証で到達可能。データ保護はRLSのみに依存。
- **推奨**: 未認証時に `/auth/**` と静的アセット以外を `/auth/login` へリダイレクト。保護レイアウトにも `getUser()` ゲートを追加し多層防御。**※認証方式変更につき着手前にユーザー確認。**

### [Critical] S-2. 管理者・テストユーザーの平文パスワードがクライアントバンドルに同梱
- **該当**: `src/components/mode-selector.tsx:16-20`
- **問題**: `'use client'` 内に管理者（`fujimaster@stockmgmt.local` / パスワード平文 ※本書では伏字）と一般ユーザーの資格情報がハードコード。ブラウザのJSバンドルから誰でも取得でき、管理者ログインが実質公開状態。非推測URLによる管理画面保護が無意味化。git履歴にも残存。
- **推奨**: 自動ログイン機構を撤廃し通常ログインへ。両アカウントのパスワード即時ローテーション。開発限定にするなら `NODE_ENV === 'development'` でビルド時除去。**※認証方式変更につき要確認。**

### [High] S-3. 管理者判定が `user_metadata` 依存で自己昇格可能
- **該当**: `src/lib/auth/admin.ts:10-15`、`src/actions/user-profile.ts:12-25`
- **問題**: `user_metadata?.role === 'admin'` で判定。`user_metadata` はユーザー自身が `auth.updateUser({ data })` で書き換え可能（現に `updateDisplayName` が同領域へ書込）。ブラウザから `updateUser({ data: { role: 'admin' } })` を実行するだけで昇格できる。
- **推奨**: `app_metadata`（service_roleのみ書込可）へ移行。ロール付与は管理者専用経路のみ。

### [High] S-4. 管理者用サーバーアクションが `isAdmin()` を検証していない
- **該当**: `src/actions/edinet-master.ts:75,128,172`（`registerMasterMetadata` / `extractSingleMasterRecord` / `getPendingMasterRecords`）
- **問題**: チェックは `if (!user)` のみ。サーバーアクションは実体がPOSTエンドポイントで、UIゲート（layoutの `notFound()`）を経由せず直接呼べる。任意の認証ユーザーがEDINET大量フェッチを起動し、共有 `edinet_master` を汚染できる。
- **推奨**: 各管理者用アクション冒頭で `isAdmin()` を必須化。

### [High] S-5. EDINET APIキーのモジュールグローバルキャッシュ（クロステナント混線・更新不能）
- **該当**: `src/lib/edinet/client.ts:25-45`（`let _cachedApiKey`）
- **問題**: ユーザー固有キーをプロセス全体の変数にキャッシュ。サーバーレスのウォームインスタンスで別ユーザーのリクエストが前ユーザーのキーを使い、誤課金・キー流用が起こる。キー変更もプロセス生存中は反映されない。`server.ts` 自身の「グローバルに置くな」というコメントと矛盾。さらに lib→actions の dynamic import で依存方向が逆転（`ai/index.ts:10` も同様）。
- **推奨**: キャッシュ廃止。アクション層でキーを解決し `client.ts` へ引数で渡す構造に（依存逆転も同時解消）。

### [High] S-6. レート制限が皆無（課金APIのコストベースDoS）
- **該当**: `src/actions/ai-research.ts:42`、`src/actions/edinet.ts:22`、`src/actions/edinet-master.ts`
- **問題**: Anthropic API（従量課金）とEDINET日次ループに回数制限がない。認証が実質オープンな現状、`runAIResearch` 連打でクレジット枯渇、巨大日付範囲でサーバー長時間占有が可能。
- **推奨**: ユーザー単位・時間窓のレート制限。AI調査の実行間隔/日次上限。日付範囲上限（バックログF21の最大6か月）をコードで強制。

### [Medium] S-7. `edinet_master` が全認証ユーザーに INSERT/UPDATE 開放 【v2新規】
- **該当**: `supabase/migrations/20260407000000_fix_edinet_master_rls.sql`、`20260405010000_create_edinet_master.sql`
- **問題**: 全ユーザー共通の参照データなのに `auth.role() = 'authenticated'` で書込可。任意ユーザーが全企業の財務マスタを汚染でき、`importMasterToFinancialData` 経由で全ユーザーの分析に波及。
- **推奨**: 書込はservice_roleまたは管理者ロール限定に。**※RLS変更につき要確認。**

### [Medium] S-8. APIキーがDBに平文保存
- **該当**: `src/actions/settings.ts:21-24`、`supabase/migrations/20260404040000_create_user_settings.sql`
- **問題**: EDINET/AnthropicキーがTEXTで平文保存。バックアップ流出・service_role漏洩（S-0が現実）・管理者乗っ取りでそのまま読める。
- **推奨**: Supabase Vault / pgsodium またはサーバー側対称鍵暗号で暗号化。最低限、書込専用＋マスク返却の設計に。

### [Medium] S-9. オープンリダイレクト（`auth/confirm` の `next`）+ 生エラーのURL露出
- **該当**: `src/app/auth/confirm/route.ts:10,20-21,23`
- **問題**: `next` を未検証で `redirect()` に渡す（`//evil.com` でフィッシング誘導可能）。Supabase生エラーメッセージをURLに連結（error/page.tsx側のマップで深刻度は低いがログに残る）。
- **推奨**: `/` 始まりかつ `//` 非含有の相対パスのみ許可。エラーは固定コードで受け渡し。

### [Medium] S-10. 検索系アクションの入力未検証によるリソース枯渇
- **該当**: `src/actions/edinet.ts:22-49`、`src/lib/edinet/client.ts:181-213`
- **問題**: `searchEdinetDocuments` は `stockCode` 桁数も日付形式も未検証（`stock-lookup.ts` は4桁チェックありで非対称）。`startDate='1900-01-01'` で実質無限ループ＋大量外部リクエスト。不正日付では `Invalid Date` でループ挙動が未定義。
- **推奨**: `/^\d{4}$/`、`YYYY-MM-DD` 形式、`start <= end`、範囲上限をZodで検証。

### [Low] S-11. 認可フィルタの非一貫性（IDOR自体はRLSで防止済み）
- **該当**: `src/actions/stocks.ts:58-99,117`、`roster.ts` 各更新、`edinet.ts:138`
- **問題**: `deleteStock`/`updateStock` 等が `.eq('id', ...)` のみで所有権チェックをRLSに全面依存（`financial-data.ts` は `.eq('user_id', ...)` 併用で非対称）。**現状RLSは全テーブルで有効と確認済み**のため成立しないが、RLSを1つ外すと即IDOR化する脆い設計。`importMasterToFinancialData` は他人の `stock_id` を指す行を自分名義で作れる軽微な整合性問題あり。
- **推奨**: サーバーアクションでも `.eq('user_id', user.id)` を一貫付与し多層防御。

### [Low] S-12. その他
- EDINET APIキーをURLクエリで送信（`client.ts:108,124`。EDINET仕様上不可避。URLをログ出力しない運用徹底）
- 依存の `latest` 固定（`package.json`: `next`/`@supabase/*`。バージョン固定＋Dependabot推奨）
- パスワードポリシー8文字のみ（Supabase側で強度・漏洩チェック有効化を推奨）

> **問題なしと確認**: SQLi（全てパラメータ化API）、XSS（`dangerouslySetInnerHTML` 不使用、Reactエスケープ下）、SSRF（フェッチ先ホスト固定）、フォーム系のZod検証、ユーザーデータ系テーブルのRLS網羅、`.env.local` 未追跡、`NEXT_PUBLIC_` に機密なし（mode-selector問題を除く）。

---

## 2. データ正確性（EDINET抽出・計算エンジン）

### [Critical] C-1. タクソノミ候補タグに実在しないEDINET要素名が含まれる疑い 【v2新規】
- **該当**: `src/lib/edinet/taxonomy.ts:66-100`
- **問題**: ①IFRS候補が `Revenue`/`OperatingProfit` 等の**サフィックスなし**だが、EDINETのIFRSタクソノミ（jpigp_cor）は `OperatingProfitLossIFRS`、サマリーは `RevenueIFRSSummaryOfBusinessResults` のように **`IFRS` サフィックス付き**が実体（外部資料照合）。IFRS企業の主要値が候補に1つもヒットしない可能性が高い。②JGAAPの `operating_cf: ['CashFlowsFromOperatingActivities']` は、本表タグ `NetCashProvidedByUsedInOperatingActivities` でもサマリータグでもなく、標準要素として確認できない。**JGAAP企業の営業CF/投資CFが常にnullになる疑い**。
- **推奨**: 実在報告書（IFRS企業1社・JGAAP企業1社）のCSVで全17メトリックの抽出を実地検証し、候補リストを実要素名に修正。confidence=lowをUI警告する仕組みも検討。「取得値がほぼ全部null」になる系統障害のため最優先。

### [Critical] C-2. XBRLフォールバック経路が文字列ファクトを数値化して破壊 【v2新規】
- **該当**: `src/lib/edinet/xbrl-parser.ts:156,213-218`、利用側 `:67-73,92`
- **問題**: 全ファクトを `normalizeNumber` で数値化するため、`AccountingStandardsDEI` の "IFRS" や `CurrentFiscalYearEndDateDEI` の "2025-03-31" が `NaN→null` になる。**XBRL経路では会計基準が常にJGAAPフォールバックし、periodEndが常にnull**。IFRS企業はJGAAP候補タグで検索され主要値がほぼ取得できない。
- **推奨**: 文字列ファクトの生テキストを `rawValue` フィールドで保持し、DEI系はそちらを参照。

### [Critical] C-3. パラメータデフォルト値が3箇所で不整合（理論株価が経路によって2倍変わる）
- **該当**: `src/actions/stocks.ts:51`（`cap_multiplier: 20`）/ `supabase/migrations/20260321045108_create_parameters_table.sql:11`（`DEFAULT 10`）/ `src/lib/schemas/parameters.ts:8`（`PARAMETER_DEFAULTS: 10`）
- **問題**: `createStock` 経由は上限倍率20、`getOrCreateParameters`（DBデフォルト依存）経由は10。UIの「デフォルト: 10倍」表示とも矛盾。**事業価値・理論株価が銘柄の作成経路で2倍変わる**。
- **推奨**: 正の値（10か20か）をユーザー確認の上、`PARAMETER_DEFAULTS` を単一の真実の源とし、`createStock`・DBデフォルトを同期。**※計算仕様につき要確認＋ゴールデンテスト。**

### [High] C-4. Memberコンテキスト（セグメント値）混入リスク
- **該当**: `src/lib/edinet/csv-parser.ts:270-310`、`xbrl-parser.ts:224-296`
- **問題**: P/L項目は「`CurrentYear` を含み `NonConsolidatedMember` を含まない」だけで通過するため、セグメント注記の `...ReportableSegmentsMember` コンテキストも一致し、採用はファイル内出現順の先頭1件。**売上高等にセグメント値が混入し得る**（confidence=highのまま保存されるため発見困難）。
- **推奨**: プレーンコンテキスト（`CurrentYearDuration`/`CurrentYearInstant` 完全一致）を最優先し、緩い一致はフォールバック＋confidence降格。

### [High] C-5. 理論株価が負のとき安全率の符号が反転し「割安」と誤判定
- **該当**: `src/lib/calc/safety.ts:40-61,74-79,88`
- **問題**: 負の分母を許すため、理論株価-100円・株価50円 → 安全率+150% → `'cheap'`（割安）と判定される（コード実行で確認）。高レバレッジ・低利益企業で理論株価は負になり得る。**債務超過的な銘柄が最上位の割安として表示される**。`calcIdealBuyPrice` も負値×0.5のfloorで絶対値が増える。
- **推奨**: `theoryPrice <= 0` のとき安全率・理想買値はnull（「算出不可（理論価値が負）」）。

### [High] C-6. グリッド保存で全項目が百万円丸め値に上書きされ精度が破壊される
- **該当**: `src/components/stocks/financial-data-grid.tsx:79-92,196-228`
- **問題**: 表示は `Math.round(value/1_000_000)`、保存は**全フィールド**を表示値×1,000,000で書き戻す。1セル編集して保存するだけで、EDINET取込した `4,112,318,000円` が `4,112,000,000円` に劣化。グリッド指標も丸め済み表示値から計算するため詳細画面と恒常的にズレる。
- **推奨**: dirtyなセルのみ表示値から変換し、未編集フィールドはDB生値を保持して書き戻す。

### [High] C-7. 計算エンジンとグリッド指標の完全二重実装（丸め規則も不一致）
- **該当**: `src/lib/calc/grid-indicators.ts:173-244` ⇔ `theory-price.ts`/`safety.ts`/`ratios.ts`
- **問題**: DCF事業価値の式がgrid-indicators内だけで4回コピーされ、エンジンとも二重（仕様変更時に5箇所以上の修正）。丸めが不一致（グリッドは `toFixed(1)`・floorなし理論株価で除算、エンジンは2位四捨五入・floor済み → 実測で安全率46.7% vs 46.8%のズレ）。`tax_rate ?? 0.3` のマジックナンバーはグリッドのみ。`interest_rate` と `cost_of_debt` は完全同一計算の重複定義。
- **推奨**: グリッドの `calc` をエンジン関数の薄いラッパーにし、ゴールデンテストの保護をグリッドに及ぼす。

### [High] C-8. XBRLパーサ・グリッド指標のテストが皆無
- **該当**: `xbrl-parser.ts`（テストなし）、`grid-indicators.ts`（テストなし）
- **問題**: 最も複雑なフォールバック経路（scale/sign/traverse/DEI判定）と二重実装側が完全無検証。C-2はテストがあれば即検出できた。負値・発散系の統合ケース（負の事業価値→負の理論株価→符号反転）もどのテストも通らない。
- **推奨**: fixture テスト追加（scale正/負/0、sign、全角ダッシュ、Memberコンテキスト混入、DEI文字列、負値ゴールデンケース）。

### [Medium] C-9. `equity` が「純資産（NetAssets）」なのに「自己資本」として使用
- **該当**: `taxonomy.ts:87-90`、`theory-price.ts:75-85`、`ratios.ts:75`、`stock-metrics.ts:59`
- **問題**: NetAssetsは非支配株主持分・新株予約権込み。商社・持株会社等で資産価値・ROE・PBRが歪む。`shareholders_equity`（株主資本）を抽出済みなのに計算未使用。
- **推奨**: 山口式の「自己資本」定義をどちらに置くか**ユーザーに仕様確認**の上で統一。

### [Medium] C-10. 有利子負債の合算が不完全
- **該当**: `taxonomy.ts:111-116`
- **問題**: 短期/長期借入金・社債のみで、リース債務・CP・1年内償還社債が未包含。理論株価の控除項目とROIC分母が過小。
- **推奨**: 包含範囲を**ユーザーに仕様確認**の上で拡張（C-4のMember混入対策と同時に）。

### [Medium] C-11. 端数処理の負値挙動が表記と不一致
- **該当**: `src/lib/calc/utils.ts:9-11`、`theory-price.ts:100`、`safety.ts:88`
- **問題**: `Math.round` は負のタイを+∞方向へ（`roundPercent(-2.005)=-2`、`(2.005)=2.01`）。`Math.floor` は負値で絶対値切上げ（`floor(-2.978)=-3`）。メタデータの「四捨五入」「円未満切捨て」表記と非対称。ゴールデンテストに負値タイがなく検出不能。
- **推奨**: 仕様（half-away-from-zero / truncate か現状の数学的丸めか）を明文化し、メタデータ文字列とテストを一致させる。

### [Medium] C-12. グリッド指標のtruthy判定が0値を誤排除
- **該当**: `grid-indicators.ts:93-105,111-117,196-259`
- **問題**: 売上0（-100%成長と算出可能）・営業利益0（ROIC=0%）・支払利息0（costOfDebt=0）を「未入力」と同一視しnull表示。エンジン側は `=== 0`/`== null` で正しく区別しており不整合。
- **推奨**: `== null` 判定に統一、分母0のみnull。

### [Medium] C-13. EDINETクライアントの堅牢性
- **該当**: `client.ts:76-81`（5xxのみリトライ、429は即例外）、`:203-205`（`catch { continue; }` が401含む全例外を黙殺→キー無効でも日数×3秒待った末に空配列）
- **推奨**: 429をリトライ対象に。認証系エラーは即時失敗＋ユーザー通知。

### [Low] C-14. その他
- 丸め済み値からの再計算（`index.ts:113-117,148-149`: 丸め済みROIC平均・floor済み理論株価×株数。誤差小・メタデータ明示ありだがスプシ移行差分の原因になり得るため仕様明文化推奨）
- デッドコード（`csv-parser.ts:149-154` 未使用 `isConsolidatedCurrent`、`:195` 到達不能ダッシュ比較、`xbrl-parser.ts:137-141`）
- `unitId`/`unitRef` 未検証（JPY以外・JPYPerSharesの混同防御なし）
- `format.ts:49-51` `round2` が `roundPercent` と重複、`formatStockPrice` 丸めなし
- `comparison.ts:79` の `as Record` キャストがフィールド名タイポを実行時nullに化けさせる（整合テスト追加推奨）
- `theory-price.test.ts:63-66` に「Wait: these are in yen already...」というAI生成の思考過程コメントが残留（削除）
- メトリック定義の重複（`metricKeys`/BS判定/合算ロジックがCSV/XBRLで丸ごと重複。Fact→ExtractionResultの選択ロジックを共通化）
- 性能: パーサはO(メトリック×候補タグ×ファクト)の線形でMap化は低優先。`searchAnnualReports` の日次ループ×3秒sleepは6か月で約180リクエスト+9分（提出時期の事前絞り込み余地）

---

## 3. サーバーアクション・データ層

### [High] D-1. Supabase生成型（`Database`型）未導入
- **該当**: `src/lib/supabase/server.ts:12`、`client.ts:4`、手書きRow型: `edinet-master.ts:17-43,203`、`parameters.ts:104-113`、`lib/types/*`
- **問題**: 全クエリ結果が実質 `any`。`data as MasterRow[]` 等の無検証キャストが散在し、スキーマ変更をコンパイル時に検知できない。手書きRow型とDBの同期が完全手作業。アプリ側にも `as FullFinancialDataRow[]` が伝播。
- **推奨**: `supabase gen types typescript` を導入し `createServerClient<Database>` に。手書き型は生成型のエイリアス/Pickに置換。

### [High] D-2. EDINETカラムマッピングが3箇所に重複
- **該当**: `src/actions/edinet.ts:179-208`、`edinet-master.ts:46-69,225-251`
- **問題**: `metricKey → DBカラム`（`operating_profit→operating_income` 等の名前ズレ含む）が3重定義。新項目追加で3ファイル4箇所の修正が必要で、片方だけ直すと取込経路間でサイレント不整合。
- **推奨**: `METRIC_TO_COLUMN` マップと行組み立て関数を `src/lib/edinet/` に集約。

### [High] D-3. 副次書き込み失敗の握り潰し（方針も不統一）
- **該当**: `stocks.ts:46-52`（parameters insert無検査）、`ai-research.ts:78-93`（課金後の保存失敗でも `success: true`）、`edinet.ts:230`（FR15の `extraction_logs` 無検査）、対照: `roster.ts:80-83`（意図的・コメント付き）
- **推奨**: 「主データは失敗時error返却、監査ログ系はconsole.error+続行（コメント明記）」の方針を決め全アクション統一。`ai_research` insertは失敗を返すべき。

### [High] D-4. AIエラー分類が文字列マッチ＋プロバイダ知識のアクション層漏出
- **該当**: `src/actions/ai-research.ts:98-111`
- **問題**: `raw.includes('credit balance is too low')`・`includes('401')` はSDK更新で静かに壊れ、誤反応もする。Claude固有の翻訳がアクション層にあり `AIProvider` 抽象が実質破られている。
- **推奨**: SDKの型付き例外（`Anthropic.AuthenticationError` 等）を `ClaudeProvider` 内で `instanceof` 判定し、プロバイダ非依存の `AIProviderError`（`kind: 'auth'|'rate_limit'|'quota'|'unknown'`）に正規化。

### [High] D-5. `lookupStockByCode` がタイムアウト確実＋キー解決の自己矛盾
- **該当**: `src/actions/stock-lookup.ts:24,31-57`
- **問題**: 30日直列×3秒sleepで最悪90秒超（Vercelの関数タイムアウト超過）。さらに `process.env.EDINET_API_KEY` のみチェックするため、**設定画面でキー登録したユーザーが誤ってブロックされる**（エラー文言「設定画面から登録してください」と自己矛盾）。
- **推奨**: `edinet_master` のDB逆引きを優先しAPIはフォールバック・日数上限を数日に。キーチェックを `resolveApiKey` 相当に統一。

### [Medium] D-6. `revalidatePath` が実ルート構造と不整合
- **該当**: `roster.ts:85,116,147`、`financial-data.ts:109,139,189,216`、`edinet.ts:232`、`ai-research.ts:95`、`settings.ts:27`
- **問題**: `revalidatePath('/stocks')` は配下の動的ルートを無効化しないため、roster変更・財務削除・EDINET取込・AI調査が**詳細ページに反映されない**。逆にcreate/updateは一覧が古いまま。`saveSetting` の `/stocks` は目的不明。`deleteFinancialData` は `stockId` を受け取らず正しい無効化が構造的に不可能。
- **推奨**: `revalidateStockPaths(stockId?)` ヘルパーで「詳細＋一覧」を統一無効化。`deleteFinancialData` 等のシグネチャに `stockId` 追加。

### [Medium] D-7. アクション戻り値が5形式以上に分裂
- **該当**: `{success,error?}` / `{success,error?,data?}` / `{exists}` / `{data}`のみ / `string|null` / 例外スロー（`ai/index.ts:21`）
- **推奨**: `ActionResult<T> = { success: true; data: T } | { success: false; error: string }` 判別共用体を `lib/types/action.ts` に定義し全アクション統一。

### [Medium] D-8. 抽出ログのハードコード（FR15の記録として不正確）
- **該当**: `src/actions/edinet.ts:218,227`（`doc_id: 'edinet-extraction'`、`source_type: 'csv'` 固定）
- **問題**: どの書類から・どの経路（CSV/XBRL）で抽出したかが記録されない。FR15/16/17の信頼性を直接損なう。
- **推奨**: `ExtractionSummary` に `sourceType` を持たせ、`saveExtractedData` に `docId` を追加して実値保存。

### [Medium] D-9. `registerMasterMetadata` のN+1（書類ごとにSELECT+INSERT直列）
- **該当**: `src/actions/edinet-master.ts:89-115`
- **推奨**: `upsert(..., { onConflict: 'doc_id', ignoreDuplicates: true })` の一括1リクエストに。

### [Medium] D-10. `addEmptyFinancialYear` が必須項目に `0` を実データとして保存
- **該当**: `src/actions/financial-data.ts:171-183`
- **問題**: 売上0・総資産0の行が本物のデータと区別できず、0除算・誤指標のリスク。`createFinancialDataSchema` の `total_assets > 0` と自己矛盾。
- **推奨**: 本来は必須カラムのNULL許容化（**※DBスキーマ変更につき要確認**）。変えない場合は「全項目0=未入力」の判定ルールを1箇所に定義。

### [Medium] D-11. `buildFinancialSummary` でnullが「0百万円」としてAIに渡る
- **該当**: `src/actions/ai-research.ts:30-38`
- **問題**: 手書き型注釈は `revenue: number` だがEDINET取込行はnullになり得る。`null / 1_000_000 === 0` のため**AIに誤った事実（売上0百万円）が渡る**。未使用の `equity` もselectしている。
- **推奨**: nullチェックで「データなし」表記。型は生成型のPickに（D-1と連動）。

### [Medium] D-12. `user-profile.ts` だけバリデーション・エラー方針が異なる
- **該当**: `src/actions/user-profile.ts:12-61`
- **問題**: Zod未使用、パスワード「8文字以上」が `auth.ts:12` と二重定義、`updateEmail` 形式チェックなし、英語生エラーをそのまま返却（他は日本語固定文言）。
- **推奨**: パスワード長を定数共有、Zodスキーマ追加、エラー方針を他アクションに統一。

### [Low] D-13. その他
- Zod v4でdeprecatedな記法の混在（`roster.ts:41,54,61` の `z.string().uuid()` vs 他の `z.uuid()`、`auth.ts:8,26` の `.email()`）→ `z.uuid()`/`z.email()` に統一
- チュートリアル残骸 `hasEnvVars`（`utils.ts:8-11`、使用箇所 `proxy.ts:12`）
- `ClaudeProvider` の遅延初期化が無意味（リクエストごとにnewされる）、`max_tokens: 2048` の根拠コメントなし、`parseResponse` のセクション名2箇所連結
- `searchEdinetDocuments` の未使用 `stockId` 引数、冗長分岐
- 金額regex `^-?[\d,]+\.?\d*$` が `1,2,3` や `123.` を許容（`schemas/financial-data.ts:34,45`）
- `roster.ts:57-59` 同一カテゴリ変更がno-opでなく `success: false`
- `deleteStock` のidがUUID検証なし（他アクションは検証あり）
- `INPUT_UNIT_OPTIONS`/`InputUnit` がschemasとutilsで二重定義（`as` キャストの原因）

---

## 4. UI・React・Next.js

### [High] U-1. 星評価・購入優先順のstale props（保存後にUIが巻き戻る）
- **該当**: `src/components/stocks/star-rating.tsx:18-26,44,58`、`buy-priority-input.tsx:21`、`actions/roster.ts:116,147`
- **問題**: アクションは `revalidatePath('/stocks')` のみで詳細ページを無効化せず、クライアントも `router.refresh()` を呼ばない。①星がマウスを離すと古い値に巻き戻る、②`aria-checked` が実値と不整合、③「2に変更→1に戻す」が `currentPriority` ガードでスキップされ **DBは2のままUIは1** の乖離。
- **推奨**: D-6のrevalidateヘルパー適用＋成功時 `router.refresh()` または `useOptimistic`。

### [High] U-2. 星評価の矢印キーがサーバー保存を連発
- **該当**: `star-rating.tsx:28-42`
- **問題**: 矢印キーごとに `next?.click()` → DB更新が発火。★4へ移動するだけで3回保存。`isPending` で全ボタンdisabledになるため連打中にフォーカスがdisabledボタンへ飛び操作不能になり得る。`document.querySelector('[data-star]')` は複数インスタンスで誤動作。Home/End未対応、未評価に戻す手段なし。
- **推奨**: 矢印はローカル選択＋フォーカス移動のみ。保存はEnter/Spaceまたはdebounce。`ref` ベースに変更。

### [High] U-3. タブ切替でグリッドの未保存編集が警告なしに消える
- **該当**: `stock-detail-tabs.tsx:31-61` + `financial-data-grid.tsx:171-179`
- **問題**: Radix Tabsは非アクティブコンテンツをアンマウントするため、セル値・dirty状態（useState）が全破棄。dirty警告もなし（デッドコード側のフォームには `window.confirm` ガードがあるのに現役グリッドにはない）。副作用としてタブを開くたびAI調査・EDINET検索が再フェッチ。
- **推奨**: `TabsContent` に `forceMount`＋hidden制御、または編集状態の親への持ち上げ。最低限dirty時のタブ切替確認。

### [High] U-4. `/stocks` で layout と page が全銘柄×全財務データを二重取得・二重計算
- **該当**: `src/app/stocks/layout.tsx:23-77`、`stocks/page.tsx:19-97`、`stocks/compare/page.tsx:47-113`（3度目のコピー）
- **問題**: ほぼ同一コード（3テーブル並列クエリ→Map→`calculateAllIndicators`）が3箇所。1回の表示で `financial_data` 全行が `select('*')` で2回転送・計算され、銘柄増で線形悪化。
- **推奨**: `React.cache()` でラップした共有関数 `getStocksWithIndicators()` に集約。必要カラムの明示列挙。

### [High] U-5. 約1,060行のデッドコードが現役コードと二重管理状態
- **該当**: `financial-data-form.tsx`（514行）、`financial-data-list.tsx`（180行・テストのみ参照）、`financial-data-empty.tsx`、`extraction-preview.tsx`（348行）— アプリコードから一切import されていないことをgrepで確認済み
- **問題**: 財務項目定義・単位変換がフォーム（dead）とグリッド（現役）で二重定義。dead側だけにあるdirty確認・重複期間検出・単位選択の仕様が現役に引き継がれておらず「どちらが正か」不明。
- **推奨**: 4ファイル削除（git履歴で十分）。`financial-data-list.test.ts` の純粋関数は `src/lib` へ移設。フィールド定義は `lib/schemas/financial-data` に一本化。

### [Medium] U-6. APIキー入力のマスク値バインド混同
- **該当**: `settings-form.tsx:45-63`
- **問題**: `value={isVisible ? value : maskedValue}` のまま `onChange` が実値として保存。非表示中の入力イベント（目アイコン切替後の入力・自動入力・ドロップ）で `'••••xxxx'+входная文字` が実値化し**キーが黙って破壊される**。
- **推奨**: 入力欄は常に実値バインド、マスクは `type="password"` 切替のみ。

### [Medium] U-7. グリッドの年度追加デフォルトが既存年度と衝突（コメントとコードの矛盾）
- **該当**: `financial-data-grid.tsx:182-186`
- **問題**: `sorted` は昇順なのに `sorted[0].fiscal_year + 1`（最古+1）を返し、コメント「最小値-1か最大値+1」と矛盾。2020〜2024がある場合デフォルト2021で重複エラー。
- **推奨**: `sorted[sorted.length-1].fiscal_year + 1` に修正。

### [Medium] U-8. EDINETバッチの日付計算未ガード
- **該当**: `edinet-batch.tsx:19-24,32-49,76-79`
- **問題**: ①`toISOString().slice(0,10)` はUTCのためJST朝9時前は「昨日」がデフォルト、②開始>終了・`Invalid Date`（NaN）のガードなし→無反応で「完了: 0件」、③F21の6か月上限未実装、④`estimatedMinutes` が未使用。
- **推奨**: `start <= end`・日数上限を実行前検証。ローカル日付組み立てに変更。未使用変数削除。

### [Medium] U-9. クライアント初期fetchのウォーターフォール
- **該当**: `parameter-section.tsx:72-90`（get-or-createをuseEffectで実行）、`ai-research-section.tsx:48-54`、`edinet-search.tsx:65-71`
- **問題**: ページがサーバーで取得済み/取得可能なデータを、マウント後のサーバーアクション呼び出し（GET目的のPOST）で取得しスピナーを挟む。タブ切替ごとに再フェッチ。`result.success` 失敗時のハンドリングがなくエラーと「データなし」が区別不能。
- **推奨**: get-or-createをサーバー側に寄せ `initialParameters` を非null保証。検索結果は親でキャッシュまたはページの並列フェッチに統合。エラー表示の区別。

### [Medium] U-10. グリッドの再レンダー・計算効率
- **該当**: `financial-data-grid.tsx:107-130,188-194,356-395`
- **問題**: 1キーストロークで全列×全指標を再計算（`toGridValues` を指標行×列ごとにレンダー内で再構築）。列リサイズはmousemoveごとにsetState、リスナーのクリーンアップなし（リーク）、ドラッグハンドルはキーボード操作不可。
- **推奨**: 列ごとの `GridValues` を `useMemo` 化。リサイズはrAFスロットル＋クリーンアップ追加。

### [Medium] U-11. アクセシビリティ欠落（WCAG 2.1 AA / プロジェクト規約）
- **該当**:
  - `financial-data-grid.tsx:323-343` — 入力セルに `aria-label` なし・行ヘッダーが `td`（「何年度の何の項目か」が読み上げ不能。データ入力アプリとして致命的）
  - `settings-form.tsx:49,101,156,161,170`、`extraction-preview.tsx:220,235` — `htmlFor` なしラベル（`edinet-batch.tsx`・`buy-priority-input.tsx` は正しく、一貫性なし）
  - `stock-table.tsx:154-169` — 星が `'★'.repeat()` のみ・安全率の割安/割高が文字色のみ（WCAG 1.4.1）、`financial-data-grid.tsx:337-339` — dirty状態がamberボーダーのみ
  - `master-data-table.tsx:62-74` — フィルタ選択状態が見た目のみ（`aria-pressed` なし）。ページネーションがbutton+router.push（`<Link>` が適切、未使用 `useSearchParams` 残存）
  - `theory-price-section.tsx:273,383` — 「クリックして〜」というマウス前提の `aria-label`
- **推奨**: セルに `aria-label={\`${年度}年度 ${項目}\`}`、行ヘッダーは `th scope="row"`、`htmlFor`/`id` 付与、星に `aria-label="評価 3/5"`、レベル名のテキスト併記、`aria-pressed`、`<Button asChild><Link>` パターン。

### [Medium] U-12. レイアウト重複と settings 側のデータ破棄
- **該当**: `app/stocks/layout.tsx`（124行）⇔ `app/settings/layout.tsx`（70行）、settings側 `:23-27`
- **問題**: ほぼコピーの2レイアウト。settings側は `roster_category` をSELECTしながら `rosterCategory: null` で上書きして捨てており、`/settings` に移動するとサイドバーからロースター・理論株価が消える画面間不整合。
- **推奨**: ルートグループ `(app)/layout.tsx` に統合しサイドバーデータ取得を1箇所に。

### [Medium] U-13. ParameterForm が保存成功後もdirtyのまま
- **該当**: `parameter-section.tsx:124-149`
- **問題**: 成功時 `form.reset(values)` を呼ばず保存ボタンが有効であり続け、保存されたか判断しづらい。`parameters` stateが2箇所に重複保持。
- **推奨**: `onSaved` で `form.reset(values)`。

### [Low] U-14. その他
- `theory-price-section.tsx`（626行）: ファイル中腹のimport文（:75）、純粋関数 `detectChangedFields` が 'use client' からexport、`CATEGORIES` 86行が同居、`SummaryCard`/`ClickableValue` のトグル二重実装 → lib/hooks/定義ファイルへ分割
- 型アサーション散在: `financial-data-grid.tsx:215`、`stocks/[id]/page.tsx:134`（D-1解消で大半除去可能）
- マジック文字列: `input_unit: 'yen'` 直書き、`QUARTER_ORDER` ローカル定義 → schemas定数を参照
- `mode-selector.tsx:45-46` ローディング解除漏れ（遷移失敗でボタン永久disabled）
- `use-mobile.ts` 初回false確定（shadcn生成物そのまま。実害時のみ対応）
- 良い点: `loading.tsx`+Suspense併用、`Promise.all` 並列クエリ、セマンティックHTML（fieldset/legend、dl/dt/dd、caption.sr-only）の使用率は高い

---

## 5. 横断的な根本原因

個別の発見の多くは以下に収束する。ここを直すと連鎖的に複数項目が解消する。

1. **DB型を使っていない（D-1）** → `as` キャスト・手書きRow型・型注釈と実態の乖離（D-11含む）の温床。
2. **「単一の真実の源」の欠如** → デフォルト値（C-3）、カラムマッピング（D-2）、計算ロジック（C-7）、フィールド定義（U-5）、パスワード長（D-12）、単位定数（D-13）が多重定義。
3. **計算・抽出の二重実装** → エンジン⇔グリッド（C-7, C-12）、CSV⇔XBRLパーサ（C-14）、現役⇔デッドコード（U-5）。
4. **認可の防御線がRLS一本足** → middleware無効化（S-1）と資格情報露出（S-2）・自己昇格（S-3）が重なると全壊する構成。
5. **「実データでの検証」の欠如** → タクソノミタグ（C-1）・XBRL経路（C-2, C-8）が実報告書での実地検証なしに本番化しており、系統障害が潜伏。
6. **キャッシュ無効化・状態同期の設計不足** → revalidatePath不整合（D-6）、stale props（U-1）、タブアンマウント（U-3）。

---

## 6. 改善プラン（フェーズ別）

優先度は「実害の大きさ × 着手容易性」。小さくコミットしてこまめにPush（CLAUDE.md規約）。**着手前にユーザー確認が必要な項目には ※確認 を付した**（認証方式・DBスキーマ・計算仕様・RLS変更）。

### フェーズ0: 緊急セキュリティ（即日〜数日）
1. **S-0** service_roleキーの無効化・ローテーション、`.claude/settings.json` のgit管理除外＋履歴除去
2. **S-2** mode-selectorの資格情報除去＋両アカウントのパスワードローテーション ※確認
3. **S-1** middlewareの認証強制復活＋保護レイアウトのゲート追加 ※確認
4. **S-3** 管理者判定を `app_metadata` へ移行 ※確認
5. **S-4** 管理系アクションに `isAdmin()` ゲート
6. **S-5** EDINETキーのモジュールキャッシュ廃止（引数渡しに変更）
7. **S-7** `edinet_master` の書込RLSを管理者限定に ※確認
8. **S-9** オープンリダイレクト修正
9. **S-8** APIキーの暗号化保存 ※確認（方式選定）

**ゴール**: 漏洩済みシークレットが無効化され、認証・認可が多層で機能する状態。

### フェーズ1: データ正確性（抽出と計算の信頼回復）
10. **C-1** タクソノミ実地検証（IFRS企業1社＋JGAAP企業1社の実報告書で全17メトリック抽出テスト）→ 候補タグ修正
11. **C-2** XBRLパーサに `rawValue` 導入（DEI文字列の保全）
12. **C-4** プレーンコンテキスト優先のマッチング＋confidence降格
13. **C-5** 負の理論株価ガード（安全率・理想買値をnull化）
14. **C-6** グリッド保存をdirtyセルのみに（精度破壊の停止）
15. **C-3** デフォルト値の単一化 ※確認（10か20か）
16. **C-11** 丸め仕様の明文化＋負値対応
17. **C-12** truthy判定の `== null` 統一
18. **C-8** テスト追加（XBRL fixture・負値ゴールデン・Member混入・grid-indicators）
19. **C-9/C-10** 自己資本の定義・有利子負債の範囲 ※確認（仕様決定後に実装）
20. **D-11** AIサマリーのnull→「0百万円」化の修正
21. **U-7** 年度追加デフォルトの衝突修正

**ゴール**: EDINET取込が実データで検証済みになり、指標が全エッジケースで正しく、回帰テストで保護された状態。

### フェーズ2: 構造リファクタ（根本原因の解消）
22. **D-1** Supabase生成型導入（`as` キャスト一掃）
23. **U-5** デッドコード約1,060行の削除＋フィールド定義の単一ソース化
24. **C-7** グリッド指標をエンジンの薄いラッパー化（ゴールデンテストの保護を拡大）
25. **D-2** カラムマッピング集約＋ **D-8** 抽出ログの実値記録
26. **D-7** `ActionResult<T>` 判別共用体で戻り値統一＋ **D-3** 副次書き込み方針の明文化
27. **D-4** AIエラーのプロバイダ層正規化
28. **D-6** `revalidateStockPaths()` ヘルパーで無効化統一（U-1の根本対策）
29. **C-14** CSV/XBRL抽出ロジックの共通化
30. **U-12** レイアウトのルートグループ統合

**ゴール**: 「単一の真実の源」が確立し、機能追加時の修正漏れが構造的に起きにくい状態。

### フェーズ3: パフォーマンス・UX
31. **U-4** `getStocksWithIndicators()` の `cache()` 集約＋必要カラム明示
32. **U-1/U-2** 星評価・購入優先順の修正（stale props＋キーボード）
33. **U-3** タブの `forceMount` 化（編集消失の防止）
34. **U-6** settings-formのマスクバインド修正
35. **U-9** クライアント初期fetchのサーバー移行
36. **U-10** グリッドのメモ化＋リサイズスロットル
37. **D-9** マスタ登録の一括upsert化
38. **D-5** stock-lookupのDB逆引き優先＋キー解決統一
39. **S-6/S-10** レート制限・入力検証・日付範囲上限（U-8と同時に）
40. **C-13** EDINETクライアントの429リトライ・認証エラー即時失敗

**ゴール**: スケールしても重くならず、編集が消えない・巻き戻らないUI。

### フェーズ4: 品質の底上げ（随時）
41. **U-11** a11y欠落の解消（グリッドのaria-label・th scope・htmlFor・色依存の解消）
42. **U-13/U-14** フォームreset・theory-price-section分割・マジック文字列統一
43. **D-12/D-13** user-profile統一・Zod v4記法統一・残骸削除・regex強化・UUID検証統一
44. **C-14残** デッドコード削除・単位検証・comparison整合テスト・AIコメント残骸削除
45. **S-11/S-12** `.eq('user_id')` の一貫付与・依存バージョン固定・パスワードポリシー強化

---

## 付録A: ユーザー確認が必要な項目（一覧）

| # | 項目 | 確認内容 |
|---|---|---|
| 1 | S-1/S-2 | 認証必須化のタイミング、開発用ワンクリックログインの扱い |
| 2 | S-3 | 管理者ロールの管理方式（app_metadata vs 専用テーブル） |
| 3 | S-7 | `edinet_master` の書込権限（RLS変更） |
| 4 | S-8 | APIキー暗号化の方式（Vault / pgsodium / アプリ層） |
| 5 | C-3 | `cap_multiplier` のデフォルト値はどちらが正か（10 or 20） |
| 6 | C-9 | 「自己資本」の定義（純資産 vs 株主資本）— 山口式の解釈 |
| 7 | C-10 | 有利子負債の包含範囲（リース債務・CP・1年内償還社債） |
| 8 | C-11 | 負値の丸め仕様（絶対値四捨五入 vs 数学的丸め） |
| 9 | D-10 | 財務データ必須カラムのNULL許容化（DBスキーマ変更） |

## 付録B: ファイル別ホットスポット

| ファイル | 関連項目 |
|---|---|
| `.claude/settings.json` | S-0 |
| `src/lib/supabase/proxy.ts` | S-1, D-13(hasEnvVars) |
| `src/components/mode-selector.tsx` | S-2, U-14 |
| `src/lib/auth/admin.ts` | S-3 |
| `src/lib/edinet/taxonomy.ts` | C-1, C-9, C-10 |
| `src/lib/edinet/xbrl-parser.ts` | C-2, C-8, C-14 |
| `src/lib/edinet/csv-parser.ts` | C-4, C-14 |
| `src/lib/edinet/client.ts` | S-5, S-10, C-13 |
| `src/lib/calc/safety.ts` | C-5, C-11 |
| `src/lib/calc/grid-indicators.ts` | C-7, C-12 |
| `src/components/stocks/financial-data-grid.tsx` | C-6, U-3, U-7, U-10, U-11 |
| `src/actions/edinet-master.ts` | S-4, D-1, D-2, D-9 |
| `src/actions/ai-research.ts` | D-3, D-4, D-11 |
| `src/actions/stock-lookup.ts` | D-5 |
| `src/components/stocks/star-rating.tsx` | U-1, U-2 |
| `src/app/stocks/{page,layout}.tsx` | U-4, U-12 |
| `src/components/stocks/financial-data-form.tsx` 他3件 | U-5（削除対象） |
