import { memo, useEffect, useMemo, useRef, useState } from "react";
import { layoutFor, shirtNumber } from "@/lib/players";
import { chemistry, linkStrength, type SquadItem } from "@/lib/game-types";
import { cn } from "@/lib/utils";

export type Spots = Record<string, { x: number; y: number }>;

interface Props {
  mode: string;
  mySquad: SquadItem[];
  oppSquad: SquadItem[];
  myName: string;
  oppName: string;
  mySpots?: Spots;
  oppSpots?: Spots;
  editable?: boolean;
  onMove?: (posKey: string, x: number, y: number) => void;
}

interface DotProps {
  item: SquadItem;
  x: number;
  y: number;
  team: "me" | "opp";
  draggable?: boolean;
  dragging?: boolean;
  onGrab?: (e: React.PointerEvent) => void;
}

const Dot = memo(function Dot({ item, x, y, team, draggable, dragging, onGrab }: DotProps) {
  return (
    <div
      onPointerDown={draggable ? onGrab : undefined}
      className={cn(
        "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1",
        draggable && "cursor-grab touch-none select-none",
        dragging && "z-20 scale-110",
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-full border-2 font-display text-sm",
          team === "me" ? "border-white/70 bg-team-home text-white" : "border-white/70 bg-team-away text-white",
          dragging && "border-gold shadow-[var(--shadow-gold)]",
        )}
      >
        {shirtNumber(item.posKey)}
      </div>
      <div className="rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-white">
        {item.player.nameAr} <span className="text-gold">{item.player.overall}</span>
      </div>
    </div>
  );
}, (previous, next) =>
  previous.item.player.id === next.item.player.id &&
  previous.item.posKey === next.item.posKey &&
  previous.x === next.x &&
  previous.y === next.y &&
  previous.team === next.team &&
  previous.draggable === next.draggable &&
  previous.dragging === next.dragging,
);

export function FormationBoard({
  mode,
  mySquad,
  oppSquad,
  myName,
  oppName,
  mySpots,
  oppSpots,
  editable = false,
  onMove,
}: Props) {
  const layout = layoutFor(mode);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragSpot, setDragSpot] = useState<{ x: number; y: number } | null>(null);
  const dragSpotRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  // my half: bottom (y 55..97), opponent: top (mirrored)
  const posOf = (posKey: string, mine: boolean) => {
    const live = mine && dragKey === posKey && dragSpot ? dragSpot : null;
    const custom = live ?? (mine ? mySpots?.[posKey] : oppSpots?.[posKey]);
    const l = custom ?? layout[posKey] ?? { x: 50, y: 50 };
    const halfY = 3 + (l.y / 100) * 44; // 3..47 within a half
    return mine ? { x: 100 - l.x, y: 97 - halfY } : { x: l.x, y: halfY };
  };

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  const handleMove = (e: React.PointerEvent) => {
    if (!dragKey || !boxRef.current || !onMove) return;
    const r = boxRef.current.getBoundingClientRect();
    const px = clamp(((e.clientX - r.left) / r.width) * 100, 3, 97);
    const py = clamp(((e.clientY - r.top) / r.height) * 100, 51, 97);
    const lx = clamp(100 - px, 0, 100);
    const ly = clamp(((94 - py) / 44) * 100, 0, 100);
    const next = { x: Math.round(lx), y: Math.round(ly) };
    dragSpotRef.current = next;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setDragSpot(dragSpotRef.current);
    });
  };

  const endDrag = () => {
    const finalSpot = dragSpotRef.current ?? dragSpot;
    if (dragKey && finalSpot && onMove) onMove(dragKey, finalSpot.x, finalSpot.y);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setDragKey(null);
    setDragSpot(null);
    dragSpotRef.current = null;
  };


  const links = useMemo(() => {
    const result: { a: SquadItem; b: SquadItem; strength: number }[] = [];
    for (let i = 0; i < mySquad.length; i++) {
      for (let j = i + 1; j < mySquad.length; j++) {
        const strength = linkStrength(mySquad[i]!.player, mySquad[j]!.player);
        if (strength > 0) result.push({ a: mySquad[i]!, b: mySquad[j]!, strength });
      }
    }
    return result;
  }, [mySquad]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-bold sm:text-sm">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-team-away" /> {oppName}
        </span>
        <span className="rounded-full bg-black/40 px-3 py-1 text-gold">كيمياء فريقك: {chemistry(mySquad)}%</span>
        <span className="flex items-center gap-2">
          {myName} <span className="size-3 rounded-full bg-team-home" />
        </span>
      </div>

      <div
        ref={boxRef}
        onPointerMove={handleMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          "relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-white/20 shadow-[var(--shadow-card)]",
          dragKey && "touch-none",
        )}
        style={{ background: "var(--gradient-pitch)" }}
      >
        {/* stripes */}
        <div className="absolute inset-0 opacity-25 [background:repeating-linear-gradient(180deg,rgba(255,255,255,0.14)_0_5%,transparent_5%_10%)]" />
        {/* markings */}
        <div className="absolute inset-3 rounded-xl border-2 border-white/45" />
        <div className="absolute top-1/2 right-3 left-3 h-0.5 -translate-y-1/2 bg-white/45" />
        <div className="absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/45" />
        <div className="absolute top-3 left-1/2 h-[13%] w-[46%] -translate-x-1/2 border-2 border-t-0 border-white/45" />
        <div className="absolute bottom-3 left-1/2 h-[13%] w-[46%] -translate-x-1/2 border-2 border-b-0 border-white/45" />

        <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {links.map((l, i) => {
            const p1 = posOf(l.a.posKey, true);
            const p2 = posOf(l.b.posKey, true);
            return (
              <line
                key={i}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={l.strength === 2 ? "oklch(0.8 0.2 150)" : "oklch(0.85 0.17 88)"}
                strokeWidth={0.4}
                opacity={0.85}
              />
            );
          })}
        </svg>

        {oppSquad.map((item) => {
          const p = posOf(item.posKey, false);
          return <Dot key={`o-${item.posKey}-${item.player.id}`} item={item} x={p.x} y={p.y} team="opp" />;
        })}
        {mySquad.map((item) => {
          const p = posOf(item.posKey, true);
          return (
            <Dot
              key={`m-${item.posKey}-${item.player.id}`}
              item={item}
              x={p.x}
              y={p.y}
              team="me"
              draggable={editable}
              dragging={dragKey === item.posKey}
              onGrab={(e) => {
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                setDragKey(item.posKey);
              }}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-3 text-[11px] text-muted-foreground sm:text-xs">
        {editable ? (
          <span className="text-gold">✋ اسحب لاعبيك على نصف ملعبك لتغيير أماكنهم</span>
        ) : (
          <>
            <span>🟢 كيمياء ممتازة (نفس النادي/الجنسية)</span>
            <span>🟡 كيمياء متوسطة (نفس الدوري)</span>
          </>
        )}
      </div>
    </div>
  );
}
