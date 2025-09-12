import React, { useState } from 'react';
import { BiSearch, BiFilterAlt } from 'react-icons/bi';

const ChatList = ({ chats, selectedChat, onChatSelect, onStatusUpdate, unreadCounts = {}, newMessageIndicators = {} }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.phone.includes(searchTerm)
  );

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

  const getStatusLabel = (status) => {
    switch (status) {
      case 'priority': return 'Priority';
      case 'regular': return 'Regular';
      case 'waitlisted': return 'Waitlisted';
      case 'call_scheduled': return 'Call Scheduled';
      case 'not_interested': return 'Not Interested';
      case 'pending_call': return 'Pending Call';
      default: return status;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="chat-list">
      <div className="search-bar">
        <div className="search-input-wrapper">
          <BiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="filter-tabs">
        <button className="filter-tab active">
          <BiFilterAlt className="filter-icon" />
          All Chats
        </button>
      </div>

      <div className="chats">
        {filteredChats.map((chat) => (
          <div
            key={chat.id}
            className={`chat-item ${selectedChat?.id === chat.id ? 'selected' : ''}`}
            onClick={() => onChatSelect(chat)}
          >
            <div className="chat-avatar">
              {chat.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="chat-content">
              <div className="chat-header">
                <div className="chat-name">
                  {chat.name}
                  {newMessageIndicators[chat.phone] && (
                    <span className="new-message-dot" title="New messages"></span>
                  )}
                </div>
                <div className="chat-time-wrapper">
                  <div className="chat-time">{formatTime(chat.lastMessageTime)}</div>
                  {unreadCounts[chat.phone] > 0 && (
                    <span className="unread-count-badge">{unreadCounts[chat.phone]}</span>
                  )}
                </div>
              </div>
              <div className="chat-preview">
                {chat.lastMessage || 'No messages yet'}
              </div>
              <div className="chat-meta">
                <span 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(chat.status) }}
                >
                  {getStatusLabel(chat.status)}
                </span>
                {chat.referredBy && (
                  <span className="referral-badge">
                    Ref: {chat.referredBy}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatList;