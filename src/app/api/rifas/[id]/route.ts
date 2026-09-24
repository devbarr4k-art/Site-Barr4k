import { getSessionUsername } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PROOFS_BUCKET, removeProofs } from "@/lib/proofs";
import { RECAPTCHA_FAILED, verifyRecaptcha } from "@/lib/recaptchaServer";
import { RAFFLE_COLUMNS, reserveError, takenByRaffle, withCounts } from "@/lib/rifasServer";
import { MAX_RAFFLE_PROOFS, type Raffle } from "@/lib/rifas";

const MAX_PROOF_LENGTH = 3_000_000; // ~2 MB de imagem em base64

// GET: a rifa + números ocupados. Com ?mine=1: as compras de quem está logado.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (new URL(request.url).searchParams.get("mine") === "1") {
    const username = await getSessionUsername();
    if (!username) return Response.json({ orders: [] }, { headers: { "Cache-Control": "no-store" } });
    const { data } = await supabaseAdmin
      .from("raffle_orders")
      .select("id, raffle_id, username, numbers, total_cents, status, created_at, decided_at")
      .eq("raffle_id", id)
      .eq("username", username)
      .order("created_at", { ascending: false });
    return Response.json({ orders: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await supabaseAdmin.from("raffles").select(RAFFLE_COLUMNS).eq("id", id).maybeSingle();
  if (error || !data) return Response.json({ error: "Rifa não encontrada." }, { status: 404 });
  const taken = await takenByRaffle([id]);
  return Response.json(
    { raffle: withCounts([data as Raffle], taken)[0], taken: taken[id] },
    {
      headers: {
        // cache bem curto só na Vercel: a grade atualiza quase na hora
        "Vercel-CDN-Cache-Control": "max-age=2, stale-while-revalidate=30",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    }
  );
}

// POST: compra. Sobe os comprovantes e reserva os números numa operação só no banco.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const username = await getSessionUsername();
  if (!username) return Response.json({ error: "Entre com a Twitch para comprar." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!(await verifyRecaptcha(body?.recaptcha, "rifa"))) {
    return Response.json({ error: RECAPTCHA_FAILED }, { status: 403 });
  }

  const numbers: number[] = Array.isArray(body?.numbers)
    ? body.numbers.map(Number).filter((n: number) => Number.isInteger(n))
    : [];
  if (numbers.length === 0) return Response.json({ error: "Escolha pelo menos um número." }, { status: 400 });

  const proofs: string[] = Array.isArray(body?.proofs) ? body.proofs.filter((p: unknown) => typeof p === "string") : [];
  if (proofs.length === 0) return Response.json({ error: "Anexe o comprovante do PIX." }, { status: 400 });
  if (proofs.length > MAX_RAFFLE_PROOFS) return Response.json({ error: `Envie no máximo ${MAX_RAFFLE_PROOFS} comprovantes.` }, { status: 400 });

  // Comprovantes para o bucket privado (o banco guarda só o caminho)
  const paths: string[] = [];
  for (const proof of proofs) {
    const match = proof.length <= MAX_PROOF_LENGTH && proof.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (!match) {
      await removeProofs(paths);
      return Response.json({ error: "Os comprovantes precisam ser imagens de até 2 MB." }, { status: 400 });
    }
    const [, contentType, base64] = match;
    const ext = contentType.split("/")[1].replace("jpeg", "jpg").replace(/\+.*/, "");
    const path = `rifas/${id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage.from(PROOFS_BUCKET).upload(path, Buffer.from(base64, "base64"), { contentType });
    if (error) {
      await removeProofs(paths);
      return Response.json({ error: "Não foi possível enviar o comprovante. Tente de novo." }, { status: 500 });
    }
    paths.push(path);
  }

  const { data: orderId, error } = await supabaseAdmin.rpc("raffle_reserve", {
    p_raffle: id,
    p_username: username,
    p_numbers: numbers,
    p_proofs: paths,
  });

  if (error) {
    // Não reservou (número ocupado, rifa fechada...): os comprovantes enviados saem
    await removeProofs(paths);
    const e = reserveError(error.message);
    return Response.json({ error: e.error, clash: e.clash }, { status: e.status });
  }

  const { data: order } = await supabaseAdmin
    .from("raffle_orders")
    .select("id, raffle_id, username, numbers, total_cents, status, created_at")
    .eq("id", orderId)
    .maybeSingle();
  return Response.json({ ok: true, order });
}
