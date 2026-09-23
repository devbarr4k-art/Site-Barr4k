import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeWhatsapp, isValidEmail } from "@/lib/siteUsers";
import { RECAPTCHA_FAILED, verifyRecaptcha } from "@/lib/recaptchaServer";

async function sessionUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { username?: string; name?: string | null; image?: string | null } | undefined;
  const username = String(user?.username || user?.name || "").toLowerCase();
  return username ? { username, image: user?.image ?? null } : null;
}

// Diz se quem está logado já tem cadastro. Com ?visit=1 (uma vez por sessão no
// navegador) também conta o acesso para o painel.
export async function GET(request: Request) {
  const user = await sessionUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("site_users")
    .select("twitch_username, visits")
    .eq("twitch_username", user.username)
    .maybeSingle();

  // Tabela ainda não criada no banco: não pede cadastro
  if (error) return Response.json({ registered: true, unavailable: true });

  if (data && new URL(request.url).searchParams.get("visit") === "1") {
    await supabaseAdmin
      .from("site_users")
      .update({ last_seen_at: new Date().toISOString(), visits: (data.visits ?? 0) + 1, avatar_url: user.image })
      .eq("twitch_username", user.username);
  }

  return Response.json({ registered: !!data }, { headers: { "Cache-Control": "no-store" } });
}

// Cria (ou atualiza) o cadastro de quem está logado
export async function POST(request: Request) {
  const user = await sessionUser();
  if (!user) return Response.json({ error: "Faça login com a Twitch primeiro." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const whatsapp = normalizeWhatsapp(body?.whatsapp);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";

  if (!whatsapp) return Response.json({ error: "Digite um WhatsApp válido, com DDD." }, { status: 400 });
  if (!isValidEmail(email)) return Response.json({ error: "Digite um e-mail válido." }, { status: 400 });
  if (!(await verifyRecaptcha(body?.recaptcha, "cadastro"))) return Response.json({ error: RECAPTCHA_FAILED }, { status: 403 });

  const { error } = await supabaseAdmin.from("site_users").upsert(
    {
      twitch_username: user.username,
      whatsapp,
      email,
      avatar_url: user.image,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "twitch_username" }
  );

  if (error) return Response.json({ error: "Não foi possível salvar agora. Tente de novo." }, { status: 500 });
  return Response.json({ ok: true });
}
