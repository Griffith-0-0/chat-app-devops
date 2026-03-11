/**
 * Page de chat temps réel
 * Connexion Socket.io (join_room, send_message), historique via messagesAPI, affichage des messages.
 */
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
  const messagesEndRef = useRef(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!content.trim()) return;
    socketRef.current.emit('send_message', { roomId, content });
    setContent('');
  };

  const isOwnMessage = (msg) => msg.sender_id === user?.userId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col">
      <header className="flex-shrink-0 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">
            <span className="text-slate-400">#</span> {roomId}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/profile')}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              Profil
            </button>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col max-w-3xl mx-auto w-full px-4 py-6">
        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4 space-y-4 mb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
              <p className="text-sm">Aucun message pour le moment</p>
              <p className="text-xs mt-1">Envoie le premier message !</p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${isOwnMessage(m) ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isOwnMessage(m)
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : 'bg-slate-700/80 text-slate-200 rounded-bl-md'
                }`}
              >
                <p className="text-xs font-medium opacity-90 mb-0.5">
                  {isOwnMessage(m) ? 'Moi' : m.sender_id}
                </p>
                <p className="text-sm break-words">{m.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex-shrink-0 flex gap-3">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Écris un message..."
            className="flex-1 px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-600/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={!content.trim()}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Envoyer
          </button>
        </div>
      </main>
    </div>
  );
}
