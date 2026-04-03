# Story 5.1: EDINET API基盤

Status: ready-for-dev

## Story

As a ログイン済みユーザー,
I want アプリがEDINET APIと連携して有価証券報告書の一覧を自動取得してほしい,
so that 手動で財務データを探す手間が省け、分析対象の書類を素早く特定できる。（FR29）

## Acceptance Criteria

1. **Given** EDINET APIキーが環境変数に設定されている **When** 書類一覧取得APIを呼び出す **Then** 指定日付の提出書類一覧が取得できる
2. **Given** 書類一覧が取得されている **When** 有価証券報告書をフィルタする **Then** docTypeCode=120 かつ xbrlFlag=1 の書類のみが抽出される
3. **Given** 銘柄詳細ページが表示されている **When** 「EDINET検索」ボタンを押す **Then** その銘柄の証券コードで有価証券報告書を検索し、候補一覧が表示される
4. **Given** 検索結果が表示されている **When** 書類を選択する **Then** docIDが保存され、次のステップ（データ取得）に進める
5. **Given** EDINET APIが応答しない **When** リクエストがタイムアウトする **Then** ユーザーにエラーメッセージが表示され、手動入力へのフォールバックが案内される

## Tasks / Subtasks

- [ ] Task 1: DBマイグレーション
  - [ ] `edinet_documents` テーブル作成（docID, stock_id, user_id, sec_code, file_date, period_start, period_end, doc_type_code, xbrl_flag, csv_flag, status, created_at）
  - [ ] RLSポリシー設定

- [ ] Task 2: EDINET APIクライアント
  - [ ] `src/lib/edinet/client.ts` — 書類一覧API呼び出し（日付指定）
  - [ ] `src/lib/edinet/client.ts` — 書類取得API呼び出し（docID + type指定）
  - [ ] `src/lib/edinet/types.ts` — レスポンス型定義
  - [ ] レート制限対応（リクエスト間3秒スリープ）
  - [ ] タイムアウト・エラーハンドリング（30秒、リトライ最大3回）

- [ ] Task 3: 有価証券報告書検索 Server Action
  - [ ] `src/actions/edinet.ts` — searchEdinetDocuments（証券コード + 日付範囲で有報検索）
  - [ ] docTypeCode=120、xbrlFlag/csvFlag のフィルタリング
  - [ ] 結果を edinet_documents テーブルに保存

- [ ] Task 4: 銘柄詳細ページへの検索UI追加
  - [ ] `src/components/stocks/edinet-search.tsx` — 検索ボタン + 結果一覧 + 選択UI
  - [ ] 銘柄詳細ページのタブまたはセクションに統合
  - [ ] エラー時のフォールバック表示

- [ ] Task 5: テスト
  - [ ] EDINET API型定義のテスト
  - [ ] フィルタリングロジックのテスト

## Dev Notes

### EDINET API 仕様

**ベースURL**: `https://api.edinet-fsa.go.jp`
**認証**: `Subscription-Key` クエリパラメータ

**書類一覧API**:
```
GET /api/v2/documents.json?date=YYYY-MM-DD&type=2&Subscription-Key={key}
```

**書類取得API**:
```
GET /api/v2/documents/{docID}?type={1|5}&Subscription-Key={key}
```

**有価証券報告書フィルタ**:
- `docTypeCode === "120"`
- `xbrlFlag === "1"` または `csvFlag === "1"`
- `secCode` で銘柄の証券コードと照合（5桁、末尾0あり）

### 証券コードの照合

EDINETの `secCode` は5桁（例: "72030"）。stocks テーブルの `stock_code` は4桁（例: "7203"）。
照合時は `secCode.startsWith(stock_code)` または `secCode.slice(0, 4) === stock_code` で比較する。

### 検索の日付戦略

有報は年1回提出。銘柄の直近の有報を探すには、過去1年分の日付をイテレートする必要がある。
最適化: EDINETコードリストで `edinetCode` を特定し、直接フィルタする方が効率的だが、初期実装では日付イテレーション + secCode フィルタで十分。

ただし1日分のAPIコールで3〜5秒かかるため、365日分は非現実的。
→ 決算月の前後2ヶ月（約60日分）をデフォルト検索範囲にする。
→ ユーザーが検索範囲を指定できるUIも用意する。

### 環境変数

```
EDINET_API_KEY=xxxxx  # .env.local に設定、Vercelの環境変数にも設定
```

### エラーハンドリング

- NFR17: 外部API障害時にユーザーに明確なエラーメッセージを表示し、手動入力へのフォールバックを提供
- NFR18: タイムアウト30秒以内、リトライ最大3回

### Project Structure Notes

- `supabase/migrations/YYYYMMDDHHMMSS_create_edinet_documents.sql` — 新規
- `src/lib/edinet/client.ts` — 新規
- `src/lib/edinet/types.ts` — 新規
- `src/actions/edinet.ts` — 新規
- `src/components/stocks/edinet-search.tsx` — 新規
- `src/app/stocks/[id]/page.tsx` — 修正（EDINET検索セクション追加）

### References

- [Source: _bmad-output/planning-artifacts/research/technical-edinet-xbrl-research-2026-04-03.md]
- [Source: EDINET API 仕様書 v2 — https://disclosure2dl.edinet-fsa.go.jp/guide/static/disclosure/download/ESE140206.pdf]

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
