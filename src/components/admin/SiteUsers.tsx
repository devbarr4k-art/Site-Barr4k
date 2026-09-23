"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit, Search, Trash2, UserCheck, UserPlus, Users } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { adminApi } from "@/lib/adminApi";
import { avatarFor } from "@/lib/daily";
import { formatWhatsapp } from "@/lib/siteUsers";
import { useDialog } from "@/components/ui/Dialog";

type SiteUser = {
  twitch_username: string;
  whatsapp: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  last_seen_at: string;
  visits: number;
};

const DAY = 24 * 60 * 60 * 1000;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR") + " " + new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Quem criou conta no site pelo popup depois de entrar com a Twitch
export default function SiteUsers() {
  const dialog = useDialog();
  const [users, setUsers] = useState<SiteUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ whatsapp: "", email: "" });
  const [now] = useState(() => Date.now());

  const load = async () => {
    try {
      const res = await adminApi<{ data: SiteUser[] }>("listSiteUsers");
      setUsers(res.data);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erro ao carregar.");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    total: users.length,
    newWeek: users.filter((u) => now - new Date(u.created_at).getTime() < 7 * DAY).length,
    activeWeek: users.filter((u) => now - new Date(u.last_seen_at).getTime() < 7 * DAY).length,
  }), [users, now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    const digits = q.replace(/\D/g, "");
    return users.filter((u) =>
      u.twitch_username.includes(q) || u.email.includes(q) || (digits && u.whatsapp.includes(digits))
    );
  }, [users, query]);

  const startEdit = (u: SiteUser) => {
    setEditing(u.twitch_username);
    setDraft({ whatsapp: formatWhatsapp(u.whatsapp), email: u.email });
  };

  const saveEdit = async (u: SiteUser) => {
    try {
      const res = await adminApi<{ whatsapp: string; email: string }>("updateSiteUser", { username: u.twitch_username, ...draft });
      setUsers((prev) => prev.map((x) => (x.twitch_username === u.twitch_username ? { ...x, whatsapp: res.whatsapp, email: res.email } : x)));
      setEditing(null);
    } catch (err) {
      dialog.error(err);
    }
  };

  const remove = async (u: SiteUser) => {
    const ok = await dialog.confirm({
      title: `Excluir o cadastro de @${u.twitch_username}?`,
      message: "WhatsApp e e-mail são apagados. Na próxima vez que a pessoa entrar, o site pede o cadastro de novo.",
      confirmText: "Excluir cadastro",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await adminApi("deleteSiteUser", { username: u.twitch_username });
      setUsers((prev) => prev.filter((x) => x.twitch_username !== u.twitch_username));
    } catch (err) {
      dialog.error(err);
    }
  };

  const statCards = [
    { label: "Cadastrados", value: stats.total, icon: Users },
    { label: "Novos (7 dias)", value: stats.newWeek, icon: UserPlus },
    { label: "Entraram (7 dias)", value: stats.activeWeek, icon: UserCheck },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Usuários do Site</h1>
        <p className="text-gray-400">Quem entrou com a Twitch e criou conta. Cada entrada no site conta como um acesso.</p>
      </div>

      {loadError ? (
        <div className="glass-panel rounded-xl border border-yellow-500/30 p-6 text-yellow-200">{loadError}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {statCards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="glass-panel rounded-xl border border-purple-500/20 p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <p className="text-3xl font-black text-white leading-none">{loading ? "–" : value}</p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nick, WhatsApp ou e-mail"
              className="w-full bg-[#0a0a0b] border border-gray-800 rounded-lg pl-11 pr-4 py-3 text-white placeholder:text-gray-600 focus:border-purple-500 outline-none"
            />
          </div>

          <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm text-gray-400">
                <thead className="bg-purple-900/20 text-xs uppercase text-gray-300 border-b border-purple-900/50">
                  <tr>
                    <th className="px-6 py-4">Nick Twitch</th>
                    <th className="px-6 py-4">WhatsApp</th>
                    <th className="px-6 py-4">E-mail</th>
                    <th className="px-6 py-4">Cadastro</th>
                    <th className="px-6 py-4">Último acesso</th>
                    <th className="px-6 py-4 text-center">Acessos</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.twitch_username} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">
                        <div className="flex items-center gap-3">
                          <img src={avatarFor(u.twitch_username, u.avatar_url)} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-700" />
                          @{u.twitch_username}
                        </div>
                      </td>
                      {editing === u.twitch_username ? (
                        <>
                          <td className="px-6 py-3">
                            <input value={draft.whatsapp} onChange={(e) => setDraft({ ...draft, whatsapp: formatWhatsapp(e.target.value) })}
                              className="w-40 bg-black border border-purple-500/50 rounded px-2 py-1 text-white outline-none" />
                          </td>
                          <td className="px-6 py-3">
                            <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(u); if (e.key === "Escape") setEditing(null); }}
                              className="w-56 bg-black border border-purple-500/50 rounded px-2 py-1 text-white outline-none" />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <a href={`https://wa.me/55${u.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-green-400 hover:text-green-300">
                              <FaWhatsapp className="w-4 h-4" /> {formatWhatsapp(u.whatsapp)}
                            </a>
                          </td>
                          <td className="px-6 py-4">
                            <a href={`mailto:${u.email}`} className="text-gray-300 hover:text-white">{u.email}</a>
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{fmtDate(u.last_seen_at)}</td>
                      <td className="px-6 py-4 text-center font-bold text-white">{u.visits}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {editing === u.twitch_username ? (
                            <>
                              <button onClick={() => saveEdit(u)} className="px-3 py-1.5 rounded text-xs font-bold bg-green-600 hover:bg-green-500 text-white">Salvar</button>
                              <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded text-xs font-bold bg-gray-700 hover:bg-gray-600 text-white">Cancelar</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(u)} title="Editar" className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => remove(u)} title="Excluir" className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                        {users.length === 0 ? "Ninguém se cadastrou ainda." : "Nenhum usuário encontrado."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
