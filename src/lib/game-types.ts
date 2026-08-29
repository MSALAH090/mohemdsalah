import type { Player, Tactic, PlayStyle } from "./players";

export type PowerId =
  | "veto"
  | "steal"
  | "hawk"
  | "spy"
  | "shield"
  | "discount"
  | "freeze"
  | "bounty"
  | "double_deal"
  | "lockout"
  | "scout_boost"
  | "blitz_bid"
  | "tax_cut"
  | "overdrive";

export interface PowerState {
  veto: number;
  steal: number;
  hawk: number;
  spy: number;
  shield: number;
  discount: number;
  freeze: number;
  bounty: number;
  double_deal: number;
  lockout: number;
  scout_boost: number;
  blitz_bid: number;
  tax_cut: number;
  overdrive: number;
}

export const POWER_META: { id: PowerId; label: string; icon: string; desc: string }[] = [
  { id: "veto", label: "الفيتو", icon: "🚫", desc: "امنع الخصم من المزايدة على اللاعب الحالي ليحصل إجبارياً على اللاعب البديل" },
  { id: "hawk", label: "عين الصقر", icon: "👁️", desc: "اكشف تقدير تقريبي لمزايدة الخصم (سري لك وحدك)" },
  { id: "spy", label: "الجاسوس", icon: "🔍", desc: "اكشف هوية وطاقة وسعر اللاعب البديل المخفي لك وحدك أثناء المزايدة" },
  { id: "discount", label: "كوبون الخصم", icon: "🏷️", desc: "إذا فزت بالجولة تدفع نصف قيمة مزايدتك فقط (خصم 50%)" },
  { id: "freeze", label: "التجميد", icon: "❄️", desc: "جمّد 30% من ميزانية الخصم في هذه الجولة فقط" },
  { id: "shield", label: "الدرع الواقي", icon: "🛡️", desc: "احمِ نفسك من سرقة اللاعب ومن أي كروت هجومية في هذه الجولة" },
  { id: "steal", label: "السرقة", icon: "🥷", desc: "اسرق اللاعب الفائز من الخصم بدفع 150% من سعره (بعد الكشف)" },
  { id: "bounty", label: "الراعي السري", icon: "💰", desc: "احصل فوراً على +15M كاش إضافية في ميزانيتك لاستخدامها في الصفقات" },
  { id: "double_deal", label: "الصفقة المزدوجة", icon: "👥", desc: "إذا فزت بالجولة تضم اللاعب الأساسي والبديل معاً إلى تشكيلتك!" },
  { id: "lockout", label: "القفل الذهبي", icon: "🔒", desc: "اقفل مزايدة الخصم عند سعرها الحالي وامنعه من رفعها حتى نهاية الجولة" },
  { id: "scout_boost", label: "الكشاف الأسطوري", icon: "⚡", desc: "ارفع طاقة وتقييم اللاعب الفائز في هذه الجولة +3 Overall بشكل دائم!" },
  { id: "blitz_bid", label: "المزايدة الشبحية", icon: "👻", desc: "قم بإخفاء مزايدتك تماماً عن الخصم وحظر عين الصقر عنه" },
  { id: "tax_cut", label: "الإعفاء الضريبي", icon: "🧾", desc: "استرد 30% كاش فوراً من قيمة ما دفعته بعد الفوز بهذه الصفقة" },
  { id: "overdrive", label: "طاقة التيربو", icon: "🚀", desc: "دعم مجاني: زيادة فورية +10M على مزايدتك تدفعها اللعبة عنك مجاناً!" },
];

export interface RoundEvent {
  id: string;
  title: string;
  icon: string;
  desc: string;
  vetoedBy?: Seat | null;
  discountedBy?: Seat | null;
  frozenSeat?: Seat | null;
  shieldedBy?: Seat | null;
  doubleDealBy?: Seat | null;
  lockedSeat?: Seat | null;
  scoutBoostBy?: Seat | null;
  ghostBidBy?: Seat | null;
  taxCutBy?: Seat | null;
  overdriveBy?: Seat | null;
}

export interface MysteryBox {
  seat: Seat;
  title: string;
  icon: string;
  desc: string;
  isGood?: boolean;
  tier?: "legendary" | "good" | "curse" | "trap";
  effectType?: string;
  effectValue?: number;
}


export type Seat = "host" | "guest";

export interface SquadItem {
  posKey: string;
  player: Player;
  price: number;
  won: boolean;
}

export interface RevealResult {
  round: number;
  posKey: string;
  main: Player;
  sub: Player;
  bidHost: number;
  bidGuest: number;
  winner: Seat;
  price: number;
  event?: RoundEvent | null;
  stolenBy?: Seat | null;
}

export interface MatchEvent {
  minute: number;
  team: Seat | null;
  type: "goal" | "chance" | "save" | "yellow" | "red" | "info";
  text: string;
}

export interface MatchResult {
  events: MatchEvent[];
  scoreHost: number;
  scoreGuest: number;
  possessionHost: number;
  xgHost: number;
  xgGuest: number;
  shotsHost: number;
  shotsGuest: number;
  motm: { name: string; seat: Seat; rating: number };
  winner: Seat | "draw";
}

export type AuctionType = "blind" | "live";

export interface LiveBidsState {
  host: number;
  guest: number;
  highest_seat: Seat | null;
  highest_bid: number;
  last_action: string | null;
  passed_seat: Seat | null;
  turn_expires_at?: number | null;
}

export interface RoomRow {
  code: string;
  mode: string;
  auction_type?: AuctionType;
  state: string;
  host_id: string;
  guest_id: string | null;
  host_name: string;
  guest_name: string | null;
  host_budget: number;
  guest_budget: number;
  round: number;
  phase: string;
  round_started_at: string | null;
  current_player: Player | null;
  current_position: string | null;
  submitted: { host: boolean; guest: boolean };
  reveal: RevealResult | null;
  squads: { host: SquadItem[]; guest: SquadItem[] };
  match: MatchResult | null;
  tactics: { host: Tactic; guest: Tactic; hostStyle: PlayStyle; guestStyle: PlayStyle };
  formation: { host: Record<string, { x: number; y: number }>; guest: Record<string, { x: number; y: number }> };
  powers: { host: PowerState; guest: PowerState };
  round_event: RoundEvent | null;
  mystery: MysteryBox | null;
  live_bids?: LiveBidsState | null;
  updated_at?: string | null;
}

export const ROUND_SECONDS = 20;

/** ثواني الجولة حسب نوع المزاد والحدث (مزاد مباشر = 30 ثانية، مزاد خاطف = 10 ثوانٍ، كلاسيكي = 20 ثانية) */
export function secondsForEvent(ev: RoundEvent | null | undefined, auctionType?: AuctionType) {
  if (auctionType === "live") return 30;
  return ev?.id === "blitz" ? 10 : ROUND_SECONDS;
}

/**
 * بعض قواعد البيانات ترجع الوقت بدون علامة المنطقة الزمنية،
 * فبعض هواتف أندرويد تفسره كوقت محلي فيتوقف العداد. نضيف Z عند اللزوم.
 */
export function parseServerTime(value: string | null | undefined): number | null {
  if (!value) return null;
  let s = value.trim().replace(" ", "T");
  if (!/[zZ]$/.test(s) && !/[+-]\d{2}:?\d{2}$/.test(s)) s += "Z";
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/** الثواني المنقضية منذ بدء الجولة، مع حماية من اختلاف ساعة الجهاز */
export function elapsedSince(value: string | null | undefined, fallbackAnchor: number): number {
  const t = parseServerTime(value);
  const now = Date.now();
  if (t === null) return (now - fallbackAnchor) / 1000;
  const diff = (now - t) / 1000;
  if (diff < -5 || diff > 600) return (now - fallbackAnchor) / 1000; // ساعة الجهاز غير مضبوطة
  return Math.max(0, diff);
}


export function linkStrength(a: Player, b: Player): 0 | 1 | 2 {
  if (a.clubAr === b.clubAr) return 2;
  if (a.nation === b.nation) return 2;
  if (a.league === b.league) return 1;
  return 0;
}

export function chemistry(squad: SquadItem[]): number {
  if (squad.length < 2) return 0;
  let links = 0;
  let score = 0;
  for (let i = 0; i < squad.length; i++) {
    for (let j = i + 1; j < squad.length; j++) {
      links++;
      score += linkStrength(squad[i]!.player, squad[j]!.player);
    }
  }
  return Math.round((score / (links * 2)) * 100);
}
