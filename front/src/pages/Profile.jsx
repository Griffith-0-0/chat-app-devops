import { useState, useEffect } from 'react';
import { profilesAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (!user) return;
    profilesAPI.get(`/profiles/${user.userId}`)
      .then((res) => {
        setDisplayName(res.data.display_name || '');
        setStatus(res.data.status || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, token]);

  const handleSave = async () => {
    await profilesAPI.put(`/profiles/${user.userId}`, {
      display_name: displayName,
      status,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight">Mon profil</h1>
            <p className="text-slate-400 mt-2">Personnalise ton compte</p>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400">Chargement...</div>
          ) : (
            <>
              {saved && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                  <span>✓</span> Profil mis à jour
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-slate-300 mb-2">
                    Nom affiché
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    placeholder="Comment tu veux être appelé"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-slate-300 mb-2">
                    Statut
                  </label>
                  <input
                    id="status"
                    type="text"
                    placeholder="Disponible, occupé, etc."
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                  />
                </div>

                <button
                  onClick={handleSave}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                >
                  Sauvegarder
                </button>

                <button
                  onClick={() => navigate('/chat')}
                  className="w-full py-3 px-4 rounded-xl bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 font-medium transition-colors"
                >
                  Retour au chat
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
