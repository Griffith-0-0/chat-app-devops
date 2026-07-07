/**
 * Page settings/profil CoWork App.
 * GET/PUT profils via profilesAPI, affiche et édite display_name, status.
 */
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  CalendarDays,
  MessageCircle,
  Save,
  Settings,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { profilesAPI } from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (!user) return;
    profilesAPI.get(`/profiles/${user.userId}`)
      .then((res) => {
        setDisplayName(res.data.display_name || '');
        setStatus(res.data.status || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, token, navigate]);

  const handleSave = async () => {
    await profilesAPI.put(`/profiles/${user.userId}`, {
      display_name: displayName,
      status,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const previewName = displayName || 'Test User';
  const previewStatus = status || 'online';

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-[88px] shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col md:items-center md:justify-between md:py-4">
          <div className="flex flex-col items-center gap-8">
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-black text-white shadow-lg shadow-indigo-200"
              title="Back to CoWork App"
            >
              C
            </button>
            <nav className="flex flex-col items-center gap-5 text-slate-900">
              <button type="button" onClick={() => navigate('/chat')} className="rounded-2xl p-3 transition hover:bg-indigo-50 hover:text-indigo-600" title="Messages">
                <MessageCircle size={22} />
              </button>
              <button type="button" className="rounded-2xl p-3 transition hover:bg-indigo-50 hover:text-indigo-600" title="Directory">
                <UsersRound size={22} />
              </button>
              <button type="button" className="rounded-2xl p-3 transition hover:bg-indigo-50 hover:text-indigo-600" title="Calendar">
                <CalendarDays size={22} />
              </button>
              <button type="button" className="rounded-2xl bg-indigo-50 p-3 text-indigo-600" title="Settings">
                <Settings size={22} />
              </button>
            </nav>
          </div>
        </aside>

        <main className="flex-1 bg-white">
          <header className="flex h-20 items-center justify-between border-b border-slate-200 px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">CoWork App</p>
              <h1 className="mt-1 text-2xl font-black">Profile settings</h1>
            </div>
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-600 transition hover:bg-indigo-100"
            >
              <ArrowLeft size={18} />
              Back to chat
            </button>
          </header>

          <div className="grid min-h-[calc(100vh-80px)] lg:grid-cols-[1fr_360px]">
            <section className="flex items-center justify-center px-6 py-10">
              <div className="w-full max-w-xl">
                <div className="mb-8 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-2xl font-black text-white shadow-lg shadow-violet-100">
                    {previewName.trim().charAt(0).toUpperCase() || 'T'}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight">{previewName}</h2>
                    <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                      {previewStatus}
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-xl shadow-slate-100">
                    Chargement...
                  </div>
                ) : (
                  <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-100">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-black">Identity</h3>
                        <p className="mt-1 text-sm text-slate-500">Ces infos apparaissent dans le Directory.</p>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">
                        Editable
                      </span>
                    </div>

                    {saved && (
                      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                        <BadgeCheck size={18} />
                        Profil mis à jour
                      </div>
                    )}

                    <div className="space-y-5">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-800">Nom affiché</span>
                        <span className="flex h-13 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
                          <UserRound size={19} className="text-slate-400" />
                          <input
                            type="text"
                            placeholder="Comment tu veux être appelé"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                          />
                        </span>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-800">Statut</span>
                        <span className="flex h-13 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
                          <Bell size={19} className="text-slate-400" />
                          <input
                            type="text"
                            placeholder="Disponible, occupé, etc."
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                          />
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={handleSave}
                        className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-500"
                      >
                        <Save size={18} />
                        Sauvegarder
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <aside className="hidden border-l border-slate-200 bg-slate-50 px-6 py-8 lg:block">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-100">
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">Directory preview</p>
                <div className="mt-5 flex items-center gap-4">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-lg font-black text-white">
                      {previewName.trim().charAt(0).toUpperCase() || 'T'}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black">{previewName}</p>
                    <p className="truncate text-sm font-semibold text-slate-400">{previewStatus}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5">
                <h3 className="font-black">Profile tips</h3>
                <div className="mt-4 space-y-3 text-sm font-semibold text-slate-500">
                  <p>Use a clear display name for room messages.</p>
                  <p>Keep your status short so it scans well in Directory.</p>
                  <p>Your presence updates automatically when you join a room.</p>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
