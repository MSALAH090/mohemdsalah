ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS tactics jsonb NOT NULL DEFAULT '{"host":"balanced","guest":"balanced"}'::jsonb,
  ADD COLUMN IF NOT EXISTS formation jsonb NOT NULL DEFAULT '{"host":{},"guest":{}}'::jsonb,
  ADD COLUMN IF NOT EXISTS powers jsonb NOT NULL DEFAULT '{"host":{"veto":1,"steal":1,"hawk":1},"guest":{"veto":1,"steal":1,"hawk":1}}'::jsonb,
  ADD COLUMN IF NOT EXISTS round_event jsonb,
  ADD COLUMN IF NOT EXISTS mystery jsonb;