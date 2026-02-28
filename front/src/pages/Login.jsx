import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/chat');
    } catch {
      setError('Email ou mot de passe incorrect');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 20 }}>
      <h2>Connexion</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 10 }} />
        <input type="password" placeholder="Mot de passe" value={password}
          onChange={e => setPassword(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 10 }} />
        <button type="submit" style={{ width: '100%' }}>Se connecter</button>
      </form>
      <p>Pas de compte ? <Link to="/register">S'inscrire</Link></p>
    </div>
  );
}