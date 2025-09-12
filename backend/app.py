# Import pymongo first to avoid DNS conflicts


# Then import and patch eventlet with selective patching
# Exclude socket patching to avoid DNS conflicts with pymongo
import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import pytz
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
socketio = SocketIO(app, async_mode="eventlet", cors_allowed_origins="*", ping_interval=10,
transport=['websocket', 'polling'],  # Fallback to polling if WebSocket fails
    allow_upgrades=True,
    logger=True,
    engineio_logger=True,
    ping_timeout=30)
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
    # For pymongo 4.7.2 with standard MongoDB URI (non-SRV)
    # Ensure SSL/TLS is properly configured
    if 'ssl=true' not in mongodb_uri and 'tls=true' not in mongodb_uri:
        # Add SSL if connecting to Atlas
        if 'mongodb.net' in mongodb_uri:
            separator = '&' if '?' in mongodb_uri else '?'
            mongodb_uri = f"{mongodb_uri}{separator}ssl=true"
            print("Added SSL=true for secure connection")
    print(mongodb_uri)
    # Connection with ServerApi for stable API version
    client = MongoClient(
        mongodb_uri,
        server_api=ServerApi('1'),  # Stable API version
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=20000,
        socketTimeoutMS=20000,
        maxPoolSize=50,
        minPoolSize=10,
        retryWrites=True,
        retryReads=True
    )
    print('connected i guess')
    # Test the connection
    client.admin.command('ping')
    db = client.whatsapp_crm
    print("✅ Successfully connected to MongoDB with pymongo 4.7.2!")
    
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
    """Send message to WhatsApp - optimized for speed with user tracking"""
    data = request.json
    phone = data['phone']
    message = data['message']
    temp_id = data.get('tempId')  # Get temporary ID from frontend
    
    # Get user information from request
    user_id = data.get('userId', 'unknown')
    user_name = data.get('userName', 'Unknown User')
    user_email = data.get('userEmail', '')
    
    # Send via WhatsApp API (now using connection pooling)
    response = send_whatsapp_message(phone, message)
    
    if 'messages' in response:
        # Get WhatsApp message ID for tracking status
        whatsapp_message_id = response['messages'][0].get('id')
        
        # Prepare message document with user tracking (using IST)
        timestamp = datetime.now(pytz.timezone('Asia/Kolkata'))
        message_doc = {
            'phone': phone,
            'message': message,
            'direction': 'outbound',
            'timestamp': timestamp,
            'messageType': 'text',
            'isRead': True,
            'status': 'sent',
            'whatsappMessageId': whatsapp_message_id,
            'sentBy': user_id,
            'sentByName': user_name,
            'sentByEmail': user_email
        }
        
        # Log the activity
        activity_log = {
            'action': 'message_sent',
            'userId': user_id,
            'userName': user_name,
            'userEmail': user_email,
            'phone': phone,
            'message': message,
            'timestamp': timestamp,
            'whatsappMessageId': whatsapp_message_id,
            'status': 'success'
        }
        
        # Use eventlet to spawn async database operations
        def async_db_operations():
            # Check for duplicate before inserting
            existing = db.messages.find_one({'whatsappMessageId': whatsapp_message_id})
            if existing:
                print(f"Message with WhatsApp ID {whatsapp_message_id} already exists")
                return
            
            # Save message to database
            result = db.messages.insert_one(message_doc)
            
            # Save activity log
            db.activity_logs.insert_one(activity_log)
            
            # Update chat's last message
            db.chats.update_one(
                {'phone': phone},
                {
                    '$set': {
                        'lastMessage': message,
                        'lastMessageTime': timestamp,
                        'lastMessageBy': user_name
                    }
                }
            )
            
            # Emit to frontend after DB save
            socketio.emit('new_message', {
                'phone': phone,
                'message': message,
                'direction': 'outbound',
                'timestamp': timestamp.isoformat(),
                'whatsappMessageId': whatsapp_message_id,
                'messageId': str(result.inserted_id),
                'tempId': temp_id
            })
        
        # Spawn async task for DB operations
        eventlet.spawn_n(async_db_operations)
        
        # Return immediately to reduce latency
        return jsonify({
            'success': True,
            'whatsappMessageId': whatsapp_message_id,
            'tempId': temp_id
        })
    
    return jsonify({
        'success': False, 
        'error': response.get('error', 'Failed to send message') if isinstance(response, dict) else str(response),
        'tempId': temp_id
    }), 400

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
        event.add('dtstamp', datetime.now(pytz.timezone('Asia/Kolkata')))
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
            'createdAt': datetime.now(pytz.timezone('Asia/Kolkata')),
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
        event.add('dtstamp', datetime.now(pytz.timezone('Asia/Kolkata')))
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
                'createdAt': datetime.now(pytz.timezone('Asia/Kolkata')),
                'addedBy': data.get('addedBy', 'Admin')  # You can pass the actual user name from frontend
            }
            
            # Add note to user's notes array
            result = db.users.update_one(
                {'phone': phone},
                {
                    '$push': {'notes': new_note},
                    '$setOnInsert': {
                        'phone': phone,
                        'createdAt': datetime.now(pytz.timezone('Asia/Kolkata'))
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

@app.route('/api/update-subscription', methods=['POST'])
def update_subscription():
    """Update user subscription status"""
    data = request.json
    phone = data['phone']
    subscription_status = data['subscriptionStatus']  # 'active', 'inactive', 'trial', 'expired'
    
    update_data = {
        'subscriptionStatus': subscription_status,
        'subscriptionUpdatedAt': datetime.now(pytz.timezone('Asia/Kolkata'))
    }
    
    # Add subscription start date if activating
    if subscription_status == 'active' and data.get('isNewSubscription'):
        update_data['subscriptionStartDate'] = datetime.now(pytz.timezone('Asia/Kolkata'))
    
    db.users.update_one(
        {'phone': phone},
        {'$set': update_data}
    )
    
    # Log the activity
    db.activity_logs.insert_one({
        'action': 'subscription_updated',
        'phone': phone,
        'subscriptionStatus': subscription_status,
        'timestamp': datetime.now(pytz.timezone('Asia/Kolkata')),
        'updatedBy': data.get('updatedBy', 'system')
    })
    
    return jsonify({'success': True})

@app.route('/api/referrals', methods=['GET'])
def get_referrals():
    """Get referral tracking data with search functionality"""
    if db is None:
        return jsonify({'error': 'Database not connected'}), 503
    
    try:
        # Get query parameters
        search = request.args.get('search', '').strip()
        referrer_filter = request.args.get('referrer', '').strip()
        subscription_filter = request.args.get('subscription', '')  # 'all', 'subscribed', 'not_subscribed'
        
        # Build aggregation pipeline
        pipeline = []
        
        # Match stage for search
        if search:
            pipeline.append({
                '$match': {
                    '$or': [
                        {'name': {'$regex': search, '$options': 'i'}},
                        {'phone': {'$regex': search, '$options': 'i'}},
                        {'referredBy': {'$regex': search, '$options': 'i'}}
                    ]
                }
            })
        
        # Filter by specific referrer
        if referrer_filter:
            pipeline.append({
                '$match': {'referredBy': referrer_filter}
            })
        
        # Add subscription status (you'll need to update this based on your subscription model)
        pipeline.append({
            '$addFields': {
                'hasSubscription': {
                    '$cond': {
                        'if': {'$and': [
                            {'$ne': ['$subscriptionStatus', None]},
                            {'$eq': ['$subscriptionStatus', 'active']}
                        ]},
                        'then': True,
                        'else': False
                    }
                }
            }
        })
        
        # Filter by subscription status
        if subscription_filter == 'subscribed':
            pipeline.append({'$match': {'hasSubscription': True}})
        elif subscription_filter == 'not_subscribed':
            pipeline.append({'$match': {'hasSubscription': False}})
        
        # Group by referrer to get referral counts
        referrer_stats_pipeline = [
            {'$match': {'referredBy': {'$ne': None}}},
            {'$group': {
                '_id': '$referredBy',
                'totalReferred': {'$sum': 1},
                'subscribedCount': {
                    '$sum': {'$cond': [{'$eq': ['$subscriptionStatus', 'active']}, 1, 0]}
                }
            }}
        ]
        
        # Execute pipelines
        users = list(db.users.aggregate(pipeline if pipeline else [{}]))
        referrer_stats = list(db.users.aggregate(referrer_stats_pipeline))
        
        # Create referrer stats lookup
        stats_lookup = {stat['_id']: stat for stat in referrer_stats}
        
        # Process users to include referral information
        referral_data = []
        for user in users:
            user_data = {
                '_id': str(user.get('_id')),
                'name': user.get('name', 'Unknown'),
                'phone': user.get('phone'),
                'referredBy': user.get('referredBy'),
                'createdAt': user.get('createdAt').isoformat() if user.get('createdAt') else None,
                'lastMessageAt': user.get('lastMessageAt').isoformat() if user.get('lastMessageAt') else None,
                'status': user.get('status', 'new'),
                'subscriptionStatus': user.get('subscriptionStatus', 'none'),
                'hasSubscription': user.get('hasSubscription', False),
                'referralStats': stats_lookup.get(user.get('name')) or stats_lookup.get(user.get('phone')) or {
                    'totalReferred': 0,
                    'subscribedCount': 0
                }
            }
            referral_data.append(user_data)
        
        # Get overall statistics
        total_users = db.users.count_documents({})
        referred_users = db.users.count_documents({'referredBy': {'$ne': None}})
        subscribed_users = db.users.count_documents({'subscriptionStatus': 'active'})
        
        # Get top referrers
        top_referrers = list(db.users.aggregate([
            {'$match': {'referredBy': {'$ne': None}}},
            {'$group': {
                '_id': '$referredBy',
                'count': {'$sum': 1},
                'subscribedCount': {
                    '$sum': {'$cond': [{'$eq': ['$subscriptionStatus', 'active']}, 1, 0]}
                }
            }},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]))
        
        return jsonify({
            'success': True,
            'referrals': referral_data,
            'statistics': {
                'totalUsers': total_users,
                'referredUsers': referred_users,
                'subscribedUsers': subscribed_users,
                'conversionRate': round((subscribed_users / referred_users * 100) if referred_users > 0 else 0, 2),
                'topReferrers': top_referrers
            }
        })
        
    except Exception as e:
        print(f"Error fetching referrals: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/activity-logs', methods=['GET'])
def get_activity_logs():
    """Get activity logs with optional filtering"""
    if db is None:
        return jsonify({'error': 'Database not connected'}), 503
    
    # Get query parameters
    user_id = request.args.get('userId')
    phone = request.args.get('phone')
    action = request.args.get('action')
    limit = int(request.args.get('limit', 100))
    
    # Build query
    query = {}
    if user_id:
        query['userId'] = user_id
    if phone:
        query['phone'] = phone
    if action:
        query['action'] = action
    
    # Get logs
    logs = list(db.activity_logs.find(query).sort('timestamp', -1).limit(limit))
    
    # Format response
    result = []
    for log in logs:
        result.append({
            'id': str(log['_id']),
            'action': log['action'],
            'userId': log.get('userId'),
            'userName': log.get('userName'),
            'userEmail': log.get('userEmail'),
            'phone': log.get('phone'),
            'message': log.get('message'),
            'timestamp': log['timestamp'].isoformat() if isinstance(log['timestamp'], datetime) else log['timestamp'],
            'status': log.get('status', 'success'),
            'details': log.get('details', {})
        })
    
    return jsonify(result)

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