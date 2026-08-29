import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().min(2).max(30),
    mode: z.enum(["5", "11"]),
    auctionType: z.enum(["blind", "live"]).optional(),
    hostId: z.string().min(6).max(100),
    hostName: z.string().min(1).max(20),
  }),
  z.object({
    action: z.literal("join"),
    id: z.string().min(2).max(10),
    playerId: z.string().min(6).max(100),
    playerName: z.string().min(1).max(20),
  }),
  z.object({
    action: z.literal("start"),
    id: z.string().min(2).max(10),
    hostId: z.string().min(6).max(100),
  }),
  z.object({
    action: z.literal("report"),
    tournamentId: z.string().min(2).max(10),
    roomCode: z.string().length(4),
    winnerId: z.string().min(6).max(100),
    winnerName: z.string().min(1).max(20),
    loserId: z.string().min(6).max(100),
  }),
]);

export const Route = createFileRoute("/api/public/tournament-access")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data = requestSchema.parse(await request.json());
          const engine = await import("@/lib/tournament-engine");

          let result: unknown;
          if (data.action === "create") {
            result = await engine.createTournamentFb(
              data.hostId, data.hostName, data.name, data.mode, data.auctionType ?? "blind"
            );
          } else if (data.action === "join") {
            result = await engine.joinTournamentFb(data.id, data.playerId, data.playerName);
          } else if (data.action === "start") {
            await engine.startTournamentFb(data.id, data.hostId);
            result = { ok: true };
          } else {
            await engine.reportMatchResultFb(
              data.tournamentId, data.roomCode, data.winnerId, data.winnerName, data.loserId
            );
            result = { ok: true };
          }

          return Response.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "تعذر تنفيذ الطلب";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
