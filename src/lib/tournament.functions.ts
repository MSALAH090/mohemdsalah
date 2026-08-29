import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createTournamentFb,
  joinTournamentFb,
  startTournamentFb,
  reportMatchResultFb,
} from "./tournament-engine";

// ─── Create Tournament ────────────────────────────────────────────────────
export const createTournament = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      name: z.string().min(2).max(30),
      mode: z.enum(["5", "11"]),
      auctionType: z.enum(["blind", "live"]).optional(),
      hostId: z.string().min(6),
      hostName: z.string().min(1).max(20),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    return createTournamentFb(
      data.hostId,
      data.hostName,
      data.name,
      data.mode,
      data.auctionType ?? "blind"
    );
  });

// ─── Join Tournament ──────────────────────────────────────────────────────
export const joinTournament = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      id: z.string().min(2).max(10),
      playerId: z.string().min(6),
      playerName: z.string().min(1).max(20),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    return joinTournamentFb(data.id, data.playerId, data.playerName);
  });

// ─── Start Tournament ─────────────────────────────────────────────────────
export const startTournament = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      id: z.string().min(2).max(10),
      hostId: z.string().min(6),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    await startTournamentFb(data.id, data.hostId);
    return { ok: true };
  });

// ─── Report Match Result ──────────────────────────────────────────────────
export const reportTournamentMatch = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      tournamentId: z.string().min(2).max(10),
      roomCode: z.string().length(4),
      winnerId: z.string().min(6),
      winnerName: z.string().min(1).max(20),
      loserId: z.string().min(6),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    await reportMatchResultFb(
      data.tournamentId,
      data.roomCode,
      data.winnerId,
      data.winnerName,
      data.loserId
    );
    return { ok: true };
  });
