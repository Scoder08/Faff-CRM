import React, { useState } from 'react';
import { IoNotifications, IoVolumeMedium, IoClose } from 'react-icons/io5';
import notificationManager from '../utils/notification';
import './NotificationSettings.css';

const NotificationSettings = ({ isOpen, onClose }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    notificationManager.isEnabled()
  );
  const [soundEnabled, setSoundEnabled] = useState(
    notificationManager.isSoundEnabled()
  );

  const handleNotificationToggle = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    notificationManager.setEnabled(newValue);
    
    if (newValue) {
      // Request permission if enabling
      const hasPermission = await notificationManager.requestPermission();
      if (!hasPermission) {
        setNotificationsEnabled(false);
        notificationManager.setEnabled(false);
        alert('Please enable notifications in your browser settings');
      }
    }
  };

  const handleSoundToggle = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    notificationManager.setSoundEnabled(newValue);
    
    // Play a test sound if enabling
    if (newValue) {
      notificationManager.playSound();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="notification-settings-overlay" onClick={onClose}>
      <div className="notification-settings" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Notification Settings</h3>
          <button className="close-btn" onClick={onClose}>
            <IoClose />
          </button>
        </div>
        
        <div className="settings-content">
          <div className="setting-item">
            <div className="setting-info">
              <IoNotifications className="setting-icon" />
              <div>
                <h4>Desktop Notifications</h4>
                <p>Show notifications for new messages</p>
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={handleNotificationToggle}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          
          <div className="setting-item">
            <div className="setting-info">
              <IoVolumeMedium className="setting-icon" />
              <div>
                <h4>Notification Sound</h4>
                <p>Play sound when new message arrives</p>
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={handleSoundToggle}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          
          <div className="settings-note">
            <p>💡 Notifications will only appear when the app is in the background or for messages from other chats.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;