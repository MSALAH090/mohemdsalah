import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    mode: z.enum(["5", "11"]),
    auctionType: z.enum(["blind", "live"]).optional(),
    name: z.string().min(1).max(20),
    playerId: z.string().min(6).max(100),
  }),
  z.object({
    action: z.literal("join"),
    code: z.string().length(4),
    name: z.string().min(1).max(20),
    playerId: z.string().min(6).max(100),
  }),
]);

export const Route = createFileRoute("/api/public/room-access")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const data = requestSchema.parse(await request.json());
          const access = await import("@/lib/room-access.server");
          const result =
            data.action === "create"
              ? await access.createRoomDirect(data)
              : await access.joinRoomDirect(data);
          return Response.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "تعذر تنفيذ الطلب";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});