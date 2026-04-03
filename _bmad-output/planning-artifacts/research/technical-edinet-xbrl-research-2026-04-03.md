# EDINET API + XBRL データ解析 技術リサーチレポート

Date: 2026-04-03
Status: Complete

## 1. EDINET API v2 仕様

### 基本情報
- **ベースURL**: `https://api.edinet-fsa.go.jp`
- **認証**: `Subscription-Key` パラメータ（必須、v2で追加）
- **料金**: 無料（金融庁運営の公的サービス）
- **通信**: TLS 1.2以上、GETのみ
- **クロスドメイン**: 禁止（サーバーサイドからのみ呼び出し可能）

### APIキー取得
1. https://api.edinet-fsa.go.jp/api/auth/index.aspx?mode=1 にアクセス
2. メール + パスワード（12〜256文字）でアカウント作成
3. SMS多要素認証を設定
4. 氏名・電話番号を登録 → APIキー発行
- 2年以上未使用で自動削除

### エンドポイント

#### 書類一覧API
```
GET /api/v2/documents.json?date={YYYY-MM-DD}&type={1|2}&Subscription-Key={key}
```
- `type=1`: メタデータのみ
- `type=2`: 提出書類一覧 + メタデータ

#### 書類取得API
```
GET /api/v2/documents/{docID}?type={1-5}&Subscription-Key={key}
```
- `type=1`: XBRL (ZIP)
- `type=2`: PDF
- `type=5`: CSV (ZIP) — XBRLをCSV変換済み

### 有価証券報告書のフィルタ条件
- `docTypeCode == "120"` — 有価証券報告書
- または `ordinanceCode == "010"` かつ `formCode == "030000"`

### レート制限
- 明示的な記載なし
- 実運用: リクエスト間に3〜5秒のスリープ推奨

### レスポンス主要フィールド
- `docID`: 書類管理番号（例: "S1000001"）
- `edinetCode`: 提出者EDINETコード
- `secCode`: 証券コード（5桁、例: "72030"）
- `xbrlFlag`: XBRL有無（"1"=あり）
- `csvFlag`: CSV有無
- `periodStart` / `periodEnd`: 事業年度

---

## 2. XBRL データ構造

### ZIP内ディレクトリ構造（type=1）
```
ZIP/
└── XBRL/
    └── PublicDoc/
        ├── *.xbrl     # 従来XBRL
        ├── *.htm       # iXBRL（インラインXBRL）
        ├── *_lab.xml   # ラベルリンク
        ├── *_pre.xml   # プレゼンテーションリンク
        └── manifest_*.xml
```

### iXBRL vs 従来XBRL
- 最近の提出書類の60%以上がiXBRL形式（.htm）
- 両方対応が必要

### 名前空間プレフィックス
| プレフィックス | 用途 |
|------------|------|
| `jpcrp_cor` | 有報の表紙・企業情報 |
| `jppfs_cor` | **財務諸表の勘定科目**（最重要） |
| `jpdei_cor` | 文書・法人基本情報 |
| `jpigp_cor` | IFRS適用企業 |

### 連結 vs 単体の判別
- contextRef に `_NonConsolidatedMember` が**含まれない** → 連結
- contextRef に `_NonConsolidatedMember` が**含まれる** → 単体
- `CurrentYearDuration` = 連結・当期間（P/L, CF）
- `CurrentYearInstant` = 連結・当期時点（B/S）

---

## 3. 主要XBRLタグ名

### 損益計算書（P/L）
| 項目 | J-GAAP | IFRS |
|------|--------|------|
| 売上高 | `jppfs_cor:NetSales` | `jppfs_cor:Revenue` |
| 営業利益 | `jppfs_cor:OperatingIncome` | `jppfs_cor:OperatingProfit` |
| 当期純利益 | `jppfs_cor:ProfitLossAttributableToOwnersOfParent` | `jppfs_cor:ProfitAttributableToOwnersOfParent` |

### 貸借対照表（B/S）
| 項目 | J-GAAP | IFRS |
|------|--------|------|
| 総資産 | `jppfs_cor:TotalAssets` | `jppfs_cor:Assets` |
| 純資産 | `jppfs_cor:NetAssets` | `jppfs_cor:TotalEquity` |

### キャッシュフロー（CF）
| 項目 | タグ |
|------|-----|
| 営業CF | `jppfs_cor:CashFlowsFromOperatingActivities` |
| 投資CF | `jppfs_cor:CashFlowsFromInvestingActivities` |

### 1株当たり情報（jpcrp_cor）
| 項目 | タグ |
|------|-----|
| EPS | `jpcrp_cor:BasicEarningsLossPerShareSummaryOfBusinessResults` |
| 発行済株式数 | `jpcrp_cor:TotalNumberOfIssuedSharesSummaryOfBusinessResults` |

### XBRLに含まれない情報
- **現在の株価** — 別APIが必要（J-Quants等）
- **有利子負債** — 単一タグなし（短期借入金+長期借入金+社債を合算）

---

## 4. Node.js/TypeScript 実装戦略

### 推奨ライブラリ
```json
{
  "jszip": "^3.10.1",          // ZIP展開
  "fast-xml-parser": "^4.3.0", // 従来XBRL (.xbrl) パース
  "cheerio": "^1.0.0"          // iXBRL (.htm) パース
}
```

### 重要注意: iXBRLの `scale` 属性
```html
<ix:nonFraction name="jppfs_cor:NetSales" scale="6">1,234</ix:nonFraction>
```
→ 実際の値は 1,234 × 10^6 = 1,234,000,000（12.34億円）

### 推奨アプローチ
1. **まず CSV (type=5) で概念実証** — XBRLパースの複雑さを避ける
2. 必要に応じて XBRL パースに移行
3. edinet-mcp の taxonomy.yaml を参考にタグマッピングJSON作成

---

## 5. 勘定科目マッピングの課題

### 売上高だけで6パターン以上
- `NetSales`, `Revenue`, `Revenues`, `SalesRevenues`, `TotalNetRevenues`, `OperatingRevenues`

### 対策
- 会計基準を `jpdei_cor:AccountingStandardsDEI` から判定
- 基準ごとに優先順位付きフォールバックリストで検索
- 名前空間URIはハードコーディングせず動的取得

---

## 6. Vercel 制約への対応

- **Hobby プラン**: サーバーレス関数10秒タイムアウト
- ZIP ダウンロード + パースは10秒以内に収まるか要検証
- 大きい有報ZIPは50MB超の場合あり → メモリ制約注意
- 対策: Supabase Edge Functions（Deno、150秒タイムアウト）の利用も検討

---

## 7. 参考リソース

- [EDINET API 仕様書 v2 PDF](https://disclosure2dl.edinet-fsa.go.jp/guide/static/disclosure/download/ESE140206.pdf)
- [EDINETタクソノミ ダウンロード](https://disclosure2.edinet-fsa.go.jp/weee0010.aspx)
- [edinet-mcp (taxonomy.yaml)](https://github.com/ajtgjmdjp/edinet-mcp) — 3基準統合マッピング161項目
- [edinet-xbrl (Python)](https://github.com/axioradev/edinet-xbrl) — iXBRL+従来XBRL両対応
