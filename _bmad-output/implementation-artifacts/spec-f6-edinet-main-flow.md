---
title: 'EDINET年次データ取込を財務データ導線へ統合する'
type: 'feature'
created: '2026-07-26'
status: 'done'
review_loop_iteration: 0
baseline_commit: '513d1231e89d6787203b0b9e3e5368cdb6107660'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-design-specification.md'
  - '{project-root}/_bmad-output/planning-artifacts/feedback-backlog.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 年次財務データをEDINETから取り込む機能は既にありますが、銘柄詳細の独立した「EDINET」タブに置かれています。利用者が財務データを入力・確認する主導線から外れているため、取込機能を見つけにくく、手動入力と自動取得の選択が分断されています。

**Approach:** 既存の検索・取込コンポーネントと安全境界を変更せず、「財務データ」タブの先頭へ配置します。独立したEDINETタブは削除し、取込後は従来どおり同じ画面の財務グリッドへ反映します。

## Boundaries & Constraints

**Always:** 既存の認証、所有権検証、証券コード照合、マスタ検索、取込時のupsert、`router.refresh()`の動作を維持します。検索中・失敗時・0件時・取込中の既存アクセシビリティと再試行導線を保持します。画面文言は日本語で、EDINETの結果表示と財務グリッドは意味のある別セクションとして構成します。

**Ask First:** EDINET APIの呼出種別や頻度を変える場合、DBスキーマまたは保存内容を変える場合、既存データの上書き確認を新設・変更する場合、UIテスト用の依存関係を追加する場合は、実装前にユーザーへ確認します。

**Never:** EDINET検索・抽出・取込ロジックを複製しません。マイグレーション、計算ロジック、パラメータ仕様、別タブへのリダイレクト、Gitのcommit・pushは行いません。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| マスタに年次データがある | 利用者が「財務データ」タブを初めて開く | グリッドの前にEDINET結果を表示し、対象年度を取り込める | 既存の取込中disabledとToastを維持します |
| マスタに該当データがない | 検索結果が0件 | 同じタブ内で管理者バッチ取得の案内を表示し、手動入力グリッドは利用できます | 例外として扱いません |
| マスタ検索に失敗する | Actionがエラーを返す、または通信に失敗する | エラーと再試行操作を表示し、財務グリッドは引き続き利用できます | `role="alert"`を維持します |
| 取込が成功する | 「取り込む」を実行する | 成功通知の後に画面を更新し、財務グリッドへ最新データを表示します | 既存の未保存セル保持ルールに従います |

</frozen-after-approval>

## Code Map

- `src/components/stocks/stock-detail-tabs.tsx` -- 銘柄詳細タブの型、トリガー、遅延マウント対象を管理します。
- `src/components/stocks/stock-detail-client.tsx` -- 銘柄コードと各タブコンテンツを組み立てます。
- `src/components/stocks/financial-data-section.tsx` -- 財務データタブのコンテナとして、EDINET取込とグリッドを順に表示します。
- `src/components/stocks/edinet-search.tsx` -- 認証済みマスタ検索、取込、空状態、エラー表示を提供します。
- `src/components/stocks/theory-price-section.tsx` -- 財務データ未入力時の次アクションを案内します。
- `src/components/stocks/stock-detail-tabs.test.tsx` -- タブナビゲーションの公開構成を回帰テストします。

## Tasks & Acceptance

**Execution:**
- [x] `src/components/stocks/stock-detail-tabs.tsx` -- EDINET専用タブの型、トリガー、パネル、propsを削除し、財務データを唯一の取込先にします。
- [x] `src/components/stocks/stock-detail-client.tsx` -- `stockCode`を財務データセクションへ渡し、独立タブへの依存を除去します。
- [x] `src/components/stocks/financial-data-section.tsx` -- EDINET取込結果を財務グリッドの前に配置し、見出しで領域を区別します。
- [x] `src/components/stocks/theory-price-section.tsx` -- 財務データ未入力時の案内を、財務データタブ内のEDINET取込導線に合わせます。
- [x] `src/components/stocks/stock-detail-tabs.test.tsx` -- 既存Vitest環境で、公開タブに「財務データ」があり「EDINET」がないことを検証します。

**Acceptance Criteria:**
- Given 銘柄詳細を表示しているとき、when タブ一覧を確認すると、then 「EDINET」専用タブは表示されず、「財務データ」タブから年次データを検索・取り込みできます。
- Given EDINETマスタに対象銘柄の抽出済みデータがあるとき、when 財務データタブを開くと、then グリッドより前に年度ごとの結果と「取り込む」操作が表示されます。
- Given 取込に成功したとき、when 画面更新が完了すると、then 従来どおり財務グリッドへ取り込んだ年度が反映されます。
- Given EDINETマスタが空または検索に失敗したとき、when 財務データタブを開くと、then 既存の案内または再試行操作が表示され、手動入力グリッドは使い続けられます。

## Spec Change Log

## Design Notes

財務データの取得方法を選び、その直後に同じ画面で内容を確認・編集できる順序にします。これにより、マスタの準備状況に応じて「EDINETから取り込む」か「手動で入力する」かを自然に選べます。既存の`EdinetSearch`をそのまま再利用するため、EDINET APIの通信、権限、保存契約は変えません。

## Verification

**Commands:**
- `npm run check` -- expected: フォーマット、Lint、型チェック、Vitestがすべて成功します。

**Manual checks:**
- 銘柄詳細で「財務データ」タブを開き、EDINET結果・0件案内・検索失敗時の再試行・取込成功後のグリッド反映を確認します。
- キーボード操作で財務データタブ、再試行、取込操作へ到達でき、ロード状態とエラー状態が読み上げ対象として維持されることを確認します。

## Suggested Review Order

**取込と手動編集の主導線**

- EDINET結果とグリッドを一つの意味的な画面で連続させます。
  [`financial-data-section.tsx:14`](../../src/components/stocks/financial-data-section.tsx#L14)

- 銘柄コードを既存検索コンポーネントへ受け渡します。
  [`stock-detail-client.tsx:85`](../../src/components/stocks/stock-detail-client.tsx#L85)

**タブ導線の整理**

- EDINET専用タブを削除し、公開タブ定義を単一化します。
  [`stock-detail-tabs.tsx:12`](../../src/components/stocks/stock-detail-tabs.tsx#L12)

- 空状態の次アクションを新しい取込導線へ合わせます。
  [`theory-price-section.tsx:36`](../../src/components/stocks/theory-price-section.tsx#L36)

**回帰検証**

- 基本タブの集合と表示順を依存追加なしで固定します。
  [`stock-detail-tabs.test.tsx:11`](../../src/components/stocks/stock-detail-tabs.test.tsx#L11)
