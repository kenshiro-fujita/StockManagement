-- 成長込理論株価（PER割引方式）に必要な「6年目当期純利益予測」を parameters に追加する。
-- スプシ方式: 成長込理論株価 = 6年目純利益予測 × 理論PER(1/(r-g)) ÷ (1+r)^5 ÷ 発行済株式数
-- ユーザーが中期経営計画等から手入力する予測値。未入力（NULL）なら成長込理論株価は算出不可。
ALTER TABLE parameters
  ADD COLUMN projected_net_income NUMERIC;

COMMENT ON COLUMN parameters.projected_net_income IS '6年目（5年後）の当期純利益予測（円）。成長込理論株価の算出に使用';
