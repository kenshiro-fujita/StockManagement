-- Rename input_unit 'hundred_million' to 'billion' and change multiplier semantics
-- hundred_million (1億 = 100,000,000) → billion (10億 = 1,000,000,000)

-- Step 1: Drop existing CHECK constraint
ALTER TABLE financial_data DROP CONSTRAINT IF EXISTS financial_data_input_unit_check;

-- Step 2: Convert existing data that used hundred_million
-- Since amounts are stored in yen, multiply by 10 to compensate for the multiplier change
-- (old: user entered X * 100M = stored yen; new: same stored yen / 1B = X/10)
-- No stored yen values need to change — only the input_unit metadata label changes.
-- But we must re-scale: if user entered "10" in hundred_million (= 1B yen),
-- they would now enter "1" in billion (= 1B yen). The stored yen is unchanged.
UPDATE financial_data SET input_unit = 'billion' WHERE input_unit = 'hundred_million';

-- Step 3: Add new CHECK constraint
ALTER TABLE financial_data ADD CONSTRAINT financial_data_input_unit_check
  CHECK (input_unit IN ('yen', 'thousand', 'million', 'billion'));
