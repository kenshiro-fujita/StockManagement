-- Add rating and buy_priority columns to stocks table
ALTER TABLE stocks ADD COLUMN rating INTEGER;
ALTER TABLE stocks ADD COLUMN buy_priority INTEGER;

ALTER TABLE stocks ADD CONSTRAINT stocks_rating_check
  CHECK (rating >= 1 AND rating <= 5);
