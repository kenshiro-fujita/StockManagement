# Claude Code → Codex CLI 移行ガイド（StockManagement）

このディレクトリは、開発環境を **Claude Code から Codex CLI へ移行**し、同じ開発体験を保つための成果物一式です。

---

## 1. 何が用意されているか

| ファイル | 役割 | 配置先 |
|---|---|---|
| `../AGENTS.md` | プロジェクト指示書（`CLAUDE.md` ＋ 恒久メモリの統合版） | リポジトリ直下（Codex が自動読込） |
| `config.toml.example` | Codex の承認ポリシー・サンドボックス・プロジェクト信頼設定 | `~/.codex/config.toml` へマージ |
| `install.sh` | BMAD スラッシュコマンドと設定の自動インストーラ | 実行するだけ |
| `README.md` | この移行ガイド | — |

---

## 2. インストール手順

```bash
# 1) Codex CLI を導入（未導入の場合）
npm install -g @openai/codex   # もしくは brew install codex

# 2) ログイン
codex login

# 3) 本リポジトリのルートで移行スクリプトを実行
bash codex-migration/install.sh

# 4) 既存の ~/.codex/config.toml があれば、テンプレート内容を手動マージ
#    （config.toml.stockmanagement を参照）

# 5) 動作確認
codex            # 起動
/prompts:        # スラッシュコマンド一覧に bmad-* が出れば成功
```

---

## 3. Claude Code との対応関係

| Claude Code | Codex CLI | 備考 |
|---|---|---|
| `CLAUDE.md` | `AGENTS.md` | Codex は Git ルート→cwd の各階層を連結読込（32 KiB 上限） |
| 自動メモリ `~/.claude/.../memory/` | **Codex に自動メモリ機能なし** | 恒久ルール（敬語・コーディング・ペース・フィードバック対応）は `AGENTS.md` に畳み込み済み |
| `.claude/commands/*.md` | `~/.codex/prompts/*.md` | `install.sh` が変換移植。呼び出しは `/prompts:<名前>` |
| `.claude/settings*.json` の permissions | `~/.codex/config.toml` の `sandbox_mode` + `approval_policy` + `projects.trust_level` | 仕組みが異なるため設計変換（下記） |
| `WebFetch` / `WebSearch` 許可 | `sandbox_workspace_write.network_access = true` | ネットワークアクセスとして一括許可 |
| 組込スラッシュ（`/code-review` 等） | Codex 同等機能 or BMAD プロンプトで代替 | 一部は移行先で名称・挙動が異なる |

---

## 4. 権限モデルの違い（重要）

Claude Code は **コマンド単位の allow/deny リスト**で細かく制御していました。
Codex は **サンドボックス + 承認ポリシー**という別アプローチです。

- `approval_policy = "on-request"` … エージェントが必要と判断したときだけ確認（ペース優先に合致）
- `sandbox_mode = "workspace-write"` … ワークスペース配下の編集を許可（Claude の Edit/Write 相当）
- `projects.trust_level = "trusted"` … このリポジトリを信頼

### ⚠️ 注意: 秘密ファイルの読み取り拒否は移行できません

Claude Code の `settings.local.json` には `.env` / `*secret*` / `~/.ssh` 等の **読み取り拒否（deny）** がありました。
**Codex にはファイル単位の読み取り拒否機能がありません。** 代替策は以下です。

- 秘密情報はリポジトリにコミットしない（`.gitignore` を維持）。
- 機密を扱う作業では `approval_policy` を厳しめ（`untrusted`）にする。
- どうしても隔離したい場合は、秘密ファイルをワークスペース外へ移動する。

---

## 5. 移行後に残る差分・要確認事項

- **自動メモリの継続学習はなくなります。** 新しい恒久ルールが生まれたら、手動で `AGENTS.md` に追記してください（Claude の memory 自動保存に相当する運用）。
- **BMAD プロンプト内の `{project-root}`** は `install.sh` が絶対パスへ置換済みです。リポジトリを別パスへ移動したら再実行してください。
- **OpenAI は custom prompts を「skills」へ移行推奨**としています。将来的には BMAD コマンドを Codex skills 化する余地があります（当面は prompts で動作）。
- Codex のモデル名（`config.toml` の `model`）は利用プランに合わせて設定してください。

---

## 6. 元のメモリ内容の保管場所

Claude 時代のメモリ原本は以下に残っています（参照用）。恒久ルールは `AGENTS.md` に反映済みです。

```
~/.claude/projects/-Users-fujita-kenshirou-projects-StockManagement/memory/
├── MEMORY.md                       … インデックス
├── feedback_coding_style.md        … 小さく切り出す＋コメント必須 → AGENTS.md 反映済
├── feedback_pace.md                … 開発ペースの好み           → AGENTS.md 反映済
├── feedback_respond_to_feedback.md … フィードバック対応         → AGENTS.md 反映済
├── project_auto_stock_lookup.md    … 銘柄自動取得（将来タスク） → AGENTS.md 反映済
├── project_sidebar_tw_fix.md       … Tailwind v3/v4 注意点      → AGENTS.md 反映済
└── technical-notes.md              … 設計インプット             → AGENTS.md 反映済
```
