import { useEffect, useRef, useState } from "react";
import type { MatchResult, Seat } from "@/lib/game-types";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";

export function MatchView({
  match,
  hostName,
  guestName,
  mySeat,
  onFinished,
}: {
  match: MatchResult;
  hostName: string;
  guestName: string;
  mySeat: Seat;
  onFinished?: () => void;
}) {
  const [minute, setMinute] = useState(0);
  const [speed, setSpeed] = useState(1);
  const feedRef = useRef<HTMLDivElement>(null);
  const played = useRef(new Set<number>());
  const finishReported = useRef(false);

  useEffect(() => {
    sfx.refresh();
    sfx.whistle();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setMinute((m) => (m >= 90 ? 90 : m + 1));
    }, 220 / speed);
    return () => clearInterval(id);
  }, [speed]);


  const shown = match.events.filter((e) => e.minute <= minute);

  useEffect(() => {
    shown
      .filter((e) => e.type === "goal" && !played.current.has(e.minute))
      .forEach((e) => {
        played.current.add(e.minute);
        sfx.goal();
      });
    if (minute === 90) sfx.whistle();
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [minute, shown]);

  const goalsHost = shown.filter((e) => e.type === "goal" && e.team === "host").length;
  const goalsGuest = shown.filter((e) => e.type === "goal" && e.team === "guest").length;
  const done = minute >= 90;

  useEffect(() => {
    if (!done || finishReported.current) return;
    finishReported.current = true;
    onFinished?.();
  }, [done, onFinished]);

  return (
    <div className="space-y-4">
      <div className="glass-gold rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 text-center">
            <div className="font-display text-lg">{hostName}</div>
            <div className="text-xs text-muted-foreground">{mySeat === "host" ? "أنت" : "الخصم"}</div>
          </div>
          <div className="text-center">
            <div className="font-display text-5xl text-gradient-gold">
              {goalsHost} - {goalsGuest}
            </div>
            <div className="mt-1 rounded-full bg-black/40 px-3 py-0.5 text-xs font-bold">
              {done ? "انتهت المباراة" : `${minute}'`}
            </div>
          </div>
          <div className="flex-1 text-center">
            <div className="font-display text-lg">{guestName}</div>
            <div className="text-xs text-muted-foreground">{mySeat === "guest" ? "أنت" : "الخصم"}</div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full bg-[var(--gradient-gold)] transition-all duration-200"
            style={{ width: `${(minute / 90) * 100}%` }}
          />
        </div>
        {!done && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">سرعة العرض</span>
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "rounded-xl border px-3 py-1 text-xs font-bold transition",
                  speed === s ? "border-gold bg-gold/15 text-gold" : "border-white/15 bg-black/25",
                )}
              >
                ×{s}
              </button>
            ))}
            <button
              onClick={() => setMinute(90)}
              className="rounded-xl border border-white/15 bg-black/25 px-3 py-1 text-xs font-bold"
            >
              تخطي ⏭️
            </button>
          </div>
        )}
      </div>

      <div ref={feedRef} className="glass max-h-72 space-y-2 overflow-y-auto rounded-3xl p-4">
        {shown.map((e, i) => (
          <div
            key={i}
            className={cn(
              "animate-float-up rounded-xl border border-white/10 px-3 py-2 text-sm",
              e.type === "goal" && "border-gold/50 bg-gold/10 font-bold",
              e.type === "red" && "border-destructive/50 bg-destructive/10",
            )}
          >
            <span className="ml-2 rounded-md bg-black/40 px-1.5 py-0.5 font-display text-xs">{e.minute}'</span>
            {e.text}
          </div>
        ))}
      </div>

      {done && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="الاستحواذ" value={`${match.possessionHost}% - ${100 - match.possessionHost}%`} />
          <Stat label="الأهداف المتوقعة xG" value={`${match.xgHost} - ${match.xgGuest}`} />
          <Stat label="التسديدات" value={`${match.shotsHost} - ${match.shotsGuest}`} />
          <Stat label="رجل المباراة" value={`${match.motm.name} (${match.motm.rating})`} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-sm text-gold">{value}</div>
    </div>
  );
}
