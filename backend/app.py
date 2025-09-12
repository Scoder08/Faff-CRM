from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from bson import ObjectId
from datetime import datetime
import os
import sys
from dotenv import load_dotenv

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from whatsapp_handler import (
    send_whatsapp_message,
    parse_message_data,
    process_incoming_message,
    process_status_update
)

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key')

# Configure CORS - More permissive for Railway
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')

# Check if running on Railway
is_railway = os.getenv('RAILWAY_ENVIRONMENT') is not None

# if is_railway:
# print("Running on Railway - enabling permissive CORS")
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")
# else:
#     CORS(app, origins=[frontend_url, 'http://localhost:3000'])
#     socketio = SocketIO(app, cors_allowed_origins=[frontend_url, 'http://localhost:3000'])

# MongoDB connection
mongodb_uri = os.getenv('MONGODB_URI') or os.getenv('MONGO_PUBLIC_URL')

if not mongodb_uri:
    print("WARNING: MONGODB_URI not set. Using localhost for development.")
    mongodb_uri = 'mongodb://localhost:27017/whatsapp_crm'

print("=" * 50)
print("MongoDB Connection Status")
print(f"Environment: {os.getenv('RAILWAY_ENVIRONMENT', 'Development')}")
print(f"MongoDB configured: {'Yes' if mongodb_uri else 'No'}")
print("=" * 50)

try:
    # For pymongo 3.4, we need to handle replica sets differently
    # Remove replicaSet parameter if it exists in the URI
    if 'replicaSet=' in mongodb_uri:
        # Remove the replicaSet parameter for simpler connection
        import re
        mongodb_uri = re.sub(r'[?&]replicaSet=[^&]*', '', mongodb_uri)
        print("Adjusted URI for pymongo 3.4 (removed replicaSet)")
    
    # Simple connection for pymongo 3.4
    # client = MongoClient(
    #     mongodb_uri,
    #     connectTimeoutMS=30000,
    #     serverSelectionTimeoutMS=30000,
    #     connect=False  # Don't connect immediately
    # )
    client = MongoClient(
        mongodb_uri,
        server_api=ServerApi('1'),        # works with Atlas
        serverSelectionTimeoutMS=30000,   # 30s to discover primary
        connectTimeoutMS=20000,
        socketTimeoutMS=20000
    )
    print("Connected i guess")
    # Force connection and test
    client.admin.command('ismaster')
    db = client.whatsapp_crm
    print("✅ Successfully connected to MongoDB!")
    
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")
    print("\n⚠️  Please set MONGODB_URI in Railway Variables")
    print("Use standard MongoDB connection string (NOT SRV):")
    print("Format: mongodb://username:password@host1:port1,host2:port2,host3:port3/whatsapp_crm?ssl=true&authSource=admin")
    print("\nTo get this from Atlas:")
    print("1. Atlas Dashboard → Connect → Connect your application")
    print("2. Select 'Python 2.7' or 'MongoDB 2.2.12 or later'")
    print("3. Copy the connection string")
    db = None

# WhatsApp webhook verify token
VERIFY_TOKEN = os.getenv('VERIFY_TOKEN', 'your_verify_token')

@app.route('/api/health', methods=['GET'])
def health():
    db_status = 'connected' if db is not None else 'disconnected'
    return jsonify({
        'success': True, 
        'message': 'API is healthy',
        'database': db_status
    }), 200

@app.route('/api/webhook', methods=['GET', 'POST'])
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
    if db is None:
        return jsonify({'error': 'Database not connected. Please configure MONGODB_URI.'}), 503
    
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

@app.route('/api/schedule-call', methods=['POST'])
def schedule_call():
    """Schedule a call and send calendar invite"""
    data = request.json
    phone = data['phone']
    name = data['name']
    scheduled_date = data['date']
    email = data['email']
    notes = data.get('notes', '')
    
    print(f"Scheduling call for {name} ({phone}) on {scheduled_date}")
    
    try:
        # Parse the date
        from dateutil import parser
        call_date = parser.parse(scheduled_date)
        
        # Format date for WhatsApp message
        formatted_date = call_date.strftime('%B %d, %Y at %I:%M %p')
        print(f"Formatted date: {formatted_date}")
        
        # Create calendar event (ICS format)
        from icalendar import Calendar, Event
        from datetime import timedelta
        import uuid
        
        cal = Calendar()
        cal.add('prodid', '-//WhatsApp CRM//Onboarding Call//')
        cal.add('version', '2.0')
        
        event = Event()
        event.add('summary', f'Onboarding Call with {name}')
        event.add('dtstart', call_date)
        event.add('dtend', call_date + timedelta(hours=1))
        event.add('dtstamp', datetime.now())
        event.add('uid', str(uuid.uuid4()))
        event.add('description', f'Onboarding call with {name}\\nPhone: {phone}\\n\\nNotes:\\n{notes}')
        event.add('location', f'WhatsApp Call to {phone}')
        event.add('attendee', f'mailto:{email}')
        
        cal.add_component(event)
        
        # Save the ICS file temporarily
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.ics', delete=False) as f:
            f.write(cal.to_ical())
            ics_path = f.name
        
        # Send email with calendar invite
        email_sent = False
        email_error = None
        
        try:
            import smtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            from email.mime.base import MIMEBase
            from email import encoders
            
            # Email configuration (you'll need to set these in .env)
            smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
            smtp_port = int(os.getenv('SMTP_PORT', '587'))
            smtp_user = os.getenv('SMTP_USER')
            smtp_pass = os.getenv('SMTP_PASS')
            
            
            print(f"Email config - Server: {smtp_server}, Port: {smtp_port}, User: {smtp_user}, Pass configured: {bool(smtp_pass)}")
            
            if smtp_user and smtp_pass:
                msg = MIMEMultipart()
                msg['From'] = smtp_user
                msg['To'] = email
                msg['Subject'] = f'Calendar Invite: Onboarding Call with {name}'
                
                body = f'''You have scheduled an onboarding call with {name}.
                
Date & Time: {formatted_date}
Phone: {phone}

Notes:
{notes if notes else 'No additional notes'}

The calendar invite is attached to this email.'''
                
                msg.attach(MIMEText(body, 'plain'))
                
                # Attach ICS file
                with open(ics_path, 'rb') as f:
                    attach = MIMEBase('text', 'calendar')
                    attach.set_payload(f.read())
                    encoders.encode_base64(attach)
                    attach.add_header('Content-Disposition', f'attachment; filename="call_with_{name}.ics"')
                    msg.attach(attach)
                
                # Send email
                print(f"Attempting to send email to {email}")
                server = smtplib.SMTP(smtp_server, smtp_port)
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
                server.quit()
                email_sent = True
                print("Email sent successfully!")
            else:
                print("Email not configured - skipping email sending")
                email_error = "Email not configured in environment variables"
                
        except Exception as e:
            email_error = str(e)
            print(f"Error sending email: {e}")
        finally:
            # Clean up temp file
            if os.path.exists(ics_path):
                os.unlink(ics_path)
        
        # Send WhatsApp message to user
        whatsapp_message = f'''Hi {name}! 

Your onboarding call has been scheduled for:
📅 {formatted_date}

We'll call you on this WhatsApp number. Please make sure you're available at the scheduled time.

If you need to reschedule, please let us know.

Looking forward to speaking with you!'''
        
        print(f"Sending WhatsApp message to {phone}")
        whatsapp_response = send_whatsapp_message(phone, whatsapp_message)
        whatsapp_sent = 'messages' in whatsapp_response
        
        if whatsapp_sent:
            print("WhatsApp message sent successfully!")
        else:
            print(f"WhatsApp message failed: {whatsapp_response}")
        
        # Update user status to call_scheduled
        db.users.update_one(
            {'phone': phone},
            {
                '$set': {
                    'status': 'call_scheduled',
                    'scheduledCallDate': call_date,
                    'scheduledCallNotes': notes
                }
            }
        )
        
        # Save the scheduled call info
        call_doc = {
            'phone': phone,
            'name': name,
            'scheduledDate': call_date,
            'email': email,
            'notes': notes,
            'createdAt': datetime.now(),
            'status': 'scheduled'
        }
        db.scheduled_calls.insert_one(call_doc)
        
        # Emit update to frontend
        socketio.emit('user_status_update', {
            'phone': phone,
            'status': 'call_scheduled'
        })
        
        return jsonify({
            'success': True,
            'message': 'Call scheduled successfully',
            'whatsappSent': whatsapp_sent,
            'emailSent': email_sent,
            'emailError': email_error,
            'scheduledDate': formatted_date
        })
        
    except Exception as e:
        print(f"Error scheduling call: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/download-ics/<phone>', methods=['GET'])
def download_ics(phone):
    """Generate and download ICS file for scheduled call"""
    try:
        # Get the scheduled call info
        call = db.scheduled_calls.find_one({'phone': phone}, sort=[('createdAt', -1)])
        
        if not call:
            return jsonify({'error': 'No scheduled call found'}), 404
        
        from icalendar import Calendar, Event
        from datetime import timedelta
        import uuid
        
        cal = Calendar()
        cal.add('prodid', '-//WhatsApp CRM//Onboarding Call//')
        cal.add('version', '2.0')
        
        event = Event()
        event.add('summary', f'Onboarding Call with {call["name"]}')
        event.add('dtstart', call['scheduledDate'])
        event.add('dtend', call['scheduledDate'] + timedelta(hours=1))
        event.add('dtstamp', datetime.now())
        event.add('uid', str(uuid.uuid4()))
        event.add('description', f'Onboarding call with {call["name"]}\\nPhone: {phone}\\n\\nNotes:\\n{call.get("notes", "")}')
        event.add('location', f'WhatsApp Call to {phone}')
        
        cal.add_component(event)
        
        from flask import Response
        
        return Response(
            cal.to_ical(),
            mimetype='text/calendar',
            headers={
                'Content-Disposition': f'attachment; filename=call_with_{call["name"]}.ics'
            }
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user-notes/<phone>', methods=['GET', 'POST'])
def user_notes(phone):
    """Get or add notes for a user"""
    if request.method == 'GET':
        try:
            # Get user with notes
            user = db.users.find_one({'phone': phone})
            if user:
                notes = user.get('notes', [])
                # Sort notes by date, most recent first
                notes.sort(key=lambda x: x.get('createdAt', datetime.min), reverse=True)
                
                # Convert datetime objects to ISO format strings for JSON serialization
                for note in notes:
                    if isinstance(note.get('createdAt'), datetime):
                        note['createdAt'] = note['createdAt'].isoformat()
                
                return jsonify({'success': True, 'notes': notes})
            return jsonify({'success': True, 'notes': []})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
            
    elif request.method == 'POST':
        try:
            data = request.json
            note_text = data.get('note', '').strip()
            
            if not note_text:
                return jsonify({'success': False, 'error': 'Note cannot be empty'}), 400
            
            # Create note object
            new_note = {
                '_id': str(ObjectId()),
                'text': note_text,
                'createdAt': datetime.now(),
                'addedBy': data.get('addedBy', 'Admin')  # You can pass the actual user name from frontend
            }
            
            # Add note to user's notes array
            result = db.users.update_one(
                {'phone': phone},
                {
                    '$push': {'notes': new_note},
                    '$setOnInsert': {
                        'phone': phone,
                        'createdAt': datetime.now()
                    }
                },
                upsert=True
            )
            
            # Get updated notes
            user = db.users.find_one({'phone': phone})
            notes = user.get('notes', [])
            notes.sort(key=lambda x: x.get('createdAt', datetime.min), reverse=True)
            
            # Convert datetime objects to ISO format strings for JSON serialization
            for note in notes:
                if isinstance(note.get('createdAt'), datetime):
                    note['createdAt'] = note['createdAt'].isoformat()
            
            # Emit update to other connected clients
            socketio.emit('notes_updated', {
                'phone': phone,
                'notes': notes
            })
            
            return jsonify({'success': True, 'notes': notes})
            
        except Exception as e:
            print(f"Error adding note: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500

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
    port = int(os.getenv('PORT', 5000))
    debug_mode = os.getenv('DEBUG', 'False').lower() == 'true'
    socketio.run(app, host='0.0.0.0', port=port, debug=debug_mode)