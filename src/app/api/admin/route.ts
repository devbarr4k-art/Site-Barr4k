import { getSessionUsername } from "@/lib/auth";
import { isAdmin } from "@/lib/admins";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchTwitchAvatars } from "@/lib/twitch";
import { addChatEntry } from "@/lib/dailyEntry";
import { serverCaptureStatus, startServerCapture, stopServerCapture } from "@/lib/eventsub";

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
  const origin = new URL(request.url).origin;

  // Desliga a escuta do chat pelo servidor quando um sorteio diário fecha, mas só se
  // não houver outro sorteio captando no mesmo canal (ex.: excluir ganhador antigo durante a live)
  const stopCaptureIfIdle = async (id: string | null) => {
    if (!id) return;
    const { data } = await db.from("giveaways").select("type, twitch_channel").eq("id", id).maybeSingle();
    if (data?.type !== "daily" || !data.twitch_channel) return;
    const { data: other } = await db
      .from("giveaways")
      .select("id")
      .eq("type", "daily")
      .eq("status", "active")
      .eq("capture_open", true)
      .eq("twitch_channel", data.twitch_channel)
      .neq("id", id)
      .limit(1)
      .maybeSingle();
    if (!other) await stopServerCapture(data.twitch_channel);
  };

  switch (action) {
    case "listParticipants": {
      // Comprovantes (imagens) só vêm quando pedidos: o painel da live consulta a cada 3s e não usa
      const columns = body.withProof
        ? "*"
        : "id, giveaway_id, twitch_username, coins_used, casa_id, sub_tier, avatar_url, status, created_at";
      const { data, error } = await db
        .from("participants")
        .select(columns)
        .eq("giveaway_id", body.giveawayId)
        .order("created_at", { ascending: true });
      if (error) return fail(error.message, 500);
      const rows = (data ?? []) as unknown as { id: string; twitch_username: string; avatar_url: string | null }[];

      // Quem entrou sem foto (inscrições antigas): busca na Twitch e guarda
      const missing = rows.filter((p) => !p.avatar_url);
      if (missing.length > 0) {
        const avatars = await fetchTwitchAvatars(missing.map((p) => p.twitch_username));
        await Promise.all(
          missing
            .filter((p) => avatars[p.twitch_username])
            .map((p) => {
              p.avatar_url = avatars[p.twitch_username];
              return db.from("participants").update({ avatar_url: p.avatar_url }).eq("id", p.id);
            })
        );
      }
      return Response.json({ data: rows });
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

    case "deleteParticipant": {
      const { error } = await db.from("participants").delete().eq("id", body.id);
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
      await stopCaptureIfIdle(body.id);
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
      await stopCaptureIfIdle(body.id);
      const { error } = await db
        .from("giveaways")
        .update({ status: "completed", is_daily_highlight: false, capture_open: false })
        .eq("id", body.id);
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }

    case "createUploadUrl": {
      // Link assinado para o painel enviar a imagem direto ao Storage, em qualidade original
      const ext = String(body.ext || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
      const path = `premios/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await db.storage.from("giveaways").createSignedUploadUrl(path);
      if (error) return fail(error.message, 500);
      const { data: pub } = db.storage.from("giveaways").getPublicUrl(path);
      return Response.json({ path, token: data.token, publicUrl: pub.publicUrl });
    }

    case "reopenGiveaway": {
      // Volta um sorteio encerrado ao ar até a nova data escolhida pelo streamer
      const drawDate = new Date(body.drawDate);
      if (isNaN(drawDate.getTime()) || drawDate.getTime() <= Date.now()) {
        return fail("Escolha uma data e hora no futuro.");
      }
      const { error } = await db
        .from("giveaways")
        .update({ status: "active", draw_date: drawDate.toISOString() })
        .eq("id", body.id)
        .neq("type", "daily");
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }

    case "insertWinner": {
      const { data, error } = await db
        .from("winners")
        .insert({
          giveaway_id: body.giveawayId ?? null,
          twitch_username: body.twitchUsername,
          avatar_url: body.avatarUrl ?? null,
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
        await stopCaptureIfIdle(winner.giveaway_id);
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
      // Liga a escuta do chat pelo servidor (segue captando com o painel fechado)
      const serverCapture = data.twitch_channel ? await startServerCapture(data.twitch_channel, origin) : "error";
      return Response.json({ data, serverCapture });
    }

    case "updateDaily": {
      const fields = pick(body.fields, DAILY_LIVE_FIELDS);
      const { data, error } = await db.from("giveaways").update(fields).eq("id", body.id).select(DAILY_COLUMNS).single();
      if (error) return fail(error.message, 500);
      // Pausar/voltar a captação liga e desliga a escuta do chat pelo servidor
      let serverCapture: string | undefined;
      if (fields.capture_open === true && data.twitch_channel) {
        serverCapture = await startServerCapture(data.twitch_channel, origin);
      } else if (fields.capture_open === false) {
        await stopServerCapture(data.twitch_channel);
        serverCapture = "off";
      }
      return Response.json({ data, serverCapture });
    }

    case "serverCapture": {
      // Situação da captação pelo servidor; com retry=true tenta ligar de novo
      const { data: daily } = await db.from("giveaways").select(DAILY_COLUMNS).eq("id", body.id).maybeSingle();
      if (!daily?.twitch_channel) return Response.json({ status: "off" });
      if (body.retry && daily.capture_open) {
        return Response.json({ status: await startServerCapture(daily.twitch_channel, origin) });
      }
      return Response.json({ status: await serverCaptureStatus(daily.twitch_channel) });
    }

    case "chatEntry": {
      // Entrada vinda do chat da Twitch (!comando), lida pelo painel aberto
      const chatUser = String(body.username || "");
      if (!chatUser) return fail("Usuário inválido.");
      const result = await addChatEntry(String(body.giveawayId || ""), chatUser, Number(body.tier) || 0);
      if (!result.ok && result.reason === "error") return fail(result.message || "Erro ao registrar entrada.", 500);
      return Response.json(result);
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
      await stopCaptureIfIdle(daily.id);
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
