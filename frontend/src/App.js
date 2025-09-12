import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import Dashboard from './components/Dashboard';
import NotificationSettings from './components/NotificationSettings';
import { IoNotifications } from 'react-icons/io5';
import config from './config';
import notificationManager from './utils/notification';
import './App.css';

const socket = io(config.SOCKET_URL);

function App() {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const selectedChatRef = useRef(selectedChat);

  // Update ref when selectedChat changes
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    // Load initial chats
    fetchChats();

    // Socket listeners
    socket.on('connected', (data) => {
      console.log('Connected to server:', data);
    });

    socket.on('new_message', async (messageData) => {
      // Update chats list
      fetchChats();
      
      // Update messages if it's for current chat using ref
      const currentChat = selectedChatRef.current;
      if (currentChat && messageData.phone === currentChat.phone) {
        fetchMessages(currentChat.phone);
      }
      
      // Play notification sound for incoming messages
      if (messageData.direction === 'inbound') {
        // Find the sender's name from chats
        const senderChat = chats.find(chat => chat.phone === messageData.phone);
        const senderName = senderChat?.name || messageData.phone;
        
        // Show notification if the app is not focused or it's a different chat
        if (!document.hasFocus() || !currentChat || currentChat.phone !== messageData.phone) {
          await notificationManager.notifyNewMessage(messageData.message, senderName);
        }
      }
    });

    // Listen for message status updates
    socket.on('message_status_update', (statusData) => {
      console.log('Message status update:', statusData);
      
      // Force update the message status in the local state
      setMessages(prevMessages => {
        if (!prevMessages || prevMessages.length === 0) return prevMessages;
        
        const updated = prevMessages.map(msg => {
          // Match by MongoDB ID or WhatsApp message ID
          if (msg.id === statusData.messageId || 
              msg.whatsappMessageId === statusData.whatsappMessageId) {
            console.log(`Updating message ${msg.id} status from ${msg.status} to ${statusData.status}`);
            return { ...msg, status: statusData.status };
          }
          return msg;
        });
        
        // Create new array to force re-render
        return [...updated];
      });
    });

    return () => {
      socket.off('connected');
      socket.off('new_message');
      socket.off('message_status_update');
    };
  }, []); // Empty dependency - set up once

  const fetchChats = async () => {
    try {
      const response = await fetch(`${config.API_URL}/api/chats`);
      const data = await response.json();
      setChats(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching chats:', error);
      setLoading(false);
    }
  };

  const fetchMessages = async (phone) => {
    try {
      const response = await fetch(`${config.API_URL}/api/messages/${phone}`);
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.phone);
  };

  const sendMessage = async (phone, message) => {
    // Generate a temporary ID for the optimistic message
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const optimisticMessage = {
      id: tempId,
      tempId: tempId,
      sender: 'user',
      text: message,
      timestamp: new Date().toISOString(),
      status: 'pending',
      phone: phone
    };

    // Immediately add the message to the UI with pending status
    setMessages(prevMessages => [...prevMessages, optimisticMessage]);

    try {
      const response = await fetch(`${config.API_URL}/api/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, message, tempId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update the message with the real ID and sent status
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.tempId === tempId 
              ? { ...msg, id: data.messageId || msg.id, status: 'sent', tempId: undefined }
              : msg
          )
        );
        
        // Update last message locally instead of fetching (faster)
        setChats(prevChats => 
          prevChats.map(chat => 
            chat.phone === phone 
              ? { ...chat, lastMessage: message, lastMessageTime: new Date().toISOString() }
              : chat
          )
        );
      } else {
        // Mark message as failed
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.tempId === tempId 
              ? { ...msg, status: 'failed' }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Mark message as failed
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.tempId === tempId 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
    }
  };

  const scheduleCall = async (callData) => {
    try {
      const response = await fetch(`${config.API_URL}/api/schedule-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(callData),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Update user status locally
        setChats(prevChats => 
          prevChats.map(chat => 
            chat.phone === callData.phone ? { ...chat, status: 'call_scheduled' } : chat
          )
        );
        
        // Update selected chat if it's the one being modified
        if (selectedChat && selectedChat.phone === callData.phone) {
          setSelectedChat(prevChat => ({ ...prevChat, status: 'call_scheduled' }));
        }
        
        // Refresh chats to get latest data
        fetchChats();
        
        // Show detailed feedback
        let message = `✅ Call scheduled for ${data.scheduledDate}\n`;
        if (data.whatsappSent) {
          message += '✅ WhatsApp confirmation sent\n';
        } else {
          message += '⚠️ WhatsApp message failed (check your WhatsApp API config)\n';
        }
        if (data.emailSent) {
          message += '✅ Calendar invite sent to email\n';
        } else if (data.emailError) {
          message += `⚠️ Email not sent: ${data.emailError}\n`;
        }
        
        alert(message);
      } else {
        alert(`Failed to schedule call: ${data.error}`);
      }
    } catch (error) {
      console.error('Error scheduling call:', error);
      alert('Failed to schedule call. Please try again.');
    }
  };

  const updateStatus = async (phone, status) => {
    try {
      const response = await fetch(`${config.API_URL}/api/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, status }),
      });
      
      if (response.ok) {
        // Update the local state immediately for better UX
        setChats(prevChats => 
          prevChats.map(chat => 
            chat.phone === phone ? { ...chat, status } : chat
          )
        );
        
        // Update selected chat if it's the one being modified
        if (selectedChat && selectedChat.phone === phone) {
          setSelectedChat(prevChat => ({ ...prevChat, status }));
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading WhatsApp CRM...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-sidebar">
        <div className="app-header">
          <h1>WhatsApp CRM</h1>
          <button 
            className="notification-btn"
            onClick={() => setShowNotificationSettings(true)}
            title="Notification Settings"
          >
            <IoNotifications />
          </button>
        </div>
        <Dashboard chats={chats} />
        <ChatList 
          chats={chats} 
          selectedChat={selectedChat}
          onChatSelect={handleChatSelect}
          onStatusUpdate={updateStatus}
        />
      </div>
      <div className="app-main">
        {selectedChat ? (
          <ChatWindow 
            chat={selectedChat}
            messages={messages}
            onSendMessage={sendMessage}
            onStatusUpdate={updateStatus}
            onScheduleCall={scheduleCall}
          />
        ) : (
          <div className="no-chat-selected">
            <h2>Select a chat to start messaging</h2>
            <p>Choose a conversation from the sidebar to view messages</p>
          </div>
        )}
      </div>
      <NotificationSettings 
        isOpen={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />
    </div>
  );
}

export default App;