import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { messagesAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Chat() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [roomId, setRoomId] = useState('room-general');
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) { navigate('/login'); return; }

    socketRef.current = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
    });

    socketRef.current.emit('join_room', { roomId });

    messagesAPI.get(`/messages/${roomId}`).then(res => setMessages(res.data));

    socketRef.current.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => socketRef.current.disconnect();
  }, [token, roomId]);

  const sendMessage = () => {
    if (!content.trim()) return;
    socketRef.current.emit('send_message', { roomId, content });
    setContent('');
  };

  return (
    <div style={{ maxWidth: 600, margin: '20px auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>Chat — {roomId}</h2>
        <div>
          <button onClick={() => navigate('/profile')} style={{ marginRight: 10 }}>Profil</button>
          <button onClick={() => { logout(); navigate('/login'); }}>Déconnexion</button>
        </div>
      </div>
      <div style={{ border: '1px solid #ccc', height: 400, overflowY: 'scroll', padding: 10, marginBottom: 10 }}>
        {messages.map(m => (
          <div key={m.id} style={{ marginBottom: 8 }}>
            <strong>{m.sender_id === user?.userId ? 'Moi' : m.sender_id}</strong>: {m.content}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={content} onChange={e => setContent(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Message..." style={{ flex: 1 }} />
        <button onClick={sendMessage}>Envoyer</button>
      </div>
    </div>
  );
}