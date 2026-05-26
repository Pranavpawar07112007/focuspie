import React, { useState, useEffect, useRef } from 'react';
import { Send, User as UserIcon } from 'lucide-react';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { WS_ROOMS } from '../api';

export default function RoomChat() {
  const { currentRoomId, roomDetails } = useRoom();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!currentRoomId || !user) return;

    let active = true;
    
    function connect() {
      if (!active) return;
      // Connect to the room WebSocket (using a dedicated connection for chat)
      // or we can just reuse the room connection, but since RoomContext doesn't expose the send function for raw messages, 
      // it's easier to create a lightweight secondary websocket specifically for chat.
      // Wait, let's just use the same URL.
      wsRef.current = new WebSocket(`${WS_ROOMS}/${currentRoomId}?user_id=${user.id}`);
      
      wsRef.current.onmessage = (e) => {
        if (!active) return;
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'CHAT_MESSAGE') {
            setMessages(prev => [...prev, data.payload]);
          }
        } catch (err) {}
      };

      wsRef.current.onclose = () => {
        if (active) setTimeout(connect, 3000);
      };
    }
    
    connect();

    return () => {
      active = false;
      if (wsRef.current) wsRef.current.close();
    };
  }, [currentRoomId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    const messagePayload = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      user_id: user.id,
      username: user.username,
      timestamp: new Date().toISOString()
    };
    
    wsRef.current.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      payload: messagePayload
    }));
    
    setNewMessage('');
  };

  const getUsername = (userId) => {
    const member = roomDetails?.members.find(m => m.user_id === userId);
    return member ? member.username : 'Unknown';
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0f1c] rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5">
        <h3 className="font-bold text-black dark:text-white">Live Chat</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-4">No messages yet. Say hi!</div>
        ) : (
          messages.map(msg => {
            const isMe = msg.user_id === user.id;
            return (
              <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                <span className="text-[10px] text-slate-500 mb-0.5 ml-1">{msg.username}</span>
                <div className={`px-3 py-2 rounded-2xl text-sm ${
                  isMe 
                    ? 'bg-brand-blue text-white rounded-tr-sm' 
                    : 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-white/5 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm outline-none focus:border-brand-blue dark:focus:border-brand-blue transition-colors"
        />
        <button 
          type="submit" 
          disabled={!newMessage.trim()}
          className="p-2 rounded-full bg-brand-blue text-white disabled:opacity-50 hover:bg-brand-blue/90 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
