import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  limit,
  deleteDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { PLAYERS, positionsFor, type Player, type PlayStyle, type Tactic } from "./players";
import {
  ROUND_SECONDS,
  type AuctionType,
  type LiveBidsState,
  type MatchResult,
  type MysteryBox,
  type PowerId,
  type PowerState,
  type RevealResult,
  type RoomRow,
  type RoundEvent,
  type Seat,
  type SquadItem,
} from "./game-types";
import {
  ROUND_EVENTS,
  MYSTERY_REWARDS,
  freshPowers,
  budgetFor,
  makeCode,
  pickRoundPlayers,
  rollEvent,
  BOT_ID,
  BOT_NAMES,
  calcBotBid,
  simulateMatch,
} from "./game-logic.server";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Strip any undefined fields from a Player before writing to Firestore.
 * Firestore rejects documents containing undefined values.
 */
function sanitizePlayer(player: Player): Player {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(player)) {
    if (v !== undefined) cleaned[k] = v;
  }
  return cleaned as unknown as Player;
}

// -------------------------------------------------------------
// In-Memory Fallback Store (Ensures 100% uptime even if offline)
// -------------------------------------------------------------
const memRooms = new Map<string, RoomRow>();
const memPrivate = new Map<string, Record<string, unknown>>();
const localListeners = new Map<string, Set<(r: RoomRow | null) => void>>();

function notifyLocal(code: string, r: RoomRow | null) {
  const listeners = localListeners.get(code.toUpperCase());
  if (listeners) {
    listeners.forEach((cb) => cb(r));
  }
}

// -------------------------------------------------------------
// Realtime Subscription
// -------------------------------------------------------------

export function subscribeToRoom(
  code: string,
  onUpdate: (room: RoomRow | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const normCode = code.toUpperCase();

  // Register local memory listener
  if (!localListeners.has(normCode)) localListeners.set(normCode, new Set());
  localListeners.get(normCode)!.add(onUpdate);

  // Initial local emission if present
  if (memRooms.has(normCode)) {
    onUpdate(memRooms.get(normCode)!);
  }

  let firestoreUnsub: Unsubscribe = () => {};
  try {
    const roomRef = doc(db, "rooms", normCode);
    firestoreUnsub = onSnapshot(
      roomRef,
      (snap) => {
        if (!snap.exists()) {
          if (!memRooms.has(normCode)) onUpdate(null);
        } else {
          const data = snap.data() as RoomRow;
          memRooms.set(normCode, data);
          onUpdate(data);
        }
      },
      (_err) => {
        // If Firestore is offline / not created yet, silently fallback to local memory state
        if (memRooms.has(normCode)) {
          onUpdate(memRooms.get(normCode)!);
        }
      }
    );
  } catch (_e) {
    if (memRooms.has(normCode)) {
      onUpdate(memRooms.get(normCode)!);
    }
  }

  return () => {
    localListeners.get(normCode)?.delete(onUpdate);
    firestoreUnsub();
  };
}

export async function fetchRoom(code: string): Promise<RoomRow> {
  const normCode = code.toUpperCase();
  if (memRooms.has(normCode)) return memRooms.get(normCode)!;

  try {
    const snap = await getDoc(doc(db, "rooms", normCode));
    if (snap.exists()) {
      const d = snap.data() as RoomRow;
      memRooms.set(normCode, d);
      return d;
    }
  } catch (_e) {
    // Firestore offline fallback
  }

  throw new Error("الغرفة غير موجودة");
}

export function getSeat(room: RoomRow, playerId: string): Seat {
  if (room.host_id === playerId) return "host";
  if (room.guest_id === playerId) return "guest";
  throw new Error("أنت لست ضمن هذه الغرفة");
}

// -------------------------------------------------------------
// Matchmaking & Room Setup
// -------------------------------------------------------------
function syncDb(p: Promise<any>) {
  p.catch(() => {});
}

export async function createRoomFb(
  mode: "5" | "11",
  name: string,
  playerId: string,
  auctionType: AuctionType = "blind",
): Promise<{ code: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    if (memRooms.has(code)) continue;

    const initData: RoomRow = {
      code,
      mode,
      auction_type: auctionType,
      state: "waiting",
      host_id: playerId,
      guest_id: null,
      host_name: name,
      guest_name: null,
      host_budget: budgetFor(mode),
      guest_budget: budgetFor(mode),
      round: 0,
      phase: "lobby",
      round_started_at: null,
      current_player: null,
      current_position: null,
      submitted: { host: false, guest: false },
      reveal: null,
      squads: { host: [], guest: [] },
      tactics: { host: "balanced", guest: "balanced", hostStyle: "possession", guestStyle: "possession" },
      formation: { host: {}, guest: {} },
      powers: { host: freshPowers(mode), guest: freshPowers(mode) },
      match: null,
      mystery: null,
      round_event: null,
      live_bids: null,
    };

    memRooms.set(code, initData);
    notifyLocal(code, initData);

    const roomRef = doc(db, "rooms", code);
    syncDb(setDoc(roomRef, initData));

    return { code };
  }
  throw new Error("تعذر إنشاء الغرفة، حاول مجدداً");
}

export async function joinRoomFb(
  code: string,
  name: string,
  playerId: string
): Promise<{ code: string }> {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  if (room.host_id === playerId || room.guest_id === playerId) return { code: normCode };
  if (room.guest_id) throw new Error("الغرفة ممتلئة");

  const updated: RoomRow = {
    ...room,
    guest_id: playerId,
    guest_name: name,
  };
  memRooms.set(normCode, updated);
  notifyLocal(normCode, updated);

  syncDb(updateDoc(doc(db, "rooms", normCode), {
    guest_id: playerId,
    guest_name: name,
  }));
  return { code: normCode };
}

export async function quickMatchFb(
  mode: "5" | "11",
  name: string,
  playerId: string,
  auctionType: AuctionType = "blind",
): Promise<{ code: string; created: boolean }> {
  // Check local memory first
  for (const [c, r] of memRooms.entries()) {
    if (
      r.state === "waiting" &&
      r.mode === mode &&
      (r.auction_type ?? "blind") === auctionType &&
      !r.guest_id &&
      r.host_id !== playerId
    ) {
      await joinRoomFb(c, name, playerId);
      return { code: c, created: false };
    }
  }

  try {
    const q = query(
      collection(db, "rooms"),
      where("state", "==", "waiting"),
      where("mode", "==", mode),
      limit(5)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const r = d.data() as RoomRow;
      if (
        !r.guest_id &&
        (r.auction_type ?? "blind") === auctionType &&
        r.host_id !== playerId
      ) {
        await joinRoomFb(r.code, name, playerId);
        return { code: r.code, created: false };
      }
    }
  } catch (_e) {
    // Offline mode
  }

  const { code } = await createRoomFb(mode, name, playerId, auctionType);
  return { code, created: true };
}

export async function createBotRoomFb(
  mode: "5" | "11",
  name: string,
  playerId: string,
  auctionType: AuctionType = "blind",
): Promise<{ code: string }> {
  const botName = pick(BOT_NAMES);
  const code = makeCode();

  const initData: RoomRow = {
    code,
    mode,
    auction_type: auctionType,
    state: "auction",
    host_id: playerId,
    guest_id: BOT_ID,
    host_name: name,
    guest_name: botName,
    host_budget: budgetFor(mode),
    guest_budget: budgetFor(mode),
    round: 0,
    phase: "lobby",
    round_started_at: null,
    current_player: null,
    current_position: null,
    submitted: { host: false, guest: false },
    reveal: null,
    squads: { host: [], guest: [] },
    tactics: { host: "balanced", guest: "balanced", hostStyle: "possession", guestStyle: "possession" },
    formation: { host: {}, guest: {} },
    powers: { host: freshPowers(mode), guest: freshPowers(mode) },
    match: null,
    mystery: null,
    round_event: null,
    live_bids: null,
  };

  memRooms.set(code, initData);
  notifyLocal(code, initData);

  syncDb(setDoc(doc(db, "rooms", code), initData));

  await beginRoundFb(initData, 1);
  if (auctionType !== "live") {
    void botSubmitBidFb(code);
  }
  return { code };
}

// -------------------------------------------------------------
// Round & Bidding Engine
// -------------------------------------------------------------

export async function beginRoundFb(room: RoomRow, round: number) {
  const event = rollEvent();
  const isScout = event?.id === "scout";
  const used = [...(room.squads?.host ?? []), ...(room.squads?.guest ?? [])].map((s) => s.player.id);
  const { slot, main, sub } = pickRoundPlayers(room.mode, round, used, event?.id === "derby", isScout);

  let host_budget = room.host_budget;
  let guest_budget = room.guest_budget;
  let host_powers = { ...room.powers.host };
  let guest_powers = { ...room.powers.guest };

  if (event?.id === "bonus") {
    host_budget += 15;
    guest_budget += 15;
  } else if (event?.id === "mega_sponsor") {
    host_budget += 25;
    guest_budget += 25;
  }
  const allPowerKeys: (keyof PowerState)[] = [
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

  if (event?.id === "power_rain") {
    host_powers[pick(allPowerKeys)] = (host_powers[pick(allPowerKeys)] || 0) + 1;
    guest_powers[pick(allPowerKeys)] = (guest_powers[pick(allPowerKeys)] || 0) + 1;
  } else if (event?.id === "double_power") {
    host_powers[pick(allPowerKeys)] = (host_powers[pick(allPowerKeys)] || 0) + 2;
    guest_powers[pick(allPowerKeys)] = (guest_powers[pick(allPowerKeys)] || 0) + 2;
  }

  // Save private sub-card
  const privKey = `${room.code}__${round}`;
  memPrivate.set(privKey, { sub_player: sub, bid_host: null, bid_guest: null });

  syncDb(setDoc(doc(db, "rooms", room.code, "private", String(round)), {
    sub_player: sanitizePlayer(sub),
    bid_host: null,
    bid_guest: null,
  }));

  const initLiveBids: LiveBidsState | null =
    room.auction_type === "live"
      ? {
          host: 0,
          guest: 0,
          highest_seat: null,
          highest_bid: 0,
          last_action: "بدأ المزاد المباشر! ضع أول مزايدة ⚡",
          passed_seat: null,
        }
      : null;

  const updated: RoomRow = {
    ...room,
    state: "auction",
    phase: "bidding",
    round,
    round_started_at: new Date().toISOString(),
    current_player: sanitizePlayer(main),
    current_position: slot.key,
    submitted: { host: false, guest: false },
    reveal: null,
    round_event: event,
    host_budget,
    guest_budget,
    powers: { host: host_powers, guest: guest_powers },
    live_bids: initLiveBids,
  };

  memRooms.set(room.code, updated);
  notifyLocal(room.code, updated);

  syncDb(updateDoc(doc(db, "rooms", room.code), {
    state: "auction",
    phase: "bidding",
    round,
    round_started_at: updated.round_started_at,
    current_player: sanitizePlayer(main),
    current_position: slot.key,
    submitted: { host: false, guest: false },
    reveal: null,
    round_event: event,
    host_budget,
    guest_budget,
    "powers.host": host_powers,
    "powers.guest": guest_powers,
    live_bids: initLiveBids,
  }));

  // مزايدة البوت المباشرة التلقائية في الجولة
  if (room.guest_id === BOT_ID && room.auction_type === "live") {
    setTimeout(async () => {
      try {
        const fresh = await fetchRoom(room.code);
        if (fresh.phase === "bidding" && fresh.round === round && (fresh.live_bids?.highest_bid ?? 0) === 0) {
          const startingBid = Math.min(fresh.guest_budget, Math.max(5, Math.round((main.overall >= 90 ? 25 : 12))));
          await liveBidFb(room.code, BOT_ID, startingBid);
        }
      } catch (_e) {
        // Safe catch
      }
    }, 1200);
  }
}

export async function submitBidFb(code: string, playerId: string, amount: number) {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  const seat = getSeat(room, playerId);

  if (room.phase !== "bidding") throw new Error("انتهت مهلة المزايدة");
  if (room.round_event?.vetoedBy && room.round_event.vetoedBy !== seat) {
    throw new Error("تم استخدام الفيتو ضدك في هذه الجولة");
  }
  if (room.submitted[seat]) return;

  let budget = seat === "host" ? room.host_budget : room.guest_budget;
  if (room.round_event?.frozenSeat === seat) budget = Math.round(budget * 0.7);
  const finalBid = Math.max(0, Math.min(amount, budget));

  const privKey = `${normCode}__${room.round}`;
  const curPriv = memPrivate.get(privKey) || {};
  curPriv[seat === "host" ? "bid_host" : "bid_guest"] = finalBid;
  memPrivate.set(privKey, curPriv);

  const privRef = doc(db, "rooms", normCode, "private", String(room.round));
  syncDb(updateDoc(privRef, {
    [seat === "host" ? "bid_host" : "bid_guest"]: finalBid,
  }));

  const nextSubmitted = { ...room.submitted, [seat]: true };
  const updated: RoomRow = { ...room, submitted: nextSubmitted };
  memRooms.set(normCode, updated);
  notifyLocal(normCode, updated);

  syncDb(updateDoc(doc(db, "rooms", normCode), {
    submitted: nextSubmitted,
  }));

  if (nextSubmitted.host && nextSubmitted.guest) {
    await resolveRoundFb(normCode);
  } else {
    const hasBot = room.guest_id === BOT_ID || room.host_id === BOT_ID;
    if (hasBot) {
      const botSeat: Seat = room.guest_id === BOT_ID ? "guest" : "host";
      if (!nextSubmitted[botSeat]) {
        await botSubmitBidFb(normCode);
      }
    }
  }
}

export async function liveBidFb(code: string, playerId: string, amount: number) {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  if (room.phase !== "bidding") return;
  const seat = getSeat(room, playerId);

  if (room.round_event?.vetoedBy && room.round_event.vetoedBy !== seat) {
    throw new Error("تم استخدام الفيتو ضدك في هذه الجولة");
  }

  let budget = seat === "host" ? room.host_budget : room.guest_budget;
  if (room.round_event?.frozenSeat === seat) budget = Math.round(budget * 0.7);
  if (amount > budget) throw new Error("المزايدة تتجاوز ميزانيتك المتاحة");

  const currentHigh = room.live_bids?.highest_bid ?? 0;
  if (amount <= currentHigh) throw new Error("يجب أن تكون المزايدة أعلى من السعر الحالي");

  const currentBids = room.live_bids ?? {
    host: 0,
    guest: 0,
    highest_seat: null,
    highest_bid: 0,
    last_action: null,
    passed_seat: null,
  };

  const playerName = seat === "host" ? room.host_name : (room.guest_name ?? "الخصم");
  const nextLiveBids: LiveBidsState = {
    ...currentBids,
    [seat]: amount,
    highest_seat: seat,
    highest_bid: amount,
    last_action: `⚡ ${playerName} رفع المزاد إلى ${amount}M!`,
    passed_seat: null,
  };

  // نحفظ المزايدة أيضاً في private store
  const privKey = `${normCode}__${room.round}`;
  const curPriv = memPrivate.get(privKey) || {};
  curPriv[seat === "host" ? "bid_host" : "bid_guest"] = amount;
  memPrivate.set(privKey, curPriv);

  const updated: RoomRow = {
    ...room,
    live_bids: nextLiveBids,
  };
  memRooms.set(normCode, updated);
  notifyLocal(normCode, updated);

  syncDb(updateDoc(doc(db, "rooms", normCode), {
    live_bids: nextLiveBids,
  }));

  // رد البوت في المود المباشر
  if (room.guest_id === BOT_ID && seat === "host") {
    setTimeout(async () => {
      try {
        const fresh = await fetchRoom(normCode);
        if (fresh.phase !== "bidding" || fresh.round !== room.round) return;
        const main = fresh.current_player;
        if (!main) return;

        const botMax = Math.min(
          fresh.guest_budget,
          Math.round(main.value * 0.95 + (main.overall >= 96 ? 35 : main.overall >= 90 ? 20 : 10))
        );

        if (amount < botMax && amount + 2 <= fresh.guest_budget) {
          const raise = Math.min(fresh.guest_budget, amount + pick([2, 3, 5, 8]));
          await liveBidFb(normCode, BOT_ID, raise);
        } else {
          // البوت يستسلم ويقول مبروك عليك
          await passBidFb(normCode, BOT_ID);
        }
      } catch (_e) {
        // Safe catch
      }
    }, 1400 + Math.random() * 800);
  }
}

export async function passBidFb(code: string, playerId: string) {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  if (room.phase !== "bidding") return;
  const seat = getSeat(room, playerId);
  const playerName = seat === "host" ? room.host_name : (room.guest_name ?? "الخصم");

  const currentBids = room.live_bids ?? {
    host: 0,
    guest: 0,
    highest_seat: null,
    highest_bid: 0,
    last_action: null,
    passed_seat: null,
  };

  const nextLiveBids: LiveBidsState = {
    ...currentBids,
    passed_seat: seat,
    last_action: `🤝 ${playerName} قال "مبروك عليك!" واكتفى باللاعب البديل`,
  };

  const updated: RoomRow = {
    ...room,
    live_bids: nextLiveBids,
  };
  memRooms.set(normCode, updated);
  notifyLocal(normCode, updated);

  syncDb(updateDoc(doc(db, "rooms", normCode), {
    live_bids: nextLiveBids,
  }));

  // إنهاء الجولة فوراً وتتويج الخصم
  await resolveRoundFb(normCode);
}

export async function botSubmitBidFb(code: string) {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  if (room.phase !== "bidding") return;
  const botSeat: Seat = room.guest_id === BOT_ID ? "guest" : "host";
  if (room.submitted[botSeat]) return;

  const budget = botSeat === "host" ? room.host_budget : room.guest_budget;
  const overall = room.current_player?.overall ?? 80;
  const amount = calcBotBid(overall, budget);

  await submitBidFb(normCode, BOT_ID, amount);
}

export async function resolveRoundFb(code: string) {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  if (room.phase !== "bidding") return;

  const privKey = `${normCode}__${room.round}`;
  let priv: Record<string, unknown> = memPrivate.get(privKey) || {};

  try {
    const privSnap = await getDoc(doc(db, "rooms", normCode, "private", String(room.round)));
    if (privSnap.exists()) priv = privSnap.data() as Record<string, unknown>;
  } catch (_e) {
    // Offline mode
  }

  let bidHost = Number(priv["bid_host"] ?? 0);
  let bidGuest = Number(priv["bid_guest"] ?? 0);

  if (room.auction_type === "live" && room.live_bids) {
    bidHost = room.live_bids.host;
    bidGuest = room.live_bids.guest;
  }

  const sub = (priv["sub_player"] as Player | undefined) ?? room.current_player!;
  const main = room.current_player!;
  const posKey = room.current_position!;

  const ev = room.round_event ?? null;
  const effHost = bidHost + (ev?.overdriveBy === "host" ? 10 : 0);
  const effGuest = bidGuest + (ev?.overdriveBy === "guest" ? 10 : 0);

  let winner: Seat;
  if (ev?.vetoedBy) {
    winner = ev.vetoedBy;
  } else if (room.auction_type === "live" && room.live_bids?.passed_seat) {
    winner = room.live_bids.passed_seat === "host" ? "guest" : "host";
  } else if (effHost > effGuest) {
    winner = "host";
  } else if (effGuest > effHost) {
    winner = "guest";
  } else {
    winner = room.round % 2 === 0 ? "guest" : "host";
  }

  const rawPrice = Math.max(
    room.auction_type === "live" ? 5 : 0,
    winner === "host" ? bidHost : bidGuest
  );
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
    awardedMain = { ...awardedMain, overall: Math.min(100, awardedMain.overall + 2) };
  } else if (ev?.id === "iron_wall") {
    awardedMain = { ...awardedMain, overall: Math.min(100, awardedMain.overall + 2) };
  }
  if (ev?.scoutBoostBy === winner) {
    awardedMain = {
      ...awardedMain,
      overall: Math.min(100, awardedMain.overall + 3),
      value: awardedMain.value + 15,
      tier: awardedMain.overall + 3 >= 96 ? "legend" : awardedMain.tier,
    };
  }

  const squads: Record<Seat, SquadItem[]> = {
    host: [...room.squads.host],
    guest: [...room.squads.guest],
  };
  squads[winner].push({ posKey, player: awardedMain, price, won: true });
  const loser: Seat = winner === "host" ? "guest" : "host";

  if (ev?.doubleDealBy === winner) {
    squads[winner].push({ posKey: posKey + "_sub", player: sub, price: 0, won: true });
  } else {
    squads[loser].push({ posKey, player: sub, price: 0, won: false });
  }

  let host_budget = room.host_budget;
  let guest_budget = room.guest_budget;
  if (winner === "host") host_budget = Math.max(0, host_budget - price);
  else guest_budget = Math.max(0, guest_budget - price);

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

  // استرداد الإعفاء الضريبي
  if (ev?.taxCutBy === winner) {
    const taxRefund = Math.round(price * 0.3);
    if (winner === "host") bonusHost += taxRefund;
    else bonusGuest += taxRefund;
  }

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
    host: { ...room.powers.host },
    guest: { ...room.powers.guest },
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

    if (reward.kind === "budget" && reward.amount) {
      if (targetSeat === "host") bonusHost += reward.amount;
      else bonusGuest += reward.amount;
    } else if (reward.kind === "curse_budget" && reward.amount) {
      if (targetSeat === "host") bonusHost -= reward.amount;
      else bonusGuest -= reward.amount;
    } else if (reward.kind === "power") {
      const key = reward.powerKey ?? pick(powerKeys);
      powers[targetSeat][key] = (powers[targetSeat][key] || 0) + (reward.amount || 1);
    } else if (reward.kind === "curse_power") {
      for (const pk of powerKeys) {
        if (powers[targetSeat][pk] > 0) {
          powers[targetSeat][pk] = Math.max(0, powers[targetSeat][pk] - 1);
          break;
        }
      }
    } else if (reward.kind === "boost" && reward.amount) {
      const squad = squads[targetSeat];
      const last = squad[squad.length - 1];
      if (last) {
        last.player = {
          ...last.player,
          overall: Math.min(99, last.player.overall + reward.amount),
          tier: reward.amount >= 5 ? "legend" : last.player.tier,
        };
      }
    } else if (reward.kind === "curse_boost" && reward.amount) {
      const squad = squads[targetSeat];
      const last = squad[squad.length - 1];
      if (last) {
        last.player = {
          ...last.player,
          overall: Math.max(50, last.player.overall - reward.amount),
        };
      }
    } else if (reward.kind === "special" && reward.amount) {
      if (targetSeat === "host") bonusHost += reward.amount;
      else bonusGuest += reward.amount;
      const pk = pick(powerKeys);
      powers[targetSeat][pk] = (powers[targetSeat][pk] || 0) + 1;
      const squad = squads[targetSeat];
      const last = squad[squad.length - 1];
      if (last) {
        last.player = {
          ...last.player,
          overall: Math.min(99, last.player.overall + 3),
        };
      }
    }
  }

  host_budget += bonusHost;
  guest_budget += bonusGuest;

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
  };

  const updated: RoomRow = {
    ...room,
    phase: "reveal",
    reveal,
    squads,
    host_budget,
    guest_budget,
    mystery,
    powers,
  };

  memRooms.set(normCode, updated);
  notifyLocal(normCode, updated);

  syncDb(updateDoc(doc(db, "rooms", normCode), {
    phase: "reveal",
    reveal,
    squads,
    host_budget,
    guest_budget,
    mystery,
    powers,
  }));
}

export async function nextRoundFb(code: string, playerId: string) {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  getSeat(room, playerId);
  if (room.phase !== "reveal") return;

  const total = positionsFor(room.mode).length;
  if (room.round >= total) {
    const updated: RoomRow = {
      ...room,
      state: "formation",
      phase: "formation",
    };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      state: "formation",
      phase: "formation",
    }));
    return;
  }

  await beginRoundFb(room, room.round + 1);

  if (room.guest_id === BOT_ID || room.host_id === BOT_ID) {
    void botSubmitBidFb(normCode);
  }
}

// -------------------------------------------------------------
// Powers & Formation & Match
// -------------------------------------------------------------

export async function usePowerFb(
  code: string,
  playerId: string,
  power: PowerId
): Promise<{ hint: string }> {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  const seat = getSeat(room, playerId);
  const other: Seat = seat === "host" ? "guest" : "host";

  if ((room.powers[seat]?.[power] ?? 0) <= 0) throw new Error("لا تملك هذا الكارت");

  const nextPowers = {
    ...room.powers,
    [seat]: { ...room.powers[seat], [power]: room.powers[seat][power] - 1 },
  };

  if (power === "veto") {
    if (room.phase !== "bidding") throw new Error("الفيتو يُستخدم أثناء المزايدة فقط");
    const updatedEvent: RoundEvent = {
      ...(room.round_event ?? { id: "veto", title: "فيتو", icon: "🚫", desc: "تم حظر الخصم" }),
      vetoedBy: seat,
    };
    const updated: RoomRow = { ...room, powers: nextPowers, round_event: updatedEvent };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      powers: nextPowers,
      round_event: updatedEvent,
    }));
    return { hint: "🚫 تم تفعيل الفيتو بنجاح! ضمنت الحصول على اللاعب الحالي والخصم سيحصل على البديل." };
  }

  if (power === "hawk") {
    if (room.phase !== "bidding") throw new Error("عين الصقر تُستخدم أثناء المزايدة فقط");
    const updated: RoomRow = { ...room, powers: nextPowers };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    const privKey = `${normCode}__${room.round}`;
    const priv = memPrivate.get(privKey) || {};
    const otherBid = Number(priv[other === "host" ? "bid_host" : "bid_guest"] ?? 0);
    const est = otherBid > 0 ? `${Math.max(0, otherBid - 5)} - ${otherBid + 5}M` : "لم يزايد بعد";
    return { hint: `👁️ تقدير مزايدة الخصم التقريبية: ${est}` };
  }

  if (power === "spy") {
    if (room.phase !== "bidding") throw new Error("الجاسوس يُستخدم أثناء المزايدة فقط");
    const updated: RoomRow = { ...room, powers: nextPowers };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    const privKey = `${normCode}__${room.round}`;
    const priv = memPrivate.get(privKey) || {};
    const sub = priv["sub_player"] as Player | undefined;
    const name = sub ? `${sub.nameAr} (طاقة: ${sub.overall})` : "غير متاح";
    return { hint: `🔍 اللاعب البديل السري لهذه الجولة هو: ${name}` };
  }

  if (power === "shield") {
    if (room.phase !== "bidding") throw new Error("الدرع يُستخدم أثناء المزايدة فقط");
    const updatedEvent: RoundEvent = {
      ...(room.round_event ?? { id: "shield", title: "درع واقٍ", icon: "🛡️", desc: "حماية من السرقة" }),
      shieldedBy: seat,
    };
    const updated: RoomRow = { ...room, powers: nextPowers, round_event: updatedEvent };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      powers: nextPowers,
      round_event: updatedEvent,
    }));
    return { hint: "🛡️ تم تفعيل الدرع الواقي! لاعبوك محميون تماماً من السرقة." };
  }

  if (power === "discount") {
    if (room.phase !== "bidding") throw new Error("كوبون الخصم يُستخدم أثناء المزايدة فقط");
    const updatedEvent: RoundEvent = {
      ...(room.round_event ?? { id: "discount", title: "كوبون خصم", icon: "🏷️", desc: "خصم 50% للفائز" }),
      discountedBy: seat,
    };
    const updated: RoomRow = { ...room, powers: nextPowers, round_event: updatedEvent };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      powers: nextPowers,
      round_event: updatedEvent,
    }));
    return { hint: "🏷️ تم تفعيل كوبون الخصم: إذا فزت ستدفع 50% فقط من مزايدتك!" };
  }

  if (power === "freeze") {
    if (room.phase !== "bidding") throw new Error("كارت التجميد يُستخدم أثناء المزايدة فقط");
    const updatedEvent: RoundEvent = {
      ...(room.round_event ?? { id: "freeze", title: "تجميد", icon: "❄️", desc: "تم تجميد 30% من ميزانية الخصم" }),
      frozenSeat: other,
    };
    const updated: RoomRow = { ...room, powers: nextPowers, round_event: updatedEvent };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      powers: nextPowers,
      round_event: updatedEvent,
    }));
    return { hint: "❄️ تم تجميد 30% من ميزانية الخصم في هذه الجولة بنجاح!" };
  }

  if (power === "steal") {
    if (room.phase !== "reveal" || !room.reveal) throw new Error("السرقة تُستخدم بعد كشف الجولة فقط");
    if (room.reveal.stolenBy) throw new Error("تمت السرقة في هذه الجولة بالفعل");
    if (room.reveal.winner === seat) throw new Error("أنت الفائز أصلاً بهذا اللاعب");

    if (room.round_event?.shieldedBy === other) {
      throw new Error("لا يمكنك سرقة هذا اللاعب، الخصم قام بحمايته بالدرع الواقي 🛡️!");
    }

    const cost = Math.max(1, Math.round(room.reveal.price * 1.5));
    const myBudget = seat === "host" ? room.host_budget : room.guest_budget;
    if (myBudget < cost) throw new Error(`تحتاج ${cost} مليون للسرقة وميزانيتك ${myBudget}`);

    const squads: Record<Seat, SquadItem[]> = {
      host: [...room.squads.host],
      guest: [...room.squads.guest],
    };
    const mineIdx = squads[seat].findIndex((s) => s.posKey === room.reveal!.posKey);
    const theirIdx = squads[other].findIndex((s) => s.posKey === room.reveal!.posKey);
    if (mineIdx < 0 || theirIdx < 0) throw new Error("تعذر تنفيذ السرقة");
    const mine = squads[seat][mineIdx]!;
    const theirs = squads[other][theirIdx]!;
    squads[seat][mineIdx] = { posKey: mine.posKey, player: theirs.player, price: cost, won: true };
    squads[other][theirIdx] = { posKey: mine.posKey, player: mine.player, price: 0, won: false };

    const reveal: RevealResult = { ...room.reveal, stolenBy: seat, winner: seat };

    const hostBudgetDiff = (seat === "host" ? -cost : 0) + (other === "host" ? room.reveal.price : 0);
    const guestBudgetDiff = (seat === "guest" ? -cost : 0) + (other === "guest" ? room.reveal.price : 0);

    const updated: RoomRow = {
      ...room,
      squads,
      powers: nextPowers,
      reveal,
      host_budget: room.host_budget + hostBudgetDiff,
      guest_budget: room.guest_budget + guestBudgetDiff,
    };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      squads,
      powers: nextPowers,
      reveal,
      host_budget: room.host_budget + hostBudgetDiff,
      guest_budget: room.guest_budget + guestBudgetDiff,
    }));
    return { hint: `🥷 تمت سرقة ${theirs.player.nameAr} بنجاح مقابل ${cost}M!` };
  }

  if (power === "bounty") {
    const budgetKey = seat === "host" ? "host_budget" : "guest_budget";
    const newBudget = room[budgetKey] + 15;
    const updated: RoomRow = {
      ...room,
      powers: nextPowers,
      [budgetKey]: newBudget,
    };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      powers: nextPowers,
      [budgetKey]: newBudget,
    }));
    return { hint: "💰 تم تفعيل الراعي السري! حصلت فوراً على +15M كاش إضافية في ميزانيتك!" };
  }

  if (power === "double_deal") {
    if (room.phase !== "bidding") throw new Error("الصفقة المزدوجة تُستخدم أثناء المزايدة فقط");
    const updatedEvent: RoundEvent = {
      ...(room.round_event ?? { id: "double_deal", title: "صفقة مزدوجة", icon: "👥", desc: "ضم الأساسي والبديل معاً" }),
      doubleDealBy: seat,
    };
    const updated: RoomRow = { ...room, powers: nextPowers, round_event: updatedEvent };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      powers: nextPowers,
      round_event: updatedEvent,
    }));
    return { hint: "👥 تم تفعيل الصفقة المزدوجة! إذا فزت بالجولة ستضم كلاً من اللاعب الأساسي والبديل معاً!" };
  }

  if (power === "lockout") {
    if (room.phase !== "bidding") throw new Error("القفل الذهبي يُستخدم أثناء المزايدة فقط");
    const updatedEvent: RoundEvent = {
      ...(room.round_event ?? { id: "lockout", title: "قفل المزاد", icon: "🔒", desc: "تم قفل مزايدة الخصم" }),
      lockedSeat: other,
    };
    const updated: RoomRow = { ...room, powers: nextPowers, round_event: updatedEvent };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      powers: nextPowers,
      round_event: updatedEvent,
    }));
    return { hint: "🔒 تم تفعيل القفل الذهبي! تم تثبيت وقفل مزايدة الخصم في هذه الجولة." };
  }

  if (power === "scout_boost") {
    if (room.phase !== "bidding") throw new Error("الكشاف الأسطوري يُستخدم أثناء المزايدة فقط");
    const updatedEvent: RoundEvent = {
      ...(room.round_event ?? { id: "scout_boost", title: "كشاف أسطوري", icon: "⚡", desc: "زيادة +3 في طاقة اللاعب الفائز" }),
      scoutBoostBy: seat,
    };
    const updated: RoomRow = { ...room, powers: nextPowers, round_event: updatedEvent };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      powers: nextPowers,
      round_event: updatedEvent,
    }));
    return { hint: "⚡ تم تفعيل الكشاف الأسطوري! اللاعب الذي ستفوز به سيحصل على +3 Overall دائم!" };
  }

  if (power === "blitz_bid") {
    if (room.phase !== "bidding") throw new Error("المزايدة الشبحية تُستخدم أثناء المزايدة فقط");
    const updatedEvent: RoundEvent = {
      ...(room.round_event ?? { id: "blitz_bid", title: "مزايدة شبحية", icon: "👻", desc: "مزايدة سرية مشفرة بالكامل" }),
      ghostBidBy: seat,
    };
    const updated: RoomRow = { ...room, powers: nextPowers, round_event: updatedEvent };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      powers: nextPowers,
      round_event: updatedEvent,
    }));
    return { hint: "👻 تم تفعيل المزايدة الشبحية! مزايدتك مخفية ومشفرة تماماً ومحمية من عين الصقر." };
  }

  if (power === "tax_cut") {
    if (room.phase !== "bidding") throw new Error("الإعفاء الضريبي يُستخدم أثناء المزايدة فقط");
    const updatedEvent: RoundEvent = {
      ...(room.round_event ?? { id: "tax_cut", title: "إعفاء ضريبي", icon: "🧾", desc: "استرداد 30% كاش بعد الفوز" }),
      taxCutBy: seat,
    };
    const updated: RoomRow = { ...room, powers: nextPowers, round_event: updatedEvent };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      powers: nextPowers,
      round_event: updatedEvent,
    }));
    return { hint: "🧾 تم تفعيل الإعفاء الضريبي! ستسترد 30% كاش فوراً من قيمة ما تدفعه بعد الفوز بالصفقة." };
  }

  if (power === "overdrive") {
    if (room.phase !== "bidding") throw new Error("طاقة التيربو تُستخدم أثناء المزايدة فقط");
    const updatedEvent: RoundEvent = {
      ...(room.round_event ?? { id: "overdrive", title: "طاقة التيربو", icon: "🚀", desc: "دعم مجاني +10M على مزايدتك" }),
      overdriveBy: seat,
    };
    const updated: RoomRow = { ...room, powers: nextPowers, round_event: updatedEvent };
    memRooms.set(normCode, updated);
    notifyLocal(normCode, updated);

    syncDb(updateDoc(doc(db, "rooms", normCode), {
      powers: nextPowers,
      round_event: updatedEvent,
    }));
    return { hint: "🚀 تم تفعيل طاقة التيربو! حصلت على دعم +10M مجانية على مزايدتك تدفعها اللعبة عنك!" };
  }

  return { hint: "تم استخدام الكارت بنجاح!" };
}

export async function setFormationFb(
  code: string,
  playerId: string,
  spots: Record<string, any>
) {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  const seat = getSeat(room, playerId);

  const updated: RoomRow = {
    ...room,
    formation: { ...room.formation, [seat]: spots },
  };
  memRooms.set(normCode, updated);
  notifyLocal(normCode, updated);

  syncDb(updateDoc(doc(db, "rooms", normCode), {
    [`formation.${seat}`]: spots,
  }));
}

export async function setTacticFb(
  code: string,
  playerId: string,
  tactic: Tactic
) {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  const seat = getSeat(room, playerId);

  const updated: RoomRow = {
    ...room,
    tactics: { ...room.tactics, [seat]: tactic },
  };
  memRooms.set(normCode, updated);
  notifyLocal(normCode, updated);

  syncDb(updateDoc(doc(db, "rooms", normCode), {
    [`tactics.${seat}`]: tactic,
  }));
}

export async function setPlayStyleFb(
  code: string,
  playerId: string,
  style: PlayStyle
) {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  const seat = getSeat(room, playerId);
  const key = seat === "host" ? "hostStyle" : "guestStyle";

  const updated: RoomRow = {
    ...room,
    tactics: { ...room.tactics, [key]: style },
  };
  memRooms.set(normCode, updated);
  notifyLocal(normCode, updated);

  syncDb(updateDoc(doc(db, "rooms", normCode), {
    [`tactics.${key}`]: style,
  }));
}

export async function startMatchFb(code: string, playerId: string) {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  if (room.host_id !== playerId) throw new Error("صاحب الغرفة فقط يبدأ المباراة");
  if (room.state === "finished") return;

  const match = simulateMatch(room);

  const updated: RoomRow = {
    ...room,
    state: "finished",
    phase: "match",
    match,
  };
  memRooms.set(normCode, updated);
  notifyLocal(normCode, updated);

  syncDb(updateDoc(doc(db, "rooms", normCode), {
    state: "finished",
    phase: "match",
    match,
  }));
}

export async function rematchFb(code: string, playerId: string) {
  const normCode = code.toUpperCase();
  const room = await fetchRoom(normCode);
  getSeat(room, playerId);

  const resetData = {
    state: "auction",
    phase: "lobby",
    round: 0,
    host_budget: budgetFor(room.mode),
    guest_budget: budgetFor(room.mode),
    current_player: null,
    current_position: null,
    reveal: null,
    match: null,
    mystery: null,
    round_event: null,
    squads: { host: [], guest: [] },
    submitted: { host: false, guest: false },
    powers: { host: freshPowers(room.mode), guest: freshPowers(room.mode) },
  };

  const updated: RoomRow = { ...room, ...resetData } as RoomRow;
  memRooms.set(normCode, updated);
  notifyLocal(normCode, updated);

  syncDb(deleteDoc(doc(db, "rooms", normCode, "private", "1")));
  syncDb(updateDoc(doc(db, "rooms", normCode), resetData));

  await beginRoundFb(updated, 1);
}
