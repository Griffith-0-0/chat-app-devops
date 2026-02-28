import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(username, email, password);
      navigate('/login');
    } catch {
      setError('Erreur lors de l\'inscription');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 20 }}>
      <h2>Inscription</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Nom d'utilisateur" value={username}
          onChange={e => setUsername(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 10 }} />
        <input type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 10 }} />
        <input type="password" placeholder="Mot de passe" value={password}
          onChange={e => setPassword(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 10 }} />
        <button type="submit" style={{ width: '100%' }}>S'inscrire</button>
      </form>
      <p>Déjà un compte ? <Link to="/login">Se connecter</Link></p>
    </div>
  );
}