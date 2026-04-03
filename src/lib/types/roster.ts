export type RosterCategory = 'core' | 'growth' | 'value' | 'watch' | 'sell';

export type RosterHistoryRow = {
  id: string;
  user_id: string;
  stock_id: string;
  from_category: RosterCategory | null;
  to_category: RosterCategory;
  reason: string;
  changed_at: string;
};
