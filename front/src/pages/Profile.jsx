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

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (!user) return;
    profilesAPI.get(`/profiles/${user.userId}`)
      .then(res => {
        setDisplayName(res.data.display_name || '');
        setStatus(res.data.status || '');
      })
      .catch(() => {});
  }, [user, token]);

  const handleSave = async () => {
    await profilesAPI.put(`/profiles/${user.userId}`, { display_name: displayName, status });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 20 }}>
      <h2>Mon profil</h2>
      <input type="text" placeholder="Nom affiché" value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 10 }} />
      <input type="text" placeholder="Statut" value={status}
        onChange={e => setStatus(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 10 }} />
      <button onClick={handleSave} style={{ width: '100%' }}>Sauvegarder</button>
      {saved && <p style={{ color: 'green' }}>Profil mis à jour ✓</p>}
      <button onClick={() => navigate('/chat')} style={{ marginTop: 10 }}>Retour au chat</button>
    </div>
  );
}