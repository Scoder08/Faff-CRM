import React, { useState } from 'react';
import { BiSearch } from 'react-icons/bi';
import { formatMessageTimeIST } from '../utils/dateUtils';

const ChatList = ({ chats, selectedChat, onChatSelect, onStatusUpdate, unreadCounts = {}, newMessageIndicators = {}, statusFilter = 'all', onFilterChange }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredChats = chats.filter(chat => {
    // Search filter
    const matchesSearch = 
      chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.phone.includes(searchTerm) ||
      (chat.referredBy && chat.referredBy.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Status filter
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'priority' && chat.status === 'priority') ||
      (statusFilter === 'regular_waitlist' && (chat.status === 'regular' || chat.status === 'waitlisted')) ||
      (statusFilter === 'waitlisted' && chat.status === 'waitlisted') ||
      (statusFilter === 'regular' && chat.status === 'regular');
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'priority': return '#ff6b35';
      case 'regular': return '#f7d794';
      case 'waitlisted': return '#ffbe76';
      case 'call_scheduled': return '#00d2d3';
      case 'not_interested': return '#ff7675';
      case 'pending_call': return '#74b9ff';
      case 'onboarded': return '#27ae60';
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
      case 'onboarded': return 'Onboarded';
      default: return status;
    }
  };


  return (
    <div className="chat-list">
      <div className="search-bar">
        <div className="search-input-wrapper">
          <BiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, phone, or referrer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
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
                  <div className="chat-time">{formatMessageTimeIST(chat.lastMessageTime)}</div>
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
                {chat.isPaid && (
                  <span className="payment-badge" style={{
                    backgroundColor: '#27ae60',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    marginLeft: '6px'
                  }}>
                    PAID
                  </span>
                )}
                {!chat.isPaid && (
                  <span className="payment-badge" style={{
                    backgroundColor: '#f0f2f5',
                    color: 'black',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    marginLeft: '6px'
                  }}>
                    UNPAID
                  </span>
                )}
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