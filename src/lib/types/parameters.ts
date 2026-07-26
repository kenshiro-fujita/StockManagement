export type ParametersRow = {
  id: string;
  stock_id: string;
  discount_rate: number;
  growth_rate: number;
  tax_rate: number;
  cap_multiplier: number;
  /** 6年目（5年後）の当期純利益予測（円）。成長込理論株価の算出に使う。未設定なら null */
  projected_net_income: number | null;
};
