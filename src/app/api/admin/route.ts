import { getSessionUsername, getSessionAccessToken } from "@/lib/auth";
import { isAdmin } from "@/lib/admins";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchTwitchAvatar, fetchTwitchAvatars, checkTwitchSubscriptions } from "@/lib/twitch";
import { addChatEntry } from "@/lib/dailyEntry";
import { chancesFor } from "@/lib/daily";
import { PROOFS_BUCKET, removeProofs, signProofs } from "@/lib/proofs";
import { expireHolds, isMissingTable, MISSING_RAFFLES, RAFFLE_COLUMNS, takenByRaffle, withCounts } from "@/lib/rifasServer";
import { MAX_RAFFLE_NUMBERS, type Raffle } from "@/lib/rifas";
import { isValidEmail, normalizeWhatsapp } from "@/lib/siteUsers";
import { isShortsLink, parseYouTubeId, VIDEOS_VISIBILITY_KEY } from "@/lib/videos";
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

const PARTICIPANT_FIELDS = ["status", "twitch_username", "coins_used", "sub_tier"] as const;


const MISSING_TABLE = "Falta rodar o SQL supabase/migracao-usuarios-e-parceiros.sql no Supabase.";
const MISSING_VIDEOS_ORDER = "Para salvar a ordem, rode no Supabase: alter table public.videos add column if not exists sort_order integer;";
const MISSING_SETTINGS_TABLE = "Falta rodar o SQL supabase/migracao-configuracoes.sql no Supabase.";
const MISSING_VIDEOS_TABLE = "Falta rodar o SQL supabase/migracao-videos.sql no Supabase.";

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
      let rows = (data ?? []) as unknown as { id: string; twitch_username: string; avatar_url: string | null; proof_url?: string | null }[];
      if (body.withProof) rows = await signProofs(rows);

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
      if (typeof fields.sub_tier === "number" && fields.sub_tier >= 0 && fields.sub_tier <= 3 && !("coins_used" in fields)) {
        const { data: part } = await db.from("participants").select("giveaway_id").eq("id", body.id).maybeSingle();
        if (part?.giveaway_id) {
          const { data: g } = await db.from("giveaways").select("chance_t1, chance_t2, chance_t3").eq("id", part.giveaway_id).maybeSingle();
          if (g) fields.coins_used = chancesFor(fields.sub_tier, g);
        }
      }
      const { error } = await db.from("participants").update(fields).eq("id", body.id);
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }


    case "deleteParticipant": {
      const { data: removed, error } = await db.from("participants").delete().eq("id", body.id).select("proof_url");
      if (error) return fail(error.message, 500);
      await removeProofs((removed ?? []).map((p) => p.proof_url));
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
      // Os participantes saem em cascata; os comprovantes no Storage precisam ser apagados à parte
      const { data: proofs } = await db.from("participants").select("proof_url").eq("giveaway_id", body.id);
      const { error } = await db.from("giveaways").delete().eq("id", body.id);
      if (error) return fail(error.message, 500);
      await removeProofs((proofs ?? []).map((p) => p.proof_url));
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

    case "addWinnerManual": {
      // Vencedor lançado à mão pelo painel (sem passar pela roleta)
      const username = String(body.twitchUsername ?? "").trim().replace(/^@/, "").toLowerCase();
      const prize = String(body.prize ?? "").trim().replace(/\s*\|\s*/g, " ");
      if (!/^[a-z0-9_]{3,25}$/.test(username)) return fail("Nick da Twitch inválido (só letras, números e _).");
      if (!prize) return fail("Preencha o prêmio.");
      const wonAt = body.wonAt ? new Date(body.wonAt) : new Date();
      if (Number.isNaN(wonAt.getTime())) return fail("Data inválida.");
      const { data, error } = await db
        .from("winners")
        .insert({
          twitch_username: username,
          prize,
          avatar_url: await fetchTwitchAvatar(username),
          image_url: typeof body.imageUrl === "string" && body.imageUrl ? body.imageUrl : null,
          in_hall_of_fame: !!body.inHall,
          won_at: wonAt.toISOString(),
        })
        .select()
        .single();
      if (error) return fail(error.message, 500);
      return Response.json({ data });
    }

    case "updateWinner": {
      // Texto do prêmio e imagem do vencedor (aparecem assim no Hall da Fama)
      const fields: Record<string, unknown> = {};
      if (typeof body.prize === "string") {
        const prize = body.prize.trim();
        if (!prize) return fail("O prêmio não pode ficar vazio.");
        fields.prize = prize;
      }
      if ("imageUrl" in body) fields.image_url = body.imageUrl || null;
      const { error } = await db.from("winners").update(fields).eq("id", body.id);
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
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
          response_seconds: Math.max(5, Math.floor(Number(f.response_seconds) || 30)),
          chance_t1: Math.max(1, Math.floor(Number(f.chance_t1) || 4)),
          chance_t2: Math.max(1, Math.floor(Number(f.chance_t2) || 6)),
          chance_t3: Math.max(1, Math.floor(Number(f.chance_t3) || 10)),
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

    case "refreshDailySubs": {
      const giveawayId = String(body.giveawayId || "");
      if (!giveawayId) return fail("ID do sorteio inválido.");

      const { data: daily } = await db
        .from("giveaways")
        .select("id, twitch_channel, chance_t1, chance_t2, chance_t3")
        .eq("id", giveawayId)
        .maybeSingle();
      if (!daily || !daily.twitch_channel) return fail("Sorteio ou canal não encontrado.");

      const { data: participants, error: pErr } = await db
        .from("participants")
        .select("id, twitch_username, sub_tier")
        .eq("giveaway_id", daily.id);
      if (pErr) return fail(pErr.message, 500);
      if (!participants || participants.length === 0) {
        return Response.json({ ok: true, updatedCount: 0, participants: [] });
      }

      const token = await getSessionAccessToken();
      if (!token) {
        return Response.json(
          {
            ok: false,
            needsAuth: true,
            error: "Conecte o canal da Twitch para autorizar a consulta automática de subs pela API.",
          },
          { status: 400 }
        );
      }

      const result = await checkTwitchSubscriptions(
        daily.twitch_channel,
        participants.map((p) => p.twitch_username),
        token
      );
      if (!result.ok) {
        return Response.json(
          {
            ok: false,
            needsAuth: !!result.needsAuth,
            error: result.message || "Erro ao consultar subs na Twitch.",
          },
          { status: 400 }
        );
      }

      const subMap = result.subs;
      let updatedCount = 0;
      await Promise.all(
        participants.map(async (p) => {
          const newTier = subMap[p.twitch_username.toLowerCase()] ?? 0;
          if (newTier !== p.sub_tier) {
            const newChances = chancesFor(newTier, daily);
            await db
              .from("participants")
              .update({ sub_tier: newTier, coins_used: newChances })
              .eq("id", p.id);
            updatedCount++;
          }
        })
      );

      const { data: updatedList } = await db
        .from("participants")
        .select("id, giveaway_id, twitch_username, coins_used, sub_tier, avatar_url, status, created_at")
        .eq("giveaway_id", daily.id)
        .order("created_at", { ascending: true });

      return Response.json({ ok: true, updatedCount, participants: updatedList ?? [] });
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

    // ---- Usuários cadastrados no site ----
    case "listSiteUsers": {
      const { data, error } = await db.from("site_users").select("*").order("created_at", { ascending: false });
      if (error) return fail(MISSING_TABLE, 500);
      return Response.json({ data: data ?? [] });
    }

    case "updateSiteUser": {
      const whatsapp = normalizeWhatsapp(body.whatsapp);
      const email = String(body.email || "").trim().toLowerCase();
      if (!whatsapp) return fail("WhatsApp inválido (use DDD + número).");
      if (!isValidEmail(email)) return fail("E-mail inválido.");
      const { error } = await db.from("site_users").update({ whatsapp, email }).eq("twitch_username", body.username);
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true, whatsapp, email });
    }

    case "deleteSiteUser": {
      const { error } = await db.from("site_users").delete().eq("twitch_username", body.username);
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }

    // ---- Vídeos do YouTube (seção da home) ----
    case "youtubeInfo": {
      // Título pelo oEmbed (sem chave de API) e a melhor capa disponível
      const link = String(body.url ?? "");
      const id = parseYouTubeId(link);
      if (!id) return fail("Link do YouTube inválido.");
      const exists = async (u: string) => (await fetch(u, { method: "HEAD" }).catch(() => null))?.ok ?? false;
      const [oembed, hasVertical, hasMaxres] = await Promise.all([
        fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        exists(`https://i.ytimg.com/vi/${id}/oardefault.jpg`),
        exists(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`),
      ]);
      if (!oembed) return fail("Não achei esse vídeo no YouTube (ele é privado ou foi apagado?).");
      const kind = body.kind === "short" || body.kind === "video" ? body.kind : isShortsLink(link) ? "short" : "video";
      const thumb = (k: string) =>
        k === "short"
          ? `https://i.ytimg.com/vi/${id}/${hasVertical ? "oardefault" : "hqdefault"}.jpg`
          : `https://i.ytimg.com/vi/${id}/${hasMaxres ? "maxresdefault" : "hqdefault"}.jpg`;
      return Response.json({ youtubeId: id, title: oembed.title as string, kind, thumbnails: { video: thumb("video"), short: thumb("short") } });
    }

    case "saveVideo": {
      const youtubeId = parseYouTubeId(String(body.youtubeId ?? ""));
      const title = String(body.title ?? "").trim().slice(0, 200);
      const kind = body.kind === "short" ? "short" : "video";
      const thumbnailUrl = String(body.thumbnailUrl ?? "").trim();
      const publishedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(body.publishedAt)) ? body.publishedAt : new Date().toISOString().slice(0, 10);
      if (!youtubeId || !title || !thumbnailUrl) return fail("Preencha o link, o título e a capa do vídeo.");
      const fields = {
        kind,
        youtube_id: youtubeId,
        title,
        thumbnail_url: thumbnailUrl,
        duration: kind === "video" ? String(body.duration ?? "").trim().slice(0, 12) || null : null,
        views: String(body.views ?? "").trim().slice(0, 12) || null,
        published_at: publishedAt,
      };
      const { error } = body.id
        ? await db.from("videos").update(fields).eq("id", body.id)
        : await db.from("videos").insert(fields);
      if (error) return fail(error.code === "42P01" || /relation|does not exist|schema cache/i.test(error.message) ? MISSING_VIDEOS_TABLE : error.message, 500);
      return Response.json({ ok: true });
    }

    case "reorderVideos": {
      // ids na ordem nova (de um tipo só); null = volta para a ordem por visualizações
      const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
      const results = await Promise.all(
        ids.map((id, i) => db.from("videos").update({ sort_order: body.reset ? null : i + 1 }).eq("id", id))
      );
      const failed = results.find((r) => r.error)?.error;
      if (failed) return fail(/sort_order/.test(failed.message) ? MISSING_VIDEOS_ORDER : failed.message, 500);
      return Response.json({ ok: true });
    }

    case "setVideosVisibility": {
      const value = { video: body.video !== false, short: body.short !== false };
      const { error } = await db
        .from("site_settings")
        .upsert({ key: VIDEOS_VISIBILITY_KEY, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) return fail(/site_settings|schema cache|does not exist/i.test(error.message) ? MISSING_SETTINGS_TABLE : error.message, 500);
      return Response.json({ ok: true, value });
    }

    // ---- Rifas ----
    case "listRaffles": {
      const { data, error } = await db.from("raffles").select(RAFFLE_COLUMNS).order("created_at", { ascending: false });
      if (error) return fail(MISSING_RAFFLES, 500);
      const raffles = (data ?? []) as Raffle[];
      await expireHolds(raffles.map((r) => r.id));
      const taken = await takenByRaffle(raffles.map((r) => r.id));
      const { data: orders } = await db.from("raffle_orders").select("raffle_id, status, total_cents").in("raffle_id", raffles.map((r) => r.id));
      const stats: Record<string, { pending: number; received_cents: number; awaiting?: number }> = {};
      for (const o of orders ?? []) {
        const s = (stats[o.raffle_id] ??= { pending: 0, received_cents: 0 });
        if (o.status === "pending") s.pending++;
        if (o.status === "awaiting") s.awaiting = (s.awaiting ?? 0) + 1;
        if (o.status === "approved") s.received_cents += o.total_cents;
      }
      return Response.json({
        data: withCounts(raffles, taken).map((r) => ({ ...r, pending_orders: stats[r.id]?.pending ?? 0, awaiting_orders: stats[r.id]?.awaiting ?? 0, received_cents: stats[r.id]?.received_cents ?? 0 })),
      });
    }

    case "saveRaffle": {
      const f = body.fields ?? {};
      const title = String(f.title ?? "").trim().slice(0, 120);
      const price = Math.round(Number(f.price_cents));
      const total = Math.round(Number(f.total_numbers));
      if (!title) return fail("Dê um nome para a rifa.");
      if (!Number.isFinite(price) || price <= 0) return fail("Coloque o valor de cada número.");
      if (!Number.isFinite(total) || total < 1 || total > MAX_RAFFLE_NUMBERS) return fail(`A quantidade de números vai de 1 a ${MAX_RAFFLE_NUMBERS}.`);
      const fields = {
        title,
        subtitle: String(f.subtitle ?? "").trim().slice(0, 200) || null,
        image_url: typeof f.image_url === "string" && f.image_url ? f.image_url : null,
        price_cents: price,
        total_numbers: total,
        draw_date: f.draw_date ? new Date(f.draw_date).toISOString() : null,
        pix_key: String(f.pix_key ?? "").trim().slice(0, 120) || null,
        pix_name: String(f.pix_name ?? "").trim().slice(0, 120) || null,
        qr_image_url: typeof f.qr_image_url === "string" && f.qr_image_url ? f.qr_image_url : null,
        status: f.status === "closed" ? "closed" : "open",
      };
      if (body.id) {
        // Não dá para diminuir a rifa abaixo de um número que já tem dono
        const { data: top } = await db.from("raffle_numbers").select("number").eq("raffle_id", body.id).order("number", { ascending: false }).limit(1).maybeSingle();
        if (top && total < top.number) return fail(`O número ${top.number} já foi escolhido: a rifa precisa ter pelo menos ${top.number} números.`);
        const { error } = await db.from("raffles").update(fields).eq("id", body.id);
        if (error) return fail(error.message, 500);
      } else {
        const { error } = await db.from("raffles").insert(fields);
        if (error) return fail(isMissingTable(error.message) ? MISSING_RAFFLES : error.message, 500);
      }
      return Response.json({ ok: true });
    }

    case "deleteRaffle": {
      // Compras e números saem em cascata; os comprovantes no Storage, à parte
      const { data: orders } = await db.from("raffle_orders").select("proof_paths").eq("raffle_id", body.id);
      const { error } = await db.from("raffles").delete().eq("id", body.id);
      if (error) return fail(error.message, 500);
      await removeProofs((orders ?? []).flatMap((o) => o.proof_paths ?? []));
      return Response.json({ ok: true });
    }

    case "listRaffleOrders": {
      // reservas vencidas saem antes de listar
      const { data: openRaffles } = await db.from("raffles").select("id").eq("status", "open");
      await expireHolds((openRaffles ?? []).map((r) => r.id));
      let query = db
        .from("raffle_orders")
        .select("id, raffle_id, username, numbers, total_cents, proof_paths, status, created_at, decided_at, expires_at, raffles(title)")
        .order("created_at", { ascending: body.status === "pending" })
        .limit(300);
      if (body.status) query = query.eq("status", body.status);
      if (body.raffleId) query = query.eq("raffle_id", body.raffleId);
      const { data, error } = await query;
      if (error) return fail(isMissingTable(error.message) ? MISSING_RAFFLES : error.message, 500);
      // Comprovantes privados: links temporários (1h), todos numa chamada
      const allPaths = (data ?? []).flatMap((o) => o.proof_paths ?? []);
      const signed = new Map<string, string>();
      if (allPaths.length) {
        const { data: urls } = await db.storage.from(PROOFS_BUCKET).createSignedUrls(allPaths, 3600);
        for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
      }
      return Response.json({
        data: (data ?? []).map(({ proof_paths, raffles, ...o }) => ({
          ...o,
          raffle_title: (raffles as unknown as { title?: string } | null)?.title ?? "",
          proofs: (proof_paths ?? []).map((p: string) => signed.get(p)).filter(Boolean),
        })),
      });
    }

    case "setRaffleOrderStatus": {
      const status = String(body.status);
      if (!["pending", "approved", "rejected"].includes(status)) return fail("Status inválido.");
      if (body.raffleId) await expireHolds([body.raffleId]);
      const { error } = await db.rpc("raffle_set_order_status", { p_order: body.id, p_status: status });
      if (error) {
        // Desfazer recusa com números já pegos: o painel abre a troca de números
        const takenBack = error.message.match(/TAKEN:([\d,]+)/);
        if (takenBack) {
          const lost = takenBack[1].split(",").map(Number);
          return Response.json(
            { error: `${lost.length > 1 ? "Números já escolhidos" : "Número já escolhido"} por outra pessoa depois da recusa.`, needsReplacement: true, lost },
            { status: 409 }
          );
        }
        if (error.message.includes("ORDER_REJECTED")) return fail("Reserva vencida não volta: a pessoa não chegou a enviar o comprovante.");
        if (error.message.includes("ORDER_NOT_PAID")) return fail("Essa pessoa ainda não enviou o comprovante.");
        return fail(isMissingTable(error.message) ? MISSING_RAFFLES : error.message, 500);
      }
      return Response.json({ ok: true });
    }

    case "restoreRaffleOrder": {
      const numbers: number[] = Array.isArray(body.numbers) ? body.numbers.map(Number).filter((n: number) => Number.isInteger(n)) : [];
      const { data: added, error } = await db.rpc("raffle_restore_order", {
        p_order: body.id,
        p_new_numbers: numbers,
        p_extend: !!body.extend,
      });
      if (error) {
        const m = error.message;
        const taken = m.match(/TAKEN:([\d,]+)/);
        if (taken) return Response.json({ error: `O número ${taken[1]} acabou de ser escolhido. Escolha outro.`, lost: taken[1].split(",").map(Number) }, { status: 409 });
        const wrong = m.match(/WRONG_COUNT:(\d+)/);
        if (wrong) return fail(`Escolha exatamente ${wrong[1]} número(s).`);
        if (m.includes("TOO_MANY")) return fail(`A rifa não pode passar de ${MAX_RAFFLE_NUMBERS} números.`);
        if (m.includes("INVALID_NUMBER")) return fail("Algum número escolhido não serve (fora da rifa ou repetido).");
        if (m.includes("INVALID_STATUS")) return fail("Essa compra não está mais recusada.");
        return fail(isMissingTable(m) ? "Falta rodar o SQL supabase/migracao-rifas-desfazer-recusa.sql no Supabase." : m, 500);
      }
      return Response.json({ ok: true, added: added ?? [] });
    }

    case "deleteVideo": {
      const { error } = await db.from("videos").delete().eq("id", body.id);
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }

    // ---- Parceiros (cards da home) ----
    case "savePartner": {
      const name = String(body.name || "").trim().slice(0, 80);
      const imageUrl = String(body.imageUrl || "").trim();
      let linkUrl = String(body.linkUrl || "").trim();
      if (linkUrl && !/^https?:\/\//i.test(linkUrl)) linkUrl = "https://" + linkUrl;
      if (!name || !imageUrl || !linkUrl) return fail("Preencha nome, imagem e link do parceiro.");
      const fields = { name, image_url: imageUrl, link_url: linkUrl };
      if (body.id) {
        const { error } = await db.from("partners").update(fields).eq("id", body.id);
        if (error) return fail(error.message, 500);
      } else {
        // Novo parceiro entra no fim da fila
        const { data: last } = await db.from("partners").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
        const { error } = await db.from("partners").insert({ ...fields, sort_order: (last?.sort_order ?? 0) + 1 });
        if (error) return fail(MISSING_TABLE, 500);
      }
      return Response.json({ ok: true });
    }

    case "deletePartner": {
      const { error } = await db.from("partners").delete().eq("id", body.id);
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }

    case "reorderPartners": {
      // Recebe os ids na ordem nova
      const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
      const results = await Promise.all(ids.map((id, i) => db.from("partners").update({ sort_order: i + 1 }).eq("id", id)));
      const failed = results.find((r) => r.error);
      if (failed?.error) return fail(failed.error.message, 500);
      return Response.json({ ok: true });
    }

    default:
      return fail("Ação desconhecida.");
  }
}
