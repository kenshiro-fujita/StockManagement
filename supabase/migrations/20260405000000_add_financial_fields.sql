-- 財務データに追加フィールド
ALTER TABLE financial_data ADD COLUMN cash_and_equivalents NUMERIC;
ALTER TABLE financial_data ADD COLUMN current_assets NUMERIC;
ALTER TABLE financial_data ADD COLUMN investments_and_other_assets NUMERIC;
ALTER TABLE financial_data ADD COLUMN current_liabilities NUMERIC;
ALTER TABLE financial_data ADD COLUMN non_current_liabilities NUMERIC;
ALTER TABLE financial_data ADD COLUMN shareholders_equity NUMERIC;
ALTER TABLE financial_data ADD COLUMN beta NUMERIC;
