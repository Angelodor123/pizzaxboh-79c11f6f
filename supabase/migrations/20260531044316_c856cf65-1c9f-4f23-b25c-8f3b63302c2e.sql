ALTER TABLE public.customer_complaints
  ADD COLUMN order_date date,
  ADD COLUMN order_number text;