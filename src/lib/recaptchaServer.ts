// Confere no Google o token do reCAPTCHA v3. Sem RECAPTCHA_SECRET_KEY fica desligado (sempre passa).

const MIN_SCORE = 0.5; // 0 = robô, 1 = humano

export async function verifyRecaptcha(token: unknown, action: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const json = await res.json();
    return !!json.success && json.action === action && (json.score ?? 0) >= MIN_SCORE;
  } catch {
    // Google fora do ar não pode travar as inscrições
    return true;
  }
}

export const RECAPTCHA_FAILED = "Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo.";
