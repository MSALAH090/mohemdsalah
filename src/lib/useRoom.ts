import { useEffect, useRef, useState } from "react";
import { subscribeToRoom } from "./firebase-engine";
import { getPlayerId } from "./identity";
import type { PowerState, RoomRow } from "./game-types";

const defaultPowers = (): PowerState => ({
  veto: 0,
  steal: 0,
  hawk: 0,
  spy: 0,
  shield: 0,
  discount: 0,
  freeze: 0,
  bounty: 0,
  double_deal: 0,
  lockout: 0,
  scout_boost: 0,
  blitz_bid: 0,
  tax_cut: 0,
  overdrive: 0,
});

function normalize(row: RoomRow | null): RoomRow | null {
  if (!row) return null;
  return {
    ...row,
    submitted: row.submitted ?? { host: false, guest: false },
    squads: {
      host: row.squads?.host ?? [],
      guest: row.squads?.guest ?? [],
    },
    tactics: { host: row.tactics?.host ?? "balanced", guest: row.tactics?.guest ?? "balanced", hostStyle: row.tactics?.hostStyle ?? "possession", guestStyle: row.tactics?.guestStyle ?? "possession" },
    formation: { host: row.formation?.host ?? {}, guest: row.formation?.guest ?? {} },
    powers: {
      host: { ...defaultPowers(), ...(row.powers?.host ?? {}) },
      guest: { ...defaultPowers(), ...(row.powers?.guest ?? {}) },
    },
    round_event: row.round_event ?? null,
    mystery: row.mystery ?? null,
  };
}

export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const unsub = subscribeToRoom(
      code,
      (data) => {
        if (!mounted.current) return;
        setLoading(false);
        if (!data) {
          setError("الغرفة غير موجودة");
          setRoom(null);
        } else {
          setError(null);
          setRoom(normalize(data));
        }
      },
      (err) => {
        if (!mounted.current) return;
        setLoading(false);
        setError("تعذر الاتصال بـ Firebase: " + err.message);
      }
    );

    return () => {
      mounted.current = false;
      unsub();
    };
  }, [code]);

  return { room, loading, error, refresh: () => {} };
}
