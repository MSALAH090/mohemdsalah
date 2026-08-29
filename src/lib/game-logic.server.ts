import { PLAYERS, PLAY_STYLES, positionsFor, type Player, type PlayStyle, type Tactic } from "./players";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

import { ROUND_SECONDS, chemistry } from "./game-types";
import type {
  MatchEvent,
  MatchResult,
  MysteryBox,
  PowerState,
  RevealResult,
  RoomRow,
  RoundEvent,
  Seat,
  SquadItem,
} from "./game-types";

const json = (v: unknown) => v as unknown as Json;

export { ROUND_SECONDS };
export type { MatchEvent, MatchResult, RevealResult, RoomRow, Seat, SquadItem };

export const ROUND_EVENTS: RoundEvent[] = [
  { id: "discount", title: "تخفيضات السوق", icon: "🏷️", desc: "الفائز يدفع 70% فقط من قيمة مزايدته" },
  { id: "fire_sale", title: "تصفية كبرى", icon: "🔥", desc: "تخفيض استثنائي: الفائز يدفع 60% فقط من مزايدته!" },
  { id: "free_agent", title: "صفقة انتقال حر", icon: "🆓", desc: "الفائز يدفع نصف قيمة مزايدته فقط (خصم 50%)" },
  { id: "inflation", title: "تضخم الأسعار", icon: "📈", desc: "الفائز يدفع 130% من قيمة مزايدته" },
  { id: "tax_season", title: "موسم الضرائب", icon: "🧾", desc: "ضريبة سوق إضافية: الفائز يدفع 115% من مزايدته" },
  { id: "bonus", title: "راعي جديد", icon: "💰", desc: "اللاعبان يحصلان فوراً على +15M في ميزانيتهما" },
  { id: "mega_sponsor", title: "عقد رعاية ذهبي", icon: "👑", desc: "اللاعبان يحصلان فوراً على +25M لدعم الصفقات!" },
  { id: "blitz", title: "مزاد خاطف", icon: "⚡", desc: "وقت المزايدة 10 ثوانٍ فقط لاتخاذ القرار السريع!" },
  { id: "refund", title: "تعويض الخاسر", icon: "🎁", desc: "الخاسر في المزاد يحصل على +10M تعويض مالي" },
  { id: "double_refund", title: "شبكة الأمان", icon: "🛟", desc: "الخاسر في المزاد يحصل على +20M تعويض مالي" },
  { id: "derby", title: "ديربي الأساطير", icon: "🌟", desc: "اللاعب المعروض في الجولة من فئة أساطير كرة القدم" },
  { id: "all_in", title: "جولة المخاطرة", icon: "🎲", desc: "سعر اللاعب يزيد 20% ومنافسة شرسة على النجوم" },
  { id: "power_rain", title: "مطر الكروت", icon: "🃏", desc: "كل لاعب يحصل فوراً على كارت قوة إضافي" },
  { id: "double_power", title: "عاصفة القوى", icon: "🌪️", desc: "كل لاعب يحصل فوراً على كارتين قوة خارقة!" },
  { id: "scout", title: "تقرير الكشاف السري", icon: "🔭", desc: "الكشاف يضمن أن البديل المخفي لاعب قوي جداً ومنافس" },
  { id: "calm", title: "هدوء ما قبل العاصفة", icon: "🧊", desc: "جولة كلاسيكية عادية بدون أي تعديل في القواعد" },
  { id: "golden_boot", title: "الحذاء الذهبي", icon: "👟", desc: "اللاعب الفائز يحصل على +2 طاقة هجومية إضافية" },
  { id: "iron_wall", title: "الجدار الحديدي", icon: "🧱", desc: "اللاعب الفائز يحصل على +2 طاقة دفاعية إضافية" },
  { id: "golden_goal", title: "جائزة التميز", icon: "🏆", desc: "الفائز بالصفقة يسترد +10M مكافأة فورية بعد الفوز" },
  { id: "fair_play", title: "اللعب المالي النظيف", icon: "⚖️", desc: "سقف المزايدة في الجولة لا يتجاوز 50M لضمان التكافؤ" },
];

export interface MysteryReward {
  title: string;
  icon: string;
  desc: string;
  kind: "budget" | "power" | "boost" | "special" | "curse_budget" | "curse_boost" | "curse_power" | "trap";
  amount?: number;
  powerKey?: keyof PowerState;
  isGood?: boolean;
  tier?: "legendary" | "good" | "curse" | "trap";
}

export const MYSTERY_REWARDS: MysteryReward[] = [
  // ── جوائز ممتازة وأسطورية (Good & Legendary Rewards) ──
  { title: "التمويل الماسي الملكي", icon: "💎", desc: "+50 مليون ضخمة في ميزانيتك!", kind: "budget", amount: 50, isGood: true, tier: "legendary" },
  { title: "خزنة النادي الذهبية", icon: "🏦", desc: "+35 مليون إضافية في ميزانيتك", kind: "budget", amount: 35, isGood: true, tier: "good" },
  { title: "شنطة أموال استثمارية", icon: "💼", desc: "+20 مليون في ميزانيتك", kind: "budget", amount: 20, isGood: true, tier: "good" },
  { title: "منحة صندوق الاستثمار", icon: "🪙", desc: "+25 مليون سيولة إضافية فورية", kind: "budget", amount: 25, isGood: true, tier: "good" },
  { title: "إكسير الأساطير", icon: "🌟", desc: "+5 لتقييم جميع لاعبي تشكيلتك وترقيتهم!", kind: "boost", amount: 5, isGood: true, tier: "legendary" },
  { title: "تأهيل بدني خارق", icon: "⚡", desc: "+4 لتقييم آخر لاعب انضم لتشكيلتك", kind: "boost", amount: 4, isGood: true, tier: "good" },
  { title: "معسكر تدريب أسطوري", icon: "🏋️‍♂️", desc: "+3 لتقييم كل لاعبي التشكيلة دفعة واحدة!", kind: "boost", amount: 3, isGood: true, tier: "legendary" },
  { title: "مدرب تكتيكي عبقري", icon: "🧠", desc: "+3 لتقييم كل لاعبي التشكيلة و+15 مليون ميزانية", kind: "special", amount: 15, isGood: true, tier: "legendary" },
  { title: "مكافأة بطل الدوري", icon: "🏆", desc: "+40 مليون ودعم بدني شامل لطاقات الفريق!", kind: "special", amount: 40, isGood: true, tier: "legendary" },
  { title: "ترسانة القوى الخارقة", icon: "🎴", desc: "حصلت على كارت فيتو وكارت سرقة إضافي!", kind: "power", amount: 2, isGood: true, tier: "legendary" },
  { title: "حزمة القوى الشاملة", icon: "🃏", desc: "حصلت على 3 كروت قوة عشوائية نادرة!", kind: "power", amount: 3, isGood: true, tier: "legendary" },
  { title: "كوبون الخصم الملكي", icon: "🏷️", desc: "حصلت على كارت خصم 50% على المزايدة", kind: "power", amount: 1, powerKey: "discount", isGood: true, tier: "good" },
  { title: "عين الصقر الخارقة", icon: "👁️", desc: "حصلت على كارت عين الصقر لكشف مزايدة الخصم", kind: "power", amount: 1, powerKey: "hawk", isGood: true, tier: "good" },
  { title: "الدرع الواقي الفولاذي", icon: "🛡️", desc: "حصلت على درع حماية ضد السرقة", kind: "power", amount: 1, powerKey: "shield", isGood: true, tier: "good" },
  { title: "تجميد حسابات الخصم", icon: "❄️", desc: "حصلت على كارت تجميد مزايدات الخصم", kind: "power", amount: 1, powerKey: "freeze", isGood: true, tier: "good" },
  { title: "صندوق الحظ الشامل", icon: "🎁", desc: "+30 مليون وكارتا قوة ورفع تقييم اللاعب +3", kind: "special", amount: 30, isGood: true, tier: "legendary" },

  // ── مقالب وكوارث (Bad Curses & Traps) ──
  { title: "غرامة اللعب المالي النظيف", icon: "💣", desc: "عقوبة مالية صارمة: خصم -20 مليون من ميزانيتك فوراً!", kind: "curse_budget", amount: 20, isGood: false, tier: "curse" },
  { title: "عقوبة إدارية مفاجئة", icon: "💸", desc: "غرامة تنظيمية: خصم -15 مليون من ميزانيتك!", kind: "curse_budget", amount: 15, isGood: false, tier: "curse" },
  { title: "احتيال وسرقة الخزينة", icon: "🚨", desc: "كارثة مالية: سرقة -25 مليون من خزينة ناديك!", kind: "curse_budget", amount: 25, isGood: false, tier: "curse" },
  { title: "مخالفة رواتب اللاعبين", icon: "📋", desc: "غرامة تأخير رواتب: خصم -10 مليون من ميزانيتك!", kind: "curse_budget", amount: 10, isGood: false, tier: "curse" },
  { title: "إصابة وإجهاد عضلي", icon: "📉", desc: "تراجع حاد: انخفاض -3 من طاقة آخر لاعب في تشكيلتك!", kind: "curse_boost", amount: 3, isGood: false, tier: "curse" },
  { title: "أزمة لياقة بدنية", icon: "🚑", desc: "إرهاق عام: انخفاض -2 من طاقة لاعبي تشكيلتك!", kind: "curse_boost", amount: 2, isGood: false, tier: "curse" },
  { title: "تمزق عضلي مفاجئ", icon: "🩹", desc: "إصابة قوية: انخفاض -4 من طاقة لاعبك الأساسي!", kind: "curse_boost", amount: 4, isGood: false, tier: "curse" },
  { title: "فخ الصندوق الفارغ", icon: "🪤", desc: "مقلب مؤسف! الصندوق فارغ تماماً وخسرت أموال المزايدة!", kind: "trap", amount: 0, isGood: false, tier: "trap" },
  { title: "مقلب المهرج الساخر", icon: "🤡", desc: "مقلب ساخر: خسارة -10 مليون وانخفاض -2 لطاقة لاعبك!", kind: "curse_budget", amount: 10, isGood: false, tier: "trap" },
  { title: "عاصفة القوى المدمرة", icon: "🌪️", desc: "تدمير أحد كروت القوة المتاحة لديك!", kind: "curse_power", amount: 1, isGood: false, tier: "curse" },
  { title: "انفجار الدخان الأسود", icon: "💨", desc: "تدمير كارتين من كروت القوة في حوزتك فوراً!", kind: "curse_power", amount: 2, isGood: false, tier: "curse" },
];

export function eventSecondsFor(ev: RoundEvent | null) {
  return ev?.id === "blitz" ? 10 : ROUND_SECONDS;
}

export function budgetFor(mode: string) {
  return mode === "11" ? 240 : 120;
}

export function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function pickRoundPlayers(mode: string, round: number, usedIds: string[], legendary = false, isScout = false) {
  const positions = positionsFor(mode);
  const slot = positions[round - 1]!;
  const pool = PLAYERS.filter((p) => p.base === slot.base && !usedIds.includes(p.id));
  const legends = pool.filter((p) => p.tier === "legend");
  const stars = pool.filter((p) => p.overall >= 86);
  const preferred = legendary && legends.length ? legends : stars.length ? stars : pool;
  // البديل: في حدث الكشاف يكون البديل قوي ومساوي أو أعلى من الأساسي، وإلا: 33% أسوأ، 33% في نفس المستوى، 33% أفضل.
  const relation = isScout ? 2 : Math.floor(Math.random() * 3);
  const relationPool = (main: Player) =>
    pool.filter((p) => {
      if (p.id === main.id) return false;
      if (relation === 0) return p.overall <= main.overall - 2;
      if (relation === 1) return Math.abs(p.overall - main.overall) <= 1;
      return p.overall >= main.overall;
    });
  const eligibleMains = preferred.filter((candidate) => relationPool(candidate).length > 0);
  const main = pick(eligibleMains.length ? eligibleMains : preferred);
  const exactSubs = relationPool(main);
  const fallback = pool.filter((p) => p.id !== main.id);
  const sub = pick(exactSubs.length ? exactSubs : fallback);
  return { slot, main, sub };
}

/** توليد كروت قوة عشوائية: 3 كروت لمود 11، وكارتين لمود 5 */
export function freshPowers(mode: string = "11"): PowerState {
  const result: PowerState = {
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
  };
  const keys: (keyof PowerState)[] = [
    "veto",
    "steal",
    "hawk",
    "spy",
    "shield",
    "discount",
    "freeze",
    "bounty",
    "double_deal",
    "lockout",
    "scout_boost",
    "blitz_bid",
    "tax_cut",
    "overdrive",
  ];
  const count = mode === "5" ? 2 : 3;
  for (let i = 0; i < count; i++) {
    result[pick(keys)] += 1;
  }
  return result;
}

export async function getRoom(code: string): Promise<RoomRow> {
  const { data, error } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("الغرفة غير موجودة");
  return data as unknown as RoomRow;
}

export function seatOf(room: RoomRow, playerId: string): Seat {
  if (room.host_id === playerId) return "host";
  if (room.guest_id === playerId) return "guest";
  throw new Error("أنت لست ضمن هذه الغرفة");
}

export function rollEvent(): RoundEvent | null {
  if (Math.random() < 0.2) return null;
  return pick(ROUND_EVENTS);
}

/* ============================================================
   الذكاء الاصطناعي (Bot) — معرّف ثابت للبوت وأسماء متعددة
   ============================================================ */
export const BOT_ID = "bot-ai-0000-0000-0000";
export const BOT_NAMES = [
  "مورينيو AI 🤖",
  "كلوب AI 🤖",
  "غوارديولا AI 🤖",
  "أنشيلوتي AI 🤖",
  "زيدان AI 🤖",
];

/** يحسب مزايدة ذكية للبوت بناءً على قوة اللاعب وميزانيته المتبقية */
export function calcBotBid(overall: number, budget: number): number {
  // أساس: نسبة من الميزانية بحسب طاقة اللاعب
  const strength = (overall - 70) / 29; // 70 = أضعف، 99 = أقوى
  const base = Math.round(budget * Math.max(0.08, Math.min(0.55, strength * 0.6)));
  // إضافة عشوائية بسيطة (±15%)
  const jitter = Math.round(base * (Math.random() * 0.3 - 0.15));
  const bid = Math.max(1, Math.min(budget, base + jitter));
  return bid;
}

/**
 * يرسل مزايدة البوت تلقائياً ويحل الجولة إذا زايد اللاعب الحقيقي أيضاً.
 * يُستدعى في beginRound عندما تكون الغرفة vs-bot.
 */
export async function botSubmitBid(roomCode: string) {
  const room = await getRoom(roomCode);
  if (room.phase !== "bidding") return;
  const botSeat: Seat = room.guest_id === BOT_ID ? "guest" : "host";
  if (room.submitted[botSeat]) return; // البوت زايد بالفعل

  const budget = botSeat === "host" ? room.host_budget : room.guest_budget;
  const overall = room.current_player?.overall ?? 80;
  const amount = calcBotBid(overall, budget);

  await supabaseAdmin
    .from("round_private")
    .update(botSeat === "host" ? { bid_host: amount } : { bid_guest: amount })
    .eq("room_code", roomCode)
    .eq("round", room.round);

  const submitted = { ...room.submitted, [botSeat]: true };
  await supabaseAdmin
    .from("rooms")
    .update({ submitted, updated_at: new Date().toISOString() })
    .eq("code", roomCode);

  // إذا زايد اللاعب الحقيقي أيضاً — حل الجولة
  const fresh = await getRoom(roomCode);
  if (fresh.submitted.host && fresh.submitted.guest) {
    await resolveRound(roomCode);
  }
}

/**
 * البحث عن غرفة عامة مفتوحة أو إنشاء غرفة جديدة.
 * يُستخدم في "لعب سريع أونلاين" بدون كود.
 */
export async function quickMatchOrCreate(
  mode: "5" | "11",
  name: string,
  playerId: string,
): Promise<{ code: string; created: boolean }> {
  // ابحث عن غرفة عامة فارغة (host فقط، بدون guest، في الانتظار)
  const { data: open } = await supabaseAdmin
    .from("rooms")
    .select("code")
    .eq("mode", mode)
    .eq("state", "waiting")
    .is("guest_id", null)
    .neq("host_id", playerId)
    .neq("host_id", BOT_ID)
    .limit(1)
    .maybeSingle();

  if (open?.code) {
    // الانضمام للغرفة الموجودة
    const { error } = await supabaseAdmin
      .from("rooms")
      .update({
        guest_id: playerId,
        guest_name: name,
        updated_at: new Date().toISOString(),
      })
      .eq("code", open.code)
      .is("guest_id", null);
    if (!error) return { code: open.code, created: false };
  }

  // إنشاء غرفة عامة جديدة
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    const { error } = await (supabaseAdmin.from("rooms") as any).insert({
      code,
      mode,
      host_id: playerId,
      host_name: name,
      host_budget: budgetFor(mode),
      guest_budget: budgetFor(mode),
      state: "waiting",
      phase: "lobby",
    });
    if (!error) return { code, created: true };
    if (!(error as { message: string }).message.includes("duplicate")) throw new Error((error as { message: string }).message);
  }
  throw new Error("تعذر إنشاء الغرفة، حاول مرة أخرى");
}

/**
 * إنشاء غرفة مع البوت وبدء المباراة فوراً.
 */
export async function createBotRoom(
  mode: "5" | "11",
  name: string,
  playerId: string,
): Promise<{ code: string }> {
  const botName = pick(BOT_NAMES);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    const { error } = await supabaseAdmin.from("rooms").insert({
      code,
      mode,
      host_id: playerId,
      host_name: name,
      host_budget: budgetFor(mode),
      guest_budget: budgetFor(mode),
      guest_id: BOT_ID,
      guest_name: botName,
      state: "auction",
      phase: "lobby",
    });
    if (!error) {
      // بدء الجولة الأولى فوراً
      const room = await getRoom(code);
      await beginRound(room, 1);
      // البوت يزايد بعد ثانية صغيرة
      setTimeout(() => void botSubmitBid(code), 800);
      return { code };
    }
    if (!error.message.includes("duplicate")) throw new Error(error.message);
  }
  throw new Error("تعذر إنشاء غرفة مع الذكاء الاصطناعي");
}



export async function beginRound(room: RoomRow, round: number, forcedEvent?: RoundEvent | null) {
  const ev = forcedEvent !== undefined ? forcedEvent : rollEvent();
  const used = [...(room.squads?.host ?? []), ...(room.squads?.guest ?? [])].map((s) => s.player.id);
  const { slot, main, sub } = pickRoundPlayers(room.mode, round, used, ev?.id === "derby", ev?.id === "scout");

  await supabaseAdmin.from("round_private").upsert({
    room_code: room.code,
    round,
    sub_player: json(sub),
    bid_host: null,
    bid_guest: null,
  });

  let hostBudget = room.host_budget;
  let guestBudget = room.guest_budget;
  if (ev?.id === "bonus") {
    hostBudget += 15;
    guestBudget += 15;
  } else if (ev?.id === "mega_sponsor") {
    hostBudget += 25;
    guestBudget += 25;
  }
  
  const powers: Record<Seat, PowerState> = room.powers ?? {
    host: freshPowers(room.mode),
    guest: freshPowers(room.mode),
  };

  const allPowerKeys = [
    "veto",
    "steal",
    "hawk",
    "spy",
    "shield",
    "discount",
    "freeze",
    "bounty",
    "double_deal",
    "lockout",
    "scout_boost",
    "blitz_bid",
    "tax_cut",
    "overdrive",
  ] as const;

  if (ev?.id === "power_rain") {
    powers.host[pick(allPowerKeys)] += 1;
    powers.guest[pick(allPowerKeys)] += 1;
  } else if (ev?.id === "double_power") {
    powers.host[pick(allPowerKeys)] += 1;
    powers.host[pick(allPowerKeys)] += 1;
    powers.guest[pick(allPowerKeys)] += 1;
    powers.guest[pick(allPowerKeys)] += 1;
  }

  const { error } = await supabaseAdmin
    .from("rooms")
    .update({
      state: "auction",
      phase: "bidding",
      round,
      current_player: json(main),
      current_position: slot.key,
      submitted: { host: false, guest: false },
      reveal: null,
      mystery: null,
      round_event: json(ev),
      powers: json(powers),
      host_budget: hostBudget,
      guest_budget: guestBudget,
      round_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("code", room.code);
  if (error) throw new Error(error.message);
}

/** الفيتو: يمنع الخصم من المزايدة على اللاعب الحالي ليحصل إجبارياً على اللاعب البديل دون سحب لاعب جديد */
export async function applyVeto(room: RoomRow, seat: Seat) {
  const powers = room.powers ?? { host: freshPowers(room.mode), guest: freshPowers(room.mode) };
  if ((powers[seat]?.veto ?? 0) <= 0) throw new Error("لم يتبقَ لديك كارت فيتو");
  if (room.phase !== "bidding") throw new Error("الفيتو يُستخدم أثناء المزايدة فقط");
  if (room.round_event?.vetoedBy) throw new Error("تم استخدام الفيتو في هذه الجولة بالفعل");

  const other: Seat = seat === "host" ? "guest" : "host";

  const next: Record<Seat, PowerState> = {
    host: { ...powers.host },
    guest: { ...powers.guest },
  };
  next[seat].veto -= 1;

  // إقفال المزايدة على الخصم وتعيين مزايدته إلى 0 في قاعدة البيانات
  await supabaseAdmin
    .from("round_private")
    .update(other === "host" ? { bid_host: 0 } : { bid_guest: 0 })
    .eq("room_code", room.code)
    .eq("round", room.round);

  const submitted = {
    ...room.submitted,
    [other]: true, // إغلاق المزايدة على الخصم
  };

  const updatedEvent: RoundEvent = {
    ...(room.round_event ?? { id: "veto", title: "فيتو", icon: "🚫", desc: "تم قفل المزايدة بالفيتو" }),
    vetoedBy: seat,
  };

  const { error } = await supabaseAdmin
    .from("rooms")
    .update({
      submitted,
      powers: json(next),
      round_event: json(updatedEvent),
      updated_at: new Date().toISOString(),
    })
    .eq("code", room.code);
  if (error) throw new Error(error.message);
}

/** عين الصقر: تقدير تقريبي لمزايدة الخصم — يرجع للاعب نفسه فقط */
export async function hawkEye(room: RoomRow, seat: Seat) {
  const powers = room.powers ?? { host: freshPowers(room.mode), guest: freshPowers(room.mode) };
  if ((powers[seat]?.hawk ?? 0) <= 0) throw new Error("لم يتبقَ لديك كارت عين الصقر");
  if (room.phase !== "bidding") throw new Error("عين الصقر تُستخدم أثناء المزايدة فقط");
  const other: Seat = seat === "host" ? "guest" : "host";

  const { data: priv } = await supabaseAdmin
    .from("round_private")
    .select("*")
    .eq("room_code", room.code)
    .eq("round", room.round)
    .maybeSingle();

  const bid = other === "host" ? priv?.bid_host : priv?.bid_guest;
  const oppBudget = other === "host" ? room.host_budget : room.guest_budget;

  const next: Record<Seat, PowerState> = { host: { ...powers.host }, guest: { ...powers.guest } };
  next[seat].hawk -= 1;
  await supabaseAdmin
    .from("rooms")
    .update({ powers: json(next), updated_at: new Date().toISOString() })
    .eq("code", room.code);

  if (bid == null) {
    return { hint: `الخصم لم يزايد بعد. ميزانيته الحالية ${oppBudget} مليون.` };
  }
  if (bid === 0) {
    return { hint: `عين الصقر ترصد: الخصم وضع مزايدة مجانية (0 مليون).` };
  }
  const lo = Math.max(0, Math.floor(bid * 0.85));
  const hi = Math.ceil(bid * 1.15);
  return { hint: `عين الصقر ترصد: مزايدة الخصم بين ${lo} و ${hi} مليون تقريباً.` };
}

/** الجاسوس: يكشف هوية وطاقة اللاعب البديل المخفي للاعب نفسه فقط */
export async function spyPlayer(room: RoomRow, seat: Seat) {
  const powers = room.powers ?? { host: freshPowers(room.mode), guest: freshPowers(room.mode) };
  if ((powers[seat]?.spy ?? 0) <= 0) throw new Error("لم يتبقَ لديك كارت الجاسوس");
  if (room.phase !== "bidding") throw new Error("كارت الجاسوس يُستخدم أثناء المزايدة فقط");

  const { data: priv } = await supabaseAdmin
    .from("round_private")
    .select("sub_player")
    .eq("room_code", room.code)
    .eq("round", room.round)
    .maybeSingle();

  const sub = priv?.sub_player as unknown as Player | null;
  const next: Record<Seat, PowerState> = { host: { ...powers.host }, guest: { ...powers.guest } };
  next[seat].spy -= 1;
  await supabaseAdmin
    .from("rooms")
    .update({ powers: json(next), updated_at: new Date().toISOString() })
    .eq("code", room.code);

  if (!sub) return { hint: "لم يتم العثور على اللاعب البديل بعد." };
  return {
    hint: `🔍 الجاسوس يرصد: اللاعب البديل هو ${sub.nameAr} (${sub.clubAr} - طاقة ${sub.overall} - مركز ${sub.base})!`,
  };
}

/** الدرع الواقي: يحمي اللاعب من السرقة */
export async function shieldPlayer(room: RoomRow, seat: Seat) {
  const powers = room.powers ?? { host: freshPowers(room.mode), guest: freshPowers(room.mode) };
  if ((powers[seat]?.shield ?? 0) <= 0) throw new Error("لم يتبقَ لديك كارت الدرع الواقي");
  if (room.phase !== "bidding" && room.phase !== "reveal") throw new Error("الدرع يُستخدم أثناء المزايدة أو الكشف فقط");
  if (room.round_event?.shieldedBy === seat) throw new Error("قمت بتفعيل الدرع في هذه الجولة بالفعل");

  const next: Record<Seat, PowerState> = { host: { ...powers.host }, guest: { ...powers.guest } };
  next[seat].shield -= 1;

  const updatedEvent: RoundEvent = {
    ...(room.round_event ?? { id: "shield", title: "درع واقي", icon: "🛡️", desc: "تم تفعيل الدرع" }),
    shieldedBy: seat,
  };

  const { error } = await supabaseAdmin
    .from("rooms")
    .update({ powers: json(next), round_event: json(updatedEvent), updated_at: new Date().toISOString() })
    .eq("code", room.code);
  if (error) throw new Error(error.message);
  return { hint: "🛡️ تم تفعيل الدرع الواقي! لاعبوك محميون تماماً من أي محاولة سرقة في هذه الجولة." };
}

/** كوبون الخصم: خصم 50% على المزايدة في حال الفوز */
export async function discountPlayer(room: RoomRow, seat: Seat) {
  const powers = room.powers ?? { host: freshPowers(room.mode), guest: freshPowers(room.mode) };
  if ((powers[seat]?.discount ?? 0) <= 0) throw new Error("لم يتبقَ لديك كوبون خصم");
  if (room.phase !== "bidding") throw new Error("كوبون الخصم يُستخدم أثناء المزايدة فقط");
  if (room.round_event?.discountedBy === seat) throw new Error("قمت بتفعيل كوبون الخصم في هذه الجولة بالفعل");

  const next: Record<Seat, PowerState> = { host: { ...powers.host }, guest: { ...powers.guest } };
  next[seat].discount -= 1;

  const updatedEvent: RoundEvent = {
    ...(room.round_event ?? { id: "discount", title: "كوبون خصم", icon: "🏷️", desc: "خصم 50% للفائز" }),
    discountedBy: seat,
  };

  const { error } = await supabaseAdmin
    .from("rooms")
    .update({ powers: json(next), round_event: json(updatedEvent), updated_at: new Date().toISOString() })
    .eq("code", room.code);
  if (error) throw new Error(error.message);
  return { hint: "🏷️ تم تفعيل كوبون الخصم: إذا فزت بهذه الجولة ستدفع 50% فقط من قيمة مزايدتك!" };
}

/** التجميد: تجميد 30% من ميزانية الخصم في هذه الجولة */
export async function freezePlayer(room: RoomRow, seat: Seat) {
  const powers = room.powers ?? { host: freshPowers(room.mode), guest: freshPowers(room.mode) };
  if ((powers[seat]?.freeze ?? 0) <= 0) throw new Error("لم يتبقَ لديك كارت التجميد");
  if (room.phase !== "bidding") throw new Error("كارت التجميد يُستخدم أثناء المزايدة فقط");
  const other: Seat = seat === "host" ? "guest" : "host";
  if (room.round_event?.frozenSeat === other) throw new Error("تم تجميد ميزانية الخصم بالفعل في هذه الجولة");

  const next: Record<Seat, PowerState> = { host: { ...powers.host }, guest: { ...powers.guest } };
  next[seat].freeze -= 1;

  const updatedEvent: RoundEvent = {
    ...(room.round_event ?? { id: "freeze", title: "تجميد", icon: "❄️", desc: "تم تجميد 30% من ميزانية الخصم" }),
    frozenSeat: other,
  };

  const { error } = await supabaseAdmin
    .from("rooms")
    .update({ powers: json(next), round_event: json(updatedEvent), updated_at: new Date().toISOString() })
    .eq("code", room.code);
  if (error) throw new Error(error.message);
  return { hint: "❄️ تم تجميد 30% من ميزانية الخصم في هذه الجولة بنجاح!" };
}

/** السرقة: بعد الكشف، الخاسر يسرق اللاعب الفائز مقابل 150% من سعره */
export async function stealPlayer(room: RoomRow, seat: Seat) {
  const powers = room.powers ?? { host: freshPowers(room.mode), guest: freshPowers(room.mode) };
  if ((powers[seat]?.steal ?? 0) <= 0) throw new Error("لم يتبقَ لديك كارت سرقة");
  if (room.phase !== "reveal" || !room.reveal) throw new Error("السرقة تُستخدم بعد كشف الجولة فقط");
  if (room.reveal.stolenBy) throw new Error("تمت السرقة في هذه الجولة بالفعل");
  if (room.reveal.winner === seat) throw new Error("أنت الفائز أصلاً بهذا اللاعب");

  const other: Seat = seat === "host" ? "guest" : "host";
  if (room.round_event?.shieldedBy === other) {
    throw new Error("لا يمكنك سرقة هذا اللاعب، الخصم قام بحمايته بالدرع الواقي 🛡️!");
  }

  const cost = Math.max(1, Math.round(room.reveal.price * 1.5));
  const myBudget = seat === "host" ? room.host_budget : room.guest_budget;
  if (myBudget < cost) throw new Error(`تحتاج ${cost} مليون للسرقة وميزانيتك ${myBudget}`);

  const squads = { host: [...room.squads.host], guest: [...room.squads.guest] };
  const mineIdx = squads[seat].findIndex((s) => s.posKey === room.reveal!.posKey);
  const theirIdx = squads[other].findIndex((s) => s.posKey === room.reveal!.posKey);
  if (mineIdx < 0 || theirIdx < 0) throw new Error("تعذر تنفيذ السرقة");
  const mine = squads[seat][mineIdx]!;
  const theirs = squads[other][theirIdx]!;
  squads[seat][mineIdx] = { posKey: mine.posKey, player: theirs.player, price: cost, won: true };
  squads[other][theirIdx] = { posKey: mine.posKey, player: mine.player, price: 0, won: false };

  const next: Record<Seat, PowerState> = { host: { ...powers.host }, guest: { ...powers.guest } };
  next[seat].steal -= 1;

  const reveal: RevealResult = { ...room.reveal, stolenBy: seat, winner: seat };

  // السارق يدفع 150% من السعر، والضحية يسترد كامل المبلغ الذي دفعه لأن اللاعب الأساسي سُرق منه
  const hostBudgetDiff = (seat === "host" ? -cost : 0) + (other === "host" ? room.reveal.price : 0);
  const guestBudgetDiff = (seat === "guest" ? -cost : 0) + (other === "guest" ? room.reveal.price : 0);

  const { error } = await supabaseAdmin
    .from("rooms")
    .update({
      squads: json(squads),
      powers: json(next),
      reveal: json(reveal),
      host_budget: room.host_budget + hostBudgetDiff,
      guest_budget: room.guest_budget + guestBudgetDiff,
      updated_at: new Date().toISOString(),
    })
    .eq("code", room.code);
  if (error) throw new Error(error.message);
  return { cost };
}

export async function resolveRound(code: string) {
  const room = await getRoom(code);
  if (room.phase !== "bidding") return;

  const ev = room.round_event ?? null;
  const startedAt = room.round_started_at ? new Date(room.round_started_at).getTime() : 0;
  const expired = Date.now() - startedAt >= eventSecondsFor(ev) * 1000 + 1500;
  const both = room.submitted.host && room.submitted.guest;
  if (!expired && !both) return;

  const { data: priv } = await supabaseAdmin
    .from("round_private")
    .select("*")
    .eq("room_code", room.code)
    .eq("round", room.round)
    .maybeSingle();

  const bidHost = priv?.bid_host ?? 0;
  const bidGuest = priv?.bid_guest ?? 0;
  const sub = (priv?.sub_player ?? null) as unknown as Player;
  const main = room.current_player!;
  const posKey = room.current_position!;

  let winner: Seat;
  if (ev?.vetoedBy) winner = ev.vetoedBy;
  else if (bidHost > bidGuest) winner = "host";
  else if (bidGuest > bidHost) winner = "guest";
  else winner = room.round % 2 === 0 ? "guest" : "host";

  const rawPrice = winner === "host" ? bidHost : bidGuest;
  let mult =
    ev?.id === "discount"
      ? 0.7
      : ev?.id === "fire_sale"
      ? 0.6
      : ev?.id === "free_agent"
      ? 0.5
      : ev?.id === "inflation"
      ? 1.3
      : ev?.id === "tax_season"
      ? 1.15
      : ev?.id === "all_in"
      ? 1.2
      : 1;

  if (ev?.discountedBy === winner) {
    mult = mult * 0.5;
  }
  const winnerBudget = winner === "host" ? room.host_budget : room.guest_budget;
  let price = Math.min(winnerBudget, Math.round(rawPrice * mult));
  if (ev?.id === "fair_play") {
    price = Math.min(50, price);
  }

  let awardedMain = { ...main };
  if (ev?.id === "golden_boot") {
    awardedMain = { ...awardedMain, overall: Math.min(99, awardedMain.overall + 2) };
  } else if (ev?.id === "iron_wall") {
    awardedMain = { ...awardedMain, overall: Math.min(99, awardedMain.overall + 2) };
  }

  const squads = {
    host: [...room.squads.host],
    guest: [...room.squads.guest],
  };
  squads[winner].push({ posKey, player: awardedMain, price, won: true });
  const loser: Seat = winner === "host" ? "guest" : "host";
  squads[loser].push({ posKey, player: sub, price: 0, won: false });

  // صندوق عشوائي
  let mystery: MysteryBox | null = null;
  let bonusHost =
    ev?.id === "refund" && loser === "host"
      ? 10
      : ev?.id === "double_refund" && loser === "host"
      ? 20
      : ev?.id === "golden_goal" && winner === "host"
      ? 10
      : 0;
  let bonusGuest =
    ev?.id === "refund" && loser === "guest"
      ? 10
      : ev?.id === "double_refund" && loser === "guest"
      ? 20
      : ev?.id === "golden_goal" && winner === "guest"
      ? 10
      : 0;
  const powerKeys: (keyof PowerState)[] = [
    "veto",
    "steal",
    "hawk",
    "spy",
    "shield",
    "discount",
    "freeze",
    "bounty",
    "double_deal",
    "lockout",
    "scout_boost",
    "blitz_bid",
    "tax_cut",
    "overdrive",
  ];
  const powers: Record<Seat, PowerState> = {
    host: { ...(room.powers?.host ?? freshPowers(room.mode)) },
    guest: { ...(room.powers?.guest ?? freshPowers(room.mode)) },
  };

  // الصندوق العشوائي يظهر حصرياً مرة واحدة في منتصف المباراة
  const isMidRound = (room.mode === "5" && room.round === 3) || (room.mode === "11" && room.round === 6);
  if (isMidRound) {
    const targetSeat = winner; // الفائز بأعلى مزايدة يحصل على الصندوق العشوائي في منتصف المباراة
    const reward = pick(MYSTERY_REWARDS);
    mystery = {
      seat: targetSeat,
      title: reward.title,
      icon: reward.icon,
      desc: reward.desc,
      isGood: reward.isGood !== false,
      tier: reward.tier || (reward.isGood === false ? "curse" : "good"),
    };

    if (reward.kind === "budget") {
      if (targetSeat === "host") bonusHost += (reward.amount ?? 20);
      else bonusGuest += (reward.amount ?? 20);
    } else if (reward.kind === "curse_budget") {
      if (targetSeat === "host") bonusHost -= (reward.amount ?? 15);
      else bonusGuest -= (reward.amount ?? 15);
    } else if (reward.kind === "power") {
      const pKey = reward.powerKey ?? pick(powerKeys);
      for (let i = 0; i < (reward.amount ?? 1); i++) {
        powers[targetSeat][reward.powerKey ? pKey : pick(powerKeys)] = (powers[targetSeat][reward.powerKey ? pKey : pick(powerKeys)] || 0) + 1;
      }
    } else if (reward.kind === "curse_power") {
      for (const pk of powerKeys) {
        if (powers[targetSeat][pk] > 0) {
          powers[targetSeat][pk] = Math.max(0, powers[targetSeat][pk] - 1);
          break;
        }
      }
    } else if (reward.kind === "boost") {
      const squad = squads[targetSeat];
      const last = squad[squad.length - 1];
      if (last) {
        last.player = {
          ...last.player,
          overall: Math.min(99, last.player.overall + (reward.amount ?? 2)),
          tier: (reward.amount ?? 2) >= 5 ? "legend" : last.player.tier,
        };
      }
    } else if (reward.kind === "curse_boost") {
      const squad = squads[targetSeat];
      const last = squad[squad.length - 1];
      if (last) {
        last.player = {
          ...last.player,
          overall: Math.max(50, last.player.overall - (reward.amount ?? 2)),
        };
      }
    } else if (reward.kind === "special") {
      if (targetSeat === "host") bonusHost += (reward.amount ?? 25);
      else bonusGuest += (reward.amount ?? 25);
      powers[targetSeat][pick(powerKeys)] = (powers[targetSeat][pick(powerKeys)] || 0) + 1;
      const squad = squads[targetSeat];
      const last = squad[squad.length - 1];
      if (last) {
        last.player = { ...last.player, overall: Math.min(99, last.player.overall + 3) };
      }
    }
  }

  const reveal: RevealResult = {
    round: room.round,
    posKey,
    main,
    sub,
    bidHost,
    bidGuest,
    winner,
    price,
    event: ev,
    stolenBy: null,
  };

  const { error } = await supabaseAdmin
    .from("rooms")
    .update({
      phase: "reveal",
      reveal: json(reveal),
      squads: json(squads),
      mystery: json(mystery),
      powers: json(powers),
      host_budget: room.host_budget - (winner === "host" ? price : 0) + bonusHost,
      guest_budget: room.guest_budget - (winner === "guest" ? price : 0) + bonusGuest,
      state: "auction",
      updated_at: new Date().toISOString(),
    })
    .eq("code", room.code)
    .eq("phase", "bidding");
  if (error) throw new Error(error.message);
}


function teamPower(
  squad: SquadItem[],
  tactic: Tactic = "balanced",
  style: PlayStyle = "possession",
  oppTactic: Tactic = "balanced",
  oppStyle: PlayStyle = "possession",
) {
  const styleMeta = PLAY_STYLES.find((s) => s.id === style);
  const wingMul = styleMeta?.wingMul ?? 1;

  // متوسط التقييم العام
  const avg = squad.reduce((s, x) => s + x.player.overall, 0) / Math.max(1, squad.length);

  // احتساب بونوس الأساطير الخارقة (98-100 OVR)
  const legendCount = squad.filter((x) => x.player.overall >= 96).length;
  const legendAura = 1 + legendCount * 0.03; // كل أسطورة ترفع أداء الفريق 3%

  // هجوم الفريق
  const attPlayers = squad.filter((x) => x.player.base === "ST" || x.player.base === "WING");
  const attSum = attPlayers.reduce((s, x) => {
    const mul = x.player.base === "WING" ? wingMul : 1;
    return s + x.player.overall * mul;
  }, 0);
  const att = (attSum / Math.max(1, attPlayers.length)) * legendAura;

  // دفاع الفريق وحراسة المرمى
  const defPlayers = squad.filter((x) => x.player.base === "DEF" || x.player.base === "GK");
  const def = (defPlayers.reduce((s, x) => s + x.player.overall, 0) / Math.max(1, defPlayers.length)) * legendAura;

  // وسط الفريق والتحكم باللعب
  const midPlayers = squad.filter((x) => x.player.base === "MID");
  const mid = (midPlayers.reduce((s, x) => s + x.player.overall, 0) / Math.max(1, midPlayers.length)) * legendAura;

  // حارس المرمى
  const gk = squad.find((x) => x.player.base === "GK")?.player;
  const gkRating = gk ? gk.overall : 75;

  // التناغم (الكيمياء)
  const chem = chemistry(squad);
  const chemMultiplier = 1 + (chem / 100) * 0.12; // حتى +12% قوة عند 100% تناغم

  // مضاعفات الخطة التكتيكية
  const tacticAttMul = tactic === "attack" ? 1.15 : tactic === "defend" ? 0.88 : 1.0;
  const tacticDefMul = tactic === "defend" ? 1.18 : tactic === "attack" ? 0.88 : 1.0;

  // تفوق التكتيكات المضادة (Counter-Tactics)
  let counterTacticsBonus = 1.0;
  if (style === "counter" && oppTactic === "attack") counterTacticsBonus = 1.2; // المرتدة تسحق الهجوم المفتوح
  if (style === "possession" && oppTactic === "defend") counterTacticsBonus = 1.12; // الاستحواذ يفكك الدفاع
  if (tactic === "defend" && oppStyle === "crosses" && def > 90) counterTacticsBonus = 1.1; // الدفاع القوي يحبط العرضيات

  // تطبيق مضاعفات أسلوب اللعب
  const styleAttMul = (styleMeta?.attMul ?? 1) * counterTacticsBonus;
  const styleDefMul = styleMeta?.defMul ?? 1;

  return {
    avg: avg * chemMultiplier,
    att: (att || avg) * tacticAttMul * styleAttMul * chemMultiplier,
    def: (def || avg) * tacticDefMul * styleDefMul * chemMultiplier,
    mid: (mid || avg) * chemMultiplier,
    gkRating,
    chem,
    tactic,
    style,
    chanceMod: styleMeta?.chanceMod ?? 0,
    possessionMod: styleMeta?.possessionMod ?? 0,
    longshotChance: styleMeta?.longshotChance ?? 0,
  };
}

export function simulateMatch(room: RoomRow): MatchResult {
  const hostTactic = room.tactics?.host ?? "balanced";
  const guestTactic = room.tactics?.guest ?? "balanced";
  const hostStyle = room.tactics?.hostStyle ?? "possession";
  const guestStyle = room.tactics?.guestStyle ?? "possession";

  const h = teamPower(room.squads.host, hostTactic, hostStyle, guestTactic, guestStyle);
  const g = teamPower(room.squads.guest, guestTactic, guestStyle, hostTactic, hostStyle);

  const nameH = room.host_name;
  const nameG = room.guest_name ?? "الخصم";
  const events: MatchEvent[] = [];
  let scoreHost = 0;
  let scoreGuest = 0;
  let xgHost = 0;
  let xgGuest = 0;
  let shotsHost = 0;
  let shotsGuest = 0;
  const ratings: Record<string, { seat: Seat; name: string; rating: number }> = {};
  const allPlayers = [
    ...room.squads.host.map((s) => ({ seat: "host" as Seat, p: s.player })),
    ...room.squads.guest.map((s) => ({ seat: "guest" as Seat, p: s.player })),
  ];
  allPlayers.forEach(({ seat, p }) => {
    ratings[p.id] = { seat, name: p.nameAr, rating: 6.2 + Math.random() * 0.6 };
  });

  events.push({ minute: 0, team: null, type: "info", text: `🔊 صافرة البداية! ديربي القمة: ${nameH} ضد ${nameG}` });

  // حساب الاستحواذ الواقعي بناء على قوة الوسط والأسلوب العام
  const hControl = h.mid * 0.5 + h.att * 0.3 + h.avg * 0.2;
  const gControl = g.mid * 0.5 + g.att * 0.3 + g.avg * 0.2;
  let possessionHost = Math.round((hControl / (hControl + gControl)) * 100);
  possessionHost = Math.max(20, Math.min(80, possessionHost + h.possessionMod - g.possessionMod));

  // رسائل التكتيك في الدقيقة الأولى
  const styleLabels: Record<string, string> = {
    counter: "⚡ استراتيجية الهجمات المرتدة الخاطفة!",
    long_ball: "📏 اعتماد الكرات الطويلة المباشرة خلف المدافعين!",
    possession: "🔄 أسلوب الاستحواذ والتمرير القصير والضغط العالي!",
    crosses: "🤸 التركيز على الكرات العرضية من الأجنحة!",
    longshots: "💥 سلاح التسديدات الصاروخية من خارج المنطقة!",
  };
  if (h.style)
    events.push({ minute: 1, team: "host", type: "info", text: `🎯 ${nameH}: ${styleLabels[h.style] ?? ""}` });
  if (g.style)
    events.push({ minute: 1, team: "guest", type: "info", text: `🎯 ${nameG}: ${styleLabels[g.style] ?? ""}` });

  for (let minute = 1; minute <= 90; minute++) {
    const roll = Math.random();
    const hostTurn = Math.random() * 100 < possessionHost;
    const att = hostTurn ? h : g;
    const def = hostTurn ? g : h;
    const seat: Seat = hostTurn ? "host" : "guest";
    const teamName = hostTurn ? nameH : nameG;
    const squad = hostTurn ? room.squads.host : room.squads.guest;
    const oppSquad = hostTurn ? room.squads.guest : room.squads.host;

    const scorerPool = squad.filter((s) => s.player.base === "ST" || s.player.base === "WING");
    const scorer = (scorerPool.length ? pick(scorerPool) : pick(squad)).player;

    // هدف تسديدة بعيدة خارقة (Longshots)
    if (att.longshotChance > 0 && Math.random() < att.longshotChance) {
      const midPool = squad.filter((s) => s.player.base === "MID");
      const longScorer = (midPool.length ? pick(midPool) : pick(squad)).player;
      if (hostTurn) { scoreHost++; shotsHost++; xgHost += 0.18; }
      else { scoreGuest++; shotsGuest++; xgGuest += 0.18; }
      ratings[longScorer.id]!.rating = Math.min(10, ratings[longScorer.id]!.rating + 1.8);
      events.push({
        minute,
        team: seat,
        type: "goal",
        text: `💥 صاروخية لا تصد ولا ترد! ${longScorer.nameAr} يطلق قذيفة من 30 ياردة في المقص ⚽! (${scoreHost}-${scoreGuest})`,
      });
      continue;
    }

    // احتمال صناعة الفرص الحقيقي
    const baseChance = 0.13 + att.chanceMod;
    if (roll < baseChance) {
      // جودة الفرصة مبنية على الفارق الحقيقي بين الهجوم والدفاع
      const diff = att.att - def.def;
      const quality = Math.max(0.08, Math.min(0.75, (diff + 20) / 45));

      if (hostTurn) {
        shotsHost++;
        xgHost += quality * 0.45;
      } else {
        shotsGuest++;
        xgGuest += quality * 0.45;
      }

      // معامل قدرة حارس المرمى على التصدي
      const gkSaveFactor = Math.max(0.2, Math.min(0.65, (def.gkRating - 70) / 45));
      const goalProbability = quality * (1.1 - gkSaveFactor * 0.5);

      if (Math.random() < goalProbability) {
        if (hostTurn) scoreHost++;
        else scoreGuest++;
        ratings[scorer.id]!.rating = Math.min(10, ratings[scorer.id]!.rating + 1.4);

        let goalText = `⚽ جوووول! ${scorer.nameAr} يسكنها الشباك ببراعة لصالح ${teamName}! (${scoreHost}-${scoreGuest})`;
        if (att.style === "counter")
          goalText = `⚡ هجمة مرتدة نموذجية وسريعة جداً! ${scorer.nameAr} ينفرد ويسجل لـ ${teamName}! (${scoreHost}-${scoreGuest})`;
        else if (att.style === "crosses")
          goalText = `🤸 عرضية متقنة بالميلي يرتقي لها ${scorer.nameAr} برأسية تسكن الشباك! (${scoreHost}-${scoreGuest})`;
        else if (att.style === "long_ball")
          goalText = `📏 تمريرة عميقة خلف الدفاع يستلمها ${scorer.nameAr} ويسجل هدفاً رائعاً! (${scoreHost}-${scoreGuest})`;

        events.push({ minute, team: seat, type: "goal", text: goalText });
      } else if (Math.random() < 0.6) {
        const keeper = oppSquad.find((s) => s.player.base === "GK")?.player;
        events.push({
          minute,
          team: seat,
          type: "save",
          text: `🧤 تصدي إعجازي من الأخطبوط ${keeper ? keeper.nameAr : "الحارس"} يمنع هدفاً محققاً لـ ${scorer.nameAr}!`,
        });
        if (keeper && ratings[keeper.id]) ratings[keeper.id]!.rating = Math.min(10, ratings[keeper.id]!.rating + 0.5);
      } else {
        events.push({
          minute,
          team: seat,
          type: "chance",
          text: `😱 فرصة خطيرة تضيع من ${scorer.nameAr}.. الكرة تمر بجوار القائم بسنتيمترات!`,
        });
      }
    } else if (roll < baseChance + 0.025) {
      const victim = pick(squad).player;
      events.push({ minute, team: seat, type: "yellow", text: `🟨 بطاقة صفراء لـ ${victim.nameAr} إثر تدخل قوي` });
    } else if (roll < baseChance + 0.028) {
      const victim = pick(squad).player;
      events.push({ minute, team: seat, type: "red", text: `🟥 بطاقة حمراء وطرد مباشر لـ ${victim.nameAr} بعد تدخل متهور!` });
    }
    if (minute === 45)
      events.push({ minute, team: null, type: "info", text: `⏸️ صافرة نهاية الشوط الأول (${scoreHost}-${scoreGuest})` });
  }

  events.push({
    minute: 90,
    team: null,
    type: "info",
    text: `🔊 صافرة النهاية! النتيجة النهائية: ${nameH} ${scoreHost} - ${scoreGuest} ${nameG}`,
  });

  const best = Object.values(ratings).sort((a, b) => b.rating - a.rating)[0]!;
  const winner: Seat | "draw" = scoreHost > scoreGuest ? "host" : scoreGuest > scoreHost ? "guest" : "draw";

  return {
    events,
    scoreHost,
    scoreGuest,
    possessionHost,
    xgHost: Math.round(xgHost * 10) / 10,
    xgGuest: Math.round(xgGuest * 10) / 10,
    shotsHost,
    shotsGuest,
    motm: { name: best.name, seat: best.seat, rating: Math.round(best.rating * 10) / 10 },
    winner,
  };
}
