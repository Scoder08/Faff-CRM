import React, { useState, useEffect, useRef } from 'react';
import ScheduleCallModal from './ScheduleCallModal';
import UserNotesModal from './UserNotesModal';
import { IoSend, IoAttach, IoEllipsisHorizontal, IoLinkOutline, IoCalendarOutline } from 'react-icons/io5';
import { BiNote, BiUser, BiBlock } from 'react-icons/bi';
import { BsCheck, BsCheckAll } from 'react-icons/bs';
import { MdError } from 'react-icons/md';
import { AiOutlineClockCircle } from 'react-icons/ai';

const ChatWindow = ({ chat, messages, onSendMessage, onStatusUpdate, onScheduleCall }) => {
  const [newMessage, setNewMessage] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const prevMessagesLength = useRef(0);
  const isInitialLoad = useRef(true);

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: instant ? "instant" : "smooth" 
    });
  };

  useEffect(() => {
    // Check if this is initial load or just new messages
    if (messages.length > 0) {
      if (isInitialLoad.current || prevMessagesLength.current === 0) {
        // Initial load or switching chats - scroll instantly
        scrollToBottom(true);
        isInitialLoad.current = false;
      } else if (messages.length > prevMessagesLength.current) {
        // New message added - smooth scroll
        scrollToBottom(false);
      }
      prevMessagesLength.current = messages.length;
    }
  }, [messages]);

  // Reset initial load flag when chat changes
  useEffect(() => {
    isInitialLoad.current = true;
    prevMessagesLength.current = 0;
  }, [chat?.phone]);

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

  const getMessageStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <BsCheck className="status-icon" />;
      case 'delivered':
        return <BsCheckAll className="status-icon" />;
      case 'read':
        return <BsCheckAll className="status-icon read" style={{ color: '#0084ff' }} />;
      case 'failed':
        return <MdError className="status-icon error" style={{ color: '#ff0000' }} />;
      default:
        return <AiOutlineClockCircle className="status-icon pending" />;
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-info">
          <div 
            className="chat-avatar-large clickable"
            onClick={() => setShowNotesModal(true)}
            title="View user notes"
          >
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
          <button className="invite-btn" title="Send invite link">
            <IoLinkOutline />
          </button>
          <button className="schedule-btn" onClick={() => setShowScheduleModal(true)}>
            <IoCalendarOutline />
          </button>
          <div className="more-menu-container">
            <button className="more-btn" onClick={() => setShowMoreMenu(!showMoreMenu)}>
              <IoEllipsisHorizontal />
            </button>
            {showMoreMenu && (
              <div className="more-menu">
                <button onClick={() => {
                  setShowNotesModal(true);
                  setShowMoreMenu(false);
                }}>
                  <BiNote className="menu-icon" /> Notes
                </button>
                {/* <button onClick={() => {
                  // Add more options here
                  setShowMoreMenu(false);
                }}>
                  <BiUser className="menu-icon" /> Profile
                </button> */}
                {/* <button onClick={() => {
                  // Add block option
                  setShowMoreMenu(false);
                }}>
                  <BiBlock className="menu-icon" /> Block
                </button> */}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="messages-container">
        <div className="messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.direction === 'outbound' || message.sender === 'user' ? 'outbound' : 'inbound'} ${message.status === 'failed' ? 'failed' : ''}`}
              data-status={message.status}
            >
              <div className="message-content">
                {message.text || message.message}
                {message.status === 'failed' && (
                  <button 
                    className="retry-btn"
                    onClick={() => onSendMessage(chat.phone, message.text || message.message)}
                    title="Retry sending"
                  >
                    Retry
                  </button>
                )}
              </div>
              <div className="message-meta">
                <span className="message-time">
                  {formatTime(message.timestamp)}
                </span>
                {(message.direction === 'outbound' || message.sender === 'user') && (
                  <span className="message-status">
                    {getMessageStatusIcon(message.status)}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form className="message-input" onSubmit={handleSendMessage}>
        <div className="input-container">
          <button type="button" className="attach-btn">
            <IoAttach />
          </button>
          <input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type="submit" className="send-btn">
            <IoSend />
          </button>
        </div>
      </form>
      
      <ScheduleCallModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        chat={chat}
        onSchedule={onScheduleCall}
      />
      
      <UserNotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        user={chat}
      />
    </div>
  );
};

export default ChatWindow;