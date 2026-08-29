/**
 * Tournament Engine — منطق الدوري على Firebase
 * single-elimination bracket with bye support for odd player counts
 */
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AuctionType } from "./game-types";
import {
  type TournamentRow,
  type TournamentPlayer,
  type BracketRound,
  type BracketMatch,
} from "./tournament-types";
import { createRoomFb } from "./firebase-engine";
import { makeCode } from "./game-logic.server";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeTournamentCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "T";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function now() {
  return new Date().toISOString();
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────
const memTournaments = new Map<string, TournamentRow>();
const localListeners = new Map<string, Set<(t: TournamentRow | null) => void>>();

function notifyLocal(id: string, t: TournamentRow | null) {
  localListeners.get(id)?.forEach((cb) => cb(t));
}

function syncDb(p: Promise<unknown>) {
  p.catch(() => {});
}

// ─── Fetch Tournament ─────────────────────────────────────────────────────
async function fetchTournament(id: string): Promise<TournamentRow> {
  const mem = memTournaments.get(id);
  if (mem) return mem;
  const snap = await getDoc(doc(db, "tournaments", id));
  if (!snap.exists()) throw new Error("الدوري غير موجود");
  const t = snap.data() as TournamentRow;
  memTournaments.set(id, t);
  return t;
}

function saveT(t: TournamentRow) {
  memTournaments.set(t.id, t);
  notifyLocal(t.id, t);
  syncDb(setDoc(doc(db, "tournaments", t.id), t));
}

// ─── Realtime Subscription ────────────────────────────────────────────────
export function subscribeToTournament(
  id: string,
  cb: (t: TournamentRow | null) => void
): Unsubscribe {
  const upper = id.toUpperCase();

  if (!localListeners.has(upper)) {
    localListeners.set(upper, new Set());
  }
  localListeners.get(upper)!.add(cb);

  // Fire from mem-cache immediately if available
  const cached = memTournaments.get(upper);
  if (cached) setTimeout(() => cb(cached), 0);

  // Firestore real-time listener
  const unsub = onSnapshot(doc(db, "tournaments", upper), (snap) => {
    if (!snap.exists()) { cb(null); return; }
    const t = snap.data() as TournamentRow;
    memTournaments.set(upper, t);
    notifyLocal(upper, t);
  });

  return () => {
    localListeners.get(upper)?.delete(cb);
    unsub();
  };
}

// ─── Build Bracket ────────────────────────────────────────────────────────
/**
 * يبني البراكيت الأول عشوائياً من قائمة اللاعبين النشطين.
 * عند عدد فردي: اللاعب الأخير يحصل على "bye" (راحة) ويتأهل تلقائياً للجولة التالية.
 */
function buildFirstRound(players: TournamentPlayer[]): BracketRound {
  const shuffled = shuffle(players);
  const matches: BracketMatch[] = [];

  let byePlayer: TournamentPlayer | null = null;
  let playersInMatches = shuffled;

  if (shuffled.length % 2 !== 0) {
    byePlayer = shuffled[shuffled.length - 1]!;
    playersInMatches = shuffled.slice(0, -1);
  }

  for (let i = 0; i < playersInMatches.length; i += 2) {
    const p1 = playersInMatches[i]!;
    const p2 = playersInMatches[i + 1]!;
    matches.push({
      id: `r1m${i / 2}`,
      player1_id: p1.id,
      player2_id: p2.id,
      player1_name: p1.name,
      player2_name: p2.name,
      winner_id: null,
      winner_name: null,
      room_code: null,
      state: "pending",
    });
  }

  return {
    round: 1,
    matches,
    bye_player_id: byePlayer?.id ?? null,
    bye_player_name: byePlayer?.name ?? null,
  };
}

/**
 * يبني الجولة التالية من الفائزين الحاليين + اللاعب الحاصل على bye.
 */
function buildNextRound(
  prevRound: BracketRound,
  roundNum: number
): BracketRound {
  // collect winners
  const winners: { id: string; name: string }[] = prevRound.matches
    .filter((m) => m.winner_id !== null)
    .map((m) => ({ id: m.winner_id!, name: m.winner_name! }));

  // add bye player from previous round
  if (prevRound.bye_player_id) {
    winners.push({ id: prevRound.bye_player_id, name: prevRound.bye_player_name! });
  }

  const shuffled = shuffle(winners);
  const matches: BracketMatch[] = [];
  let byePlayer: { id: string; name: string } | null = null;
  let playersInMatches = shuffled;

  if (shuffled.length % 2 !== 0) {
    byePlayer = shuffled[shuffled.length - 1]!;
    playersInMatches = shuffled.slice(0, -1);
  }

  for (let i = 0; i < playersInMatches.length; i += 2) {
    const p1 = playersInMatches[i]!;
    const p2 = playersInMatches[i + 1]!;
    matches.push({
      id: `r${roundNum}m${i / 2}`,
      player1_id: p1.id,
      player2_id: p2.id,
      player1_name: p1.name,
      player2_name: p2.name,
      winner_id: null,
      winner_name: null,
      room_code: null,
      state: "pending",
    });
  }

  return {
    round: roundNum,
    matches,
    bye_player_id: byePlayer?.id ?? null,
    bye_player_name: byePlayer?.name ?? null,
  };
}

// ─── Create Tournament ────────────────────────────────────────────────────
export async function createTournamentFb(
  hostId: string,
  hostName: string,
  name: string,
  mode: "5" | "11",
  auctionType: AuctionType
): Promise<{ id: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = makeTournamentCode();
    if (memTournaments.has(id)) continue;

    const hostPlayer: TournamentPlayer = {
      id: hostId,
      name: hostName,
      status: "active",
      wins: 0,
      losses: 0,
      current_room: null,
    };

    const t: TournamentRow = {
      id,
      name,
      host_id: hostId,
      host_name: hostName,
      mode,
      auction_type: auctionType,
      state: "lobby",
      players: [hostPlayer],
      bracket: [],
      current_round: 0,
      champion_id: null,
      champion_name: null,
      created_at: now(),
      updated_at: null,
    };

    saveT(t);
    return { id };
  }
  throw new Error("تعذر إنشاء الدوري، حاول مجدداً");
}

// ─── Join Tournament ──────────────────────────────────────────────────────
export async function joinTournamentFb(
  id: string,
  playerId: string,
  playerName: string
): Promise<{ id: string }> {
  const t = await fetchTournament(id.toUpperCase());

  if (t.state !== "lobby") throw new Error("الدوري بدأ بالفعل ولا يمكن الانضمام");
  if (t.players.length >= 16) throw new Error("الدوري ممتلئ (الحد الأقصى 16 لاعباً)");
  if (t.players.find((p) => p.id === playerId)) {
    return { id: t.id }; // already joined
  }

  const updated: TournamentRow = {
    ...t,
    players: [
      ...t.players,
      {
        id: playerId,
        name: playerName,
        status: "active",
        wins: 0,
        losses: 0,
        current_room: null,
      },
    ],
    updated_at: now(),
  };

  saveT(updated);
  return { id: t.id };
}

// ─── Start Tournament ─────────────────────────────────────────────────────
export async function startTournamentFb(
  id: string,
  hostId: string
): Promise<void> {
  const t = await fetchTournament(id.toUpperCase());

  if (t.host_id !== hostId) throw new Error("فقط منشئ الدوري يمكنه البدء");
  if (t.state !== "lobby") throw new Error("الدوري بدأ بالفعل");
  if (t.players.length < 2) throw new Error("يجب أن يكون هناك لاعبان على الأقل");

  const activePlayers = t.players.filter((p) => p.status === "active");
  const firstRound = buildFirstRound(activePlayers);

  // create rooms for each match in parallel
  const updatedMatches = await Promise.all(
    firstRound.matches.map(async (match) => {
      const { code } = await createRoomFb(t.mode, match.player1_name, match.player1_id, t.auction_type);
      return { ...match, room_code: code, state: "active" as const };
    })
  );

  const roundWithRooms: BracketRound = { ...firstRound, matches: updatedMatches };

  // update player statuses & current_room
  const updatedPlayers = t.players.map((p) => {
    if (p.id === roundWithRooms.bye_player_id) {
      return { ...p, status: "bye" as const, current_room: null };
    }
    const match = updatedMatches.find(
      (m) => m.player1_id === p.id || m.player2_id === p.id
    );
    return match ? { ...p, current_room: match.room_code, status: "active" as const } : p;
  });

  const updated: TournamentRow = {
    ...t,
    state: "active",
    bracket: [roundWithRooms],
    current_round: 1,
    players: updatedPlayers,
    updated_at: now(),
  };

  saveT(updated);
}

// ─── Report Match Result ──────────────────────────────────────────────────
/**
 * يُستدعى عند انتهاء مباراة داخل الدوري.
 * winnerId = id اللاعب الفائز
 * loserId  = id اللاعب الخاسر
 */
export async function reportMatchResultFb(
  tournamentId: string,
  roomCode: string,
  winnerId: string,
  winnerName: string,
  loserId: string
): Promise<void> {
  const t = await fetchTournament(tournamentId.toUpperCase());
  if (t.state !== "active") return;

  // find and update the match
  const updatedBracket = t.bracket.map((round) => {
    if (round.round !== t.current_round) return round;
    const updatedMatches = round.matches.map((m) => {
      if (m.room_code !== roomCode) return m;
      return {
        ...m,
        winner_id: winnerId,
        winner_name: winnerName,
        state: "done" as const,
      };
    });
    return { ...round, matches: updatedMatches };
  });

  // update player stats
  const updatedPlayers = t.players.map((p) => {
    if (p.id === winnerId) return { ...p, wins: p.wins + 1, current_room: null, status: "active" as const };
    if (p.id === loserId) return { ...p, losses: p.losses + 1, current_room: null, status: "eliminated" as const };
    return p;
  });

  const partial: TournamentRow = {
    ...t,
    bracket: updatedBracket,
    players: updatedPlayers,
    updated_at: now(),
  };

  // check if all matches in current round are done
  const currentRound = updatedBracket.find((r) => r.round === t.current_round)!;
  const allDone = currentRound.matches.every((m) => m.state === "done");

  if (allDone) {
    await advanceRoundFb(partial);
  } else {
    saveT(partial);
  }
}

// ─── Advance Round ────────────────────────────────────────────────────────
async function advanceRoundFb(t: TournamentRow): Promise<void> {
  const currentRound = t.bracket.find((r) => r.round === t.current_round)!;

  // count remaining active players (winners + bye)
  const winners = currentRound.matches
    .filter((m) => m.winner_id !== null)
    .map((m) => ({ id: m.winner_id!, name: m.winner_name! }));

  if (currentRound.bye_player_id) {
    winners.push({ id: currentRound.bye_player_id, name: currentRound.bye_player_name! });
  }

  // ── CHAMPION: only 1 winner left ───────────────────────────────────────
  if (winners.length === 1) {
    const champion = winners[0]!;
    const finished: TournamentRow = {
      ...t,
      state: "finished",
      champion_id: champion.id,
      champion_name: champion.name,
      updated_at: now(),
    };
    saveT(finished);
    return;
  }

  // ── Build next round ───────────────────────────────────────────────────
  const nextRoundNum = t.current_round + 1;
  const nextRound = buildNextRound(currentRound, nextRoundNum);

  // create rooms for next round matches
  const nextMatches = await Promise.all(
    nextRound.matches.map(async (match) => {
      const { code } = await createRoomFb(t.mode, match.player1_name, match.player1_id, t.auction_type);
      return { ...match, room_code: code, state: "active" as const };
    })
  );

  const nextRoundFinal: BracketRound = { ...nextRound, matches: nextMatches };

  // update players' current rooms + bye status
  const updatedPlayers = t.players.map((p) => {
    if (p.status === "eliminated") return p;
    if (p.id === nextRoundFinal.bye_player_id) {
      return { ...p, status: "bye" as const, current_room: null };
    }
    const match = nextMatches.find(
      (m) => m.player1_id === p.id || m.player2_id === p.id
    );
    if (match) return { ...p, current_room: match.room_code, status: "active" as const };
    // was a bye last round, now spectating until matched
    return { ...p, status: "spectating" as const, current_room: null };
  });

  const updated: TournamentRow = {
    ...t,
    bracket: [...t.bracket, nextRoundFinal],
    current_round: nextRoundNum,
    players: updatedPlayers,
    updated_at: now(),
  };

  saveT(updated);
}

// ─── Get Active Spectator Rooms ────────────────────────────────────────────
/** يرجع قائمة المباريات الجارية في الجولة الحالية للمتفرجين */
export function getActiveRoomsForSpectator(t: TournamentRow): {
  room_code: string;
  player1_name: string;
  player2_name: string;
}[] {
  const currentRound = t.bracket.find((r) => r.round === t.current_round);
  if (!currentRound) return [];
  return currentRound.matches
    .filter((m) => m.state === "active" && m.room_code)
    .map((m) => ({
      room_code: m.room_code!,
      player1_name: m.player1_name,
      player2_name: m.player2_name,
    }));
}
