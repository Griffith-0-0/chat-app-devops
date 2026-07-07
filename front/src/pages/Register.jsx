/**
 * Page d'inscription CoWork App.
 * Formulaire username/email/password, appelle authAPI /auth/register, redirige vers /login.
 */
import { useState } from 'react';
import { ArrowRight, LockKeyhole, Mail, MessageCircle, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username, email, password);
      navigate('/login');
    } catch (err) {
      const apiError = err.response?.data?.error || err.message;
      setError(apiError || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-[88px] shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col md:items-center md:justify-between md:py-4">
          <div className="flex flex-col items-center gap-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-black text-white shadow-lg shadow-indigo-200">
              C
            </div>
            <div className="flex flex-col gap-5 text-slate-900">
              <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><UserRound size={22} /></span>
              <span className="rounded-2xl p-3"><MessageCircle size={22} /></span>
              <span className="rounded-2xl p-3"><UsersRound size={22} /></span>
            </div>
          </div>
        </aside>

        <main className="grid flex-1 lg:grid-cols-[1fr_minmax(420px,520px)]">
          <section className="hidden border-r border-slate-200 bg-slate-50 px-10 py-10 lg:block">
            <div className="mx-auto flex h-full max-w-xl flex-col justify-center">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">Join the workspace</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">Un compte, toute l'équipe au même endroit.</h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500">
                CoWork App rassemble rooms, messages, présence et fichiers partagés dans une interface simple à scanner.
              </p>

              <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-100">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-lg font-black text-white">T</span>
                  <div>
                    <p className="font-black">Test User</p>
                    <p className="text-sm font-semibold text-slate-400">Online collaborator</p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-indigo-50 p-4">
                    <ShieldCheck className="text-indigo-600" size={22} />
                    <p className="mt-3 text-sm font-bold">JWT secured</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <UsersRound className="text-emerald-600" size={22} />
                    <p className="mt-3 text-sm font-bold">Team ready</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center px-6 py-10">
            <div className="w-full max-w-md">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">CoWork App</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight">Create account</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Crée ton accès pour rejoindre les conversations et personnaliser ton profil.
              </p>

              {error && (
                <div className="mt-8 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-800">Nom d'utilisateur</span>
                  <span className="flex h-13 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
                    <UserRound size={19} className="text-slate-400" />
                    <input
                      type="text"
                      placeholder="johndoe"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-800">Email</span>
                  <span className="flex h-13 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
                    <Mail size={19} className="text-slate-400" />
                    <input
                      type="email"
                      placeholder="tu@exemple.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-800">Mot de passe</span>
                  <span className="flex h-13 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
                    <LockKeyhole size={19} className="text-slate-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    />
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Inscription...' : "S'inscrire"}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Déjà un compte ?{' '}
                <Link to="/login" className="font-bold text-indigo-600 transition hover:text-indigo-500">
                  Se connecter
                </Link>
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
