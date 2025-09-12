import React, { useState, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import config from '../config';
import './UserNotesModal.css';

const UserNotesModal = ({ isOpen, onClose, user }) => {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchNotes();
    }
  }, [isOpen, user]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.API_URL}/api/user-notes/${user.phone}`);
      const data = await response.json();
      if (response.ok) {
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setSaving(true);
    try {
      const response = await fetch(`${config.API_URL}/api/user-notes/${user.phone}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: newNote }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes);
        setNewNote('');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen || !user) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="notes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="notes-header">
          <h2>User Notes</h2>
          <button className="close-btn" onClick={onClose}><IoClose /></button>
        </div>

        <div className="notes-user-info">
          <div className="user-avatar">
            {user.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="user-details">
            <h3>{user.name}</h3>
            <p>{user.phone}</p>
            {user.referredBy && (
              <span className="referred-by">Ref by: {user.referredBy}</span>
            )}
          </div>
        </div>

        <div className="notes-content">
          <div className="add-note-section">
            <h3>Add Note</h3>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter your note about this user..."
              rows="4"
              disabled={saving}
            />
            <button 
              className="add-note-btn"
              onClick={handleAddNote}
              disabled={saving || !newNote.trim()}
            >
              {saving ? 'Adding...' : 'Add Note'}
            </button>
          </div>

          <div className="previous-notes">
            <h3>Previous Notes ({notes.length})</h3>
            {loading ? (
              <div className="loading">Loading notes...</div>
            ) : notes.length === 0 ? (
              <div className="no-notes">No notes added yet</div>
            ) : (
              <div className="notes-list">
                {notes.map((note, index) => (
                  <div key={note._id || index} className="note-item">
                    <div className="note-content">{note.text}</div>
                    <div className="note-meta">
                      <span className="note-author">{note.addedBy || 'Admin'}</span>
                      <span className="note-date">{formatDate(note.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotesModal;