import React, { useState } from 'react';
import './ScheduleCallModal.css';

const ScheduleCallModal = ({ isOpen, onClose, chat, onSchedule }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  
  // Time slots for the dropdown
  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
    '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!date || !time || !email) {
      alert('Please fill in all required fields');
      return;
    }
    
    setIsScheduling(true);
    
    try {
      // Combine date and time
      const scheduledDateTime = new Date(`${date} ${convertTo24Hour(time)}`);
      
      await onSchedule({
        phone: chat.phone,
        name: chat.name,
        date: scheduledDateTime.toISOString(),
        email: email,
        notes: notes
      });
      
      // Reset form
      setDate('');
      setTime('');
      setEmail('');
      setNotes('');
      onClose();
    } catch (error) {
      console.error('Error scheduling call:', error);
      alert('Failed to schedule call. Please try again.');
    } finally {
      setIsScheduling(false);
    }
  };
  
  const convertTo24Hour = (time12h) => {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    
    if (hours === '12') {
      hours = '00';
    }
    
    if (modifier === 'PM') {
      hours = parseInt(hours, 10) + 12;
    }
    
    return `${hours}:${minutes}`;
  };
  
  // Get today's date for the date picker minimum
  const today = new Date().toISOString().split('T')[0];
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Schedule Onboarding Call</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="user-info">
            <div className="user-avatar">
              {chat.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="user-details">
              <h3>{chat.name}</h3>
              <p>{chat.phone}</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                📅 Select Date
                <input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={today}
                  required
                />
              </label>
            </div>
            
            <div className="form-group">
              <label>
                ⏰ Select Time
                <select 
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                >
                  <option value="">Choose a time slot</option>
                  {timeSlots.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </label>
            </div>
            
            <div className="form-group">
              <label>
                ✉️ Your Email (for calendar invite)
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@company.com"
                  required
                />
              </label>
            </div>
            
            <div className="form-group">
              <label>
                Meeting Notes (Optional)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any specific topics or notes for the call..."
                  rows="4"
                />
              </label>
            </div>
            
            <div className="info-text">
              <p>📅 A calendar invite will be sent to your email with the user's details</p>
              <p>✓ The user's status will be updated to "Call Scheduled"</p>
              <p>💬 A WhatsApp confirmation will be sent to the user</p>
            </div>
            
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-schedule" disabled={isScheduling}>
                {isScheduling ? 'Scheduling...' : 'Schedule Call'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ScheduleCallModal;