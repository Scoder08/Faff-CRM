import React, { useState, useEffect, useRef } from 'react';
import ScheduleCallModal from './ScheduleCallModal';
import UserNotesModal from './UserNotesModal';
import './InviteModal.css';
import Select from 'react-select';
import { IoSend, IoAttach, IoEllipsisHorizontal, IoLinkOutline, IoCalendarOutline } from 'react-icons/io5';
import { BiNote } from 'react-icons/bi';
import { BsCheck, BsCheckAll } from 'react-icons/bs';
import { MdError } from 'react-icons/md';
import { AiOutlineClockCircle } from 'react-icons/ai';
import { formatMessageTimeIST } from '../utils/dateUtils';
import config from '../config';

const ChatWindow = ({ chat, messages, onSendMessage, onStatusUpdate, onScheduleCall }) => {
  const [newMessage, setNewMessage] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedReferrer, setSelectedReferrer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [groupNameError, setGroupNameError] = useState('');
  const [inviteStatus, setInviteStatus] = useState(null); // 'sending', 'success', 'error'
  const [inviteError, setInviteError] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const prevMessagesLength = useRef(0);
  const isInitialLoad = useRef(true);
  
  // Fetch customers when modal opens
  useEffect(() => {
    if (showInviteModal) {
      fetchCustomers();
    }
  }, [showInviteModal]);
  
  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const response = await fetch(`${config.API_URL}/api/customers`);
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };
  
  const validateGroupName = (name) => {
    if (!name.trim()) {
      setGroupNameError('Group name is required');
      return false;
    }
    
    // Check if name already exists
    const nameExists = customers.some(
      customer => customer.name?.toLowerCase() === name.toLowerCase()
    );
    
    if (nameExists) {
      setGroupNameError(`Group name "${name}" already exists. Please choose a unique name.`);
      return false;
    }
    
    setGroupNameError('');
    return true;
  };

  const scrollToBottom = (instant = false) => {
    // Use requestAnimationFrame to ensure DOM has painted
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current;
          // Force instant scroll to bottom
          container.scrollTop = container.scrollHeight + 1000;
        }
        // Also use scrollIntoView as backup
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ 
            behavior: instant ? "instant" : "smooth",
            block: "end",
            inline: "nearest"
          });
        }
      }, instant ? 0 : 100);
    });
  };

  useEffect(() => {
    // Always scroll to bottom when messages change
    if (messages.length > 0) {
      // Multiple timeouts to ensure scroll happens
      scrollToBottom(true);
      // Backup scroll after a short delay
      setTimeout(() => scrollToBottom(true), 100);
      // Final backup scroll
      setTimeout(() => scrollToBottom(true), 300);
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  // Reset and scroll when chat changes
  useEffect(() => {
    isInitialLoad.current = true;
    prevMessagesLength.current = 0;
    // Immediate scroll
    scrollToBottom(true);
    // Multiple attempts to ensure it works
    setTimeout(() => scrollToBottom(true), 50);
    setTimeout(() => scrollToBottom(true), 150);
    setTimeout(() => scrollToBottom(true), 500);
  }, [chat?.phone]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(chat.phone, newMessage);
      setNewMessage('');
      // Scroll to bottom after sending message
      setTimeout(() => scrollToBottom(false), 100);
    }
  };

  const handleStatusChange = (newStatus) => {
    onStatusUpdate(chat.phone, newStatus);
    setShowStatusMenu(false);
  };
  
  const handleSendInvite = async () => {
    if (!validateGroupName(groupName)) {
      return;
    }
    if (sendingInvite) return;
    
    setSendingInvite(true);
    setInviteStatus('sending');
    setInviteError('');
    
    try {
      const response = await fetch(`${config.API_URL}/api/send-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: chat.phone,
          name: groupName.trim(),
          referrerName: selectedReferrer?.label || '',
          referrerId: selectedReferrer?.value || ''
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setInviteStatus('success');
        // Auto close after 2 seconds on success
        setTimeout(() => {
          setShowInviteModal(false);
          setGroupName('');
          setSelectedReferrer(null);
          setGroupNameError('');
          setInviteStatus(null);
        }, 2000);
      } else {
        setInviteStatus('error');
        setInviteError(data.error || 'Failed to send invite. Please try again.');
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      setInviteStatus('error');
      setInviteError('Network error. Please check your connection and try again.');
    } finally {
      setSendingInvite(false);
    }
  };
  
  const resetInviteModal = () => {
    setShowInviteModal(false);
    setGroupName('');
    setSelectedReferrer(null);
    setGroupNameError('');
    setInviteStatus(null);
    setInviteError('');
  };


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

  const getMessageStatusIcon = (status, is_read) => {
    if(status === 'delivered' && is_read){
      status = 'read'
    }

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
                <button onClick={() => handleStatusChange('onboarded')}>Onboarded</button>
                <button onClick={() => handleStatusChange('not_interested')}>Not Interested</button>
              </div>
            )}
          </div>
          {chat.status !== 'onboarded' && (
            <button 
              className="invite-btn" 
              title="Send invite link"
              onClick={() => setShowInviteModal(true)}
              disabled={sendingInvite}
              style={{
                opacity: sendingInvite ? 0.6 : 1,
                cursor: sendingInvite ? 'not-allowed' : 'pointer'
              }}
            >
              {sendingInvite ? '...' : <IoLinkOutline />}
            </button>
          )}
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
        <div className="messages" ref={messagesContainerRef}>
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
                  {formatMessageTimeIST(message.timestamp)}
                </span>
                {(message.direction === 'outbound' || message.sender === 'user') && (
                  <span className="message-status">
                    {getMessageStatusIcon(message.status, message.is_read)}
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
      
      {/* Invite Modal */}
      {showInviteModal && (
        <div className="invite-modal-overlay" onClick={() => !sendingInvite && inviteStatus !== 'sending' && resetInviteModal()}>
          <div className="invite-modal-content" onClick={(e) => e.stopPropagation()}>
            {(inviteStatus === 'sending') ? (
              <div className="invite-loading-container">
                <div className="invite-loading-spinner"></div>
                <h3>Sending Invite...</h3>
                <p>Please wait while we send the invite link</p>
              </div>
            ) : inviteStatus === 'success' ? (
              <div className="invite-result-container success">
                <div className="invite-result-icon">
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="2"/>
                    <path d="M8 12L11 15L16 9" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>Invite Sent Successfully!</h3>
                <p>The invite link has been sent to {chat.name}</p>
              </div>
            ) : inviteStatus === 'error' ? (
              <div className="invite-result-container error">
                <div className="invite-result-icon">
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/>
                    <path d="M15 9L9 15M9 9L15 15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>Failed to Send Invite</h3>
                <p>{inviteError}</p>
                <button className="invite-retry-btn" onClick={() => {
                  setInviteStatus(null);
                  setInviteError('');
                }}>
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="invite-modal-header">
                  <h3>Send Invite Link</h3>
                  <button className="invite-close-btn" onClick={resetInviteModal}>×</button>
                </div>
                <div className="invite-modal-body">
              <label htmlFor="group-name">Enter Group Name:</label>
              <input
                id="group-name"
                type="text"
                value={groupName}
                onChange={(e) => {
                  setGroupName(e.target.value);
                  validateGroupName(e.target.value);
                }}
                placeholder="e.g., Marketing Team"
                autoFocus
                className={groupNameError ? 'error' : ''}
              />
              {groupNameError && (
                <p className="error-message" style={{color: 'red', fontSize: '14px', marginTop: '5px'}}>
                  {groupNameError}
                </p>
              )}
              
              <label htmlFor="referrer-select" style={{marginTop: '15px', display: 'block'}}>
                Select Referrer:
              </label>
              <Select
                id="referrer-select"
                value={selectedReferrer}
                onChange={setSelectedReferrer}
                options={customers.map(c => ({
                  value: c.id,
                  label: c.name
                }))}
                isSearchable
                isClearable
                isLoading={loadingCustomers}
                placeholder="Search and select referrer..."
                noOptionsMessage={() => "No referrers found"}
                styles={{
                  control: (base) => ({
                    ...base,
                    marginTop: '5px'
                  })
                }}
              />
              {selectedReferrer && (
                <p className="referrer-note" style={{marginTop: '10px'}}>
                  ℹ️ Referrer "{selectedReferrer.label}" will be included in the message
                </p>
              )}
            </div>
            <div className="invite-modal-footer">
              <button 
                className="invite-cancel-btn" 
                onClick={resetInviteModal}
                disabled={sendingInvite}
              >
                Cancel
              </button>
              <button 
                className="invite-confirm-btn" 
                onClick={handleSendInvite}
                disabled={sendingInvite || !groupName.trim()}
              >
                Send Invite
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;