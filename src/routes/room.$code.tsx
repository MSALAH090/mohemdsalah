import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useRoom } from "@/lib/useRoom";
import { getPlayerId, getPlayerName } from "@/lib/identity";
import {
  joinRoom,
  leaveRoom,
  nextRound,
  rematch,
  resolveRound,
  setFormation,
  setPlayStyle,
  setTactic,
  startGame,
  startMatch,
  submitBid,
  usePower,
  liveBid,
  passBid,
} from "@/lib/game.functions";
import { positionsFor, formationsFor, TACTICS, PLAY_STYLES, type Tactic, type PlayStyle } from "@/lib/players";
import {
  POWER_META,
  chemistry,
  elapsedSince,
  secondsForEvent,
  type PowerId,
  type PowerState,
  type RoundEvent,
  type Seat,
} from "@/lib/game-types";
import { PlayerCard } from "@/components/game/PlayerCard";
import { FormationBoard, type Spots } from "@/components/game/FormationBoard";
import { MatchView } from "@/components/game/MatchView";
import { MysteryBoxModal } from "@/components/game/MysteryBoxModal";
import { sfx, unlockAudio } from "@/lib/sound";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/room/$code")({
  head: () => ({
    meta: [
      { title: "غرفة المزاد | مزاد كرة القدم الأسطوري" },
      { name: "description", content: "غرفة مزاد أونلاين: زايد بالسر، ابنِ تشكيلتك، وشاهد المباراة مباشرة." },
      { property: "og:title", content: "غرفة المزاد الأسطوري" },
      { property: "og:description", content: "انضم بكود الغرفة وزايد بالسر على نجوم كرة القدم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { room, loading, error, refresh } = useRoom(code.toUpperCase());
  const [playerId, setPlayerId] = useState("");

  const join = useServerFn(joinRoom);
  const start = useServerFn(startGame);
  const bid = useServerFn(submitBid);
  const doLiveBid = useServerFn(liveBid);
  const doPassBid = useServerFn(passBid);
  const resolve = useServerFn(resolveRound);
  const next = useServerFn(nextRound);
  const kickoff = useServerFn(startMatch);
  const again = useServerFn(rematch);
  const power = useServerFn(usePower);
  const tacticFn = useServerFn(setTactic);
  const styleFn = useServerFn(setPlayStyle);
  const formationFn = useServerFn(setFormation);
  const leaveFn = useServerFn(leaveRoom);

  useEffect(() => {
    setPlayerId(getPlayerId());
    unlockAudio();
    sfx.refresh();
  }, []);

  // auto-join as guest if seat is free
  const joined = useRef(false);
  useEffect(() => {
    if (!room || !playerId || joined.current) return;
    if (room.host_id === playerId || room.guest_id === playerId) return;
    if (room.guest_id) return;
    joined.current = true;
    void join({ data: { code: room.code, name: getPlayerName() || "الخصم", playerId } })
      .then(() => refresh())
      .catch(() => undefined);
  }, [room, playerId, join, refresh]);

  const seat: Seat | null = useMemo(() => {
    if (!room || !playerId) return null;
    if (room.host_id === playerId) return "host";
    if (room.guest_id === playerId) return "guest";
    return null;
  }, [room, playerId]);

  // watchdog: يمنع توقف اللعبة بين الجولات
  const busyRef = useRef(false);
  const phaseAnchor = useRef(Date.now());
  const phaseKey = room ? `${room.phase}-${room.round}-${room.round_started_at ?? ""}` : "";
  useEffect(() => {
    phaseAnchor.current = Date.now();
  }, [phaseKey]);

  useEffect(() => {
    if (!room || !playerId || !seat) return;
    const id = setInterval(() => {
      if (busyRef.current) return;
      const limit = secondsForEvent(room.round_event, room.auction_type);
      const elapsed = elapsedSince(room.round_started_at, phaseAnchor.current);
      const phaseAge = (Date.now() - phaseAnchor.current) / 1000;
      const run = (fn: () => Promise<unknown>) => {
        busyRef.current = true;
        void fn()
          .then(() => refresh())
          .catch(() => undefined)
          .finally(() => {
            busyRef.current = false;
          });
      };
      if (room.phase === "bidding" && elapsed > limit + 2) {
        run(() => resolve({ data: { code: room.code } }));
      } else if (room.phase === "reveal" && phaseAge > 22) {
        run(() => next({ data: { code: room.code, playerId } }));
      }
    }, 3000);
    return () => clearInterval(id);
  }, [room, playerId, seat, resolve, next, refresh]);


  // كارت المفاجأة/الحدث يظهر للاثنين
  const [popupSeen, setPopupSeen] = useState<string>("");
  const popupKey = room
    ? room.phase === "reveal" && room.mystery
      ? `m${room.round}`
      : room.phase === "bidding" && room.round_event
        ? `e${room.round}`
        : ""
    : "";
  const showPopup = popupKey !== "" && popupSeen !== popupKey;

  // الخطة: تحديث فوري محلي + حفظ مؤجل على السيرفر (يمنع البطء واختفاء اللاعبين)
  const [localSpots, setLocalSpots] = useState<Spots | null>(null);
  const [localTactic, setLocalTactic] = useState<Tactic | null>(null);
  const [localPlayStyle, setLocalPlayStyle] = useState<PlayStyle | null>(null);
  const [matchFinished, setMatchFinished] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomCode = room?.code ?? "";
  const queueSaveSpots = (spots: Spots) => {
    setLocalSpots(spots);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void formationFn({ data: { code: roomCode, playerId, spots } })
        .catch(() => toast.error("تعذر حفظ الخطة، حاول مرة أخرى"));
    }, 450);
  };
  useEffect(() => {
    if (room?.phase !== "formation") {
      setLocalSpots(null);
      setLocalTactic(null);
      setLocalPlayStyle(null);
    }
  }, [room?.phase]);
  useEffect(() => {
    setMatchFinished(false);
  }, [room?.phase, room?.round]);
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );




  if (loading) return <Centered>جارٍ تحميل الغرفة…</Centered>;
  if (error || !room) return <Centered>{error ?? "الغرفة غير موجودة"}</Centered>;
  if (room.state === "closed")
    return (
      <Centered>
        <div className="space-y-4">
          <div>🚪 صاحب الغرفة أنهى اللعبة</div>
          <button onClick={() => void navigate({ to: "/" })} className="btn-hero rounded-2xl px-6 py-3">
            العودة للرئيسية
          </button>
        </div>
      </Centered>
    );
  const isSpectator = !seat;
  const effectiveSeat: Seat = seat || "host";
  const isHost = effectiveSeat === "host";
  const oppSeat: Seat = isHost ? "guest" : "host";
  const myName = isSpectator ? room.host_name : (isHost ? room.host_name : (room.guest_name ?? "أنت"));
  const oppName = isSpectator ? (room.guest_name ?? "الضيف") : (isHost ? (room.guest_name ?? "في الانتظار…") : room.host_name);
  const myBudget = isHost ? room.host_budget : room.guest_budget;
  const oppBudget = isHost ? room.guest_budget : room.host_budget;
  const squadsMap = room.squads ?? { host: [], guest: [] };
  const mySquad = squadsMap[effectiveSeat] ?? [];
  const oppSquad = squadsMap[oppSeat] ?? [];
  const totalRounds = positionsFor(room.mode).length;
  const myPowers: PowerState = room.powers?.[effectiveSeat] ?? { veto: 0, steal: 0, hawk: 0 };
  const mySpots: Spots = localSpots ?? room.formation?.[effectiveSeat] ?? {};
  const oppSpots: Spots = room.formation?.[oppSeat] ?? {};
  const myTactic: Tactic = localTactic ?? room.tactics?.[effectiveSeat] ?? "balanced";
  const myPlayStyle: PlayStyle = localPlayStyle ?? (effectiveSeat === "host" ? room.tactics?.hostStyle : room.tactics?.guestStyle) ?? "possession";

  const onLeave = async () => {
    if (!confirm(isHost ? "إنهاء الغرفة للجميع؟" : "الخروج من الغرفة؟")) return;
    try {
      await leaveFn({ data: { code: room.code, playerId } });
    } catch {
      /* ignore */
    }
    void navigate({ to: "/" });
  };

  const onPower = async (id: PowerId) => {
    try {
      sfx.click();
      const res = await power({ data: { code: room.code, playerId, power: id } });
      if (res.hint) toast.info(res.hint, { duration: 7000 });
      else toast.success("تم استخدام الكارت");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر استخدام الكارت");
    }
  };


  return (
    <main className="relative min-h-screen polygonal-bg text-[#eae2cf] pb-12">
      {/* Subtle ambient glow overlays — body gradient shows through */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#7e1040]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-[#ffd700]/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl space-y-4 px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {showPopup &&
          (popupKey.startsWith("m") && room.mystery ? (
            <MysteryBoxModal
              box={room.mystery}
              mySeat={effectiveSeat}
              oppName={oppName}
              onClose={() => setPopupSeen(popupKey)}
            />
          ) : (
            <CardPopup
              icon={room.round_event?.icon ?? "⚡"}
              kind="حدث الجولة"
              title={room.round_event?.title ?? ""}
              desc={room.round_event?.desc ?? ""}
              owner="يطبّق على اللاعبَين"
              onClose={() => setPopupSeen(popupKey)}
            />
          ))}

        <TopBar
          code={room.code}
          mode={room.mode}
          myName={myName}
          oppName={oppName}
          myBudget={myBudget}
          oppBudget={oppBudget}
          round={room.round}
          totalRounds={totalRounds}
          isHost={isHost}
          onLeave={() => void onLeave()}
        />

        {isSpectator && (
          <div className="clipped-corners p-3.5 bg-[#8b5cf6]/20 border-2 border-[#8b5cf6] flex items-center justify-between shadow-[0_0_20px_rgba(139,92,246,0.3)] animate-pulse">
            <div className="flex items-center gap-2">
              <span className="text-xl">👁️</span>
              <div>
                <div className="font-display font-black text-sm text-[#00E5FF]">أنت في وضع المشاهدة الحية (بث مباشر)</div>
                <div className="text-[10px] text-[#d0c6ab]">تتابع مباراة {room.host_name} ضد {room.guest_name ?? "الخصم"}</div>
              </div>
            </div>
            <button
              onClick={() => void navigate({ to: "/" })}
              className="bg-black/60 border border-white/20 px-3 py-1.5 clipped-corners text-xs font-bold text-[#ffd700] hover:bg-black/80"
            >
              ← خروج
            </button>
          </div>
        )}

        {room.round_event && (room.phase === "bidding" || room.phase === "reveal") && (
          <EventBanner event={room.round_event} />
        )}

        {!isSpectator && (room.phase === "bidding" || room.phase === "reveal") && (
          <PowersBar
            powers={myPowers}
            phase={room.phase}
            canSteal={
              room.phase === "reveal" &&
              !!room.reveal &&
              room.reveal.winner !== effectiveSeat &&
              !room.reveal.stolenBy &&
              room.round_event?.shieldedBy !== oppSeat
            }
            canShield={
              (room.phase === "bidding" ||
                (room.phase === "reveal" && !!room.reveal && room.reveal.winner === effectiveSeat && !room.reveal.stolenBy)) &&
              room.round_event?.shieldedBy !== effectiveSeat
            }
            onUse={(id) => void onPower(id)}
          />
        )}

        {room.state === "waiting" && (
          <Lobby
            room={room}
            isHost={isHost}
            onStart={async () => {
              try {
                sfx.whistle();
                await start({ data: { code: room.code, playerId } });
                await refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذر البدء");
              }
            }}
          />
        )}

        {room.phase === "bidding" && (
          <BiddingPanel
            key={`${room.round}-${room.round_started_at ?? ""}`}
            room={room}
            seat={effectiveSeat}
            myBudget={myBudget}
            vetoedBy={room.round_event?.vetoedBy ?? null}
            onBid={async (amount) => {
              try {
                sfx.bid();
                await bid({ data: { code: room.code, playerId, amount } });
                await refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذر إرسال المزايدة");
              }
            }}
            onLiveBid={async (amount) => {
              try {
                sfx.bid();
                await doLiveBid({ data: { code: room.code, playerId, amount } });
                await refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذر رفع المزاد");
              }
            }}
            onPassBid={async () => {
              try {
                sfx.whistle();
                toast.success("🤝 قلت للخصم مبروك عليك! تم حسم الجولة فوراً");
                await doPassBid({ data: { code: room.code, playerId } });
                await refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذر إنهاء المزايدة");
              }
            }}
            onExpire={async () => {
              try {
                await resolve({ data: { code: room.code } });
                await refresh();
              } catch {
                /* another client resolved it */
              }
            }}
          />
        )}

        {room.phase === "reveal" && room.reveal && (
          <RevealPanel
            reveal={room.reveal}
            seat={effectiveSeat}
            myName={myName}
            oppName={oppName}
            isHost={isHost}
            isLast={room.round >= totalRounds}
            onNext={async () => {
              try {
                sfx.click();
                await next({ data: { code: room.code, playerId } });
                await refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذر الانتقال");
              }
            }}
          />
        )}

        {room.phase === "reveal" && room.mystery && (
          <div className="animate-flip-in clipped-corners border border-[#ffd700]/40 bg-black/40 p-4 text-center neon-border-gold">
            <div className="font-display text-base sm:text-lg font-bold text-[#ffd700]">
              🎁 صندوق عشوائي لـ {room.mystery.seat === seat ? "صالحك" : oppName}: {room.mystery.icon}{" "}
              {room.mystery.title}
            </div>
            <div className="mt-1 text-xs text-[#d0c6ab]">{room.mystery.desc}</div>
          </div>
        )}

        {(room.phase === "formation" || room.phase === "match") && (
          <FormationBoard
            mode={room.mode}
            mySquad={mySquad}
            oppSquad={oppSquad}
            myName={myName}
            oppName={oppName}
            mySpots={mySpots}
            oppSpots={oppSpots}
            editable={room.phase === "formation"}
            onMove={(posKey, x, y) => {
              queueSaveSpots({ ...mySpots, [posKey]: { x, y } });
            }}
          />
        )}

        {room.phase === "formation" && (
          <div className="glass-panel clipped-corners space-y-4 p-5 sm:p-6 border border-white/15 neon-border-purple" style={{ background: 'linear-gradient(135deg, rgba(26, 11, 46, 0.7) 0%, rgba(5, 1, 10, 0.9) 100%)' }}>
            <div className="text-center font-display text-xl sm:text-2xl font-extrabold text-[#ffd700] text-glow">🏟️ اكتملت التشكيلة!</div>
            <p className="text-center text-xs sm:text-sm text-[#d0c6ab]">
              كيمياء فريقك <span className="text-[#ffe16d] font-bold font-geist">{chemistry(mySquad)}%</span> — اسحب لاعبيك على الملعب واختر خطتك وأسلوبك.
            </p>

            <div>
              <div className="mb-2 text-xs sm:text-sm font-bold font-display text-[#ffe16d]">خطط تكتيكية جاهزة</div>
              <div className="flex flex-wrap gap-2">
                {formationsFor(room.mode).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      sfx.click();
                      queueSaveSpots({ ...f.spots });
                    }}
                    className="clipped-corners-inner border border-white/15 bg-black/40 px-3.5 py-2 text-xs font-bold font-display text-[#eae2cf] hover:border-[#ffd700] hover:text-[#ffd700] transition active:scale-95"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs sm:text-sm font-bold font-display text-[#ffe16d]">أسلوب اللعب التكتيكي</div>
              <div className="grid grid-cols-3 gap-2">
                {TACTICS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      sfx.click();
                      setLocalTactic(t.id);
                      void tacticFn({ data: { code: room.code, playerId, tactic: t.id } })
                        .catch(() => {
                          setLocalTactic(null);
                          toast.error("تعذر حفظ أسلوب اللعب");
                        });
                    }}
                    className={cn(
                      "clipped-corners-inner border p-3 text-center transition-all transform active:scale-95",
                      myTactic === t.id
                        ? "border-[#ffd700] bg-[#ffd700]/20 shadow-[0_0_15px_rgba(255,215,0,0.25)] text-[#ffd700]"
                        : "border-white/10 bg-black/40 hover:border-white/20 text-[#d0c6ab]",
                    )}
                  >
                    <div className="text-2xl">{t.icon}</div>
                    <div className="mt-1 text-xs font-bold font-display">{t.label}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2 text-center text-[11px] text-[#d0c6ab]/70">
                {TACTICS.find((t) => t.id === myTactic)?.desc}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs sm:text-sm font-bold font-display text-[#00e5ff]">أسلوب اللعب الميداني</div>
              <div className="grid grid-cols-5 gap-1.5">
                {PLAY_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      sfx.click();
                      setLocalPlayStyle(s.id);
                      void styleFn({ data: { code: room.code, playerId, style: s.id } })
                        .catch(() => {
                          setLocalPlayStyle(null);
                          toast.error("تعذر حفظ أسلوب اللعب");
                        });
                    }}
                    className={cn(
                      "clipped-corners-inner border p-2 text-center transition-all transform active:scale-95",
                      myPlayStyle === s.id
                        ? "border-[#00e5ff] bg-[#00e5ff]/20 shadow-[0_0_15px_rgba(0,229,255,0.25)] text-[#00e5ff]"
                        : "border-white/10 bg-black/40 hover:border-white/20 text-[#d0c6ab]",
                    )}
                  >
                    <div className="text-xl">{s.icon}</div>
                    <div className="mt-0.5 text-[10px] font-bold font-display leading-tight">{s.label}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2 text-center text-[11px] text-[#d0c6ab]/70">
                {PLAY_STYLES.find((s) => s.id === myPlayStyle)?.desc}
              </div>
            </div>

            {isHost ? (
              <button
                onClick={async () => {
                  try {
                    sfx.crowd();
                    await kickoff({ data: { code: room.code, playerId } });
                    await refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "تعذر بدء المباراة");
                  }
                }}
                className="gold-gradient-bg text-[#705e00] font-display font-extrabold w-full py-4 text-lg clipped-corners shadow-[0_4px_20px_rgba(255,215,0,0.35)] transition-transform active:scale-95 hover:brightness-110"
              >
                ابدأ المباراة الكبرى ⚽
              </button>
            ) : (
              <p className="text-center text-xs sm:text-sm text-[#ffe16d] font-bold">في انتظار صاحب الغرفة ليبدأ المباراة…</p>
            )}
          </div>
        )}

        {room.phase === "match" && room.match && (
          <>
            <MatchView
              match={room.match}
              hostName={room.host_name}
              guestName={room.guest_name ?? "الخصم"}
              mySeat={effectiveSeat}
              onFinished={() => setMatchFinished(true)}
            />
            {matchFinished && (
              <FinalResult
                winner={room.match.winner}
                seat={effectiveSeat}
                isHost={isHost}
                onRematch={async () => {
                  try {
                    await again({ data: { code: room.code, playerId } });
                    await refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "تعذر إعادة اللعب");
                  }
                }}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass rounded-3xl px-8 py-6 text-center font-display text-lg">{children}</div>
    </div>
  );
}

function EventBanner({ event }: { event: RoundEvent }) {
  return (
    <div className="animate-flip-in clipped-corners border border-[#ffd700]/50 bg-[#ffd700]/10 p-3.5 text-center neon-border-gold shadow-[0_0_15px_rgba(255,215,0,0.2)]">
      <div className="font-display text-sm sm:text-base font-bold text-[#ffd700]">
        {event.icon} حدث الجولة: {event.title}
      </div>
      <div className="mt-0.5 text-xs text-[#d0c6ab]">{event.desc}</div>
    </div>
  );
}

function PowersBar({
  powers,
  phase,
  canSteal,
  canShield,
  onUse,
}: {
  powers: PowerState;
  phase: string;
  canSteal: boolean;
  canShield: boolean;
  onUse: (id: PowerId) => void;
}) {
  const availablePowers = POWER_META.filter((p) => (powers[p.id] ?? 0) > 0);

  return (
    <div className="glass-panel clipped-corners p-3 border border-white/15 neon-border-purple shadow-[0_0_15px_rgba(139,92,246,0.15)]">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-bold font-display text-[#ffe16d]">كروت القوة في يدك 🃏</span>
        <span className="text-[10px] text-[#ffe16d]/70 font-bold">
          {availablePowers.length > 0 ? `${availablePowers.length} كروت متاحة للاستخدام` : "لا توجد كروت"}
        </span>
      </div>

      {availablePowers.length === 0 ? (
        <div className="text-center py-2.5 text-[11px] text-[#d0c6ab]/60 font-medium">
          لا تملك كروت قوة في هذه الجولة.. ستحصل على كروت متغيرة تلقائياً في الجولات القادمة ⚡
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {availablePowers.map((p) => {
            const count = powers[p.id] ?? 0;
            const usable =
              count > 0 &&
              (p.id === "steal"
                ? canSteal
                : p.id === "shield"
                ? canShield
                : phase === "bidding");
            return (
              <button
                key={p.id}
                disabled={!usable}
                onClick={() => onUse(p.id)}
                title={p.desc}
                className={cn(
                  "flex items-center gap-2 clipped-corners-inner px-3 py-2 text-right transition-all transform active:scale-95 border",
                  usable
                    ? "border-[#ffd700]/60 bg-gradient-to-r from-[#ffd700]/20 to-[#ff9100]/10 hover:border-[#ffd700] hover:bg-[#ffd700]/30 shadow-[0_0_12px_rgba(255,215,0,0.25)] text-[#ffe16d]"
                    : "border-white/10 bg-black/40 opacity-40 cursor-not-allowed text-[#d0c6ab]",
                )}
              >
                <div className="text-xl">{p.icon}</div>
                <div className="flex flex-col text-right">
                  <div className="text-xs font-bold font-display leading-tight">{p.label}</div>
                  <div className="text-[9px] text-[#d0c6ab]/70 line-clamp-1 max-w-[140px]">{p.desc}</div>
                </div>
                <div className="mr-1 font-geist font-black text-xs px-1.5 py-0.5 rounded-full bg-black/60 border border-[#ffd700]/40 text-[#ffd700]">
                  ×{count}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopBar(props: {
  code: string;
  mode: string;
  myName: string;
  oppName: string;
  myBudget: number;
  oppBudget: number;
  round: number;
  totalRounds: number;
  isHost: boolean;
  onLeave: () => void;
}) {
  return (
    <div className="space-y-2.5">
      {/* Upper Navigation Bar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          onClick={props.onLeave}
          className="clipped-corners px-3 py-1.5 text-xs font-bold font-display border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 active:scale-95 transition flex items-center gap-1"
        >
          <span>←</span>
          <span>{props.isHost ? "إنهاء الغرفة" : "خروج للرئيسية"}</span>
        </button>

        <div className="inline-flex items-center gap-2">
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(props.code);
              toast.success("تم نسخ كود الغرفة");
            }}
            className="clipped-corners px-3 py-1 bg-black/60 border border-[#ffd700]/40 font-geist text-base sm:text-lg font-bold tracking-[0.25em] text-[#ffd700] hover:bg-[#ffd700]/10 transition"
          >
            {props.code}
          </button>
        </div>

        <div className="font-display text-xs font-bold text-[#d0c6ab]">
          {props.mode === "11" ? "11 ضد 11" : "5 ضد 5"}
          {props.round > 0 && ` • جولة ${props.round}/${props.totalRounds}`}
        </div>
      </div>

      {/* Futuristic VS Status Bar */}
      <div className="relative flex justify-between items-stretch bg-[#161308]/80 backdrop-blur-xl border border-white/15 h-16 sm:h-20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] clipped-corners overflow-hidden">
        {/* Player Budget */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 bg-gradient-to-r from-[#ffe16d]/10 to-transparent">
          <div className="flex items-center gap-1.5 text-[#ffe16d] mb-0.5">
            <span className="text-xs">💰</span>
            <span className="font-display font-bold text-[11px] sm:text-xs truncate">{props.myName} (أنت)</span>
          </div>
          <div className="font-geist font-extrabold text-xl sm:text-3xl text-[#ffe16d] drop-shadow-[0_0_8px_rgba(255,225,109,0.5)] leading-none">
            {props.myBudget}M
          </div>
        </div>

        {/* VS Badge */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-11 sm:w-13 sm:h-14 bg-[#231f14] border border-white/25 clipped-corners flex items-center justify-center shadow-lg z-20">
          <span className="font-display font-extrabold text-xs sm:text-base text-[#ffd700]">VS</span>
        </div>

        {/* Opponent Status */}
        <div className="flex-1 flex flex-col justify-center items-end px-4 sm:px-6 bg-gradient-to-l from-[#FF3B3B]/10 to-transparent">
          <div className="flex items-center gap-1.5 text-[#FF3B3B] mb-0.5">
            <span className="font-display font-bold text-[11px] sm:text-xs truncate">{props.oppName}</span>
            <span className="text-xs">🔒</span>
          </div>
          <div className="font-geist font-extrabold text-xl sm:text-3xl text-[#FF3B3B] drop-shadow-[0_0_8px_rgba(255,59,59,0.4)] leading-none">
            {props.oppBudget}M
          </div>
        </div>
      </div>
    </div>
  );
}

function Lobby({
  room,
  isHost,
  onStart,
}: {
  room: { code: string; guest_name: string | null; mode: string };
  isHost: boolean;
  onStart: () => Promise<void>;
}) {
  return (
    <div className="glass-panel clipped-corners p-6 text-center border-2 border-white/15 neon-border-purple shadow-[0_0_25px_rgba(139,92,246,0.2)]">
      <div className="font-display text-2xl font-extrabold text-[#ffd700] text-glow">غرفة الانتظار</div>
      <p className="mt-2 text-xs sm:text-sm text-[#d0c6ab]">
        شارك الكود <span className="font-geist font-bold text-[#ffd700] text-base px-2 py-0.5 bg-black/40 rounded border border-[#ffd700]/30">{room.code}</span> مع خصمك ليدخل الغرفة.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <span className="clipped-corners bg-black/50 border border-white/15 px-4 py-2 text-xs sm:text-sm font-bold text-[#eae2cf]">
          👑 صاحب الغرفة
        </span>
        <span
          className={cn(
            "clipped-corners px-4 py-2 text-xs sm:text-sm font-bold border",
            room.guest_name
              ? "bg-green-500/20 text-green-400 border-green-500/40"
              : "animate-pulse bg-black/50 text-[#d0c6ab]/60 border-white/10",
          )}
        >
          {room.guest_name ? `✅ ${room.guest_name}` : "⏳ في انتظار الخصم"}
        </span>
      </div>
      {isHost ? (
        <button
          disabled={!room.guest_name}
          onClick={() => void onStart()}
          className="gold-gradient-bg text-[#705e00] font-display font-extrabold mt-6 w-full py-4 text-base sm:text-lg clipped-corners shadow-[0_4px_20px_rgba(255,215,0,0.35)] transition-transform active:scale-95 disabled:opacity-40 hover:brightness-110"
        >
          ابدأ المزاد الأسطوري 🔥
        </button>
      ) : (
        <p className="mt-6 text-xs sm:text-sm text-[#ffe16d] font-bold">في انتظار صاحب الغرفة ليبدأ المزاد…</p>
      )}
    </div>
  );
}

function BiddingPanel({
  room,
  seat,
  myBudget,
  vetoedBy,
  onBid,
  onLiveBid,
  onPassBid,
  onExpire,
}: {
  room: {
    code: string;
    round: number;
    round_started_at: string | null;
    round_event: RoundEvent | null;
    current_player: NonNullable<ReturnType<typeof Object>> | null;
    current_position: string | null;
    submitted: { host: boolean; guest: boolean };
    mode: string;
    auction_type?: "blind" | "live";
    live_bids?: import("@/lib/game-types").LiveBidsState | null;
    host_name: string;
    guest_name: string | null;
  };
  seat: Seat;
  myBudget: number;
  vetoedBy: Seat | null;
  onBid: (amount: number) => Promise<void>;
  onLiveBid?: (amount: number) => Promise<void>;
  onPassBid?: () => Promise<void>;
  onExpire: () => Promise<void>;
}) {
  const isLive = room.auction_type === "live";
  const limit = secondsForEvent(room.round_event, room.auction_type);
  const [amount, setAmount] = useState(0);
  const [customLiveAmount, setCustomLiveAmount] = useState<number>(0);
  const [sent, setSent] = useState(false);
  const [remaining, setRemaining] = useState(limit);
  const lastTick = useRef(-1);
  const expired = useRef(false);
  const anchor = useRef(Date.now());
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  const startedAt = room.round_started_at;

  useEffect(() => {
    anchor.current = Date.now();
    expired.current = false;
    lastTick.current = -1;
  }, [startedAt]);

  useEffect(() => {
    const tickOnce = () => {
      const left = Math.max(0, limit - Math.floor(elapsedSince(startedAt, anchor.current)));
      setRemaining(left);
      if (left !== lastTick.current) {
        lastTick.current = left;
        if (left <= (isLive ? 4 : 5) && left > 0) sfx.urgentTick();
        else if (left > 0) sfx.tick();
      }
      if (left === 0 && !expired.current) {
        expired.current = true;
        void expireRef.current();
      }
    };
    tickOnce();
    const id = setInterval(tickOnce, 250);
    return () => clearInterval(id);
  }, [startedAt, limit, isLive]);

  const posMeta = positionsFor(room.mode).find((p) => p.key === room.current_position);
  const player = room.current_player as unknown as import("@/lib/players").Player | null;
  if (!player) return null;

  const submittedMap = room.submitted ?? { host: false, guest: false };
  const oppSubmitted = seat === "host" ? submittedMap.guest : submittedMap.host;
  const mySubmitted = sent || (seat === "host" ? submittedMap.host : submittedMap.guest);
  const vetoBlocked = vetoedBy !== null && vetoedBy !== seat;
  const isMidRound = (room.mode === "5" && room.round === 3) || (room.mode === "11" && room.round === 6);

  // Live bidding calculations
  const liveBids = room.live_bids;
  const highestBid = liveBids?.highest_bid ?? 0;
  const highestSeat = liveBids?.highest_seat ?? null;
  const myLiveBid = seat === "host" ? (liveBids?.host ?? 0) : (liveBids?.guest ?? 0);
  const oppLiveBid = seat === "host" ? (liveBids?.guest ?? 0) : (liveBids?.host ?? 0);
  const oppName = seat === "host" ? (room.guest_name ?? "الخصم") : room.host_name;
  const isLeader = highestSeat === seat && highestBid > 0;
  const iPassed = liveBids?.passed_seat === seat;
  const oppPassed = liveBids?.passed_seat !== null && liveBids?.passed_seat !== undefined && !iPassed;

  return (
    <div className="space-y-4">
      {/* Center Stage & Cards */}
      <div className="glass-panel clipped-corners p-5 sm:p-6 flex flex-col items-center gap-5 border border-white/15 neon-border-purple" style={{ background: 'linear-gradient(135deg, rgba(26, 11, 46, 0.6) 0%, rgba(5, 1, 10, 0.8) 100%)' }}>
        {isMidRound && (
          <div className="w-full clipped-corners border-2 border-[#ffd700] bg-gradient-to-r from-[#ffd700]/25 via-[#8b5cf6]/35 to-[#ffd700]/25 p-3.5 text-center shadow-[0_0_25px_rgba(255,215,0,0.35)] animate-pulse">
            <div className="font-display font-black text-sm sm:text-base text-[#ffd700] flex items-center justify-center gap-2">
              <span>🎁</span>
              <span>مـزاد الصـندوق الغامـض الحصري!</span>
              <span>💥</span>
            </div>
            <div className="text-xs text-[#eae2cf] mt-1 font-sans">
              زايد بأموالك الآن — الفائز بالمزاد سيحصل على الصندوق الغامض لتفجير المفاجأة!
            </div>
          </div>
        )}

        {/* Top Position Tag & Digital Countdown Timer */}
        <div className="flex w-full items-center justify-between">
          <div className="clipped-corners bg-black/60 border border-white/15 px-3.5 py-1.5 text-xs font-bold font-display text-[#ffe16d] flex items-center gap-1.5">
            {isLive && <span className="animate-pulse text-red-500">🔴</span>}
            <span>
              {isLive ? "⚡ مزاد مباشر حـي" : isMidRound ? "المعروض: 🎁 الصندوق العشوائي الغامض" : `المركز المطلوب: ${posMeta?.label ?? room.current_position}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-geist font-black text-2xl sm:text-3xl tracking-wider leading-none",
              remaining <= 4
                ? "text-red-500 animate-ping drop-shadow-[0_0_15px_rgba(255,59,59,1)]"
                : "text-[#FF3B3B] drop-shadow-[0_0_12px_rgba(255,59,59,1)]"
            )} dir="ltr">
              00:{remaining < 10 ? `0${remaining}` : remaining}
            </span>
          </div>
        </div>

        {/* Center Stage: Mystery Box Card OR Player Card */}
        {isMidRound ? (
          <div className="relative flex items-center justify-center my-3 w-full">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-[#ffd700]/30 via-[#8b5cf6]/30 to-[#00E5FF]/30 blur-xl animate-pulse pointer-events-none" />
            <div
              className="relative z-10 w-52 sm:w-60 h-[300px] sm:h-[330px] p-[3px] clipped-corners transition-transform hover:scale-105"
              style={{
                background: "linear-gradient(145deg, #FFE57F 0%, #B388FF 30%, #D4AF37 55%, #7C4DFF 80%, #FFD700 100%)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.9), 0 0 30px rgba(255,215,0,0.4)",
              }}
            >
              <div
                className="w-full h-full relative overflow-hidden flex flex-col justify-between items-center p-4 text-center"
                style={{ background: "linear-gradient(180deg, #240b3b 0%, #120324 45%, #05010a 100%)" }}
              >
                <div className="flex w-full items-center justify-between z-10">
                  <div className="font-display font-black text-3xl sm:text-4xl text-[#FFE57F] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                    ??
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#ffd700]/20 border border-[#ffd700]/40 text-[10px] font-display font-extrabold text-[#ffd700]">
                    MYSTERY BOX
                  </span>
                </div>
                <div className="relative my-auto flex flex-col items-center justify-center">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-[#3D1466] to-[#1F0833] border-2 border-[#FFD700] flex items-center justify-center text-6xl sm:text-7xl shadow-[0_0_25px_rgba(255,215,0,0.5)] animate-wiggle">
                    🎁
                  </div>
                  <div className="mt-2 text-[10px] sm:text-xs font-display font-black tracking-widest text-[#00E5FF] uppercase">
                    ✨ الحظ والمفاجآت ✨
                  </div>
                </div>
                <div className="w-full z-10 space-y-0.5 border-t border-[#ffd700]/30 pt-2 bg-black/40 rounded-b-xl">
                  <div className="font-display font-black text-base sm:text-lg text-[#FFE57F] text-glow">
                    الصندوق العشوائي
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-[#d0c6ab]">
                    كنز أسطوري أم مقلب كارثي؟
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative flex items-center justify-center my-2">
            <PlayerCard player={player} posLabel={posMeta?.key} className="animate-flip-in z-10" />
            <div
              className="absolute -left-6 sm:-left-12 top-4 w-28 sm:w-36 h-40 sm:h-52 bg-[#1f1b10]/70 border border-white/15 backdrop-blur-md flex flex-col items-center justify-center -z-0 transform -rotate-12 opacity-60 shadow-lg"
              style={{ clipPath: 'polygon(0 15%, 100% 0, 100% 85%, 0 100%)' }}
            >
              <span className="text-xl sm:text-2xl mb-1">🔒</span>
              <span className="font-display font-bold text-[9px] sm:text-xs text-[#d0c6ab] text-center px-2 leading-tight">
                البديل سري ومخفي
              </span>
            </div>
          </div>
        )}

        <div className="w-full clipped-corners-inner bg-black/40 border border-white/10 p-2.5 text-center text-[11px] text-[#d0c6ab]">
          {isLive ? (
            <span>⚡ <b>مزاد مباشر مفتوح:</b> المزايدات تظهر لحظياً — عـلّي على الخصم أو اضغط <b>"مبروك عليك"</b> لحسم الصفقة فوراً!</span>
          ) : (
            <span>🔒 مزايدتك سرية تماماً — لا تُرسل لمتصفح الخصم إطلاقاً حتى نهاية الجولة.</span>
          )}
        </div>
      </div>

      {vetoBlocked ? (
        <div className="glass-panel clipped-corners p-6 text-center border-2 border-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(255,59,59,0.2)]">
          <div className="font-display text-xl font-bold text-red-400">🚫 تم استخدام الفيتو ضدك</div>
          <p className="mt-2 text-xs sm:text-sm text-[#d0c6ab]">
            الخصم استخدم كارت الفيتو ومنعك من المزايدة على اللاعب الحالي. ستحصل إجبارياً على اللاعب البديل المخفي مجاناً في نهاية الجولة!
          </p>
        </div>
      ) : isLive ? (
        /* ══════════════════════════════════════════════════════════════════════════
           ⚡ LIVE BIDDING ARENA (12s Open Real-Time Auction)
           ══════════════════════════════════════════════════════════════════════════ */
        <div className="glass-panel clipped-corners p-5 space-y-4 border-2 border-[#ffd700]/50 neon-border-gold shadow-[0_0_25px_rgba(255,215,0,0.25)]" style={{ background: 'linear-gradient(135deg, rgba(26, 11, 46, 0.8) 0%, rgba(5, 1, 10, 0.95) 100%)' }}>
          {/* Live Action Ticker */}
          <div className="flex items-center justify-between bg-black/60 border border-[#ffd700]/40 clipped-corners-inner px-3.5 py-2">
            <span className="text-xs font-bold font-display text-[#ffd700] flex items-center gap-1.5">
              <span>⚡</span>
              <span>{liveBids?.last_action || "بدأ المزاد المباشر! ضع مزايدتك الأولى"}</span>
            </span>
            <span className="text-[10px] text-[#d0c6ab]/70 font-bold">12 ثانية ⏳</span>
          </div>

          {/* Side-by-Side Live Bids Box */}
          <div className="grid grid-cols-2 gap-3">
            {/* My Bid */}
            <div className={cn(
              "clipped-corners p-3.5 flex flex-col items-center justify-center border text-center transition-all",
              isLeader
                ? "border-green-500 bg-green-500/15 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                : "border-white/15 bg-black/40"
            )}>
              <span className="text-xs text-[#d0c6ab] font-bold flex items-center gap-1">
                {isLeader && <span>👑</span>} مزايدتك الحالية
              </span>
              <span className="font-geist font-black text-2xl sm:text-3xl text-[#ffd700] mt-1">
                {myLiveBid > 0 ? `${myLiveBid}M` : "—"}
              </span>
              {isLeader && (
                <span className="text-[10px] text-green-400 font-bold mt-1">أنت الأعلى حالياً! ✅</span>
              )}
            </div>

            {/* Opponent Bid */}
            <div className={cn(
              "clipped-corners p-3.5 flex flex-col items-center justify-center border text-center transition-all",
              highestSeat !== null && highestSeat !== seat
                ? "border-red-500 bg-red-500/15 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                : "border-white/15 bg-black/40"
            )}>
              <span className="text-xs text-[#d0c6ab] font-bold flex items-center gap-1">
                {highestSeat !== null && highestSeat !== seat && <span>👑</span>} مزايدة {oppName}
              </span>
              <span className="font-geist font-black text-2xl sm:text-3xl text-[#eae2cf] mt-1">
                {oppLiveBid > 0 ? `${oppLiveBid}M` : "—"}
              </span>
              {highestSeat !== null && highestSeat !== seat && (
                <span className="text-[10px] text-red-400 font-bold mt-1">الخصم أعلى منك! ⚠️</span>
              )}
            </div>
          </div>

          {/* Status Banners */}
          {iPassed ? (
            <div className="p-3 bg-amber-500/20 border border-amber-500/50 clipped-corners text-center text-xs font-bold text-amber-300">
              🤝 لقد قلت للخصم "مبروك عليك!" واكتفيت بالبديل.. جارٍ إنهاء الجولة فوراً!
            </div>
          ) : oppPassed ? (
            <div className="p-3 bg-green-500/20 border border-green-500/50 clipped-corners text-center text-xs font-bold text-green-300 animate-pulse">
              🎉 {oppName} قال لك "مبروك عليك!" وتنازل عن المزايدة.. مبروك فوزك باللاعب!
            </div>
          ) : (
            <>
              {/* Quick Raise Pills */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#d0c6ab] font-bold px-1">
                  <span>المزايدة السريعة (فوق السعر الحالي {highestBid}M):</span>
                  <span className="text-[#ffe16d]">ميزانيتك: {myBudget}M</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 5, 10, 20].map((inc) => {
                    const target = highestBid + inc;
                    const canBid = target <= myBudget;
                    return (
                      <button
                        key={inc}
                        disabled={!canBid}
                        onClick={() => {
                          if (canBid && onLiveBid) void onLiveBid(target);
                        }}
                        className={cn(
                          "clipped-corners-inner py-2.5 px-1 flex flex-col items-center justify-center border transition active:scale-95",
                          canBid
                            ? "border-[#ffd700]/40 bg-[#ffd700]/15 hover:bg-[#ffd700]/25 text-[#ffe16d] hover:border-[#ffd700]"
                            : "border-white/10 bg-black/40 opacity-30 cursor-not-allowed text-[#d0c6ab]"
                        )}
                      >
                        <span className="font-geist font-black text-sm sm:text-base">+{inc}M</span>
                        <span className="text-[9px] text-[#d0c6ab]/70">({target}M)</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Raise Input & Submit */}
              <div className="flex gap-2">
                <div className="flex-1 border border-white/20 clipped-corners-inner px-3 py-2 bg-black/50 flex items-center">
                  <input
                    type="number"
                    min={highestBid + 1}
                    max={myBudget}
                    placeholder={`أدخل رقماً أعلى من ${highestBid}M`}
                    value={customLiveAmount || ""}
                    onChange={(e) => setCustomLiveAmount(Number(e.target.value))}
                    className="bg-transparent border-none text-[#ffe16d] font-geist font-bold text-base w-full focus:ring-0 outline-none p-0"
                  />
                  <span className="text-xs text-[#ffd700] font-bold shrink-0">M</span>
                </div>

                <button
                  disabled={!customLiveAmount || customLiveAmount <= highestBid || customLiveAmount > myBudget}
                  onClick={() => {
                    if (customLiveAmount > highestBid && customLiveAmount <= myBudget && onLiveBid) {
                      void onLiveBid(customLiveAmount);
                      setCustomLiveAmount(0);
                    }
                  }}
                  className={cn(
                    "px-4 py-2 clipped-corners font-display font-extrabold text-xs sm:text-sm transition active:scale-95 shrink-0 flex items-center gap-1",
                    customLiveAmount > highestBid && customLiveAmount <= myBudget
                      ? "gold-gradient-bg text-[#705e00] shadow-[0_0_10px_rgba(255,215,0,0.3)] hover:brightness-110"
                      : "bg-black/40 border border-white/10 text-white/30 cursor-not-allowed"
                  )}
                >
                  <span>🚀</span> ارفع المزاد
                </button>
              </div>

              {/* 🤝 The "مبروك عليك" (Pass / Concede) Button */}
              <button
                onClick={() => {
                  if (onPassBid) void onPassBid();
                }}
                className="w-full clipped-corners py-3 px-4 border-2 border-emerald-500/60 bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 text-emerald-300 hover:text-white hover:border-emerald-400 hover:bg-emerald-800/80 transition-all transform active:scale-95 flex flex-col items-center justify-center gap-0.5 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
              >
                <div className="font-display font-black text-sm sm:text-base flex items-center gap-2">
                  <span className="text-lg">🤝</span>
                  <span>مبروك عليك (اكتفاء بالبديل وإنهاء فوري)</span>
                  <span className="text-lg">🤝</span>
                </div>
                <span className="text-[10px] text-emerald-200/70 font-sans">
                  لو مش عايز تزود.. اضغط هنا للتنازل عن اللاعب وإنهاء الجولة فوراً دون انتظار الوقت!
                </span>
              </button>
            </>
          )}
        </div>
      ) : mySubmitted ? (
        /* Secret Auction: Submitted State */
        <div className="glass-panel clipped-corners p-6 text-center border-2 border-[#ffd700]/50 bg-[#ffd700]/10 neon-border-gold shadow-[0_0_20px_rgba(255,215,0,0.2)]">
          <div className="font-display text-xl font-bold text-[#ffd700] text-glow">تم تسجيل مزايدتك بنجاح ✅</div>
          <p className="mt-2 text-xs sm:text-sm text-[#d0c6ab]">
            {oppSubmitted ? "الخصم زايد أيضاً — جارٍ الكشف لحظياً…" : "في انتظار مزايدة الخصم أو انتهاء الوقت…"}
          </p>
        </div>
      ) : (
        /* Secret Auction: Slider & Controls */
        <div className="glass-panel clipped-corners p-5 space-y-4 border border-white/15 neon-border-purple" style={{ background: 'linear-gradient(135deg, rgba(26, 11, 46, 0.7) 0%, rgba(5, 1, 10, 0.9) 100%)' }}>
          {/* Bid Amount Header */}
          <div className="flex items-center justify-between px-1">
            <span className="font-display font-bold text-sm sm:text-base text-[#eae2cf]">
              {isMidRound ? "مزايدتك السرية على الصندوق الغامض:" : "مزايدتك السرية:"}
            </span>
            <span className="font-geist font-extrabold text-2xl sm:text-3xl text-[#ffd700] drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">{amount}M</span>
          </div>

          {/* Interactive Range Slider with Minus / Plus */}
          <div className="flex items-center gap-2 sm:gap-3" dir="ltr">
            <button
              onClick={() => { sfx.click(); setAmount((a) => Math.max(0, a - 5)); }}
              className="w-10 h-10 shrink-0 clipped-corners bg-[#2e2a1e] border border-white/15 flex items-center justify-center text-lg font-bold text-[#ffe16d] hover:bg-[#3d392c] active:scale-95 transition"
            >
              -
            </button>

            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min={0}
                max={myBudget}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-black/60 accent-[#ffd700] cursor-pointer"
              />
            </div>

            <button
              onClick={() => { sfx.click(); setAmount((a) => Math.min(myBudget, a + 5)); }}
              className="w-10 h-10 shrink-0 clipped-corners bg-[#2e2a1e] border border-white/15 flex items-center justify-center text-lg font-bold text-[#ffe16d] hover:bg-[#3d392c] active:scale-95 transition"
            >
              +
            </button>
          </div>

          {/* Quick Step Buttons */}
          <div className="flex gap-2">
            {[5, 10, 25].map((step) => (
              <button
                key={step}
                onClick={() => {
                  sfx.click();
                  setAmount((a) => Math.min(myBudget, a + step));
                }}
                className="flex-1 clipped-corners-inner border border-white/15 bg-black/40 py-2 text-xs sm:text-sm font-geist font-bold text-[#ffe16d] hover:border-[#ffd700] transition active:scale-95"
              >
                +{step}
              </button>
            ))}
            <button
              onClick={() => {
                sfx.click();
                setAmount(myBudget);
              }}
              className="flex-1 clipped-corners-inner border border-[#ffd700]/40 bg-[#ffd700]/15 py-2 text-xs sm:text-sm font-display font-bold text-[#ffd700] hover:bg-[#ffd700]/25 transition active:scale-95"
            >
              الكل ({myBudget}M)
            </button>
            <button
              onClick={() => {
                sfx.click();
                setAmount(0);
              }}
              className="flex-1 clipped-corners-inner border border-white/15 bg-black/40 py-2 text-xs sm:text-sm font-display font-bold text-[#d0c6ab] hover:border-white/30 transition active:scale-95"
            >
              صفر
            </button>
          </div>

          {/* Confirm Secret Bid Button */}
          <button
            onClick={() => {
              setSent(true);
              void onBid(amount);
            }}
            className="w-full gold-gradient-bg text-[#705e00] font-display font-extrabold text-base sm:text-xl py-3.5 mt-2 clipped-corners shadow-[0_4px_20px_rgba(255,215,0,0.35)] transition-transform active:scale-95 flex items-center justify-center gap-2 hover:brightness-110"
          >
            {isMidRound ? "🎁 تأكيد المزايدة على الصندوق الغامض" : "🔒 تأكيد المزايدة السرية"}
          </button>

          <div className="text-center text-[11px] text-[#d0c6ab]/70">
            حالة الخصم: {oppSubmitted ? "🔒 زايد بالفعل (القيمة مخفية)" : "⌛ لسه بيزايد..."}
          </div>
        </div>
      )}
    </div>
  );
}

function RevealPanel({
  reveal,
  seat,
  myName,
  oppName,
  isHost,
  isLast,
  onNext,
}: {
  reveal: import("@/lib/game-types").RevealResult;
  seat: Seat;
  myName: string;
  oppName: string;
  isHost: boolean;
  isLast: boolean;
  onNext: () => Promise<void>;
}) {
  const myBid = seat === "host" ? reveal.bidHost : reveal.bidGuest;
  const oppBid = seat === "host" ? reveal.bidGuest : reveal.bidHost;
  const iWon = reveal.winner === seat;

  useEffect(() => {
    sfx.reveal();
    const t = setTimeout(() => (iWon ? sfx.win() : sfx.lose()), 700);
    return () => clearTimeout(t);
  }, [iWon]);

  return (
    <div className="space-y-4">
      {/* Reveal Result Banner */}
      <div className="glass-panel clipped-corners p-5 sm:p-6 text-center border-2 border-[#ffd700]/40 neon-border-gold shadow-[0_0_25px_rgba(255,215,0,0.2)]" style={{ background: 'linear-gradient(135deg, rgba(26, 11, 46, 0.7) 0%, rgba(5, 1, 10, 0.9) 100%)' }}>
        <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#ffd700] text-glow">✨ لحظة الكشف!</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="animate-flip-in clipped-corners border border-team-home/60 bg-team-home/15 p-3.5 sm:p-4">
            <div className="text-xs text-[#d0c6ab] font-bold">{myName} (أنت)</div>
            <div className="font-geist font-extrabold text-2xl sm:text-4xl text-[#ffe16d] mt-1">{myBid}M</div>
          </div>
          <div
            className="animate-flip-in clipped-corners border border-team-away/60 bg-team-away/15 p-3.5 sm:p-4"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="text-xs text-[#d0c6ab] font-bold">{oppName}</div>
            <div className="font-geist font-extrabold text-2xl sm:text-4xl text-[#FF3B3B] mt-1">{oppBid}M</div>
          </div>
        </div>

        <div className={cn("mt-4 font-display font-extrabold text-lg sm:text-xl", iWon ? "text-[#3fc07a] drop-shadow-[0_0_8px_rgba(63,192,122,0.6)]" : "text-[#FF3B3B] drop-shadow-[0_0_8px_rgba(255,59,59,0.6)]")}>
          {reveal.stolenBy ? (
            reveal.stolenBy === seat ? (
              `🥷 قمت بسرقة ${reveal.main.nameAr} بنجاح مقابل ${reveal.price}M!`
            ) : (
              `🥷 الخصم سرق ${reveal.main.nameAr} منك بعد الكشف!`
            )
          ) : reveal.event?.vetoedBy ? (
            reveal.event.vetoedBy === seat ? (
              `🚫 فزت بـ ${reveal.main.nameAr} باستخدام الفيتو مقابل ${reveal.price}M`
            ) : (
              `🚫 حصلت على اللاعب البديل بسبب استخدام الخصم للفيتو`
            )
          ) : iWon ? (
            `🏆 مبروك! فزت بـ ${reveal.main.nameAr} مقابل ${reveal.price}M`
          ) : (
            `😤 الخصم فاز بـ ${reveal.main.nameAr} مقابل ${reveal.price}M`
          )}
        </div>
      </div>

      {/* Cards Distribution */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel clipped-corners flex flex-col items-center gap-2 p-4 border border-white/10 text-center">
          <div className="text-xs font-bold font-display text-[#ffe16d]">اللاعب الأساسي</div>
          <PlayerCard player={reveal.main} size="sm" />
          <div className="text-xs font-bold mt-1 text-[#eae2cf]">{reveal.winner === seat ? "من نصيبك 🎉" : "من نصيب الخصم"}</div>
        </div>
        <div className="glass-panel clipped-corners flex flex-col items-center gap-2 p-4 border border-white/10 text-center">
          <div className="text-xs font-bold font-display text-[#ffe16d]">اللاعب البديل (كان مخفي 🔒)</div>
          <PlayerCard player={reveal.sub} size="sm" className="animate-flip-in" />
          <div className="text-xs font-bold mt-1 text-[#eae2cf]">{reveal.winner === seat ? "ذهب للخصم مجاناً" : "من نصيبك مجاناً 🎉"}</div>
        </div>
      </div>

      <button
        onClick={() => void onNext()}
        className="w-full gold-gradient-bg text-[#705e00] font-display font-extrabold text-base sm:text-lg py-4 clipped-corners shadow-[0_4px_20px_rgba(255,215,0,0.35)] transition-transform active:scale-95 hover:brightness-110"
      >
        {isLast ? "عرض التشكيلة على الملعب 🏟️" : "الجولة التالية ⏭️"}
      </button>
    </div>
  );
}

function FinalResult({
  winner,
  seat,
  isHost,
  onRematch,
}: {
  winner: Seat | "draw";
  seat: Seat;
  isHost: boolean;
  onRematch: () => Promise<void>;
}) {
  const text = winner === "draw" ? "🤝 تعادل مثير!" : winner === seat ? "🏆 مبروك! أنت البطل الأسطوري" : "💔 خسرت هذه المرة!";
  return (
    <div className="glass-panel clipped-corners p-6 text-center border-2 border-[#ffd700]/40 neon-border-gold shadow-[0_0_30px_rgba(255,215,0,0.25)]" style={{ background: 'linear-gradient(135deg, rgba(26, 11, 46, 0.85) 0%, rgba(5, 1, 10, 0.95) 100%)' }}>
      <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#ffd700] text-glow">{text}</div>
      {isHost ? (
        <button
          onClick={() => void onRematch()}
          className="gold-gradient-bg text-[#705e00] font-display font-extrabold mt-5 w-full py-3.5 text-base sm:text-lg clipped-corners shadow-[0_4px_20px_rgba(255,215,0,0.35)] hover:brightness-110 active:scale-95"
        >
          مباراة جديدة 🔁
        </button>
      ) : (
        <p className="mt-4 text-xs sm:text-sm text-[#d0c6ab]">صاحب الغرفة يستطيع بدء مباراة جديدة.</p>
      )}
    </div>
  );
}

function CardPopup(props: {
  icon: string;
  kind: string;
  title: string;
  desc: string;
  owner: string;
  onClose: () => void;
}) {
  useEffect(() => {
    sfx.click();
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5 backdrop-blur-md">
      <div className="glass-panel clipped-corners animate-flip-in w-full max-w-sm p-6 text-center border-2 border-[#ffd700]/40 neon-border-gold shadow-[0_0_30px_rgba(255,215,0,0.3)]" style={{ background: 'linear-gradient(135deg, rgba(26, 11, 46, 0.9) 0%, rgba(5, 1, 10, 0.95) 100%)' }}>
        <div className="text-xs font-bold text-[#ffe16d] font-display">{props.kind}</div>
        <div className="mt-3 text-5xl sm:text-6xl drop-shadow">{props.icon}</div>
        <div className="mt-3 font-display text-xl sm:text-2xl font-bold text-[#ffd700] text-glow">{props.title}</div>
        <p className="mt-2 text-xs sm:text-sm text-[#eae2cf] leading-relaxed">{props.desc}</p>
        <div className="mt-3 clipped-corners-inner border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-bold text-[#d0c6ab]">
          {props.owner}
        </div>
        <button
          onClick={props.onClose}
          className="gold-gradient-bg text-[#705e00] font-display font-extrabold mt-5 w-full py-3 text-base clipped-corners shadow-[0_4px_15px_rgba(255,215,0,0.3)] hover:brightness-110 active:scale-95"
        >
          يلا نكمل ▶
        </button>
      </div>
    </div>
  );
}
