// Navegação para seções da home ("/" e "/#id"), usada pelo menu e pelo rodapé.
// Já na home, rola direto (o # do Next não rola depois que a URL passou a seguir a rolagem).

const MENU_HEIGHT = 80;

export function scrollToSectionId(id: string, behavior: ScrollBehavior = "smooth") {
  const el = id ? document.getElementById(id) : null;
  const top = el ? el.getBoundingClientRect().top + window.scrollY - MENU_HEIGHT : 0;
  window.scrollTo({ top, behavior });
}

/** onClick de links "/" e "/#id": na home rola até a seção; em outras páginas deixa o Next navegar. */
export function handleSectionLink(e: React.MouseEvent, href: string, pathname: string | null) {
  if (pathname !== "/" || !(href === "/" || href.startsWith("/#"))) return;
  e.preventDefault();
  const id = href === "/" ? "" : href.slice(2);
  scrollToSectionId(id);
  window.history.replaceState(window.history.state, "", id ? `/#${id}` : "/");
}
