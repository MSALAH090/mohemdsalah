import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as Fb from "./firebase-engine";

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        mode: z.enum(["5", "11"]),
        auctionType: z.enum(["blind", "live"]).optional(),
        name: z.string().min(1).max(20),
        playerId: z.string().min(6),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return Fb.createRoomFb(data.mode, data.name, data.playerId, data.auctionType ?? "blind");
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ code: z.string().length(4), name: z.string().min(1).max(20), playerId: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data }) => {
    return Fb.joinRoomFb(data.code, data.name, data.playerId);
  });

export const startGame = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().length(4), playerId: z.string().min(6) }).parse(d))
  .handler(async ({ data }) => {
    const room = await Fb.fetchRoom(data.code);
    if (room.host_id !== data.playerId) throw new Error("صاحب الغرفة فقط يبدأ اللعبة");
    if (!room.guest_id) throw new Error("في انتظار انضمام الخصم");
    if (room.state !== "waiting") return { ok: true };
    await Fb.beginRoundFb(room, 1);
    return { ok: true };
  });

export const submitBid = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({ code: z.string().length(4), playerId: z.string().min(6), amount: z.number().int().min(0).max(1000) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await Fb.submitBidFb(data.code, data.playerId, data.amount);
    return { ok: true };
  });

export const resolveRound = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().length(4) }).parse(d))
  .handler(async ({ data }) => {
    await Fb.resolveRoundFb(data.code.toUpperCase());
    return { ok: true };
  });

export const nextRound = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().length(4), playerId: z.string().min(6) }).parse(d))
  .handler(async ({ data }) => {
    await Fb.nextRoundFb(data.code, data.playerId);
    return { ok: true };
  });

export const startMatch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().length(4), playerId: z.string().min(6) }).parse(d))
  .handler(async ({ data }) => {
    await Fb.startMatchFb(data.code, data.playerId);
    return { ok: true };
  });

export const rematch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().length(4), playerId: z.string().min(6) }).parse(d))
  .handler(async ({ data }) => {
    await Fb.rematchFb(data.code, data.playerId);
    return { ok: true };
  });

export const usePower = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        code: z.string().length(4),
        playerId: z.string().min(6),
        power: z.enum([
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
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const res = await Fb.usePowerFb(data.code, data.playerId, data.power);
    return { ok: true, hint: res?.hint };
  });

export const setTactic = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        code: z.string().length(4),
        playerId: z.string().min(6),
        tactic: z.enum(["attack", "balanced", "defend"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await Fb.setTacticFb(data.code, data.playerId, data.tactic);
    return { ok: true };
  });

export const setPlayStyle = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        code: z.string().length(4),
        playerId: z.string().min(6),
        style: z.enum(["counter", "long_ball", "possession", "crosses", "longshots"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await Fb.setPlayStyleFb(data.code, data.playerId, data.style);
    return { ok: true };
  });

export const setFormation = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        code: z.string().length(4),
        playerId: z.string().min(6),
        spots: z.record(z.any()).optional(),
        formation: z.record(z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const spots = data.spots || data.formation || {};
    await Fb.setFormationFb(data.code, data.playerId, spots);
    return { ok: true };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().length(4), playerId: z.string().min(6) }).parse(d))
  .handler(async ({ data }) => {
    return { ok: true };
  });

export const quickMatch = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        mode: z.enum(["5", "11"]),
        auctionType: z.enum(["blind", "live"]).optional(),
        name: z.string().min(1).max(20),
        playerId: z.string().min(6),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return Fb.quickMatchFb(data.mode, data.name, data.playerId, data.auctionType ?? "blind");
  });

export const playVsBot = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        mode: z.enum(["5", "11"]),
        auctionType: z.enum(["blind", "live"]).optional(),
        name: z.string().min(1).max(20),
        playerId: z.string().min(6),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return Fb.createBotRoomFb(data.mode, data.name, data.playerId, data.auctionType ?? "blind");
  });

export const triggerBotBid = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().length(4) }).parse(d))
  .handler(async ({ data }) => {
    await Fb.botSubmitBidFb(data.code);
    return { ok: true };
  });

export const liveBid = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        code: z.string().length(4),
        playerId: z.string().min(6),
        amount: z.number().int().min(1).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await Fb.liveBidFb(data.code, data.playerId, data.amount);
    return { ok: true };
  });

export const passBid = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().length(4), playerId: z.string().min(6) }).parse(d))
  .handler(async ({ data }) => {
    await Fb.passBidFb(data.code, data.playerId);
    return { ok: true };
  });
