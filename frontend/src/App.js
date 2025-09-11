import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import Dashboard from './components/Dashboard';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
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

    socket.on('new_message', (messageData) => {
      // Update chats list
      fetchChats();
      
      // Update messages if it's for current chat using ref
      const currentChat = selectedChatRef.current;
      if (currentChat && messageData.phone === currentChat.phone) {
        fetchMessages(currentChat.phone);
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
      const response = await fetch('http://localhost:5000/api/chats');
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
      const response = await fetch(`http://localhost:5000/api/messages/${phone}`);
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
    try {
      const response = await fetch('http://localhost:5000/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, message }),
      });
      
      if (response.ok) {
        fetchMessages(phone);
        fetchChats();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const updateStatus = async (phone, status) => {
    try {
      const response = await fetch('http://localhost:5000/api/update-status', {
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
          <button className="invite-btn">
            🔗 Send Invite Link
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
          />
        ) : (
          <div className="no-chat-selected">
            <h2>Select a chat to start messaging</h2>
            <p>Choose a conversation from the sidebar to view messages</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;