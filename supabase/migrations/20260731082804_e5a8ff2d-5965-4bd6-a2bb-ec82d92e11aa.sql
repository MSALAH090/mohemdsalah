CREATE TABLE public.rooms (
  code TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT '5',
  state TEXT NOT NULL DEFAULT 'waiting',
  host_id TEXT NOT NULL,
  guest_id TEXT,
  host_name TEXT NOT NULL DEFAULT 'اللاعب 1',
  guest_name TEXT,
  host_budget INTEGER NOT NULL DEFAULT 120,
  guest_budget INTEGER NOT NULL DEFAULT 120,
  round INTEGER NOT NULL DEFAULT 0,
  phase TEXT NOT NULL DEFAULT 'lobby',
  round_started_at TIMESTAMPTZ,
  current_player JSONB,
  current_position TEXT,
  submitted JSONB NOT NULL DEFAULT '{"host":false,"guest":false}'::jsonb,
  reveal JSONB,
  squads JSONB NOT NULL DEFAULT '{"host":[],"guest":[]}'::jsonb,
  match JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms are publicly viewable" ON public.rooms FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.round_private (
  room_code TEXT NOT NULL,
  round INTEGER NOT NULL,
  sub_player JSONB,
  bid_host INTEGER,
  bid_guest INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_code, round)
);

GRANT ALL ON public.round_private TO service_role;
ALTER TABLE public.round_private ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;