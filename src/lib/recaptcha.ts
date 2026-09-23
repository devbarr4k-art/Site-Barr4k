// reCAPTCHA v3 (invisível): o script é carregado no layout e mostra o selo
// "protegido por reCAPTCHA". Sem NEXT_PUBLIC_RECAPTCHA_SITE_KEY fica desligado.

export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

type Grecaptcha = { ready: (cb: () => void) => void; execute: (key: string, opts: { action: string }) => Promise<string> };

/** Token para mandar junto com o formulário ("" se o reCAPTCHA estiver desligado ou falhar ao carregar). */
export async function getRecaptchaToken(action: string): Promise<string> {
  if (!RECAPTCHA_SITE_KEY || typeof window === "undefined") return "";
  // Espera o script do Google (carregado no layout) por até 5s
  for (let i = 0; i < 50 && !(window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha?.execute; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const g = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
  if (!g?.execute) return "";
  try {
    return await new Promise<string>((resolve, reject) =>
      g.ready(() => g.execute(RECAPTCHA_SITE_KEY, { action }).then(resolve, reject))
    );
  } catch {
    return "";
  }
}
