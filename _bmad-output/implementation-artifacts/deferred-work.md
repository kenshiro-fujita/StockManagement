# Deferred Work

- source_spec: none
  summary: EDINET抽出結果プレビューの金額単位を一貫して表示する（F16）。
  evidence: EDINETメイン導線統合とは独立してレビュー・リリースできる表示修正であるため。
- source_spec: none
  summary: 銘柄一覧テーブルの列幅を利用者が調整できるようにする（F4）。
  evidence: 一覧画面の独立した操作性改善であり、EDINET取込フローと結合する必要がないため。
- source_spec: none
  summary: EDINETマスタ取得バッチに停止操作、進捗率、日付範囲の自動調整を追加する（F19、F14、F21）。
  evidence: 管理者向けのバックグラウンド取得体験であり、利用者向けの銘柄詳細導線とは別の検証対象になるため。
- source_spec: none
  summary: EDINET検索結果から有価証券報告書PDFを別タブで開けるようにする（F15）。
  evidence: EDINET APIの取得種別を追加する独立した外部API変更であるため。
- source_spec: none
  summary: EDINET実データを用いたE2E検証を追加する。
  evidence: 実装済みの抽出機能に対する統合検証であり、UI導線変更と分離して再現性とテストデータ方針を決める必要があるため。
- source_spec: none
  summary: ロースターカテゴリをユーザーごとにカスタマイズ可能にする（F13）。
  evidence: DBスキーマと制約の変更を伴う独立機能であり、事前確認が必要なため。
- source_spec: none
  summary: パラメータ既定値と財務グリッド計算指標の未確定仕様を決定して実装する（F17、F18）。
  evidence: 既存計算結果、DB既定値、ゴールデンテストへ影響するため、EDINET導線とは別に仕様確認が必要なため。
- source_spec: none
  summary: UIコンポーネントテスト基盤を導入して主要画面のレンダリングテストを追加する。
  evidence: テスト基盤の追加は機能導線の変更とは独立してレビュー・導入できるため。
- source_spec: none
  summary: Vercelへのデプロイと本番環境変数を設定する。
  evidence: デプロイ設定と環境変数の変更には事前確認が必要であり、アプリ機能の実装から分離するため。
