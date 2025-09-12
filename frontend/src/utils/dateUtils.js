// Utility functions for date/time handling
// Convert any timestamp to IST

export const convertToIST = (timestamp) => {
  if (!timestamp) return null;
  
  // Create date object from timestamp
  const date = new Date(timestamp);
  
  // Check if date is valid
  if (isNaN(date.getTime())) return null;
  
  // Convert to IST (UTC + 5:30)
  // Get UTC time in milliseconds
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  
  // IST offset is UTC + 5:30 hours (19800000 milliseconds)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(utcTime + istOffset);
  
  return istTime;
};

export const formatTimeIST = (timestamp) => {
  if (!timestamp) return '';
  
  const istDate = convertToIST(timestamp);
  if (!istDate) return '';
  
  const now = convertToIST(new Date());
  const isToday = istDate.toDateString() === now.toDateString();
  
  if (isToday) {
    // Show time for today's messages
    return istDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  } else {
    // Show date for older messages
    return istDate.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short' 
    });
  }
};

// Format for message timestamps - always show date and time
export const formatMessageTimeIST = (timestamp) => {
  if (!timestamp) return '';
  
  const istDate = convertToIST(timestamp);
  if (!istDate) return '';
  
  const now = convertToIST(new Date());
  const isToday = istDate.toDateString() === now.toDateString();
  
  // Get yesterday's date
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = istDate.toDateString() === yesterday.toDateString();
  
  // Format time part
  const timeStr = istDate.toLocaleTimeString('en-IN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (isToday) {
    return `Today, ${timeStr}`;
  } else if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  } else {
    // Show full date with time
    const dateStr = istDate.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short',
      year: istDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
    return `${dateStr}, ${timeStr}`;
  }
};

export const formatDateTimeIST = (timestamp) => {
  if (!timestamp) return '';
  
  const istDate = convertToIST(timestamp);
  if (!istDate) return '';
  
  return istDate.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export const getISTTimestamp = () => {
  // Get current time in IST
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(utcTime + istOffset).toISOString();
};