// Notification utility for playing sounds and showing browser notifications

class NotificationManager {
  constructor() {
    this.audio = null;
    this.enabled = localStorage.getItem('notificationsEnabled') !== 'false';
    this.soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    this.initAudio();
  }

  initAudio() {
    // Create audio element with notification sound
    this.audio = new Audio();
    // Try to use local notification sound first
    this.audio.src = '/notification.mp3';
    // Fallback to data URI if local sound fails (this is a simple beep sound)
    this.audio.onerror = () => {
      this.audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi+H0fPTgjMGHm7A7+OZURE';
    };
    this.audio.volume = 0.5;
  }

  async playSound() {
    if (!this.soundEnabled || !this.audio) return;
    
    try {
      // Reset the audio to play from start
      this.audio.currentTime = 0;
      await this.audio.play();
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }

  async requestPermission() {
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }

    return false;
  }

  async showNotification(title, options = {}) {
    if (!this.enabled) return;

    const hasPermission = await this.requestPermission();
    if (!hasPermission) return;

    try {
      const notification = new Notification(title, {
        icon: '/logo192.png', // You can add a logo file
        badge: '/logo192.png',
        tag: 'whatsapp-crm',
        renotify: true,
        ...options
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.log('Could not show notification:', error);
    }
  }

  async notifyNewMessage(message, senderName) {
    // Play sound
    await this.playSound();

    // Show browser notification
    await this.showNotification(`New message from ${senderName}`, {
      body: message.length > 100 ? message.substring(0, 100) + '...' : message,
      silent: true // We're playing our own sound
    });
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem('notificationsEnabled', enabled);
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = enabled;
    localStorage.setItem('soundEnabled', enabled);
  }

  isEnabled() {
    return this.enabled;
  }

  isSoundEnabled() {
    return this.soundEnabled;
  }
}

// Create singleton instance
const notificationManager = new NotificationManager();

export default notificationManager;