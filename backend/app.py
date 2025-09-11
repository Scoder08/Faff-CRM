from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv
import requests
import json

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*")

# MongoDB connection
client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
db = client.whatsapp_crm

# WhatsApp API config
WHATSAPP_TOKEN = os.getenv('WHATSAPP_TOKEN')
WHATSAPP_PHONE_ID = os.getenv('WHATSAPP_PHONE_ID')
VERIFY_TOKEN = os.getenv('VERIFY_TOKEN', 'your_verify_token')

def send_whatsapp_message(phone, message, buttons=None):
    """Send message via WhatsApp API"""
    url = f"https://graph.facebook.com/v17.0/{WHATSAPP_PHONE_ID}/messages"
    headers = {
        'Authorization': f'Bearer {WHATSAPP_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    if buttons:
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": message},
                "action": {"buttons": buttons}
            }
        }
    else:
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"body": message}
        }
    
    response = requests.post(url, headers=headers, json=payload)
    return response.json()

def get_auto_reply(message_text, is_new_user=True):
    """Generate auto-reply based on message content"""
    message_lower = message_text.lower()
    
    if is_new_user and ("hi" in message_lower and "faff" in message_lower):
        # Check for referral
        referred_by = None
        if "referred by" in message_lower:
            try:
                referred_by = message_text.split("referred by")[1].strip().rstrip('.')
            except:
                pass
        
        reply_text = "Hey there! I'm faff!\nWe're an affordable personal assistant service for people who value their time. You can hire us and your personal chores over WhatsApp.\n\nHow would you like to proceed?\nChoose an option below"
        
        buttons = [
            {"type": "reply", "reply": {"id": "know_more", "title": "Know more"}},
            {"type": "reply", "reply": {"id": "onboard_direct", "title": "Onboard me directly"}}
        ]
        
        return reply_text, buttons, referred_by
    
    return None, None, None

@app.route('/webhook', methods=['GET', 'POST'])
def webhook():
    if request.method == 'GET':
        # Webhook verification
        verify_token = request.args.get('hub.verify_token')
        if verify_token == VERIFY_TOKEN:
            return request.args.get('hub.challenge')
        return 'Invalid verification token', 403
    
    elif request.method == 'POST':
        # Handle incoming messages
        data = request.json
        print(f"Webhook data received: {data}")
        
        if 'messages' in data['entry'][0]['changes'][0]['value']:
            message_data = data['entry'][0]['changes'][0]['value']['messages'][0]
            contact_data = data['entry'][0]['changes'][0]['value']['contacts'][0]
            
            phone = message_data['from']
            message_id = message_data['id']
            timestamp = datetime.fromtimestamp(int(message_data['timestamp']))
            
            # Handle different message types
            message_type = message_data.get('type', 'text')
            if message_type == 'text':
                message_text = message_data.get('text', {}).get('body', '')
            elif message_type == 'interactive':
                # Handle button replies
                interactive = message_data.get('interactive', {})
                if interactive.get('type') == 'button_reply':
                    button_reply = interactive.get('button_reply', {})
                    message_text = f"Button: {button_reply.get('title', '')}"
                    button_id = button_reply.get('id', '')
                    print(f"Button reply received: id={button_id}, title={button_reply.get('title', '')}")
                else:
                    message_text = "Interactive message"
            else:
                message_text = f"Unsupported message type: {message_type}"
            
            print(f"Processing message from {phone}: '{message_text}'")
            print(f"Message ID: {message_id}")
            
            # Check if user exists
            user = db.users.find_one({'phone': phone})
            is_new_user = user is None
            print(f"User lookup for {phone}: {'NEW USER' if is_new_user else 'EXISTING USER'}")
            if user:
                print(f"Existing user details: {user}")
            
            # Save message
            message_doc = {
                'messageId': message_id,
                'phone': phone,
                'message': message_text,
                'direction': 'inbound',
                'timestamp': timestamp,
                'messageType': 'text',
                'isRead': False
            }
            db.messages.insert_one(message_doc)
            
            # Handle auto-reply for new users
            if is_new_user:
                print(f"Getting auto-reply for new user message: '{message_text}'")
                reply_text, buttons, referred_by = get_auto_reply(message_text, True)
                print(f"Auto-reply result: reply_text={reply_text}, buttons={buttons}, referred_by={referred_by}")
            else:
                # Check if it's a button reply from existing user
                reply_text = None
                buttons = None
                referred_by = None
                
                if message_type == 'interactive' and 'button_id' in locals():
                    if button_id == 'know_more':
                        reply_text = "We offer a wide range of services:\n\n📱 Digital Tasks\n• Online research & bookings\n• Email management\n• Social media handling\n\n🏠 Personal Errands\n• Shopping assistance\n• Bill payments\n• Appointment scheduling\n\n💼 Professional Support\n• Document preparation\n• Travel planning\n• Event coordination\n\nAll for just ₹999/month! Ready to get started?"
                        buttons = [
                            {"type": "reply", "reply": {"id": "start_trial", "title": "Start Free Trial"}},
                            {"type": "reply", "reply": {"id": "pricing", "title": "View Pricing"}}
                        ]
                    elif button_id == 'onboard_direct':
                        reply_text = "Great! Let's get you started.\n\nPlease share your email address to create your account and start your free trial."
                    print(f"Button handler: reply_text={reply_text}, buttons={buttons}")
                
            # Send reply if we have one (for both new and existing users)
            if reply_text:
                if is_new_user:
                    # Create new user
                    user_doc = {
                        'phone': phone,
                        'name': contact_data.get('profile', {}).get('name', f'User {phone[-4:]}'),
                        'status': 'priority',
                        'referredBy': referred_by,
                        'createdAt': datetime.now(),
                        'lastMessageAt': timestamp
                    }
                    print(f"Creating new user: {user_doc}")
                    db.users.insert_one(user_doc)
                
                # Send auto-reply
                print(f"Sending auto-reply to {phone}: '{reply_text}'")
                api_response = send_whatsapp_message(phone, reply_text, buttons)
                print(f"WhatsApp API response: {api_response}")
                
                # Save outbound message
                reply_doc = {
                    'phone': phone,
                    'message': reply_text,
                    'direction': 'outbound',
                    'timestamp': datetime.now(),
                    'messageType': 'interactive' if buttons else 'text',
                    'isRead': True
                }
                db.messages.insert_one(reply_doc)
            else:
                # Update existing user
                print(f"Updating existing user {phone} with lastMessageAt: {timestamp}")
                db.users.update_one(
                    {'phone': phone},
                    {'$set': {'lastMessageAt': timestamp}}
                )
            
            # Emit to frontend via socket
            socketio.emit('new_message', {
                'phone': phone,
                'message': message_text,
                'direction': 'inbound',
                'timestamp': timestamp.isoformat()
            })
        
        return 'Success', 200

@app.route('/api/chats', methods=['GET'])
def get_chats():
    """Get all chat conversations"""
    users = list(db.users.find().sort('lastMessageAt', -1))
    
    chats = []
    for user in users:
        # Get last message
        last_message = db.messages.find_one(
            {'phone': user['phone']}, 
            sort=[('timestamp', -1)]
        )
        
        # Count unread messages
        unread_count = db.messages.count_documents({
            'phone': user['phone'],
            'direction': 'inbound',
            'isRead': False
        })
        
        chats.append({
            'id': str(user['_id']),
            'phone': user['phone'],
            'name': user['name'],
            'status': user['status'],
            'referredBy': user.get('referredBy'),
            'lastMessage': last_message['message'] if last_message else '',
            'lastMessageTime': user['lastMessageAt'].isoformat(),
            'unreadCount': unread_count
        })
    
    return jsonify(chats)

@app.route('/api/messages/<phone>', methods=['GET'])
def get_messages(phone):
    """Get messages for a specific phone number"""
    messages = list(db.messages.find({'phone': phone}).sort('timestamp', 1))
    
    # Mark messages as read
    db.messages.update_many(
        {'phone': phone, 'direction': 'inbound'},
        {'$set': {'isRead': True}}
    )
    
    result = []
    for msg in messages:
        result.append({
            'id': str(msg['_id']),
            'message': msg['message'],
            'direction': msg['direction'],
            'timestamp': msg['timestamp'].isoformat(),
            'messageType': msg.get('messageType', 'text')
        })
    
    return jsonify(result)

@app.route('/api/send-message', methods=['POST'])
def send_message():
    """Send message to WhatsApp"""
    data = request.json
    phone = data['phone']
    message = data['message']
    
    # Send via WhatsApp API
    response = send_whatsapp_message(phone, message)
    
    if 'messages' in response:
        # Save to database
        message_doc = {
            'phone': phone,
            'message': message,
            'direction': 'outbound',
            'timestamp': datetime.now(),
            'messageType': 'text',
            'isRead': True
        }
        db.messages.insert_one(message_doc)
        
        # Emit to frontend
        socketio.emit('new_message', {
            'phone': phone,
            'message': message,
            'direction': 'outbound',
            'timestamp': datetime.now().isoformat()
        })
        
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'error': response}), 400

@app.route('/api/update-status', methods=['POST'])
def update_status():
    """Update user status"""
    data = request.json
    phone = data['phone']
    status = data['status']
    
    db.users.update_one(
        {'phone': phone},
        {'$set': {'status': status}}
    )
    
    return jsonify({'success': True})

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('connected', {'data': 'Connected to WhatsApp CRM'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)