import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MASK = "__opponent__";

/**
 * Public (unauthenticated) room state read.
 * The `rooms` table is no longer readable by anon/authenticated clients:
 * all reads go through here so that opponent identifiers are masked and
 * only participants-relevant data leaves the server.
 */
export const getRoomState = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        code: z.string().trim().length(4),
        playerId: z.string().min(6).max(64),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.toUpperCase();
    const { data: row, error } = await supabaseAdmin
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (error) throw new Error("تعذر تحميل الغرفة");
    if (!row) return { room: null as null };

    const viewer = data.playerId;
    const isHost = row.host_id === viewer;
    const isGuest = row.guest_id === viewer;

    return {
      room: {
        ...row,
        host_id: isHost ? viewer : MASK,
        guest_id: row.guest_id ? (isGuest ? viewer : MASK) : null,
      },
    };
  });
