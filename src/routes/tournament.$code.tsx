import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useTournament } from "@/lib/useTournament";
import { getPlayerId, getPlayerName } from "@/lib/identity";
import {
  createTournament,
  joinTournament,
  startTournament,
} from "@/lib/tournament.functions";
import { cn } from "@/lib/utils";
import type { BracketMatch, TournamentPlayer } from "@/lib/tournament-types";

export const Route = createFileRoute("/tournament/$code")({
  head: () => ({
    meta: [{ title: "دوري مزاد الأساطير | بطولة مباشرة" }],
  }),
  component: TournamentPage,
});

// ─── Hooks ─────────────────────────────────────────────────────────────────
function TournamentPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { tournament, loading, error } = useTournament(code.toUpperCase());
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"bracket" | "players" | "spectate">("bracket");
  const [spectateRoom, setSpectateRoom] = useState<string | null>(null);

  const doJoin = useServerFn(joinTournament);
  const doStart = useServerFn(startTournament);

  useEffect(() => {
    setPlayerId(getPlayerId());
    setPlayerName(getPlayerName() || "");
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#ffd700] font-display text-xl animate-pulse">🏆 جارٍ تحميل الدوري...</div>
      </main>
    );
  }

  if (error || !tournament) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-5xl">😞</div>
        <div className="text-[#eae2cf] font-display text-xl">{error ?? "الدوري غير موجود"}</div>
        <button
          onClick={() => void navigate({ to: "/" })}
          className="purple-gradient-bg text-white font-bold px-6 py-2 clipped-corners"
        >
          🏠 الرئيسية
        </button>
      </main>
    );
  }

  const myPlayer = tournament.players.find((p) => p.id === playerId);
  const isHost = tournament.host_id === playerId;
  const isLobby = tournament.state === "lobby";
  const isActive = tournament.state === "active";
  const isFinished = tournament.state === "finished";
  const alreadyJoined = !!myPlayer;

  // ─── My current room ────────────────────────────────────────────────────
  const myCurrentRoom = myPlayer?.current_room;
  const isPlaying = !!myCurrentRoom && myPlayer?.status === "active";
  const isEliminated = myPlayer?.status === "eliminated";
  const isBye = myPlayer?.status === "bye";

  // ─── Active rooms for spectating ────────────────────────────────────────
  const currentRound = tournament.bracket.find((r) => r.round === tournament.current_round);
  const activeRooms = (currentRound?.matches ?? [])
    .filter((m) => m.state === "active" && m.room_code)
    .map((m) => ({ code: m.room_code!, p1: m.player1_name, p2: m.player2_name }));

  // ─── Handlers ────────────────────────────────────────────────────────────
  const onJoin = async () => {
    if (!playerName.trim()) { toast.error("اكتب اسمك أولاً"); return; }
    setBusy(true);
    try {
      await doJoin({ data: { id: tournament.id, playerId, playerName: playerName.trim() } });
      toast.success("✅ انضممت للدوري!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الانضمام");
    } finally { setBusy(false); }
  };

  const onStart = async () => {
    setBusy(true);
    try {
      await doStart({ data: { id: tournament.id, hostId: playerId } });
      toast.success("🏆 انطلق الدوري!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر البدء");
    } finally { setBusy(false); }
  };

  const goToMyRoom = () => {
    if (myCurrentRoom) void navigate({ to: "/room/$code", params: { code: myCurrentRoom } });
  };

  const goSpectate = (roomCode: string) => {
    void navigate({ to: "/room/$code", params: { code: roomCode } });
  };

  return (
    <main className="relative min-h-screen text-[#eae2cf] polygonal-bg font-sans">
      {/* Subtle overlay — body gradient shows through */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-black/10 via-transparent to-black/30 -z-10" />

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#200523]/80 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <button
            onClick={() => void navigate({ to: "/" })}
            className="flex items-center gap-1.5 px-3 py-1.5 clipped-corners bg-[#ffd700]/15 border border-[#ffd700]/40 text-[#ffd700] hover:bg-[#ffd700]/25 transition font-display font-bold text-xs active:scale-95"
          >
            <span>←</span>
            <span>الرئيسية</span>
          </button>
          <div className="text-center">
            <div className="font-display font-black text-base text-[#ffd700] text-glow">
              🏆 {tournament.name}
            </div>
            <div className="text-[10px] text-[#d0c6ab]/70">
              كود الدوري:{" "}
              <span className="font-geist font-bold text-[#ffe16d]">{tournament.id}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "px-2.5 py-1 rounded-full text-[9px] font-black font-display",
                isLobby ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                  : isActive ? "bg-green-500/20 text-green-300 border border-green-500/40 animate-pulse"
                  : "bg-[#ffd700]/20 text-[#ffd700] border border-[#ffd700]/40"
              )}
            >
              {isLobby ? "انتظار" : isActive ? "🔴 يلعب" : "🏆 انتهى"}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 pb-6 space-y-4 pt-4">

        {/* ─── CHAMPION BANNER ──────────────────────────────────────────── */}
        {isFinished && (
          <div className="glass-panel clipped-corners p-6 border-2 border-[#ffd700] bg-gradient-to-r from-[#ffd700]/20 via-[#8b5cf6]/20 to-[#ffd700]/20 text-center space-y-3 shadow-[0_0_40px_rgba(255,215,0,0.4)] animate-pulse">
            <div className="text-5xl">🏆</div>
            <div className="font-display font-black text-2xl text-[#ffd700] text-glow">
              بطل الدوري!
            </div>
            <div className="font-display font-black text-3xl text-white">
              {tournament.champion_name}
            </div>
            <div className="text-sm text-[#d0c6ab]">
              {tournament.champion_id === playerId ? "🎉 مبروك! أنت بطل الدوري!" : "👏 مبروك للبطل!"}
            </div>
          </div>
        )}

        {/* ─── MY STATUS CARD ──────────────────────────────────────────── */}
        {isActive && myPlayer && (
          <div className={cn(
            "clipped-corners p-4 border-2 text-center space-y-2",
            isPlaying ? "border-green-500 bg-green-500/15 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
              : isBye ? "border-blue-500 bg-blue-500/15"
              : isEliminated ? "border-red-500 bg-red-500/15"
              : "border-white/15 bg-white/5"
          )}>
            {isPlaying && (
              <>
                <div className="font-display font-bold text-green-300">🎮 أنت تلعب الآن!</div>
                <button
                  onClick={goToMyRoom}
                  className="w-full gold-gradient-bg text-[#705e00] font-display font-extrabold text-base py-3 clipped-corners shadow-[0_4px_20px_rgba(255,215,0,0.35)] active:scale-95 transition"
                >
                  🏟️ ادخل للملعب
                </button>
              </>
            )}
            {isBye && (
              <div className="font-display font-bold text-blue-300">
                😴 حصلت على جولة راحة (Bye) — ستنتقل تلقائياً للجولة القادمة!
              </div>
            )}
            {isEliminated && (
              <>
                <div className="font-display font-bold text-red-300">😞 خرجت من الدوري</div>
                <div className="text-xs text-[#d0c6ab]">يمكنك مشاهدة المباريات الجارية ↓</div>
              </>
            )}
          </div>
        )}

        {/* ─── LOBBY SECTION ───────────────────────────────────────────── */}
        {isLobby && (
          <div className="glass-panel clipped-corners p-5 border border-[#ffd700]/40 space-y-4"
            style={{ background: 'linear-gradient(135deg, rgba(42,10,74,0.7) 0%, rgba(5,1,10,0.9) 100%)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-[#ffd700]">
                🏟️ صالة الانتظار
              </h2>
              <span className="text-xs text-[#d0c6ab] bg-black/40 px-2 py-1 rounded-full">
                {tournament.players.length} / 16 لاعب
              </span>
            </div>

            {/* Player list in lobby */}
            <div className="space-y-2">
              {tournament.players.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 bg-black/30 border border-white/10 clipped-corners-inner p-2.5">
                  <span className="text-lg font-black text-[#ffd700] font-display w-6 text-center">{i + 1}</span>
                  <span className="font-bold text-sm text-[#eae2cf] flex-1">{p.name}</span>
                  {p.id === tournament.host_id && (
                    <span className="text-[9px] bg-[#ffd700]/20 text-[#ffd700] border border-[#ffd700]/40 px-2 py-0.5 rounded-full font-bold">
                      👑 المضيف
                    </span>
                  )}
                  {p.id === playerId && (
                    <span className="text-[9px] bg-green-500/20 text-green-300 border border-green-500/40 px-2 py-0.5 rounded-full font-bold">
                      أنت
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Join / Start buttons */}
            {!alreadyJoined && (
              <button
                disabled={busy}
                onClick={() => void onJoin()}
                className="w-full purple-gradient-bg text-white font-display font-extrabold text-base py-3.5 clipped-corners shadow-[0_4px_15px_rgba(139,92,246,0.4)] active:scale-95 transition disabled:opacity-50"
              >
                ✅ انضم للدوري
              </button>
            )}

            {isHost && alreadyJoined && tournament.players.length >= 2 && (
              <button
                disabled={busy}
                onClick={() => void onStart()}
                className="w-full gold-gradient-bg text-[#705e00] font-display font-extrabold text-base py-3.5 clipped-corners shadow-[0_4px_20px_rgba(255,215,0,0.35)] active:scale-95 transition hover:brightness-110 disabled:opacity-50"
              >
                🚀 ابدأ الدوري ({tournament.players.length} لاعبين)
              </button>
            )}

            {isHost && tournament.players.length < 2 && (
              <div className="text-center text-xs text-[#d0c6ab]/60 py-2">
                في انتظار لاعب آخر على الأقل للبدء...
              </div>
            )}

            {!isHost && alreadyJoined && (
              <div className="text-center text-xs text-[#d0c6ab]/60 py-2 animate-pulse">
                ⏳ في انتظار المضيف لبدء الدوري...
              </div>
            )}
          </div>
        )}

        {/* ─── ACTIVE / FINISHED TABS ──────────────────────────────────── */}
        {(isActive || isFinished) && (
          <>
            {/* Tab bar */}
            <div className="flex gap-2">
              {(["bracket", "players", "spectate"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 clipped-corners py-2.5 text-xs font-bold font-display transition",
                    tab === t
                      ? "border border-[#ffd700] bg-[#ffd700]/15 text-[#ffd700]"
                      : "border border-white/10 bg-[#161308]/60 text-[#d0c6ab]/70 hover:bg-[#161308]"
                  )}
                >
                  {t === "bracket" ? "🏆 البراكيت" : t === "players" ? "👥 اللاعبون" : "👁️ مشاهدة"}
                </button>
              ))}
            </div>

            {/* ── BRACKET TAB ─────────────────────────────────────────── */}
            {tab === "bracket" && (
              <div className="space-y-4">
                {tournament.bracket.map((round) => (
                  <div key={round.round} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-xs font-bold font-display text-[#ffe16d] px-2">
                        {round.round === tournament.bracket.length && isFinished
                          ? "🏆 النهائي"
                          : `الجولة ${round.round}`}
                      </span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>

                    {/* Bye badge */}
                    {round.bye_player_id && (
                      <div className="clipped-corners-inner bg-blue-500/10 border border-blue-500/30 p-2.5 text-center text-xs text-blue-300 font-bold">
                        😴 {round.bye_player_name} — حصل على جولة راحة (Bye) وتأهل تلقائياً
                      </div>
                    )}

                    {/* Matches */}
                    {round.matches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        playerId={playerId}
                        onEnter={() => {
                          if (match.room_code) void navigate({ to: "/room/$code", params: { code: match.room_code } });
                        }}
                      />
                    ))}
                  </div>
                ))}

                {isActive && currentRound && (
                  <div className="text-center text-xs text-[#d0c6ab]/50 py-1">
                    الجولة الحالية: {tournament.current_round} •{" "}
                    {currentRound.matches.filter((m) => m.state === "done").length} / {currentRound.matches.length} مباريات انتهت
                  </div>
                )}
              </div>
            )}

            {/* ── PLAYERS TAB ─────────────────────────────────────────── */}
            {tab === "players" && (
              <div className="space-y-2">
                {[...tournament.players]
                  .sort((a, b) => {
                    const order = { active: 0, bye: 1, spectating: 2, eliminated: 3 };
                    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
                  })
                  .map((p) => (
                    <PlayerStatusCard key={p.id} player={p} isMe={p.id === playerId} />
                  ))}
              </div>
            )}

            {/* ── SPECTATE TAB ────────────────────────────────────────── */}
            {tab === "spectate" && (
              <div className="space-y-3">
                <div className="text-xs text-[#d0c6ab]/70 text-center">
                  اختر مباراة لمشاهدتها — يمكنك التنقل بينها بحرية 👁️
                </div>

                {activeRooms.length === 0 ? (
                  <div className="text-center py-8 space-y-2 text-[#d0c6ab]/50">
                    <div className="text-3xl">⏸️</div>
                    <div className="text-sm">لا توجد مباريات جارية حالياً</div>
                  </div>
                ) : (
                  activeRooms.map((r) => (
                    <button
                      key={r.code}
                      onClick={() => goSpectate(r.code)}
                      className="w-full glass-panel clipped-corners p-4 flex items-center gap-3 border border-[#8b5cf6]/40 hover:border-[#00E5FF] active:scale-95 group transition text-right"
                      style={{ background: 'linear-gradient(135deg, rgba(26,11,46,0.8) 0%, rgba(5,1,10,0.9) 100%)' }}
                    >
                      <div className="text-2xl p-2 rounded-xl bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 shrink-0 group-hover:scale-110 transition-transform">
                        👁️
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-sm text-[#00E5FF]">
                          {r.p1} <span className="text-[#d0c6ab]/60 mx-1">vs</span> {r.p2}
                        </div>
                        <div className="text-[10px] text-[#d0c6ab]/50 mt-0.5">
                          غرفة: {r.code} • اضغط للمشاهدة الحية
                        </div>
                      </div>
                      <span className="text-[#8b5cf6] text-lg">→</span>
                    </button>
                  ))
                )}

                {/* All finished rooms */}
                {currentRound && currentRound.matches.filter((m) => m.state === "done").length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-[#d0c6ab]/40 text-center">مباريات انتهت في هذه الجولة</div>
                    {currentRound.matches
                      .filter((m) => m.state === "done")
                      .map((m) => (
                        <div key={m.id} className="clipped-corners-inner bg-black/30 border border-white/8 p-3 text-xs text-center text-[#d0c6ab]/60">
                          {m.player1_name} vs {m.player2_name} —{" "}
                          <span className="text-[#ffd700] font-bold">الفائز: {m.winner_name}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ─── Match Card Component ──────────────────────────────────────────────────
function MatchCard({
  match,
  playerId,
  onEnter,
}: {
  match: BracketMatch;
  playerId: string;
  onEnter: () => void;
}) {
  const isMyMatch = match.player1_id === playerId || match.player2_id === playerId;
  const isDone = match.state === "done";
  const isActive = match.state === "active";

  return (
    <div
      className={cn(
        "clipped-corners p-4 border transition",
        isDone
          ? "border-white/10 bg-black/20"
          : isActive && isMyMatch
          ? "border-green-500 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
          : isActive
          ? "border-[#8b5cf6]/40 bg-black/30"
          : "border-white/8 bg-black/20 opacity-60"
      )}
    >
      {/* vs row */}
      <div className="flex items-center gap-3">
        {/* Player 1 */}
        <div className={cn(
          "flex-1 text-center p-2 clipped-corners-inner border",
          isDone && match.winner_id === match.player1_id
            ? "border-[#ffd700] bg-[#ffd700]/15"
            : "border-white/10 bg-black/20"
        )}>
          <div className="font-bold text-sm truncate">
            {isDone && match.winner_id === match.player1_id && <span className="mr-1">👑</span>}
            {match.player1_name}
          </div>
          {isDone && match.winner_id !== match.player1_id && (
            <div className="text-[10px] text-red-400 mt-0.5">خسر</div>
          )}
        </div>

        {/* VS */}
        <span className="text-xs font-black text-[#d0c6ab]/50 shrink-0">
          {isDone ? "🏁" : isActive ? "⚡" : "vs"}
        </span>

        {/* Player 2 */}
        <div className={cn(
          "flex-1 text-center p-2 clipped-corners-inner border",
          isDone && match.winner_id === match.player2_id
            ? "border-[#ffd700] bg-[#ffd700]/15"
            : "border-white/10 bg-black/20"
        )}>
          <div className="font-bold text-sm truncate">
            {isDone && match.winner_id === match.player2_id && <span className="mr-1">👑</span>}
            {match.player2_name}
          </div>
          {isDone && match.winner_id !== match.player2_id && (
            <div className="text-[10px] text-red-400 mt-0.5">خسر</div>
          )}
        </div>
      </div>

      {/* Action */}
      {isActive && isMyMatch && (
        <button
          onClick={onEnter}
          className="w-full mt-3 gold-gradient-bg text-[#705e00] font-display font-extrabold text-sm py-2 clipped-corners active:scale-95 transition"
        >
          🏟️ ادخل ملعبك
        </button>
      )}
      {isActive && !isMyMatch && (
        <button
          onClick={onEnter}
          className="w-full mt-3 bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 text-[#8b5cf6] font-display font-bold text-xs py-2 clipped-corners active:scale-95 transition hover:bg-[#8b5cf6]/30"
        >
          👁️ شاهد هذه المباراة
        </button>
      )}
    </div>
  );
}

// ─── Player Status Card ────────────────────────────────────────────────────
function PlayerStatusCard({ player, isMe }: { player: TournamentPlayer; isMe: boolean }) {
  const statusConfig = {
    active: { label: "🟢 نشط", color: "text-green-300 border-green-500/30 bg-green-500/10" },
    bye: { label: "😴 راحة", color: "text-blue-300 border-blue-500/30 bg-blue-500/10" },
    spectating: { label: "👁️ يتفرج", color: "text-purple-300 border-purple-500/30 bg-purple-500/10" },
    eliminated: { label: "❌ خرج", color: "text-red-400/70 border-red-500/20 bg-red-500/5" },
  }[player.status];

  return (
    <div className={cn(
      "flex items-center gap-3 clipped-corners-inner border p-3 transition",
      statusConfig.color,
      player.status === "eliminated" ? "opacity-60" : ""
    )}>
      <div className="flex-1 min-w-0">
        <div className={cn("font-bold text-sm", isMe && "text-[#ffd700]")}>
          {player.name} {isMe && "(أنت)"}
        </div>
        <div className="text-[10px] opacity-70">
          ✅ {player.wins} انتصار • ❌ {player.losses} خسارة
        </div>
      </div>
      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", statusConfig.color)}>
        {statusConfig.label}
      </span>
    </div>
  );
}
