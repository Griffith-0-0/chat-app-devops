/**
 * Ecran principal CoWork App.
 * Combine rooms Socket.io, historique messages, presence, typing et UI collaborative.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Bell,
  CalendarDays,
  Download,
  FileArchive,
  FileImage,
  FileText,
  FolderOpen,
  LogOut,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
  Settings,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { messagesAPI, profilesAPI } from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const conversations = [
  {
    id: 'room-general',
    name: 'General Squad',
    subtitle: 'Daily team sync',
    preview: 'Standup starts in 10 minutes',
    time: '12m',
    unread: 4,
    tags: ['Team', 'Priority'],
    seed: 'general-squad',
  },
  {
    id: 'room-design',
    name: 'Design Review',
    subtitle: 'UI feedback',
    preview: 'New CoWork layout is ready',
    time: '24m',
    unread: 2,
    tags: ['Design'],
    seed: 'design-review',
  },
  {
    id: 'room-devops',
    name: 'DevOps Pipeline',
    subtitle: 'Jenkins and Argo CD',
    preview: 'Trivy scan passed',
    time: '1h',
    unread: 0,
    tags: ['CI/CD', 'Help'],
    seed: 'devops-pipeline',
  },
  {
    id: 'room-support',
    name: 'Support Desk',
    subtitle: 'Incidents and bugs',
    preview: 'Need someone on auth logs',
    time: '5h',
    unread: 1,
    tags: ['Bug'],
    seed: 'support-desk',
  },
  {
    id: 'room-product',
    name: 'Product Ideas',
    subtitle: 'Roadmap',
    preview: 'Typing indicator is a win',
    time: '2d',
    unread: 0,
    tags: ['Request'],
    seed: 'product-ideas',
  },
];

const fallbackMembers = [
  {
    user_id: 'florencio',
    display_name: 'Florencio Dorrance',
    status: 'Market Development Manager',
    avatar_url: '',
  },
  {
    user_id: 'benny',
    display_name: 'Benny Spanbauer',
    status: 'Area Sales Manager',
    avatar_url: '',
  },
  {
    user_id: 'jamel',
    display_name: 'Jamel Eusebio',
    status: 'Administrator',
    avatar_url: '',
  },
  {
    user_id: 'lavern',
    display_name: 'Lavern Laboy',
    status: 'Account Executive',
    avatar_url: '',
  },
  {
    user_id: 'alfonzo',
    display_name: 'Alfonzo Schuessler',
    status: 'Proposal Writer',
    avatar_url: '',
  },
  {
    user_id: 'daryl',
    display_name: 'Daryl Nehls',
    status: 'Nursing Assistant',
    avatar_url: '',
  },
];

const sharedFiles = [
  { name: 'cowork-roadmap.pdf', type: 'PDF', size: '9mb', icon: FileText, tone: 'rose' },
  { name: 'chat-ui-shot.png', type: 'PNG', size: '4mb', icon: FileImage, tone: 'emerald' },
  { name: 'release-notes.docx', type: 'DOC', size: '555kb', icon: FolderOpen, tone: 'sky' },
  { name: 'jenkins-logs.zip', type: 'ZIP', size: '24mb', icon: FileArchive, tone: 'violet' },
];

const tagStyles = {
  Team: 'bg-indigo-50 text-indigo-600',
  Priority: 'bg-emerald-100 text-emerald-700',
  Design: 'bg-slate-100 text-slate-600',
  'CI/CD': 'bg-orange-100 text-orange-700',
  Help: 'bg-emerald-100 text-emerald-700',
  Bug: 'bg-red-50 text-red-600',
  Request: 'bg-green-100 text-green-700',
};

function avatarUrl(seed) {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f1f4ff,d1fae5,fee2e2,e0f2fe`;
}

function formatMessageTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getFileTone(tone) {
  const tones = {
    rose: 'bg-rose-50 text-rose-500',
    emerald: 'bg-emerald-50 text-emerald-500',
    sky: 'bg-sky-50 text-sky-500',
    violet: 'bg-violet-50 text-violet-500',
  };
  return tones[tone] || tones.sky;
}

function isTestMember(member) {
  return member.display_name?.trim().toLowerCase() === 'test user'
    || member.user_id === 'ca453145-bc8c-48c6-891e-e4c5ef7da610';
}

function TeamMemberAvatar({ member, online }) {
  return (
    <div className="relative">
      {isTestMember(member) ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-lg font-black text-white shadow-sm shadow-violet-100">
          T
        </div>
      ) : (
        <img
          src={member.avatar_url || avatarUrl(member.display_name)}
          alt=""
          className="h-12 w-12 rounded-2xl object-cover"
        />
      )}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
      )}
    </div>
  );
}

export default function Chat() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [activeRoomId, setActiveRoomId] = useState(conversations[0].id);
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState(fallbackMembers);
  const [presence, setPresence] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [callActive, setCallActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState('');
  const [socketStatus, setSocketStatus] = useState('Connecting');
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeRoomId) || conversations[0],
    [activeRoomId]
  );

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return conversations;
    return conversations.filter((conversation) => (
      conversation.name.toLowerCase().includes(normalizedQuery)
      || conversation.subtitle.toLowerCase().includes(normalizedQuery)
      || conversation.preview.toLowerCase().includes(normalizedQuery)
      || conversation.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    ));
  }, [query]);

  const memberById = useMemo(() => {
    const map = new Map();
    members.forEach((member) => map.set(member.user_id, member));
    if (user?.userId && !map.has(user.userId)) {
      map.set(user.userId, {
        user_id: user.userId,
        display_name: 'You',
        status: 'Online',
        avatar_url: '',
      });
    }
    return map;
  }, [members, user]);

  const activePresence = useMemo(
    () => presence.filter((member) => member.roomId === activeRoomId || !member.roomId),
    [presence, activeRoomId]
  );

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    profilesAPI.get('/profiles')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setMembers([
            ...res.data.map((profile) => ({
              user_id: profile.user_id,
              display_name: profile.display_name || `Member ${profile.user_id.slice(0, 6)}`,
              status: profile.status || 'Team member',
              avatar_url: profile.avatar_url || '',
            })),
            ...fallbackMembers,
          ]);
        }
      })
      .catch(() => {});
  }, [token, navigate]);

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus('Online');
      socket.emit('join_room', { roomId: activeRoomId });
    });

    socket.on('disconnect', () => {
      setSocketStatus('Offline');
    });

    messagesAPI
      .get(`/messages/${activeRoomId}`)
      .then((res) => setMessages(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMessages([]));

    socket.on('new_message', (message) => {
      if (message.room_id === activeRoomId) {
        setMessages((previousMessages) => [...previousMessages, message]);
      }
    });

    socket.on('room_presence', ({ roomId, members: roomMembers }) => {
      if (roomId === activeRoomId) {
        setPresence((roomMembers || []).map((member) => ({ ...member, roomId })));
      }
    });

    socket.on('typing', ({ roomId, userId, isTyping }) => {
      if (roomId !== activeRoomId || userId === user?.userId) return;
      setTypingUsers((previousUsers) => {
        const nextUsers = new Set(previousUsers);
        if (isTyping) nextUsers.add(userId);
        else nextUsers.delete(userId);
        return [...nextUsers];
      });
    });

    return () => {
      socket.emit('leave_room', { roomId: activeRoomId });
      socket.disconnect();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [token, user?.userId, activeRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const sendTypingStart = () => {
    socketRef.current?.emit('typing_start', { roomId: activeRoomId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit('typing_stop', { roomId: activeRoomId });
    }, 900);
  };

  const handleContentChange = (event) => {
    setContent(event.target.value);
    sendTypingStart();
  };

  const sendMessage = () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;
    socketRef.current?.emit('send_message', {
      roomId: activeRoomId,
      content: trimmedContent,
    });
    socketRef.current?.emit('typing_stop', { roomId: activeRoomId });
    setContent('');
  };

  const isOwnMessage = (message) => message.sender_id === user?.userId;

  const selectRoom = (roomId) => {
    setMessages([]);
    setTypingUsers([]);
    setPresence([]);
    setSocketStatus('Connecting');
    setActiveRoomId(roomId);
  };

  const getMessageAuthor = (message) => {
    if (isOwnMessage(message)) {
      return {
        display_name: 'You',
        avatar_url: avatarUrl(user?.userId || 'you'),
      };
    }
    const member = memberById.get(message.sender_id);
    return {
      display_name: member?.display_name || `Member ${message.sender_id?.slice(0, 6) || ''}`,
      avatar_url: member?.avatar_url || avatarUrl(message.sender_id || 'member'),
    };
  };

  const getConversationPreview = (conversation) => {
    if (conversation.id !== activeRoomId || messages.length === 0) return conversation.preview;
    return messages[messages.length - 1].content;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="h-screen overflow-hidden bg-white text-slate-950">
      <div className="flex h-full">
        <aside className="hidden w-[88px] shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col md:items-center md:justify-between md:py-4">
          <div className="flex flex-col items-center gap-8">
            <button
              type="button"
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-black text-white shadow-lg shadow-indigo-200"
              title="CoWork App"
            >
              C
            </button>
            <nav className="flex flex-col items-center gap-5 text-slate-900">
              <button type="button" className="rounded-2xl p-3 transition hover:bg-indigo-50 hover:text-indigo-600" title="Home">
                <UserRound size={22} />
              </button>
              <button type="button" className="rounded-2xl bg-indigo-50 p-3 text-indigo-600" title="Messages">
                <MessageCircle size={22} />
              </button>
              <button type="button" className="rounded-2xl p-3 transition hover:bg-indigo-50 hover:text-indigo-600" title="Directory">
                <UsersRound size={22} />
              </button>
              <button type="button" className="rounded-2xl p-3 transition hover:bg-indigo-50 hover:text-indigo-600" title="Search">
                <Search size={22} />
              </button>
              <button type="button" className="rounded-2xl p-3 transition hover:bg-indigo-50 hover:text-indigo-600" title="Calendar">
                <CalendarDays size={22} />
              </button>
            </nav>
          </div>

          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="rounded-2xl p-3 text-slate-900 transition hover:bg-indigo-50 hover:text-indigo-600"
              title="Profile settings"
            >
              <Settings size={22} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl p-3 text-slate-900 transition hover:bg-red-50 hover:text-red-500"
              title="Logout"
            >
              <LogOut size={22} />
            </button>
          </div>
        </aside>

        <section className="hidden w-full shrink-0 flex-col border-r border-slate-200 bg-white md:flex md:w-[350px]">
          <header className="flex h-20 items-center justify-between border-b border-slate-200 px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">CoWork App</p>
              <div className="mt-1 flex items-center gap-3">
                <h1 className="text-2xl font-bold">Messages</h1>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {conversations.reduce((total, conversation) => total + conversation.unread, 0)}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-500"
              title="New conversation"
            >
              <Bell size={20} />
            </button>
          </header>

          <div className="px-6 py-4">
            <label className="flex h-12 items-center gap-3 rounded-xl bg-slate-100 px-4 text-slate-400">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search messages"
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => selectRoom(conversation.id)}
                className={`mb-2 flex w-full gap-4 rounded-2xl p-3 text-left transition ${
                  conversation.id === activeRoomId
                    ? 'bg-indigo-50'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                <img
                  src={avatarUrl(conversation.seed)}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold text-slate-950">{conversation.name}</span>
                    <span className="text-xs font-semibold text-slate-400">{conversation.time}</span>
                  </span>
                  <span className="mt-1 block truncate text-sm text-slate-500">
                    {getConversationPreview(conversation)}
                  </span>
                  <span className="mt-3 flex flex-wrap gap-2">
                    {conversation.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${tagStyles[tag] || 'bg-slate-100 text-slate-600'}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <main className="flex min-w-0 flex-1 flex-col bg-white">
          <header className="flex h-20 items-center justify-between border-b border-slate-200 px-6">
            <div className="flex items-center gap-4">
              <img
                src={avatarUrl(activeConversation.seed)}
                alt=""
                className="h-12 w-12 rounded-2xl object-cover"
              />
              <div>
                <h2 className="text-xl font-bold">{activeConversation.name}</h2>
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span>{socketStatus}</span>
                  <span>·</span>
                  <span>{activePresence.length || 1} online</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCallActive((value) => !value)}
                className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition ${
                  callActive
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                }`}
              >
                <Phone size={18} />
                {callActive ? 'Call ready' : 'Call'}
              </button>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"
                title="More options"
              >
                <MoreVertical size={20} />
              </button>
            </div>
          </header>

          <section className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <img
                  src={avatarUrl(activeConversation.seed)}
                  alt=""
                  className="mb-5 h-20 w-20 rounded-3xl object-cover"
                />
                <h3 className="text-lg font-bold">Start the {activeConversation.name} conversation</h3>
                <p className="mt-2 max-w-sm text-sm text-slate-500">
                  Send the first message and CoWork App will keep the history in this room.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message) => {
                  const author = getMessageAuthor(message);
                  const ownMessage = isOwnMessage(message);
                  return (
                    <div
                      key={message.id}
                      className={`flex items-end gap-3 ${ownMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      {!ownMessage && (
                        <img
                          src={author.avatar_url}
                          alt=""
                          className="h-10 w-10 rounded-2xl object-cover"
                        />
                      )}
                      <div className={`max-w-[68%] ${ownMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                        <span className="mb-1 text-xs font-semibold text-slate-400">
                          {author.display_name}
                          {message.created_at ? ` · ${formatMessageTime(message.created_at)}` : ''}
                        </span>
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                            ownMessage
                              ? 'rounded-br-md bg-indigo-600 text-white'
                              : 'rounded-bl-md bg-slate-100 text-slate-950'
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                      {ownMessage && (
                        <img
                          src={author.avatar_url}
                          alt=""
                          className="h-10 w-10 rounded-2xl object-cover"
                        />
                      )}
                    </div>
                  );
                })}

                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <img
                      src={avatarUrl(typingUsers[0])}
                      alt=""
                      className="h-10 w-10 rounded-2xl object-cover"
                    />
                    <span className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3">
                      {memberById.get(typingUsers[0])?.display_name || 'Someone'} is typing...
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </section>

          <footer className="border-t border-slate-100 px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-900 transition hover:bg-slate-100"
                title="Attach file"
              >
                <Paperclip size={22} />
              </button>
              <label className="flex min-h-12 flex-1 items-center rounded-xl border border-slate-200 px-4 shadow-sm focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
                <input
                  value={content}
                  onChange={handleContentChange}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message"
                  className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!content.trim()}
                  className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Send message"
                >
                  <Send size={18} />
                </button>
              </label>
            </div>
          </footer>
        </main>

        <aside className="hidden w-[360px] shrink-0 flex-col border-l border-slate-200 bg-white xl:flex">
          <header className="flex h-20 items-center justify-between border-b border-slate-200 px-6">
            <h2 className="text-xl font-bold">Directory</h2>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"
              title="Directory menu"
            >
              <MoreVertical size={20} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <section className="border-b border-slate-200 px-6 py-6">
              <div className="mb-5 flex items-center gap-3">
                <h3 className="font-bold">Team Members</h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {members.length}
                </span>
              </div>
              <div className="space-y-5">
                {members.slice(0, 6).map((member) => {
                  const online = activePresence.some((presenceMember) => presenceMember.userId === member.user_id);
                  return (
                    <div key={member.user_id} className="flex items-center gap-4">
                      <TeamMemberAvatar member={member} online={online} />
                      <div className="min-w-0">
                        <p className="truncate font-bold">{member.display_name}</p>
                        <p className="truncate text-sm text-slate-400">{member.status}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="px-6 py-6">
              <div className="mb-5 flex items-center gap-3">
                <h3 className="font-bold">Files</h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">125</span>
              </div>
              <div className="space-y-5">
                {sharedFiles.map((file) => {
                  const Icon = file.icon;
                  return (
                    <button
                      key={file.name}
                      type="button"
                      onClick={() => setSelectedFile(file.name)}
                      className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition hover:bg-slate-50"
                    >
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${getFileTone(file.tone)}`}>
                        <Icon size={22} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{file.name}</span>
                        <span className="text-sm font-semibold text-slate-400">
                          {file.type} · {file.size}
                        </span>
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-200 text-indigo-600">
                        <Download size={18} />
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedFile && (
                <p className="mt-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
                  {selectedFile} selected for preview.
                </p>
              )}
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
