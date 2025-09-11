import React from 'react';
import { AiOutlineStar, AiOutlineTeam } from 'react-icons/ai';

const Dashboard = ({ chats }) => {
  const priorityCount = chats.filter(chat => chat.status === 'priority').length;
  const regularCount = chats.filter(chat => chat.status === 'regular').length;
  const waitlistedCount = chats.filter(chat => chat.status === 'waitlisted').length;

  return (
    <div className="dashboard">
      <h2>Dashboard Overview</h2>
      <div className="dashboard-stats">
        <div className="stat-card priority">
          <div className="stat-icon"><AiOutlineStar /></div>
          <div className="stat-content">
            <div className="stat-number">{priorityCount}</div>
            <div className="stat-label">Priority Waitlist</div>
          </div>
        </div>
        <div className="stat-card regular">
          <div className="stat-icon"><AiOutlineTeam /></div>
          <div className="stat-content">
            <div className="stat-number">{regularCount + waitlistedCount}</div>
            <div className="stat-label">Regular Waitlist</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;