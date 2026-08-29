import { useState, useEffect, useMemo } from "react";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/utils";
import type { MysteryBox, Seat } from "@/lib/game-types";

interface MysteryBoxModalProps {
  box: MysteryBox;
  mySeat: Seat;
  oppName: string;
  onClose: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  duration: number;
  delay: number;
  rotate: number;
}

export function MysteryBoxModal({ box, mySeat, oppName, onClose }: MysteryBoxModalProps) {
  const [phase, setPhase] = useState<"sealed" | "opening" | "exploded">("sealed");
  const [showContent, setShowContent] = useState(false);

  const isMine = box.seat === mySeat;
  const isGood = box.isGood !== false && box.tier !== "curse" && box.tier !== "trap";
  const isCurse = box.tier === "curse";
  const isTrap = box.tier === "trap";

  // Generate explosion particles
  const particles = useMemo<Particle[]>(() => {
    const colors = isGood
      ? ["#FFD700", "#FFE57F", "#00E5FF", "#B388FF", "#FF80AB", "#FFFFFF"]
      : ["#FF3B3B", "#FF1744", "#FF5252", "#212121", "#FF9100", "#880e4f"];

    return Array.from({ length: 36 }).map((_, i) => {
      const angle = (i / 36) * 360 + (Math.random() * 20 - 10);
      const dist = 90 + Math.random() * 150;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        x: Math.cos(rad) * dist,
        y: Math.sin(rad) * dist,
        color: colors[i % colors.length]!,
        size: Math.random() * 8 + 4,
        duration: 0.6 + Math.random() * 0.5,
        delay: Math.random() * 0.1,
        rotate: Math.random() * 720 - 360,
      };
    });
  }, [isGood]);

  // Auto trigger after brief delay if user doesn't click
  useEffect(() => {
    const timer = setTimeout(() => {
      if (phase === "sealed") {
        handleOpen();
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, [phase]);

  const handleOpen = () => {
    if (phase !== "sealed") return;
    setPhase("opening");
    sfx.boxRattle();

    setTimeout(() => {
      setPhase("exploded");
      sfx.explosion();

      if (isGood) {
        setTimeout(() => sfx.jackpot(), 400);
      } else {
        setTimeout(() => sfx.curse(), 350);
      }

      setTimeout(() => {
        setShowContent(true);
      }, 500);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
      {/* Background Ambient Glow */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none transition-all duration-700",
          phase === "exploded"
            ? isGood
              ? "bg-radial from-[#ffd700]/25 via-[#8b5cf6]/15 to-transparent"
              : "bg-radial from-[#ff1744]/25 via-[#b71c1c]/15 to-transparent"
            : "bg-radial from-[#8b5cf6]/20 via-transparent to-transparent"
        )}
      />

      {/* Main Container Card */}
      <div
        className={cn(
          "relative w-full max-w-md p-6 sm:p-8 clipped-corners text-center border-2 transition-all duration-500 overflow-hidden",
          phase === "exploded"
            ? isGood
              ? "border-[#ffd700] shadow-[0_0_50px_rgba(255,215,0,0.4)] bg-gradient-to-b from-[#2A0845] via-[#100320] to-[#05000C]"
              : "border-[#ff1744] shadow-[0_0_50px_rgba(255,23,68,0.4)] bg-gradient-to-b from-[#3a050d] via-[#1a0206] to-[#050002]"
            : "border-[#ffd700]/50 neon-border-gold shadow-[0_0_35px_rgba(139,92,246,0.3)] bg-gradient-to-b from-[#1F0833] to-[#08020E]"
        )}
      >
        {/* Top Badge: Header */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-sm">🎁</span>
          <span
            className={cn(
              "text-xs sm:text-sm font-display font-extrabold tracking-wider uppercase px-3 py-0.5 rounded-full border",
              isGood
                ? "bg-[#ffd700]/15 text-[#ffd700] border-[#ffd700]/40"
                : "bg-[#ff1744]/15 text-[#ff5252] border-[#ff1744]/40"
            )}
          >
            {phase === "exploded"
              ? isCurse
                ? "⚠️ فخ وكارثة!"
                : isTrap
                ? "🤡 مقلب الصندوق!"
                : "✨ كنز الصندوق الغامض!"
              : "مـزاد الصـندوق الغامـض"}
          </span>
        </div>

        {/* Ownership line */}
        <div className="text-xs sm:text-sm font-bold text-[#d0c6ab] mb-6">
          {isMine ? (
            <span className="text-[#00E5FF] font-display">من نصيبك أنت 🎉</span>
          ) : (
            <span className="text-[#ffd700]">من نصيب {oppName} ⚔️</span>
          )}
        </div>

        {/* Center Mystery Box Graphic / Explosion Area */}
        <div className="relative flex items-center justify-center min-h-[170px] sm:min-h-[200px] my-2">
          {/* Phase 1 & 2: Sealed / Shaking Box */}
          {phase !== "exploded" && (
            <div
              onClick={handleOpen}
              className={cn(
                "cursor-pointer group flex flex-col items-center justify-center relative transition-transform duration-300",
                phase === "opening" ? "animate-wiggle scale-110" : "hover:scale-105 active:scale-95"
              )}
            >
              {/* Shimmering Aura Rings */}
              <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-[#FFD700]/30 via-[#B388FF]/30 to-[#00E5FF]/30 blur-xl animate-pulse" />

              {/* 3D Glowing Chest Element */}
              <div className="relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-b from-[#3D1466] via-[#22073D] to-[#120224] border-2 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.5)] flex flex-col items-center justify-center">
                <div className="text-5xl sm:text-6xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] filter transition-transform group-hover:scale-110">
                  🎁
                </div>
                <div className="absolute -bottom-2.5 px-2.5 py-0.5 rounded-full bg-[#ffd700] text-black font-display font-black text-[10px] tracking-wider uppercase shadow-md">
                  MYSTERY
                </div>
              </div>

              {/* Floating Prompt */}
              <div className="mt-4 text-xs font-display font-extrabold text-[#ffe16d] animate-bounce">
                {phase === "opening" ? "⚡ جارٍ الانفجار والفتح..." : "اضغط للفتح الفوري 💥"}
              </div>
            </div>
          )}

          {/* Phase 3: Explosion Particles */}
          {phase === "exploded" && !showContent && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Central Shockwave Flash */}
              <div className="w-24 h-24 rounded-full bg-white animate-ping opacity-90 blur-md" />

              {/* Flying Sparks Particles */}
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="absolute rounded-full"
                  style={{
                    backgroundColor: p.color,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    boxShadow: `0 0 12px ${p.color}`,
                    transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotate}deg)`,
                    transition: `all ${p.duration}s cubic-bezier(0.1, 0.9, 0.2, 1) ${p.delay}s`,
                    opacity: 1,
                  }}
                />
              ))}
            </div>
          )}

          {/* Phase 3 Result: Revealed Content */}
          {phase === "exploded" && showContent && (
            <div className="animate-flip-in flex flex-col items-center gap-3 w-full py-2">
              {/* Reward Big Icon with Radiant Glow */}
              <div className="relative">
                <div
                  className={cn(
                    "absolute -inset-4 rounded-full blur-xl animate-pulse",
                    isGood ? "bg-[#ffd700]/40" : "bg-[#ff1744]/40"
                  )}
                />
                <div
                  className={cn(
                    "relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-6xl sm:text-7xl border-2 shadow-2xl",
                    isGood
                      ? "bg-gradient-to-b from-[#ffd700]/20 to-black/60 border-[#ffd700] shadow-[0_0_30px_rgba(255,215,0,0.5)]"
                      : "bg-gradient-to-b from-[#ff1744]/20 to-black/60 border-[#ff1744] shadow-[0_0_30px_rgba(255,23,68,0.5)]"
                  )}
                >
                  {box.icon}
                </div>
              </div>

              {/* Reward Title */}
              <div
                className={cn(
                  "font-display text-2xl sm:text-3xl font-black filter drop-shadow-md",
                  isGood ? "text-[#FFE57F] text-glow" : "text-[#FF5252]"
                )}
              >
                {box.title}
              </div>

              {/* Reward Description */}
              <p className="text-xs sm:text-sm text-[#eae2cf] leading-relaxed max-w-xs mx-auto px-2">
                {box.desc}
              </p>
            </div>
          )}
        </div>

        {/* Bottom CTA Button */}
        {phase === "exploded" && showContent && (
          <button
            onClick={() => {
              sfx.click();
              onClose();
            }}
            className={cn(
              "w-full py-3.5 mt-4 clipped-corners font-display font-extrabold text-base sm:text-lg transition-transform active:scale-95 hover:brightness-110 shadow-lg",
              isGood
                ? "gold-gradient-bg text-[#705e00] shadow-[0_4px_20px_rgba(255,215,0,0.35)]"
                : "bg-gradient-to-r from-[#d50000] to-[#b71c1c] text-white shadow-[0_4px_20px_rgba(213,0,0,0.4)]"
            )}
          >
            متابعة المزاد ▶
          </button>
        )}
      </div>
    </div>
  );
}
