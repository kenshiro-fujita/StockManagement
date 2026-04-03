# Story 5.3: ユーザー確認フロー

Status: ready-for-dev

## Story

As a ログイン済みユーザー,
I want EDINET から自動抽出された財務データを確認・修正してから保存したい,
so that 抽出ミスを防ぎ、正確なデータで分析を行える。（FR14）

## Acceptance Criteria

1. **Given** 抽出結果が表示されている **When** 値を確認する **Then** 各項目を編集可能なフォームとして表示され、修正できる
2. **Given** 抽出結果に null（未抽出）の項目がある **When** 確認画面を見る **Then** 未抽出項目が目立つように表示され、手動入力できる
3. **Given** 抽出結果を修正した **When** 「財務データに反映」を押す **Then** 修正後の値で financial_data に保存される
4. **Given** 年度情報が抽出されている **When** 確認画面を見る **Then** 年度・四半期・連結区分が自動設定されているが、変更もできる
5. **Given** 同じ年度のデータが既に存在する **When** 保存しようとする **Then** 上書き確認のダイアログが表示される

## Tasks / Subtasks

- [ ] Task 1: 抽出結果の編集可能フォーム化
  - [ ] ExtractionPreview コンポーネントを editable テーブルに変更
  - [ ] 各値を Input フィールド化（null 項目はハイライト付き空フィールド）
  - [ ] 年度・四半期・連結区分の選択UI

- [ ] Task 2: 保存前の確認・上書き検出
  - [ ] 既存データとの重複チェック Server Action
  - [ ] 上書き確認ダイアログ

- [ ] Task 3: テスト

## Dev Notes

### 現状の抽出UI

Story 5.2 で実装した edinet-search.tsx の抽出結果テーブルは読み取り専用。
これを編集可能なフォームに拡張する。

### References

- [Source: src/components/stocks/edinet-search.tsx — 現在の抽出結果表示]

## Dev Agent Record

### Agent Model Used

### Completion Notes List

### File List
