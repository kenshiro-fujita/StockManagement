/**
 * Supabase データベース型定義
 *
 * 【重要】本来は `supabase gen types typescript --local` で自動生成すべきものを、
 * Docker が使えない環境のためマイグレーション SQL（supabase/migrations/ 全14本超）
 * から手起こししたファイル。Docker が起動できるようになったら必ず再生成して
 * このファイルを置き換えること。
 *
 * 【運用ルール】スキーマ変更（マイグレーション追加）時は必ずこのファイルも更新すること。
 *
 * 【自動生成との差分】roster_category（CHECK 制約あり）のみ、アプリ既存の
 * RosterCategory 型と一致させるため文字列リテラルのユニオン型で表現している
 * （自動生成では単なる string になる）。他の CHECK 制約付きカラムは、フォーム入力
 * 由来の string 値と衝突しないよう自動生成と同じ string のままにしてある。
 *
 * 型マッピング: UUID/TEXT/DATE/TIMESTAMPTZ → string、
 * NUMERIC/INTEGER/BIGINT → number、BOOLEAN → boolean。
 * NOT NULL でないカラムは `| null`、DEFAULT 付きカラムは Insert で optional。
 */

/**
 * stocks.roster_category / roster_history の CHECK 制約値（銘柄の名簿分類）。
 * src/lib/types/roster.ts の RosterCategory と同一の値集合（DB 側が真実の源）
 */
type RosterCategoryColumn = 'core' | 'growth' | 'value' | 'watch' | 'sell';

export type Database = {
  public: {
    Tables: {
      /** 銘柄マスタ（ユーザーごとに登録する銘柄） */
      stocks: {
        Row: {
          id: string;
          user_id: string;
          stock_code: string;
          company_name: string;
          market: string | null;
          sector: string | null;
          business_segment: string | null;
          // 20260402 で追加（名簿分類）
          roster_category: RosterCategoryColumn | null;
          // 20260403 で追加（5段階評価と購入優先度）
          rating: number | null;
          buy_priority: number | null;
          // 20260404 で追加（事業概要テキスト）
          business_description: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          stock_code: string;
          company_name: string;
          market?: string | null;
          sector?: string | null;
          business_segment?: string | null;
          roster_category?: RosterCategoryColumn | null;
          rating?: number | null;
          buy_priority?: number | null;
          business_description?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          stock_code?: string;
          company_name?: string;
          market?: string | null;
          sector?: string | null;
          business_segment?: string | null;
          roster_category?: RosterCategoryColumn | null;
          rating?: number | null;
          buy_priority?: number | null;
          business_description?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      /** 財務データ（ワイドテーブル設計: 1期 = 1行、金額は円で保存） */
      financial_data: {
        Row: {
          id: string;
          user_id: string;
          stock_id: string;
          fiscal_year: number;
          fiscal_quarter: string;
          consolidation_type: string;
          // 必須項目（円単位、BIGINT）
          revenue: number;
          operating_income: number;
          net_income: number;
          total_assets: number;
          equity: number;
          // 任意項目（円単位、BIGINT）
          interest_bearing_debt: number | null;
          operating_cf: number | null;
          investing_cf: number | null;
          shares_outstanding: number | null;
          interest_expense: number | null;
          current_stock_price: number | null;
          // 20260405 で追加（NUMERIC）
          cash_and_equivalents: number | null;
          current_assets: number | null;
          investments_and_other_assets: number | null;
          current_liabilities: number | null;
          non_current_liabilities: number | null;
          shareholders_equity: number | null;
          beta: number | null;
          input_unit: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          stock_id: string;
          fiscal_year: number;
          fiscal_quarter: string;
          // DEFAULT 'consolidated' があるため optional
          consolidation_type?: string;
          revenue: number;
          operating_income: number;
          net_income: number;
          total_assets: number;
          equity: number;
          interest_bearing_debt?: number | null;
          operating_cf?: number | null;
          investing_cf?: number | null;
          shares_outstanding?: number | null;
          interest_expense?: number | null;
          current_stock_price?: number | null;
          cash_and_equivalents?: number | null;
          current_assets?: number | null;
          investments_and_other_assets?: number | null;
          current_liabilities?: number | null;
          non_current_liabilities?: number | null;
          shareholders_equity?: number | null;
          beta?: number | null;
          // DEFAULT 'million' があるため optional
          input_unit?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          stock_id?: string;
          fiscal_year?: number;
          fiscal_quarter?: string;
          consolidation_type?: string;
          revenue?: number;
          operating_income?: number;
          net_income?: number;
          total_assets?: number;
          equity?: number;
          interest_bearing_debt?: number | null;
          operating_cf?: number | null;
          investing_cf?: number | null;
          shares_outstanding?: number | null;
          interest_expense?: number | null;
          current_stock_price?: number | null;
          cash_and_equivalents?: number | null;
          current_assets?: number | null;
          investments_and_other_assets?: number | null;
          current_liabilities?: number | null;
          non_current_liabilities?: number | null;
          shareholders_equity?: number | null;
          beta?: number | null;
          input_unit?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      /** 評価パラメータ（銘柄ごとのユーザー調整値、1ユーザー×1銘柄で1行） */
      parameters: {
        Row: {
          id: string;
          user_id: string;
          stock_id: string;
          discount_rate: number;
          growth_rate: number;
          tax_rate: number;
          cap_multiplier: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          stock_id: string;
          // 4つとも DEFAULT があるため optional
          discount_rate?: number;
          growth_rate?: number;
          tax_rate?: number;
          cap_multiplier?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          stock_id?: string;
          discount_rate?: number;
          growth_rate?: number;
          tax_rate?: number;
          cap_multiplier?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      /** 名簿分類の変更履歴（いつ・なぜ分類を変えたかの監査ログ） */
      roster_history: {
        Row: {
          id: string;
          user_id: string;
          stock_id: string;
          // from は初回分類時に NULL（CHECK 制約なしだが実値は分類値のみ）
          from_category: RosterCategoryColumn | null;
          to_category: RosterCategoryColumn;
          reason: string;
          changed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          stock_id: string;
          from_category?: RosterCategoryColumn | null;
          to_category: RosterCategoryColumn;
          reason: string;
          changed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          stock_id?: string;
          from_category?: RosterCategoryColumn | null;
          to_category?: RosterCategoryColumn;
          reason?: string;
          changed_at?: string | null;
        };
        Relationships: [];
      };
      /** EDINET 書類メタデータ（ユーザーが取得した書類の一覧） */
      edinet_documents: {
        Row: {
          id: string;
          user_id: string;
          // 銘柄削除時は SET NULL されるため nullable
          stock_id: string | null;
          doc_id: string;
          sec_code: string | null;
          edinet_code: string | null;
          filer_name: string | null;
          doc_type_code: string | null;
          doc_description: string | null;
          file_date: string;
          period_start: string | null;
          period_end: string | null;
          xbrl_flag: string | null;
          csv_flag: string | null;
          status: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          stock_id?: string | null;
          doc_id: string;
          sec_code?: string | null;
          edinet_code?: string | null;
          filer_name?: string | null;
          doc_type_code?: string | null;
          doc_description?: string | null;
          file_date: string;
          period_start?: string | null;
          period_end?: string | null;
          xbrl_flag?: string | null;
          csv_flag?: string | null;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          stock_id?: string | null;
          doc_id?: string;
          sec_code?: string | null;
          edinet_code?: string | null;
          filer_name?: string | null;
          doc_type_code?: string | null;
          doc_description?: string | null;
          file_date?: string;
          period_start?: string | null;
          period_end?: string | null;
          xbrl_flag?: string | null;
          csv_flag?: string | null;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      /** 抽出ログ（FR15: XBRL からのデータ判定過程を記録する監査用） */
      extraction_logs: {
        Row: {
          id: string;
          user_id: string;
          stock_id: string;
          doc_id: string;
          fiscal_year: number;
          metric_key: string;
          matched_tag: string | null;
          context_id: string | null;
          raw_value: string | null;
          normalized_value: number | null;
          confidence: string | null;
          accounting_standard: string | null;
          source_type: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          stock_id: string;
          doc_id: string;
          fiscal_year: number;
          metric_key: string;
          matched_tag?: string | null;
          context_id?: string | null;
          raw_value?: string | null;
          normalized_value?: number | null;
          confidence?: string | null;
          accounting_standard?: string | null;
          source_type?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          stock_id?: string;
          doc_id?: string;
          fiscal_year?: number;
          metric_key?: string;
          matched_tag?: string | null;
          context_id?: string | null;
          raw_value?: string | null;
          normalized_value?: number | null;
          confidence?: string | null;
          accounting_standard?: string | null;
          source_type?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      /** AI 調査結果（銘柄ごとの AI リサーチの保存） */
      ai_research: {
        Row: {
          id: string;
          user_id: string;
          stock_id: string;
          business_overview: string;
          competitive_position: string;
          strengths_and_risks: string;
          recent_news: string;
          model: string;
          researched_at: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          stock_id: string;
          // 4つとも DEFAULT '' があるため optional
          business_overview?: string;
          competitive_position?: string;
          strengths_and_risks?: string;
          recent_news?: string;
          model: string;
          researched_at: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          stock_id?: string;
          business_overview?: string;
          competitive_position?: string;
          strengths_and_risks?: string;
          recent_news?: string;
          model?: string;
          researched_at?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      /** ユーザー設定（API キー等の key-value 保存） */
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          setting_key: string;
          setting_value: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          setting_key: string;
          // DEFAULT '' があるため optional
          setting_value?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          setting_key?: string;
          setting_value?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      /** EDINET マスタ（システム共通の抽出済み財務データ、書き込みは管理者のみ） */
      edinet_master: {
        Row: {
          id: string;
          doc_id: string;
          sec_code: string;
          edinet_code: string | null;
          filer_name: string;
          doc_description: string | null;
          period_start: string | null;
          period_end: string | null;
          fiscal_year: number;
          accounting_standard: string | null;
          // 抽出済み財務データ（円単位、NUMERIC）
          revenue: number | null;
          operating_income: number | null;
          net_income: number | null;
          total_assets: number | null;
          equity: number | null;
          interest_bearing_debt: number | null;
          operating_cf: number | null;
          investing_cf: number | null;
          shares_outstanding: number | null;
          interest_expense: number | null;
          cash_and_equivalents: number | null;
          current_assets: number | null;
          investments_and_other_assets: number | null;
          current_liabilities: number | null;
          non_current_liabilities: number | null;
          shareholders_equity: number | null;
          extraction_status: string | null;
          error_message: string | null;
          fetched_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          doc_id: string;
          sec_code: string;
          edinet_code?: string | null;
          filer_name: string;
          doc_description?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          fiscal_year: number;
          accounting_standard?: string | null;
          revenue?: number | null;
          operating_income?: number | null;
          net_income?: number | null;
          total_assets?: number | null;
          equity?: number | null;
          interest_bearing_debt?: number | null;
          operating_cf?: number | null;
          investing_cf?: number | null;
          shares_outstanding?: number | null;
          interest_expense?: number | null;
          cash_and_equivalents?: number | null;
          current_assets?: number | null;
          investments_and_other_assets?: number | null;
          current_liabilities?: number | null;
          non_current_liabilities?: number | null;
          shareholders_equity?: number | null;
          extraction_status?: string | null;
          error_message?: string | null;
          fetched_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          doc_id?: string;
          sec_code?: string;
          edinet_code?: string | null;
          filer_name?: string;
          doc_description?: string | null;
          period_start?: string | null;
          period_end?: string | null;
          fiscal_year?: number;
          accounting_standard?: string | null;
          revenue?: number | null;
          operating_income?: number | null;
          net_income?: number | null;
          total_assets?: number | null;
          equity?: number | null;
          interest_bearing_debt?: number | null;
          operating_cf?: number | null;
          investing_cf?: number | null;
          shares_outstanding?: number | null;
          interest_expense?: number | null;
          cash_and_equivalents?: number | null;
          current_assets?: number | null;
          investments_and_other_assets?: number | null;
          current_liabilities?: number | null;
          non_current_liabilities?: number | null;
          shareholders_equity?: number | null;
          extraction_status?: string | null;
          error_message?: string | null;
          fetched_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

// ---------------------------------------------------------------------------
// 補助型（supabase gen types が出力するものの簡易版）
// テーブル名から Row/Insert/Update を引けるようにして、各所での
// Database['public']['Tables'][...] という長い参照を避ける
// ---------------------------------------------------------------------------

/** テーブルの SELECT 結果（Row）型を取得する */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

/** テーブルの INSERT ペイロード型を取得する */
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

/** テーブルの UPDATE ペイロード型を取得する */
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
