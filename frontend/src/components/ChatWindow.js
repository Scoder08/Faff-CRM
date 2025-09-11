import React, { useState, useEffect, useRef } from 'react';

const ChatWindow = ({ chat, messages, onSendMessage, onStatusUpdate }) => {
  const [newMessage, setNewMessage] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(chat.phone, newMessage);
      setNewMessage('');
    }
  };

  const handleStatusChange = (newStatus) => {
    onStatusUpdate(chat.phone, newStatus);
    setShowStatusMenu(false);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'priority': return '#ff6b35';
      case 'regular': return '#f7d794';
      case 'waitlisted': return '#ffbe76';
      case 'call_scheduled': return '#00d2d3';
      case 'not_interested': return '#ff7675';
      case 'pending_call': return '#74b9ff';
      default: return '#ddd';
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-info">
          <div className="chat-avatar-large">
            {chat.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="chat-details">
            <h3>{chat.name}</h3>
            <p>{chat.phone}</p>
            {chat.referredBy && (
              <p className="referral-info">Ref by: {chat.referredBy}</p>
            )}
          </div>
        </div>
        <div className="chat-actions">
          <div className="status-dropdown">
            <button 
              className="status-btn"
              style={{ backgroundColor: getStatusColor(chat.status) }}
              onClick={() => setShowStatusMenu(!showStatusMenu)}
            >
              {chat.status.replace('_', ' ').toUpperCase()}
            </button>
            {showStatusMenu && (
              <div className="status-menu">
                <button onClick={() => handleStatusChange('priority')}>Priority</button>
                <button onClick={() => handleStatusChange('regular')}>Regular</button>
                <button onClick={() => handleStatusChange('waitlisted')}>Waitlisted</button>
                <button onClick={() => handleStatusChange('call_scheduled')}>Call Scheduled</button>
                <button onClick={() => handleStatusChange('pending_call')}>Pending Call</button>
                <button onClick={() => handleStatusChange('not_interested')}>Not Interested</button>
              </div>
            )}
          </div>
          <button className="schedule-btn">
            📅 Schedule Call
          </button>
          <button className="more-btn">⋮</button>
        </div>
      </div>

      <div className="messages-container">
        <div className="messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.direction === 'outbound' ? 'outbound' : 'inbound'}`}
            >
              <div className="message-content">
                {message.message}
              </div>
              <div className="message-time">
                {formatTime(message.timestamp)}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form className="message-input" onSubmit={handleSendMessage}>
        <div className="input-container">
          <button type="button" className="attach-btn">📎</button>
          <input
            type="text"
            placeholder="Type your message or use /command for quick replies..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type="submit" className="send-btn">
            ➤
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatWindow;