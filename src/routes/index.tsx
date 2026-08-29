import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getPlayerId,
  getPlayerName,
  getPlayerTag,
  setPlayerName,
  getFriends,
  addFriend,
  removeFriend,
  type Friend,
} from "@/lib/identity";
import { safeCopy } from "@/lib/legacy-polyfills";
import { sfx, unlockAudio, isMuted, setMuted } from "@/lib/sound";
import { quickMatch, playVsBot } from "@/lib/game.functions";
import { createTournament } from "@/lib/tournament.functions";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { PlayerCard } from "@/components/game/PlayerCard";
import { PLAYERS } from "@/lib/players";

export const Route = createFileRoute("/")(
  {
    head: () => ({
      meta: [
        { title: "مزاد كرة القدم الأسطوري | لعبة مزاد أونلاين" },
        {
          name: "description",
          content:
            "زايد بالسر على نجوم الكرة، ابنِ تشكيلتك على الملعب، وواجه خصمك أونلاين في مباراة محاكاة حماسية — 5 ضد 5 أو 11 ضد 11.",
        },
        { property: "og:title", content: "مزاد كرة القدم الأسطوري" },
        {
          property: "og:description",
          content: "مزايدة سرية أونلاين على أساطير كرة القدم وبناء تشكيلة الأحلام.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    }),
    component: Home,
  }
);

type NavTab = "home" | "play" | "join" | "friends" | "settings";

function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"5" | "11">("5");
  const [auctionType, setAuctionType] = useState<"blind" | "live">("blind");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [tag, setTag] = useState("#????");
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendTag, setFriendTag] = useState("");
  const [friendName, setFriendName] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setName(getPlayerName() || "");
    setMutedState(isMuted());
    setTag(getPlayerTag());
    setFriends(getFriends());
    sfx.refresh();
  }, []);

  const doCreateTournament = useServerFn(createTournament);

  const requireName = () => {
    const n = name.trim();
    if (n.length < 2) { toast.error("اكتب اسمك أولاً"); return null; }
    setPlayerName(n);
    return n;
  };

  const onCreate = async () => {
    unlockAudio();
    const n = requireName();
    if (!n) return;
    setBusy(true);
    try {
      sfx.click();
      const res = await requestRoomAccess({ action: "create", mode, auctionType, name: n, playerId: getPlayerId() });
      void navigate({ to: "/room/$code", params: { code: res.code } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ غير متوقع");
    } finally { setBusy(false); }
  };

  const onCreateTournament = async () => {
    unlockAudio();
    const n = requireName();
    if (!n) return;
    setBusy(true);
    try {
      sfx.click();
      toast.loading("🏆 يتم إنشاء بطولة الدوري...", { id: "tourney" });
      const res = await doCreateTournament({
        data: {
          name: `بطولة ${n}`,
          mode,
          auctionType,
          hostId: getPlayerId(),
          hostName: n,
        },
      });
      toast.dismiss("tourney");
      toast.success("✅ تم إنشاء الدوري بنجاح!");
      void navigate({ to: "/tournament/$code", params: { code: res.id } });
    } catch (e) {
      toast.dismiss("tourney");
      toast.error(e instanceof Error ? e.message : "تعذر إنشاء الدوري");
    } finally { setBusy(false); }
  };

  const onJoin = async () => {
    unlockAudio();
    const n = requireName();
    if (!n) return;
    const raw = code.trim().toUpperCase();
    if (raw.startsWith("T") || raw.length === 6) {
      void navigate({ to: "/tournament/$code", params: { code: raw } });
      return;
    }
    if (raw.length !== 4) { toast.error("كود الغرفة 4 خانات أو كود الدوري يبدأ بـ T"); return; }
    setBusy(true);
    try {
      sfx.click();
      const res = await requestRoomAccess({ action: "join", code: raw, name: n, playerId: getPlayerId() });
      void navigate({ to: "/room/$code", params: { code: res.code } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الانضمام");
    } finally { setBusy(false); }
  };

  const onQuickMatch = async () => {
    unlockAudio();
    const n = requireName();
    if (!n) return;
    setBusy(true);
    setSearching(true);
    try {
      sfx.click();
      toast.loading("🔍 نبحث عن خصم...", { id: "qm" });
      const res = await quickMatch({ data: { mode, auctionType, name: n, playerId: getPlayerId() } });
      toast.dismiss("qm");
      if (res.created) {
        toast.success("⏳ في انتظار خصم... سيبدأ اللعب تلقائياً!");
      } else {
        toast.success("✅ تم العثور على خصم! يتم الانضمام...");
      }
      void navigate({ to: "/room/$code", params: { code: res.code } });
    } catch (e) {
      toast.dismiss("qm");
      toast.error(e instanceof Error ? e.message : "خطأ في البحث");
    } finally { setBusy(false); setSearching(false); }
  };

  const onVsBot = async () => {
    unlockAudio();
    const n = requireName();
    if (!n) return;
    setBusy(true);
    try {
      sfx.click();
      toast.loading("🤖 يتم إعداد الذكاء الاصطناعي...", { id: "bot" });
      const res = await playVsBot({ data: { mode, auctionType, name: n, playerId: getPlayerId() } });
      toast.dismiss("bot");
      void navigate({ to: "/room/$code", params: { code: res.code } });
    } catch (e) {
      toast.dismiss("bot");
      toast.error(e instanceof Error ? e.message : "خطأ غير متوقع");
    } finally { setBusy(false); }
  };

  const onCopyTag = () => {
    safeCopy(tag)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("تم نسخ سيريالك!"); })
      .catch(() => toast.error("تعذر النسخ"));
  };

  const onAddFriend = () => {
    const t = friendTag.trim();
    const fn = friendName.trim() || t;
    if (!t) { toast.error("أدخل سيريال الصديق"); return; }
    try {
      const updated = addFriend(t, fn);
      setFriends(updated);
      setFriendTag("");
      setFriendName("");
      toast.success("✅ تمت إضافة الصديق!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    }
  };

  const onRemoveFriend = (ftag: string) => {
    const updated = removeFriend(ftag);
    setFriends(updated);
    toast.info("تم حذف الصديق");
  };

  const onChallengeFriend = async (f: Friend) => {
    const n = requireName();
    if (!n) return;
    setBusy(true);
    try {
      sfx.click();
      const res = await requestRoomAccess({ action: "create", mode, name: n, playerId: getPlayerId() });
      const msg = `${n} يتحداك في مزاد كرة القدم الأسطوري! كود الغرفة: ${res.code}`;
      safeCopy(msg).catch(() => null);
      toast.success(`🎮 تم إنشاء الغرفة! أرسل الكود ${res.code} لـ ${f.name}`);
      void navigate({ to: "/room/$code", params: { code: res.code } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally { setBusy(false); }
  };

  const STAR_PLAYER_IDS = ["messi", "ronaldo", "mbappe", "haaland"];
  const STAR_PLAYERS: import("@/lib/players").Player[] = STAR_PLAYER_IDS.map(
    (id) => PLAYERS.find((p) => p.id === id)!
  ).filter(Boolean);

  // ─── Bottom Nav Items ────────────────────────────────────────────────────────
  const NAV_ITEMS: { id: NavTab; icon: string; label: string }[] = [
    { id: "home",     icon: "🏠", label: "الرئيسية" },
    { id: "play",     icon: "🎮", label: "العب" },
    { id: "join",     icon: "🔑", label: "انضم" },
    { id: "friends",  icon: "👥", label: "الأصدقاء" },
    { id: "settings", icon: "⚙️", label: "الإعدادات" },
  ];

  return (
    <main className="relative min-h-screen text-[#eae2cf] polygonal-bg overflow-x-hidden font-sans flex flex-col">
      {/* Subtle overlay to darken edges slightly */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/40 -z-10" />

      {/* ══════════════════════════════════════════
          HEADER — Logo + Title + Back button
          ══════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-[#200523]/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between max-w-xl mx-auto w-full">
        {/* Left: Back button or Mute toggle */}
        {activeTab !== "home" ? (
          <button
            onClick={() => { setActiveTab("home"); sfx.click(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 clipped-corners bg-[#ffd700]/15 border border-[#ffd700]/40 text-[#ffd700] hover:bg-[#ffd700]/25 transition font-display font-bold text-xs active:scale-95 shadow-[0_0_10px_rgba(255,215,0,0.2)]"
          >
            <span>←</span>
            <span>الرئيسية</span>
          </button>
        ) : (
          <button
            onClick={() => {
              const next = !muted;
              setMutedState(next);
              setMuted(next);
              sfx.refresh();
              if (!next) { unlockAudio(); sfx.click(); }
            }}
            className="w-9 h-9 flex items-center justify-center clipped-corners bg-white/5 border border-white/10 text-base hover:bg-white/10 transition"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}

        {/* Center: Title + live badge */}
        <div className="flex flex-col items-center">
          <h1 className="font-display font-black text-lg sm:text-xl text-[#ffd700] leading-tight tracking-wide text-glow">
            مزاد الأساطير
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
            <span className="text-[10px] text-[#d0c6ab]/70 font-bold tracking-wider">أونلاين</span>
          </div>
        </div>

        {/* Right: Player tag pill */}
        <button
          onClick={onCopyTag}
          className={cn(
            "flex items-center gap-1 px-2 py-1 clipped-corners text-[10px] font-bold transition",
            copied
              ? "bg-green-500/20 text-green-400 border border-green-500/40"
              : "bg-[#ffd700]/10 text-[#ffd700] border border-[#ffd700]/30 hover:bg-[#ffd700]/20"
          )}
        >
          {copied ? "✅" : tag}
        </button>
      </header>

      {/* ══════════════════════════════════════════
          MAIN CONTENT (scrollable area)
          ══════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-xl mx-auto px-4 pt-2 space-y-0">

          {/* ── HOME TAB ── */}
          {activeTab === "home" && (
            <div className="space-y-6 pt-4">
              {/* Hero Title */}
              <div className="text-center space-y-2">
                <p className="text-4xl sm:text-5xl font-black font-display text-[#ffd700] leading-tight text-glow drop-shadow-[0_0_25px_rgba(255,215,0,0.4)]">
                  مزاد كرة القدم<br />
                  <span className="text-[#eae2cf]">الأسطوري</span>
                </p>
                <p className="text-xs sm:text-sm text-[#d0c6ab]/80 max-w-xs mx-auto leading-relaxed">
                  زايد بالسر على النجوم — ابنِ تشكيلتك وواجه خصمك أونلاين
                </p>
              </div>

              {/* Star Player Cards — horizontal scroll */}
              <div>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-[#ffd700] text-sm">⭐</span>
                  <span className="font-display font-bold text-xs text-[#ffe16d]">نجوم المزاد المتاحة</span>
                  <span className="text-[#ffd700] text-sm">⭐</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 px-1 no-scrollbar snap-x snap-mandatory justify-start">
                  {STAR_PLAYERS.map((p) => (
                    <div key={p.id} className="snap-center shrink-0">
                      <PlayerCard player={p} size="sm" className="hover:scale-105 transition-transform" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Action Cards — tappable shortcuts */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab("play")}
                  className="glass-panel clipped-corners p-5 flex flex-col items-center gap-2 border border-[#ffd700]/30 hover:border-[#ffd700] transition active:scale-95 group"
                  style={{ background: 'linear-gradient(135deg, rgba(26,11,46,0.7) 0%, rgba(5,1,10,0.9) 100%)' }}
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform">🎮</span>
                  <span className="font-display font-bold text-sm text-[#ffd700]">العب الآن</span>
                  <span className="text-[10px] text-[#d0c6ab]/70 text-center">اختر الوضع وابدأ</span>
                </button>

                <button
                  onClick={() => setActiveTab("join")}
                  className="glass-panel clipped-corners p-5 flex flex-col items-center gap-2 border border-[#8b5cf6]/30 hover:border-[#8b5cf6] transition active:scale-95 group"
                  style={{ background: 'linear-gradient(135deg, rgba(26,11,46,0.7) 0%, rgba(5,1,10,0.9) 100%)' }}
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform">🔑</span>
                  <span className="font-display font-bold text-sm text-[#00E5FF]">انضم بكود</span>
                  <span className="text-[10px] text-[#d0c6ab]/70 text-center">عندك كود غرفة؟</span>
                </button>

                <button
                  onClick={() => { requireName() && void onVsBot(); }}
                  disabled={busy}
                  className="glass-panel clipped-corners p-5 flex flex-col items-center gap-2 border border-emerald-500/30 hover:border-emerald-500 transition active:scale-95 group disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, rgba(5,40,5,0.7) 0%, rgba(5,1,10,0.9) 100%)' }}
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform">🤖</span>
                  <span className="font-display font-bold text-sm text-emerald-300">ضد البوت</span>
                  <span className="text-[10px] text-[#d0c6ab]/70 text-center">تدرب على الذكاء</span>
                </button>

                <button
                  onClick={() => setActiveTab("friends")}
                  className="glass-panel clipped-corners p-5 flex flex-col items-center gap-2 border border-pink-500/30 hover:border-pink-500 transition active:scale-95 group"
                  style={{ background: 'linear-gradient(135deg, rgba(40,5,20,0.7) 0%, rgba(5,1,10,0.9) 100%)' }}
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform">👥</span>
                  <span className="font-display font-bold text-sm text-pink-300">الأصدقاء</span>
                  <span className="text-[10px] text-[#d0c6ab]/70 text-center">{friends.length} صديق</span>
                </button>
              </div>

              {/* Footer note */}
              <p className="text-center text-[10px] text-[#d0c6ab]/40 pb-2">
                🔒 مزايدة مغلقة — المزايدات مخزنة على السيرفر فقط
              </p>
            </div>
          )}

          {/* ── PLAY TAB ── */}
          {activeTab === "play" && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2 pb-1">
                <span className="text-2xl">🎮</span>
                <h2 className="font-display font-black text-xl text-[#ffd700]">أوضاع اللعب</h2>
              </div>

              {/* Name Input */}
              <div className="glass-panel clipped-corners p-4 border border-white/10 space-y-2"
                style={{ background: 'linear-gradient(135deg, rgba(42,10,74,0.7) 0%, rgba(5,1,10,0.9) 100%)' }}>
                <label className="text-xs text-[#d0c6ab] font-bold">اسمك في الملعب</label>
                <div className="border border-white/15 clipped-corners-inner px-4 py-2.5 flex items-center bg-black/40 neon-border-purple">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={20}
                    placeholder="مثال: كابتن محمد"
                    className="bg-transparent border-none text-[#eae2cf] font-display font-bold text-base w-full focus:ring-0 outline-none p-0"
                  />
                </div>
              </div>

              {/* Game Mode */}
              <div className="space-y-2">
                <label className="text-xs text-[#d0c6ab] font-bold px-1">🏟️ الوضع</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setMode("5"); unlockAudio(); sfx.click(); }}
                    className={cn(
                      "clipped-corners p-4 flex flex-col items-center gap-1 transition-all border active:scale-95",
                      mode === "5"
                        ? "bg-[#2e2a1e] border-2 border-[#ffd700] shadow-[0_0_15px_rgba(255,215,0,0.25)]"
                        : "bg-[#161308]/80 border-white/10 opacity-70 hover:opacity-90"
                    )}
                  >
                    <span className="text-2xl">⚡</span>
                    <span className="font-bold text-[#ffe16d] text-sm font-display">سريع 5 ضد 5</span>
                    <span className="text-[10px] text-[#d0c6ab]">5 جولات • 120M</span>
                  </button>
                  <button
                    onClick={() => { setMode("11"); unlockAudio(); sfx.click(); }}
                    className={cn(
                      "clipped-corners p-4 flex flex-col items-center gap-1 transition-all border active:scale-95",
                      mode === "11"
                        ? "bg-[#2e2a1e] border-2 border-[#ffd700] shadow-[0_0_15px_rgba(255,215,0,0.25)]"
                        : "bg-[#161308]/80 border-white/10 opacity-70 hover:opacity-90"
                    )}
                  >
                    <span className="text-2xl">🏆</span>
                    <span className="font-bold text-[#eae2cf] text-sm font-display">كامل 11 ضد 11</span>
                    <span className="text-[10px] text-[#d0c6ab]">11 جولة • 240M</span>
                  </button>
                </div>
              </div>

              {/* Auction Type */}
              <div className="space-y-2">
                <label className="text-xs text-[#d0c6ab] font-bold px-1">🎯 نوع المزاد</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setAuctionType("blind"); unlockAudio(); sfx.click(); }}
                    className={cn(
                      "clipped-corners p-4 flex flex-col items-center gap-1 transition-all border text-center active:scale-95",
                      auctionType === "blind"
                        ? "bg-[#2e2a1e] border-2 border-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.25)] text-[#ffe16d]"
                        : "bg-[#161308]/80 border-white/10 opacity-70 hover:opacity-90 text-[#d0c6ab]"
                    )}
                  >
                    <span className="text-2xl">🤫</span>
                    <span className="font-bold text-sm font-display">مزاد سري</span>
                    <span className="text-[9px] text-[#d0c6ab]/70">مغلق 20 ثانية</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuctionType("live"); unlockAudio(); sfx.click(); }}
                    className={cn(
                      "clipped-corners p-4 flex flex-col items-center gap-1 transition-all border text-center active:scale-95 relative overflow-hidden",
                      auctionType === "live"
                        ? "bg-gradient-to-r from-[#ffd700]/25 to-[#ff9100]/20 border-2 border-[#ffd700] shadow-[0_0_15px_rgba(255,215,0,0.35)] text-[#ffd700]"
                        : "bg-[#161308]/80 border-white/10 opacity-70 hover:opacity-90 text-[#d0c6ab]"
                    )}
                  >
                    <span className="absolute top-0 left-0 bg-red-600 text-white font-black text-[7px] px-1 py-0.5 rounded-br">جديد🔥</span>
                    <span className="text-2xl">⚡</span>
                    <span className="font-bold text-sm font-display">مباشر 12s</span>
                    <span className="text-[9px] text-[#d0c6ab]/70">حي + مبروك عليك</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-1">
                {/* vs Bot */}
                <button
                  disabled={busy}
                  onClick={() => void onVsBot()}
                  className="w-full glass-panel clipped-corners p-4 flex items-center gap-3.5 border border-emerald-500/40 hover:border-emerald-500 active:scale-95 group transition disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, rgba(5,40,5,0.8) 0%, rgba(5,1,10,0.9) 100%)' }}
                >
                  <div className="text-3xl p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 shrink-0 group-hover:scale-110 transition-transform">🤖</div>
                  <div className="flex-1 text-right">
                    <div className="font-display text-base font-bold text-emerald-300">العب ضد البوت الذكي</div>
                    <div className="text-[11px] text-[#d0c6ab] mt-0.5">مورينيو، كلوب، غوارديولا...</div>
                  </div>
                </button>

                {/* Quick Match */}
                <button
                  disabled={busy}
                  onClick={() => void onQuickMatch()}
                  className="w-full glass-panel clipped-corners p-4 flex items-center gap-3.5 border border-[#8b5cf6]/40 hover:border-[#00E5FF] active:scale-95 group transition disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, rgba(26,11,46,0.8) 0%, rgba(5,1,10,0.9) 100%)' }}
                >
                  <div className="text-3xl p-2.5 rounded-xl bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 shrink-0 group-hover:scale-110 transition-transform">
                    {searching ? "⏳" : "⚡"}
                  </div>
                  <div className="flex-1 text-right">
                    <div className="font-display text-base font-bold text-[#00E5FF]">لعب سريع أونلاين</div>
                    <div className="text-[11px] text-[#d0c6ab] mt-0.5">ابحث عن منافس عشوائي فوراً</div>
                  </div>
                </button>

                {/* Create Tournament */}
                <button
                  disabled={busy}
                  onClick={() => void onCreateTournament()}
                  className="w-full glass-panel clipped-corners p-4 flex items-center gap-3.5 border-2 border-[#ffd700]/60 hover:border-[#ffd700] active:scale-95 group transition shadow-[0_0_20px_rgba(255,215,0,0.2)] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, rgba(74,40,10,0.8) 0%, rgba(5,1,10,0.95) 100%)' }}
                >
                  <div className="text-3xl p-2.5 rounded-xl bg-[#ffd700]/15 border border-[#ffd700]/40 shrink-0 group-hover:scale-110 transition-transform">
                    🏆
                  </div>
                  <div className="flex-1 text-right">
                    <div className="font-display text-base font-black text-[#ffd700] text-glow">
                      إنشاء بطولة دوري أونلاين
                    </div>
                    <div className="text-[11px] text-[#d0c6ab] mt-0.5">
                      أي عدد لاعبين (فردي أو زوجي) • إقصاء مباشر + مشاهدة
                    </div>
                  </div>
                </button>

                {/* Create Private Room */}
                <button
                  disabled={busy}
                  onClick={() => void onCreate()}
                  className="w-full gold-gradient-bg text-[#705e00] font-display font-extrabold text-base py-4 shadow-[0_4px_20px_rgba(255,215,0,0.35)] transition-transform active:scale-95 flex items-center justify-center gap-2 clipped-corners hover:brightness-110 disabled:opacity-50"
                >
                  👑 إنشاء مباراة فردية خاصة
                </button>
              </div>
            </div>
          )}

          {/* ── JOIN TAB ── */}
          {activeTab === "join" && (
            <div className="space-y-5 pt-4">
              <div className="flex items-center gap-2 pb-1">
                <span className="text-2xl">🔑</span>
                <h2 className="font-display font-black text-xl text-[#ffd700]">انضم بكود</h2>
              </div>

              {/* Name */}
              <div className="glass-panel clipped-corners p-4 border border-white/10 space-y-2"
                style={{ background: 'linear-gradient(135deg, rgba(42,10,74,0.7) 0%, rgba(5,1,10,0.9) 100%)' }}>
                <label className="text-xs text-[#d0c6ab] font-bold">اسمك في الملعب</label>
                <div className="border border-white/15 clipped-corners-inner px-4 py-2.5 flex items-center bg-black/40 neon-border-purple">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={20}
                    placeholder="مثال: كابتن محمد"
                    className="bg-transparent border-none text-[#eae2cf] font-display font-bold text-base w-full focus:ring-0 outline-none p-0"
                  />
                </div>
              </div>

              {/* Code Entry */}
              <div className="glass-panel clipped-corners p-5 space-y-4 border border-[#8b5cf6]/30 neon-border-purple"
                style={{ background: 'linear-gradient(135deg, rgba(26,11,46,0.6) 0%, rgba(5,1,10,0.8) 100%)' }}>
                <p className="text-sm text-[#d0c6ab] text-center">أدخل الكود المكوّن من 4 خانات</p>
                <div className="flex gap-3 h-16">
                  <div className="flex-1 border-2 border-[#8b5cf6]/50 clipped-corners-inner flex items-center justify-center px-4 bg-black/50 focus-within:border-[#ffd700] transition">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                      placeholder="X7A9"
                      dir="ltr"
                      className="bg-transparent border-none text-[#ffd700] font-geist font-black text-center text-2xl tracking-[0.4em] w-full focus:ring-0 outline-none p-0 uppercase"
                    />
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => void onJoin()}
                    className="purple-gradient-bg text-white font-display font-bold text-base px-7 clipped-corners transition-transform active:scale-95 shadow-[0_4px_15px_rgba(139,92,246,0.4)] disabled:opacity-50 hover:brightness-110"
                  >
                    انضمام
                  </button>
                </div>
                <p className="text-[10px] text-[#d0c6ab]/50 text-center">
                  احصل على الكود من صديقك بعد إنشائه غرفة خاصة
                </p>
              </div>
            </div>
          )}

          {/* ── FRIENDS TAB ── */}
          {activeTab === "friends" && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2 pb-1">
                <span className="text-2xl">👥</span>
                <h2 className="font-display font-black text-xl text-[#ffd700]">الأصدقاء</h2>
              </div>

              {/* My Serial Card */}
              <div className="clipped-corners bg-[#ffd700]/10 border border-[#ffd700]/30 p-4 text-center space-y-2">
                <div className="text-xs text-[#d0c6ab]">سيريالك الخاص — شاركه مع أصدقائك</div>
                <div className="font-display text-xl font-bold text-[#ffd700]">
                  {name || "بدون اسم"} <span className="text-sm font-geist font-normal text-[#d0c6ab]">{tag}</span>
                </div>
                <button
                  onClick={onCopyTag}
                  className="mt-1 rounded-full bg-[#ffd700]/20 border border-[#ffd700]/40 px-5 py-1.5 text-xs font-bold text-[#ffd700] hover:bg-[#ffd700]/30 transition"
                >
                  {copied ? "✅ تم النسخ!" : "📋 انسخ سيريالك"}
                </button>
              </div>

              {/* Add Friend Form */}
              <div className="glass-panel clipped-corners p-4 border border-white/10 space-y-3"
                style={{ background: 'linear-gradient(135deg, rgba(26,11,46,0.6) 0%, rgba(5,1,10,0.8) 100%)' }}>
                <div className="text-xs font-bold font-display text-[#ffe16d]">➕ إضافة صديق جديد</div>
                <input
                  value={friendTag}
                  onChange={(e) => setFriendTag(e.target.value)}
                  placeholder="سيريال الصديق مثل #84A2F"
                  className="w-full bg-black/40 border border-white/15 clipped-corners-inner px-3.5 py-2.5 text-sm text-[#eae2cf] outline-none focus:border-[#ffd700] transition"
                  maxLength={10}
                />
                <input
                  value={friendName}
                  onChange={(e) => setFriendName(e.target.value)}
                  placeholder="اسم الصديق (اختياري)"
                  className="w-full bg-black/40 border border-white/15 clipped-corners-inner px-3.5 py-2.5 text-sm text-[#eae2cf] outline-none focus:border-[#ffd700] transition"
                  maxLength={20}
                />
                <button
                  onClick={onAddFriend}
                  className="w-full purple-gradient-bg text-white py-2.5 text-sm font-display font-bold clipped-corners shadow-[0_2px_10px_rgba(139,92,246,0.3)] hover:brightness-110"
                >
                  إضافة صديق
                </button>
              </div>

              {/* Friends List */}
              {friends.length === 0 ? (
                <div className="text-center text-[#d0c6ab]/70 text-sm py-8 space-y-2">
                  <div className="text-4xl">👥</div>
                  <p>لا يوجد أصدقاء بعد.<br />أضف سيريال صديقك لتبدأ التحدي!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#ffe16d] font-display">أصدقائي ({friends.length})</div>
                  {friends.map((f) => (
                    <div key={f.tag} className="flex items-center gap-3 clipped-corners-inner bg-black/30 border border-white/10 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-[#eae2cf] truncate">{f.name}</div>
                        <div className="text-xs text-[#d0c6ab]/70 font-geist">{f.tag}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() => void onChallengeFriend(f)}
                          className="rounded-lg bg-[#ffd700]/15 border border-[#ffd700]/30 px-3 py-1.5 text-xs font-bold text-[#ffd700] hover:bg-[#ffd700]/25 transition disabled:opacity-50"
                        >
                          🎮 تحدِّ
                        </button>
                        <button
                          onClick={() => onRemoveFriend(f.tag)}
                          className="rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {activeTab === "settings" && (
            <div className="space-y-5 pt-4">
              <div className="flex items-center gap-2 pb-1">
                <span className="text-2xl">⚙️</span>
                <h2 className="font-display font-black text-xl text-[#ffd700]">الإعدادات</h2>
              </div>

              {/* Sound */}
              <div className="glass-panel clipped-corners p-4 border border-white/10 space-y-3"
                style={{ background: 'linear-gradient(135deg, rgba(26,11,46,0.6) 0%, rgba(5,1,10,0.8) 100%)' }}>
                <div className="text-xs font-bold text-[#ffe16d] font-display">🔊 الصوت</div>
                <button
                  onClick={() => {
                    const next = !muted;
                    setMutedState(next);
                    setMuted(next);
                    sfx.refresh();
                    if (!next) { unlockAudio(); sfx.click(); }
                  }}
                  className={cn(
                    "w-full py-3 clipped-corners font-display font-bold text-sm transition",
                    muted
                      ? "bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
                      : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                  )}
                >
                  {muted ? "🔇 الصوت مكتوم — اضغط لتشغيله" : "🔊 الصوت شغّال — اضغط لكتمه"}
                </button>
              </div>

              {/* My Identity */}
              <div className="glass-panel clipped-corners p-4 border border-white/10 space-y-3"
                style={{ background: 'linear-gradient(135deg, rgba(26,11,46,0.6) 0%, rgba(5,1,10,0.8) 100%)' }}>
                <div className="text-xs font-bold text-[#ffe16d] font-display">👤 بياناتي</div>
                <div className="space-y-1">
                  <label className="text-xs text-[#d0c6ab]">اسم اللاعب</label>
                  <div className="border border-white/15 clipped-corners-inner px-4 py-2.5 bg-black/40">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setPlayerName(e.target.value); }}
                      maxLength={20}
                      placeholder="مثال: كابتن محمد"
                      className="bg-transparent border-none text-[#eae2cf] font-display font-bold text-base w-full focus:ring-0 outline-none p-0"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between border border-white/8 clipped-corners-inner p-3 bg-black/30">
                  <div>
                    <div className="text-xs text-[#d0c6ab]">سيريالك الخاص</div>
                    <div className="font-geist font-bold text-[#ffd700] text-sm">{tag}</div>
                  </div>
                  <button
                    onClick={onCopyTag}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-bold transition",
                      copied ? "bg-green-500/20 text-green-400" : "bg-[#ffd700]/15 text-[#ffd700] hover:bg-[#ffd700]/25"
                    )}
                  >
                    {copied ? "✅ تم" : "📋 نسخ"}
                  </button>
                </div>
              </div>

              {/* Game Info */}
              <div className="glass-panel clipped-corners p-4 border border-white/10 space-y-2"
                style={{ background: 'linear-gradient(135deg, rgba(26,11,46,0.6) 0%, rgba(5,1,10,0.8) 100%)' }}>
                <div className="text-xs font-bold text-[#ffe16d] font-display">ℹ️ عن اللعبة</div>
                <div className="text-xs text-[#d0c6ab]/70 leading-relaxed space-y-1">
                  <p>🏆 <b className="text-[#d0c6ab]">11 ضد 11:</b> 11 جولة، ميزانية 240M، خطط كاملة</p>
                  <p>⚡ <b className="text-[#d0c6ab]">5 ضد 5:</b> 5 جولات، ميزانية 120M، سرعة وحماس</p>
                  <p>🤫 <b className="text-[#d0c6ab]">مزاد سري:</b> مزايدة مغلقة 20 ثانية</p>
                  <p>⚡ <b className="text-[#d0c6ab]">مزاد مباشر:</b> 12 ثانية + زر مبروك عليك</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════
          BOTTOM NAVIGATION BAR
          ══════════════════════════════════════════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#200523]/85 backdrop-blur-2xl border-t border-white/10 safe-area-pb">
        <div className="max-w-xl mx-auto flex items-stretch">
          {NAV_ITEMS.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); sfx.click(); unlockAudio(); }}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-all relative",
                activeTab === id
                  ? "text-[#ffd700]"
                  : "text-[#d0c6ab]/50 hover:text-[#d0c6ab]"
              )}
            >
              {/* Active indicator line */}
              {activeTab === id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#ffd700] rounded-full shadow-[0_0_6px_rgba(255,215,0,0.8)]" />
              )}
              <span className={cn(
                "text-xl transition-transform",
                activeTab === id ? "scale-110" : "scale-100"
              )}>
                {icon}
              </span>
              <span className={cn(
                "text-[9px] font-bold leading-none",
                activeTab === id ? "text-[#ffd700]" : "text-[#d0c6ab]/50"
              )}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

type RoomAccessRequest =
  | { action: "create"; mode: "5" | "11"; auctionType?: "blind" | "live"; name: string; playerId: string }
  | { action: "join"; code: string; name: string; playerId: string };

async function requestRoomAccess(data: RoomAccessRequest): Promise<{ code: string }> {
  const response = await fetch("/api/public/room-access", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = (await response.json()) as { code?: string; error?: string };
  if (!response.ok || !result.code) throw new Error(result.error || "تعذر الاتصال بالخادم");
  return { code: result.code };
}
