from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv
from whatsapp_handler import (
    send_whatsapp_message,
    parse_message_data,
    process_incoming_message,
    process_status_update
)

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*")

# MongoDB connection
client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
db = client.whatsapp_crm

# WhatsApp webhook verify token
VERIFY_TOKEN = os.getenv('VERIFY_TOKEN', 'your_verify_token')


@app.route('/webhook', methods=['GET', 'POST'])
def webhook():
    if request.method == 'GET':
        # Webhook verification
        verify_token = request.args.get('hub.verify_token')
        if verify_token == VERIFY_TOKEN:
            return request.args.get('hub.challenge')
        return 'Invalid verification token', 403
    
    elif request.method == 'POST':
        # Handle incoming messages and status updates
        data = request.json
        print(f"Webhook data received: {data}")
        
        # First check if it's a status update
        if not process_status_update(db, socketio, data):
            # If not a status update, try to process as a message
            parsed_data = parse_message_data(data)
            if parsed_data:
                process_incoming_message(db, socketio, parsed_data)
        
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
            'messageType': msg.get('messageType', 'text'),
            'status': msg.get('status', 'sent'),  # Include message status
            'whatsappMessageId': msg.get('whatsappMessageId')  # Include WhatsApp message ID for status tracking
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
        # Get WhatsApp message ID for tracking status
        whatsapp_message_id = response['messages'][0].get('id')
        
        # Save to database with status
        message_doc = {
            'phone': phone,
            'message': message,
            'direction': 'outbound',
            'timestamp': datetime.now(),
            'messageType': 'text',
            'isRead': True,
            'status': 'sent',
            'whatsappMessageId': whatsapp_message_id
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