// Logins da Twitch (minúsculos) com acesso ao painel admin.
export const ADMIN_USERNAMES = ["barr4k", "luizpragi"];

export function isAdmin(username: string | null | undefined): boolean {
  return !!username && ADMIN_USERNAMES.includes(username.toLowerCase());
}
