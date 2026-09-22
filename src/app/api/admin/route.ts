import { getSessionUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/admins";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GIVEAWAY_FIELDS = [
  "title", "description", "highlight_text", "highlight_color", "coins_cost", "subtitle",
  "prize_label", "shipping_text", "prize_value", "draw_date", "login_text", "image_url",
  "detail_image_url", "type", "status", "is_daily_highlight", "response_seconds",
] as const;

const PARTICIPANT_FIELDS = ["status", "twitch_username", "coins_used"] as const;

function pick(source: any, fields: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (source && f in source) out[f] = source[f];
  return out;
}

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

// Todas as escritas do painel passam por aqui: confere no servidor se quem
// chama é admin antes de usar a service role.
export async function POST(request: Request) {
  const username = await getSessionUsername();
  if (!isAdmin(username)) return fail("Acesso negado.", 403);

  const body = await request.json().catch(() => null);
  const action = body?.action as string | undefined;
  const db = supabaseAdmin;

  switch (action) {
    case "listParticipants": {
      const { data, error } = await db
        .from("participants")
        .select("*")
        .eq("giveaway_id", body.giveawayId)
        .order("created_at", { ascending: true });
      if (error) return fail(error.message, 500);
      return Response.json({ data });
    }

    case "participantCounts": {
      const { data, error } = await db.from("participants").select("giveaway_id");
      if (error) return fail(error.message, 500);
      const counts: Record<string, number> = {};
      for (const p of data ?? []) counts[p.giveaway_id] = (counts[p.giveaway_id] || 0) + 1;
      return Response.json({ data: counts });
    }

    case "updateParticipant": {
      const fields = pick(body.fields, PARTICIPANT_FIELDS);
      if (typeof fields.twitch_username === "string") {
        fields.twitch_username = fields.twitch_username.trim().replace(/^@/, "").toLowerCase();
      }
      const { error } = await db.from("participants").update(fields).eq("id", body.id);
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }

    case "saveGiveaway": {
      const fields = pick(body.fields, GIVEAWAY_FIELDS);
      if (fields.is_daily_highlight === true) {
        // Só pode existir um sorteio diário ativo por vez.
        await db.from("giveaways").update({ is_daily_highlight: false }).eq("is_daily_highlight", true);
      }
      const query = body.id
        ? db.from("giveaways").update(fields).eq("id", body.id)
        : db.from("giveaways").insert(fields);
      const { error } = await query;
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }

    case "deleteGiveaway": {
      const { error } = await db.from("giveaways").delete().eq("id", body.id);
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }

    case "setFeatured": {
      await db.from("giveaways").update({ type: "monthly" }).eq("type", "featured");
      if (body.on) {
        const { error } = await db.from("giveaways").update({ type: "featured" }).eq("id", body.id);
        if (error) return fail(error.message, 500);
      }
      return Response.json({ ok: true });
    }

    case "setDailyHighlight": {
      await db.from("giveaways").update({ is_daily_highlight: false }).eq("is_daily_highlight", true);
      if (body.on) {
        const { error } = await db.from("giveaways").update({ is_daily_highlight: true }).eq("id", body.id);
        if (error) return fail(error.message, 500);
      }
      return Response.json({ ok: true });
    }

    case "completeGiveaway": {
      const { error } = await db
        .from("giveaways")
        .update({ status: "completed", is_daily_highlight: false })
        .eq("id", body.id);
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }

    case "insertWinner": {
      const { data, error } = await db
        .from("winners")
        .insert({
          giveaway_id: body.giveawayId ?? null,
          twitch_username: body.twitchUsername,
          prize: String(body.prize ?? "").replace(/\s*\|\s*/g, " "),
          in_hall_of_fame: false,
        })
        .select()
        .single();
      if (error) return fail(error.message, 500);
      return Response.json({ data });
    }

    case "setHallOfFame": {
      const { error } = await db.from("winners").update({ in_hall_of_fame: !!body.value }).eq("id", body.id);
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }

    case "chatEntry": {
      // Entrada vinda do chat da Twitch (!comando) para o sorteio diário ativo.
      const chatUser = String(body.username || "").toLowerCase();
      const chances = Math.max(1, Math.floor(Number(body.chances) || 1));
      if (!chatUser) return fail("Usuário inválido.");

      const { data: daily } = await db
        .from("giveaways")
        .select("id")
        .eq("is_daily_highlight", true)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!daily) return Response.json({ ok: false, reason: "no-daily" });

      const { data: existing } = await db
        .from("participants")
        .select("id")
        .eq("giveaway_id", daily.id)
        .eq("twitch_username", chatUser)
        .maybeSingle();
      if (existing) return Response.json({ ok: true, duplicate: true });

      const { error } = await db.from("participants").insert({
        giveaway_id: daily.id,
        twitch_username: chatUser,
        coins_used: chances,
        status: "approved",
      });
      // 23505 = violou o unique (giveaway_id, twitch_username): já estava inscrito
      if (error?.code === "23505") return Response.json({ ok: true, duplicate: true });
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }

    default:
      return fail("Ação desconhecida.");
  }
}
