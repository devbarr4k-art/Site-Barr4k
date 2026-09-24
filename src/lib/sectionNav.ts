// Navegação para as seções da home, usada pelo menu, pelo rodapé e pela própria home.
// Cada seção tem endereço próprio, sem "#": /sorteios, /hall-da-fama, /videos, /parceiros.
// Essas rotas mostram a mesma home e rolam até a seção (src/app/<secao>/page.tsx).
// Já na home, o clique só rola e troca o endereço, sem recarregar nada.

const MENU_HEIGHT = 80;

export const HOME_SECTIONS = ["sorteios", "hall-da-fama", "videos", "parceiros"] as const;

// Âncoras antigas que ainda podem estar em links compartilhados (ex.: /#active-giveaways)
const RENAMED_SECTIONS: Record<string, string> = { "active-giveaways": "sorteios" };
export const currentSectionId = (id: string) => RENAMED_SECTIONS[id] ?? id;

/** "/" e "/sorteios", "/videos"... são todos a home */
export const isHomePath = (pathname: string | null) =>
  pathname === "/" || HOME_SECTIONS.some((s) => pathname === `/${s}`);

/** Seção de um endereço: "/videos" → "videos", "/#videos" → "videos", "/" → "" */
export function sectionFromHref(href: string): string | null {
  if (href === "/") return "";
  const m = href.match(/^\/#?([\w-]+)$/);
  if (!m) return null;
  const id = currentSectionId(m[1]);
  return (HOME_SECTIONS as readonly string[]).includes(id) ? id : null;
}

export const sectionPath = (id: string) => (id ? `/${id}` : "/");

export function scrollToSectionId(id: string, behavior: ScrollBehavior = "smooth") {
  const el = id ? document.getElementById(currentSectionId(id)) : null;
  const top = el ? el.getBoundingClientRect().top + window.scrollY - MENU_HEIGHT : 0;
  window.scrollTo({ top, behavior });
}

/** onClick dos links de seção: na home rola até ela; em outras páginas deixa o Next navegar. */
export function handleSectionLink(e: React.MouseEvent, href: string, pathname: string | null) {
  const id = sectionFromHref(href);
  if (id === null || !isHomePath(pathname)) return;
  e.preventDefault();
  scrollToSectionId(id);
  window.history.replaceState(window.history.state, "", sectionPath(id));
}
