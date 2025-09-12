import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth, useUser, SignIn, UserButton } from '@clerk/clerk-react';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import Dashboard from './components/Dashboard';
import NotificationSettings from './components/NotificationSettings';
import { IoNotifications } from 'react-icons/io5';
import config from './config';
import notificationManager from './utils/notification';
import './App.css';

function App() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const selectedChatRef = useRef(selectedChat);
  const [socket, setSocket] = useState(null);

  // Initialize socket only when user is authenticated
  useEffect(() => {
    if (isSignedIn && user) {
      // Debug: Log all user properties
      console.log('=== CLERK USER OBJECT DEBUG ===');
      console.log('Full user object:', user);
      console.log('User ID:', user.id);
      console.log('Username:', user.username);
      console.log('Full Name:', user.fullName);
      console.log('First Name:', user.firstName);
      console.log('Last Name:', user.lastName);
      console.log('Email Addresses:', user.emailAddresses);
      console.log('Primary Email:', user.primaryEmailAddress);
      console.log('Profile Image URL:', user.profileImageUrl);
      
      // Log all properties of user object
      console.log('All user properties:');
      Object.keys(user).forEach(key => {
        console.log(`  ${key}:`, user[key]);
      });
      console.log('=== END DEBUG ===');
      
      // Get user's display name from various possible fields
      const getUserName = () => {
        console.log('Getting user name...');
        console.log('  fullName:', user?.fullName);
        console.log('  firstName:', user?.firstName);
        console.log('  lastName:', user?.lastName);
        console.log('  username:', user?.username);
        
        if (user?.fullName) {
          console.log('  Using fullName:', user.fullName);
          return user.fullName;
        }
        if (user?.firstName && user?.lastName) {
          const name = `${user.firstName} ${user.lastName}`.trim();
          console.log('  Using firstName + lastName:', name);
          return name;
        }
        if (user?.firstName) {
          console.log('  Using firstName:', user.firstName);
          return user.firstName;
        }
        if (user?.lastName) {
          console.log('  Using lastName:', user.lastName);
          return user.lastName;
        }
        if (user?.username) {
          console.log('  Using username:', user.username);
          return user.username;
        }
        
        // Try email addresses array
        if (user?.emailAddresses && user.emailAddresses.length > 0) {
          const email = user.emailAddresses[0].emailAddress;
          const emailName = email.split('@')[0];
          console.log('  Using email from emailAddresses:', emailName);
          return emailName;
        }
        
        if (user?.primaryEmailAddress?.emailAddress) {
          const emailName = user.primaryEmailAddress.emailAddress.split('@')[0];
          console.log('  Using primary email prefix:', emailName);
          return emailName;
        }
        
        console.log('  Using default: User');
        return 'User';
      };
      
      const userName = getUserName();
      
      const newSocket = io(config.SOCKET_URL, {
        auth: {
          userId: user.id,
          userEmail: user.primaryEmailAddress?.emailAddress,
          userName: userName
        }
      });
      setSocket(newSocket);
      
      console.log('Final authenticated user info:', {
        id: user.id,
        name: userName,
        email: user.primaryEmailAddress?.emailAddress
      });
      
      return () => {
        newSocket.disconnect();
      };
    }
  }, [isSignedIn, user]);
  
  useEffect(()=> {
    console.log("=== User object updated ===");
    console.log("User:", user);
    if (user) {
      console.log("User ID:", user.id);
      console.log("User email:", user.emailAddresses);
      console.log("Primary email:", user.primaryEmailAddress);
    }
  }, [user])
  // Load chats when user is authenticated
  useEffect(() => {
    if (isSignedIn && isLoaded) {
      console.log('User authenticated, loading chats...');
      setLoading(true);
      fetchChats();
    } else if (!isSignedIn && isLoaded) {
      console.log('User not authenticated');
      setLoading(false);
    }
  }, [isSignedIn, isLoaded]);

  // Update ref when selectedChat changes
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (!socket || !isSignedIn) return;

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
  }, [socket, isSignedIn]); // Re-setup when socket or auth changes

  const fetchChats = async () => {
    console.log('Fetching chats...');
    try {
      const response = await fetch(`${config.API_URL}/api/chats`);
      
      if (!response.ok) {
        console.error('Failed to fetch chats:', response.status, response.statusText);
        const errorData = await response.json();
        console.error('Error details:', errorData);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log('Fetched chats:', data);
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
    // Get user's display name
    const getUserName = () => {
      console.log('SendMessage - Getting user name from:', user);
      
      if (!user) {
        console.log('  No user object, using default');
        return 'User';
      }
      
      // Check each field
      if (user.fullName) {
        console.log('  Found fullName:', user.fullName);
        return user.fullName;
      }
      if (user.firstName && user.lastName) {
        const name = `${user.firstName} ${user.lastName}`.trim();
        console.log('  Using firstName + lastName:', name);
        return name;
      }
      if (user.firstName) {
        console.log('  Using firstName:', user.firstName);
        return user.firstName;
      }
      if (user.lastName) {
        console.log('  Using lastName:', user.lastName);
        return user.lastName;
      }
      if (user.username) {
        console.log('  Using username:', user.username);
        return user.username;
      }
      
      // Try email addresses array (Clerk v5 structure)
      if (user.emailAddresses && user.emailAddresses.length > 0) {
        const email = user.emailAddresses[0].emailAddress;
        const emailName = email.split('@')[0];
        console.log('  Using email from emailAddresses:', emailName);
        return emailName;
      }
      
      if (user.primaryEmailAddress?.emailAddress) {
        const emailName = user.primaryEmailAddress.emailAddress.split('@')[0];
        console.log('  Using email prefix:', emailName);
        return emailName;
      }
      
      console.log('  No name fields found, using default: User');
      return 'User';
    };
    
    // Generate a temporary ID for the optimistic message
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const optimisticMessage = {
      id: tempId,
      tempId: tempId,
      sender: 'user',
      text: message,
      timestamp: new Date().toISOString(),
      status: 'pending',
      phone: phone,
      sentBy: user?.id,
      sentByName: getUserName()
    };

    // Immediately add the message to the UI with pending status
    setMessages(prevMessages => [...prevMessages, optimisticMessage]);

    try {
      const response = await fetch(`${config.API_URL}/api/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phone, 
          message, 
          tempId,
          userId: user?.id,
          userName: getUserName(),
          userEmail: user?.primaryEmailAddress?.emailAddress
        }),
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

  // Show loading while Clerk is loading
  if (!isLoaded) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading authentication...</p>
      </div>
    );
  }

  // Show sign-in if user is not authenticated
  if (!isSignedIn) {
    return (
      <div className="auth-container" style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          marginBottom: '2rem'
        }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            marginBottom: '1rem',
            color: '#1a1a1a',
            textAlign: 'center'
          }}>
            WhatsApp CRM
          </h1>
          <p style={{ 
            color: '#666', 
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            Please sign in to access your WhatsApp conversations
          </p>
          <SignIn 
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'shadow-none'
              }
            }}
          />
        </div>
      </div>
    );
  }

  // Show loading for app data
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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8'
                }
              }}
            />
            <button 
              className="notification-btn"
              onClick={() => setShowNotificationSettings(true)}
              title="Notification Settings"
            >
              <IoNotifications />
            </button>
          </div>
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