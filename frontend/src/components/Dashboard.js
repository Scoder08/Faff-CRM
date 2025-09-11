import React from 'react';

const Dashboard = ({ chats }) => {
  const priorityCount = chats.filter(chat => chat.status === 'priority').length;
  const regularCount = chats.filter(chat => chat.status === 'regular').length;
  const waitlistedCount = chats.filter(chat => chat.status === 'waitlisted').length;

  return (
    <div className="dashboard">
      <h2>Dashboard Overview</h2>
      <div className="dashboard-stats">
        <div className="stat-card priority">
          <div className="stat-number">{priorityCount}</div>
          <div className="stat-label">⭐ Priority Waitlist</div>
        </div>
        <div className="stat-card regular">
          <div className="stat-number">{regularCount}</div>
          <div className="stat-label">🔒 Regular Waitlist</div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;