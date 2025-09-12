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
import { getISTTimestamp } from './utils/dateUtils';
import './App.css';

function App() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const selectedChatRef = useRef(selectedChat);
  const [socket, setSocket] = useState(null);
  const messagesCache = useRef({}); // Cache messages by phone number
  const cacheTimestamps = useRef({}); // Track when cache was last updated
  const [unreadCounts, setUnreadCounts] = useState({}); // Track unread messages per chat
  const [newMessageIndicators, setNewMessageIndicators] = useState({}); // Track which chats have new messages
  const [statusFilter, setStatusFilter] = useState('all'); // Status filter state

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
      
      // Track new messages for other chats
      if (messageData.direction === 'inbound' && (!currentChat || messageData.phone !== currentChat.phone)) {
        // Mark this chat as having new messages
        setNewMessageIndicators(prev => ({
          ...prev,
          [messageData.phone]: true
        }));
        
        // Increment unread count
        setUnreadCounts(prev => ({
          ...prev,
          [messageData.phone]: (prev[messageData.phone] || 0) + 1
        }));
        
        // Invalidate cache for this chat so it refreshes next time
        if (messagesCache.current[messageData.phone]) {
          delete cacheTimestamps.current[messageData.phone];
        }
      }
      
      if (currentChat && messageData.phone === currentChat.phone) {
        // Add the new message directly and sort
        const newMessage = {
          id: messageData.messageId || `msg_${Date.now()}`,
          message: messageData.message,
          direction: messageData.direction,
          timestamp: messageData.timestamp,
          status: messageData.status || 'sent',
          whatsappMessageId: messageData.whatsappMessageId
        };
        
        setMessages(prevMessages => {
          // First check if this message already exists by its IDs
          const existingIndex = prevMessages.findIndex(msg => 
            (msg.id && msg.id === newMessage.id) || 
            (msg.whatsappMessageId && newMessage.whatsappMessageId && 
             msg.whatsappMessageId === newMessage.whatsappMessageId)
          );
          
          if (existingIndex !== -1) {
            console.log('Message already exists, skipping duplicate:', newMessage.id);
            return prevMessages;
          }
          
          // Check if this is replacing an optimistic message
          if (messageData.direction === 'outbound') {
            const optimisticIndex = prevMessages.findIndex(msg => 
              msg.status === 'pending' && 
              msg.message === messageData.message && 
              msg.phone === messageData.phone &&
              msg.tempId // Has a tempId, meaning it's optimistic
            );
            
            if (optimisticIndex !== -1) {
              console.log('Replacing optimistic message with real message');
              const updated = [...prevMessages];
              // Replace optimistic message with the real one
              updated[optimisticIndex] = newMessage;
              return updated.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            }
          }
          
          // If no duplicate and not replacing optimistic, add as new message
          const updatedMessages = [...prevMessages, newMessage];
          // Sort by timestamp to maintain chronological order
          const sorted = updatedMessages.sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
          );
          
          // Update cache if this is for the current chat
          if (messageData.phone === currentChat.phone) {
            messagesCache.current[messageData.phone] = sorted;
          }
          
          return sorted;
        });
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

  const fetchMessages = async (phone, forceRefresh = false) => {
    // Check if cache is stale (older than 30 seconds)
    const cacheAge = cacheTimestamps.current[phone] 
      ? Date.now() - cacheTimestamps.current[phone] 
      : Infinity;
    const isStale = cacheAge > 30000; // 30 seconds
    
    // Check cache first unless force refresh or stale
    if (!forceRefresh && !isStale && messagesCache.current[phone]) {
      console.log('Using cached messages for:', phone);
      setMessages(messagesCache.current[phone]);
      
      // Still fetch in background to ensure freshness
      fetchMessagesInBackground(phone);
      return;
    }

    setMessagesLoading(true);
    try {
      const response = await fetch(`${config.API_URL}/api/messages/${phone}`);
      const data = await response.json();
      
      // Handle new paginated response format
      const messages = data.messages || data;
      
      // Ensure messages are sorted by timestamp
      const sortedMessages = messages.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      
      // Cache the messages with timestamp
      messagesCache.current[phone] = sortedMessages;
      cacheTimestamps.current[phone] = Date.now();
      
      // Clean up old cache entries if too many (keep last 10 chats)
      const cacheKeys = Object.keys(messagesCache.current);
      if (cacheKeys.length > 10) {
        const oldestKey = cacheKeys[0];
        delete messagesCache.current[oldestKey];
        delete cacheTimestamps.current[oldestKey];
      }
      
      setMessages(sortedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const fetchMessagesInBackground = async (phone) => {
    try {
      const response = await fetch(`${config.API_URL}/api/messages/${phone}`);
      const data = await response.json();
      
      // Handle new paginated response format
      const messages = data.messages || data;
      
      const sortedMessages = messages.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      
      // Update cache silently
      messagesCache.current[phone] = sortedMessages;
      cacheTimestamps.current[phone] = Date.now();
      
      // Update UI if still viewing this chat
      if (selectedChatRef.current && selectedChatRef.current.phone === phone) {
        setMessages(sortedMessages);
      }
    } catch (error) {
      console.error('Background fetch error:', error);
    }
  };

  const handleChatSelect = (chat) => {
    // Immediately switch chat (optimistic update)
    setSelectedChat(chat);
    
    // Clear new message indicator for this chat
    setNewMessageIndicators(prev => {
      const updated = { ...prev };
      delete updated[chat.phone];
      return updated;
    });
    
    // Clear unread count for this chat
    setUnreadCounts(prev => {
      const updated = { ...prev };
      delete updated[chat.phone];
      return updated;
    });
    
    // Show cached messages immediately if available
    if (messagesCache.current[chat.phone]) {
      setMessages(messagesCache.current[chat.phone]);
      // Always fetch fresh data to ensure we have latest
      fetchMessages(chat.phone, false);
    } else {
      // No cache, show loading and fetch
      setMessages([]);
      fetchMessages(chat.phone);
    }
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
      message: message,  // Changed from 'text' to 'message' for consistency
      direction: 'outbound',
      timestamp: getISTTimestamp(),  // Use IST timestamp
      status: 'pending',
      phone: phone,
      sentBy: user?.id,
      sentByName: getUserName()
    };

    // Immediately add the message to the UI with pending status (sorted)
    setMessages(prevMessages => {
      const newMessages = [...prevMessages, optimisticMessage];
      // Sort by timestamp to maintain chronological order
      return newMessages.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
    });

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
        
        // Update the optimistic message with the real ID and sent status
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.tempId === tempId 
              ? { 
                  ...msg, 
                  id: data.messageId || msg.id, 
                  status: 'sent', 
                  whatsappMessageId: data.whatsappMessageId,
                  tempId: undefined  // Clear tempId after successful send
                }
              : msg
          )
        );
        
        // Update last message locally instead of fetching (faster)
        setChats(prevChats => 
          prevChats.map(chat => 
            chat.phone === phone 
              ? { ...chat, lastMessage: message, lastMessageTime: getISTTimestamp() }
              : chat
          )
        );
      } else {
        // Mark the optimistic message as failed
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
      // Mark the optimistic message as failed on error
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: 'width: 32px; height: 32px;'
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
        <Dashboard 
          chats={chats} 
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
        />
        <ChatList 
          chats={chats} 
          selectedChat={selectedChat}
          onChatSelect={handleChatSelect}
          onStatusUpdate={updateStatus}
          unreadCounts={unreadCounts}
          newMessageIndicators={newMessageIndicators}
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
        />
      </div>
      <div className="app-main">
        {selectedChat ? (
          <div style={{ position: 'relative', height: '100%' }}>
            <ChatWindow 
              chat={selectedChat}
              messages={messages}
              onSendMessage={sendMessage}
              onStatusUpdate={updateStatus}
              onScheduleCall={scheduleCall}
            />
            {messagesLoading && messages.length === 0 && (
              <div className="messages-loading-overlay">
                <div className="messages-loading-content">
                  <div className="messages-loading-spinner"></div>
                  <p>Loading messages...</p>
                </div>
              </div>
            )}
          </div>
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