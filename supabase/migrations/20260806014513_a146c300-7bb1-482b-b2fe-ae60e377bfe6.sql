DROP POLICY IF EXISTS "rooms are publicly viewable" ON public.rooms;

REVOKE ALL ON public.rooms FROM anon, authenticated;
REVOKE ALL ON public.round_private FROM anon, authenticated;

GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.round_private TO service_role;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_private ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime DROP TABLE public.rooms;