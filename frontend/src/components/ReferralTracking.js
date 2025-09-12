import React, { useState, useEffect } from 'react';
import { BiSearch } from 'react-icons/bi';
import './ReferralTracking.css';
import config from '../config';

const ReferralTracking = () => {
  const [referrals, setReferrals] = useState([]);
  const [statistics, setStatistics] = useState({
    totalUsers: 0,
    referredUsers: 0,
    subscribedUsers: 0,
    conversionRate: 0,
    topReferrers: []
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterReferrer, setFilterReferrer] = useState('');
  const [filterSubscription, setFilterSubscription] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    fetchReferrals();
  }, [searchTerm, filterReferrer, filterSubscription]);

  const fetchReferrals = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterReferrer) params.append('referrer', filterReferrer);
      if (filterSubscription !== 'all') params.append('subscription', filterSubscription);

      const response = await fetch(`${config.API_URL}/api/referrals?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setReferrals(data.referrals);
        setStatistics(data.statistics);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching referrals:', error);
      setLoading(false);
    }
  };

  const updateSubscriptionStatus = async (phone, status) => {
    try {
      const response = await fetch(`${config.API_URL}/api/update-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          subscriptionStatus: status,
          isNewSubscription: status === 'active',
          updatedBy: 'admin'
        }),
      });

      if (response.ok) {
        fetchReferrals(); // Refresh data
        setShowUpdateModal(false);
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
    }
  };

  const getSubscriptionBadgeClass = (status) => {
    switch (status) {
      case 'active': return 'badge-success';
      case 'trial': return 'badge-warning';
      case 'expired': return 'badge-danger';
      default: return 'badge-secondary';
    }
  };

  const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    // Format Indian phone numbers
    if (phone.startsWith('91') && phone.length === 12) {
      return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`;
    }
    return phone;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="referral-tracking-container">
        <div className="loading-container">
          <div className="loading-card">
            <div className="loading-spinner-wrapper">
              <div className="loading-spinner"></div>
            </div>
            <h2 className="loading-title">Loading User Data</h2>
            <p className="loading-text">Fetching referral information...</p>
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="referral-tracking-container">
      {/* Header */}
      <div className="referral-header">
        <h1>User Tracking Dashboard</h1>
        <p>Track and manage your referral program</p>
      </div>

      {/* Statistics Cards */}
      <div className="statistics-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{statistics.totalUsers}</div>
            <div className="stat-label">Total Users</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🔗</div>
          <div className="stat-content">
            <div className="stat-value">{statistics.referredUsers}</div>
            <div className="stat-label">Referred Users</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">💳</div>
          <div className="stat-content">
            <div className="stat-value">{statistics.subscribedUsers}</div>
            <div className="stat-label">Active Subscriptions</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-value">{statistics.conversionRate}%</div>
            <div className="stat-label">Conversion Rate</div>
          </div>
        </div>
      </div>

      {/* Top Referrers */}
      {statistics.topReferrers && statistics.topReferrers.length > 0 && (
        <div className="top-referrers-section">
          <h2>🏆 Top Referrers</h2>
          <div className="top-referrers-grid">
            {statistics.topReferrers.slice(0, 5).map((referrer, index) => (
              <div key={referrer._id} className="top-referrer-card">
                <div className="referrer-rank">#{index + 1}</div>
                <div className="referrer-name">{referrer._id}</div>
                <div className="referrer-stats">
                  <span>{referrer.count} referrals</span>
                  <span className="conversion-stat">
                    {referrer.subscribedCount} converted
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="search-filters-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by name, phone, or referrer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <BiSearch className="search-icon" />
        </div>
        
        <div className="filters">
          <select
            value={filterSubscription}
            onChange={(e) => setFilterSubscription(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Users</option>
            <option value="subscribed">Subscribed Only</option>
            <option value="not_subscribed">Not Subscribed</option>
          </select>
          
          <input
            type="text"
            placeholder="Filter by referrer..."
            value={filterReferrer}
            onChange={(e) => setFilterReferrer(e.target.value)}
            className="filter-input"
          />
        </div>
      </div>

      {/* Referrals Table */}
      <div className="referrals-table-section">
        <h2>Referral Details</h2>
        <div className="table-container">
          <table className="referrals-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Phone</th>
                <th>Referred By</th>
                <th>Join Date</th>
                <th>Subscription</th>
                <th>Referrals Made</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((user) => (
                <tr key={user._id}>
                  <td>
                    <div className="user-info">
                      <div className="user-name">{user.name}</div>
                      <div className="user-status">{user.status}</div>
                    </div>
                  </td>
                  <td>{formatPhone(user.phone)}</td>
                  <td>
                    {user.referredBy ? (
                      <span className="referrer-badge">{user.referredBy}</span>
                    ) : (
                      <span className="no-referrer">Direct</span>
                    )}
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <span className={`subscription-badge ${getSubscriptionBadgeClass(user.subscriptionStatus)}`}>
                      {user.subscriptionStatus || 'None'}
                    </span>
                  </td>
                  <td>
                    <div className="referral-stats">
                      <span className="total-referrals">
                        {user.referralStats.totalReferred} total
                      </span>
                      {user.referralStats.subscribedCount > 0 && (
                        <span className="converted-referrals">
                          ({user.referralStats.subscribedCount} converted)
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      className="action-btn"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowUpdateModal(true);
                      }}
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {referrals.length === 0 && (
            <div className="no-data">
              <p>No referral data found matching your criteria</p>
            </div>
          )}
        </div>
      </div>

      {/* Update Subscription Modal */}
      {showUpdateModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Update Subscription Status</h3>
            <p>User: {selectedUser.name} ({formatPhone(selectedUser.phone)})</p>
            
            <div className="subscription-options">
              <button
                className="subscription-btn active"
                onClick={() => updateSubscriptionStatus(selectedUser.phone, 'active')}
              >
                Active
              </button>
              <button
                className="subscription-btn trial"
                onClick={() => updateSubscriptionStatus(selectedUser.phone, 'trial')}
              >
                Trial
              </button>
              <button
                className="subscription-btn expired"
                onClick={() => updateSubscriptionStatus(selectedUser.phone, 'expired')}
              >
                Expired
              </button>
              <button
                className="subscription-btn inactive"
                onClick={() => updateSubscriptionStatus(selectedUser.phone, 'inactive')}
              >
                Inactive
              </button>
            </div>
            
            <button className="close-btn" onClick={() => setShowUpdateModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralTracking;