/**
 * Page de connexion CoWork App.
 * Formulaire email/mot de passe, appelle authAPI /auth/login, redirige vers /chat.
 */
import { useState } from 'react';
import { ArrowRight, LockKeyhole, Mail, MessageCircle, ShieldCheck, UsersRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';

function ErrorButton() {
  return (
    <button
      type="button"
      onClick={() => { throw new Error('This is your first error!'); }}
      className="mt-4 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
    >
      Test Sentry
    </button>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/chat');
    } catch {
      setError('Email ou mot de passe incorrect');
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
              <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600"><MessageCircle size={22} /></span>
              <span className="rounded-2xl p-3"><UsersRound size={22} /></span>
              <span className="rounded-2xl p-3"><ShieldCheck size={22} /></span>
            </div>
          </div>
        </aside>

        <main className="grid flex-1 lg:grid-cols-[minmax(420px,520px)_1fr]">
          <section className="flex items-center justify-center border-r border-slate-200 px-6 py-10">
            <div className="w-full max-w-md">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">CoWork App</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Welcome back</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Connecte-toi pour retrouver tes rooms, ton équipe et les messages de ton workspace.
              </p>

              {error && (
                <div className="mt-8 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
                  {loading ? 'Connexion...' : 'Se connecter'}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </form>

              <ErrorButton />

              <p className="mt-6 text-center text-sm text-slate-500">
                Pas de compte ?{' '}
                <Link to="/register" className="font-bold text-indigo-600 transition hover:text-indigo-500">
                  S'inscrire
                </Link>
              </p>
            </div>
          </section>

          <section className="hidden bg-slate-50 px-10 py-10 lg:block">
            <div className="mx-auto flex h-full max-w-xl flex-col justify-center">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-100">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">Workspace preview</p>
                    <h2 className="mt-1 text-2xl font-black">General Squad</h2>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">Online</span>
                </div>
                <div className="space-y-4">
                  <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm">
                    Standup starts in 10 minutes.
                  </div>
                  <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-3 text-sm text-white">
                    I’ll share the deployment update.
                  </div>
                  <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm">
                    Perfect, CoWork App is ready.
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-4">
                {['Rooms', 'Members', 'Files'].map((item, index) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-2xl font-black text-slate-950">{[5, 7, 125][index]}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-400">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
