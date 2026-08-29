import { useEffect, useRef, useState } from "react";
import { subscribeToTournament } from "./tournament-engine";
import type { TournamentRow } from "./tournament-types";

export function useTournament(id: string) {
  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = () => {
    // subscribeToTournament handles realtime — no manual refresh needed
    // but we keep this for UI compatibility
  };

  useEffect(() => {
    if (!id) return;
    mounted.current = true;

    const unsub = subscribeToTournament(id.toUpperCase(), (data) => {
      if (!mounted.current) return;
      setLoading(false);
      if (!data) {
        setError("الدوري غير موجود");
        setTournament(null);
      } else {
        setError(null);
        setTournament(data);
      }
    });

    return () => {
      mounted.current = false;
      unsub();
    };
  }, [id]);

  return { tournament, loading, error, refresh };
}
