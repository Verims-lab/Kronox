import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function LobbyChat({ lobbyId, playerName, compact = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Initial load
  useEffect(() => {
    if (!lobbyId) return;
    base44.entities.LobbyMessage.filter({ lobby_id: lobbyId }, 'created_date', 50)
      .then(msgs => {
        setMessages(msgs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lobbyId]);

  // Real-time subscription
  useEffect(() => {
    if (!lobbyId) return;
    const unsub = base44.entities.LobbyMessage.subscribe((event) => {
      if (event.data?.lobby_id !== lobbyId) return;
      if (event.type === 'create') {
        setMessages(prev => [...prev, event.data]);
      }
    });
    return () => unsub();
  }, [lobbyId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await base44.entities.LobbyMessage.create({
      lobby_id: lobbyId,
      player_name: playerName,
      message: text,
      type: 'chat',
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`flex flex-col border border-border/30 rounded-xl bg-secondary/10 overflow-hidden ${compact ? 'h-48' : 'h-full'}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20 bg-secondary/20">
        <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-inter text-xs text-muted-foreground font-semibold uppercase tracking-wider">Lobi Sohbeti</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {loading && (
          <p className="text-xs font-inter text-muted-foreground/50 text-center pt-4">Yükleniyor...</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-xs font-inter text-muted-foreground/50 text-center pt-4">
            Henüz mesaj yok. İlk mesajı gönder!
          </p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.player_name === playerName;
            const isSystem = msg.type === 'system';

            if (isSystem) {
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <span className="text-xs font-inter text-muted-foreground/60 italic">{msg.message}</span>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && (
                  <span className="text-[10px] font-inter text-muted-foreground/60 px-1 mb-0.5">
                    {msg.player_name}
                  </span>
                )}
                <div
                  className={`max-w-[80%] px-3 py-1.5 rounded-xl text-xs font-inter leading-relaxed
                    ${isMe
                      ? 'bg-primary/80 text-primary-foreground rounded-br-sm'
                      : 'bg-secondary/60 text-foreground rounded-bl-sm'
                    }`}
                >
                  {msg.message}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/20">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mesaj yaz..."
          maxLength={200}
          className="flex-1 bg-transparent text-xs font-inter text-foreground placeholder:text-muted-foreground/50 outline-none"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="w-7 h-7 rounded-lg bg-primary/80 hover:bg-primary flex items-center justify-center disabled:opacity-30 transition-all"
        >
          <Send className="w-3.5 h-3.5 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
}