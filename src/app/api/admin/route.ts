import { getSessionUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/admins";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchTwitchAvatar } from "@/lib/twitch";
import { chancesFor } from "@/lib/daily";

const GIVEAWAY_FIELDS = [
  "title", "description", "highlight_text", "highlight_color", "coins_cost", "subtitle",
  "prize_label", "shipping_text", "prize_value", "draw_date", "login_text", "image_url",
  "featured_image_url", "detail_image_url", "type", "status", "is_daily_highlight", "response_seconds",
  "capture_open", "bot_command", "twitch_channel", "chance_t1", "chance_t2", "chance_t3",
] as const;

// O que pode ser alterado com o sorteio diário já rodando
const DAILY_LIVE_FIELDS = ["response_seconds", "capture_open", "chance_t1", "chance_t2", "chance_t3"] as const;

const DAILY_COLUMNS =
  "id, title, image_url, status, capture_open, bot_command, twitch_channel, response_seconds, chance_t1, chance_t2, chance_t3, created_at";

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
        .update({ status: "completed", is_daily_highlight: false, capture_open: false })
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

    case "listDailyWinners": {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await db
        .from("winners")
        .select("id, giveaway_id, twitch_username, prize, avatar_url, won_at, giveaways!inner(type)")
        .eq("giveaways.type", "daily")
        .gte("won_at", since)
        .order("won_at", { ascending: false });
      if (error) return fail(error.message, 500);
      return Response.json({ data });
    }

    case "deleteWinner": {
      // Remove um ganhador confirmado por engano; opcionalmente reabre o sorteio do dia
      const { data: winner } = await db.from("winners").select("id, giveaway_id").eq("id", body.id).maybeSingle();
      if (!winner) return fail("Ganhador não encontrado.", 404);

      if (body.reopen && winner.giveaway_id) {
        const { data: otherActive } = await db
          .from("giveaways")
          .select("id")
          .eq("type", "daily")
          .eq("status", "active")
          .neq("id", winner.giveaway_id)
          .limit(1)
          .maybeSingle();
        if (otherActive) return fail("Já existe um sorteio diário aberto. Encerre ele antes de reabrir este.");
      }

      const { error } = await db.from("winners").delete().eq("id", winner.id);
      if (error) return fail(error.message, 500);

      if (body.reopen && winner.giveaway_id) {
        const { error: reopenError } = await db
          .from("giveaways")
          .update({ status: "active", is_daily_highlight: true, capture_open: false })
          .eq("id", winner.giveaway_id);
        if (reopenError) return fail(reopenError.message, 500);
      } else if (winner.giveaway_id) {
        // Sorteio diário sem ganhador não fica guardado: apaga ele e a lista de participantes
        await db.from("giveaways").delete().eq("id", winner.giveaway_id).eq("type", "daily");
      }
      return Response.json({ ok: true, reopened: !!(body.reopen && winner.giveaway_id) });
    }

    case "getActiveDaily": {
      const { data, error } = await db
        .from("giveaways")
        .select(DAILY_COLUMNS)
        .eq("type", "daily")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return fail(error.message, 500);
      return Response.json({ data });
    }

    case "startDaily": {
      // Cria o sorteio da live já com a captação aberta
      const f = body.fields ?? {};
      const title = String(f.title || "").trim();
      if (!title) return fail("Informe o prêmio do sorteio.");
      await db.from("giveaways").update({ is_daily_highlight: false, capture_open: false }).eq("is_daily_highlight", true);
      const { data, error } = await db
        .from("giveaways")
        .insert({
          title,
          image_url: f.image_url || null,
          bot_command: String(f.bot_command || "!sorteio").trim().toLowerCase(),
          twitch_channel: String(f.twitch_channel || "").trim().replace(/^#/, "").toLowerCase(),
          response_seconds: Math.max(5, Math.floor(Number(f.response_seconds) || 60)),
          chance_t1: Math.max(1, Math.floor(Number(f.chance_t1) || 1)),
          chance_t2: Math.max(1, Math.floor(Number(f.chance_t2) || 1)),
          chance_t3: Math.max(1, Math.floor(Number(f.chance_t3) || 1)),
          type: "daily",
          status: "active",
          is_daily_highlight: true,
          capture_open: true,
        })
        .select(DAILY_COLUMNS)
        .single();
      if (error) return fail(error.message, 500);
      return Response.json({ data });
    }

    case "updateDaily": {
      const fields = pick(body.fields, DAILY_LIVE_FIELDS);
      const { data, error } = await db.from("giveaways").update(fields).eq("id", body.id).select(DAILY_COLUMNS).single();
      if (error) return fail(error.message, 500);
      return Response.json({ data });
    }

    case "chatEntry": {
      // Entrada vinda do chat da Twitch (!comando) no sorteio da live
      const chatUser = String(body.username || "").toLowerCase();
      const tier = [0, 1, 2, 3].includes(Number(body.tier)) ? Number(body.tier) : 0;
      if (!chatUser) return fail("Usuário inválido.");

      const { data: daily } = await db
        .from("giveaways")
        .select("id, status, capture_open, chance_t1, chance_t2, chance_t3")
        .eq("id", body.giveawayId)
        .maybeSingle();
      if (!daily || daily.status !== "active") return Response.json({ ok: false, reason: "no-daily" });
      if (!daily.capture_open) return Response.json({ ok: false, reason: "closed" });

      const { data: existing } = await db
        .from("participants")
        .select("id")
        .eq("giveaway_id", daily.id)
        .eq("twitch_username", chatUser)
        .maybeSingle();
      if (existing) return Response.json({ ok: true, duplicate: true });

      const { data, error } = await db
        .from("participants")
        .insert({
          giveaway_id: daily.id,
          twitch_username: chatUser,
          sub_tier: tier,
          coins_used: chancesFor(tier, daily),
          avatar_url: await fetchTwitchAvatar(chatUser),
          status: "approved",
        })
        .select()
        .single();
      // 23505 = violou o unique (giveaway_id, twitch_username): já estava inscrito
      if (error?.code === "23505") return Response.json({ ok: true, duplicate: true });
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true, data });
    }

    case "finishDaily": {
      // Confirma o ganhador: vai para o histórico e o sorteio do dia é encerrado
      const { data: participant } = await db
        .from("participants")
        .select("twitch_username, avatar_url, giveaway_id")
        .eq("id", body.participantId)
        .maybeSingle();
      const { data: daily } = await db.from("giveaways").select("id, title").eq("id", body.giveawayId).maybeSingle();
      if (!participant || !daily || participant.giveaway_id !== daily.id) return fail("Participante ou sorteio inválido.");

      const { error } = await db.from("winners").insert({
        giveaway_id: daily.id,
        twitch_username: participant.twitch_username,
        avatar_url: participant.avatar_url,
        prize: daily.title.replace(/\s*\|\s*/g, " "),
      });
      if (error) return fail(error.message, 500);
      await db
        .from("giveaways")
        .update({ status: "completed", capture_open: false, is_daily_highlight: false })
        .eq("id", daily.id);
      return Response.json({ ok: true });
    }

    default:
      return fail("Ação desconhecida.");
  }
}
