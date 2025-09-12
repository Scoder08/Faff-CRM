import os
import requests
from datetime import datetime, timezone, timedelta
import pytz
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

load_dotenv()

WHATSAPP_TOKEN = os.getenv('WHATSAPP_TOKEN')
WHATSAPP_PHONE_ID = os.getenv('WHATSAPP_PHONE_ID')

# Create a session with connection pooling and keep-alive
session = requests.Session()

# Configure retry strategy
retry_strategy = Retry(
    total=2,
    backoff_factor=0.3,
    status_forcelist=[429, 500, 502, 503, 504],
)

# Mount adapter with connection pooling
adapter = HTTPAdapter(
    pool_connections=10,
    pool_maxsize=20,
    max_retries=retry_strategy
)
session.mount("http://", adapter)
session.mount("https://", adapter)

# Set default headers
session.headers.update({
    'Authorization': f'Bearer {WHATSAPP_TOKEN}',
    'Content-Type': 'application/json',
    'Connection': 'keep-alive'
})

def send_whatsapp_message(phone, message, buttons=None):
    """Send message via WhatsApp API with optimized connection"""
    url = f"https://graph.facebook.com/v17.0/{WHATSAPP_PHONE_ID}/messages"
    
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
    
    # Use session with connection pooling (much faster)
    try:
        response = session.post(url, json=payload, timeout=5)
        return response.json()
    except requests.exceptions.Timeout:
        return {"error": "Request timeout"}
    except Exception as e:
        return {"error": str(e)}

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
        
        reply_text = "Hey there! I'm faff!\nWe're an affordable personal assistant service for people who value their time. You can hire us and delegate your personal chores over WhatsApp.\n\nHow would you like to proceed?\nChoose an option below"
        
        buttons = [
            {"type": "reply", "reply": {"id": "know_more", "title": "Know more"}},
            {"type": "reply", "reply": {"id": "onboard_direct", "title": "Onboard me directly"}}
        ]
        
        return reply_text, buttons, referred_by
    
    return None, None, None

def handle_button_reply(button_id):
    """Handle interactive button replies"""
    reply_text = None
    buttons = None
    
    if button_id == 'know_more':
        reply_text = "We offer a wide range of services:\n\n📱 Digital Tasks\n• Online research & bookings\n• Email management\n• Social media handling\n\n🏠 Personal Errands\n• Shopping assistance\n• Bill payments\n• Appointment scheduling\n\n💼 Professional Support\n• Document preparation\n• Travel planning\n• Event coordination\n\nAll for just ₹999/month! Ready to get started?"
        buttons = [
            {"type": "reply", "reply": {"id": "start_trial", "title": "Start Free Trial"}},
            {"type": "reply", "reply": {"id": "pricing", "title": "View Pricing"}}
        ]
    elif button_id == 'onboard_direct':
        reply_text = "Great! Let's get you started.\n\nPlease share your email address to create your account and start your free trial."
    elif button_id == 'start_trial':
        reply_text = "Excellent choice! 🎉\n\nYour 7-day free trial has been activated.\n\nTo get started:\n1. Save this number\n2. Send us your first task\n3. We'll handle it within 2 hours\n\nWhat would you like help with today?"
    elif button_id == 'pricing':
        reply_text = "Our Pricing Plans:\n\n📌 Basic Plan - ₹999/month\n• 10 tasks per month\n• 2-hour response time\n• WhatsApp support\n\n⭐ Premium Plan - ₹2499/month\n• Unlimited tasks\n• 30-min response time\n• Priority support\n• Dedicated assistant\n\n💎 Business Plan - ₹4999/month\n• Everything in Premium\n• Team collaboration\n• API access\n• Custom integrations\n\nWhich plan interests you?"
        buttons = [
            {"type": "reply", "reply": {"id": "start_trial", "title": "Start Free Trial"}},
            {"type": "reply", "reply": {"id": "contact_sales", "title": "Contact Sales"}}
        ]
    
    return reply_text, buttons

def parse_message_data(data):
    """Parse incoming WhatsApp webhook data"""
    try:
        if 'entry' not in data or not data['entry']:
            return None
            
        changes = data['entry'][0].get('changes', [])
        if not changes:
            return None
            
        value = changes[0].get('value', {})
        
        # Check if this is a message (not just a status update)
        if 'messages' not in value:
            return None
            
        message_data = value['messages'][0]
        contact_data = value['contacts'][0]
        
        # Extract basic info
        phone = message_data['from']
        message_id = message_data['id']
        timestamp = datetime.fromtimestamp(int(message_data['timestamp']))
        
        # Handle different message types
        message_type = message_data.get('type', 'text')
        message_text = ''
        button_id = None
        
        if message_type == 'text':
            message_text = message_data.get('text', {}).get('body', '')
        elif message_type == 'interactive':
            interactive = message_data.get('interactive', {})
            if interactive.get('type') == 'button_reply':
                button_reply = interactive.get('button_reply', {})
                message_text = f"Button: {button_reply.get('title', '')}"
                button_id = button_reply.get('id', '')
        else:
            message_text = f"Unsupported message type: {message_type}"
        
        return {
            'phone': phone,
            'message_text': message_text,
            'message_id': message_id,
            'timestamp': timestamp,
            'message_type': message_type,
            'button_id': button_id,
            'contact_name': contact_data.get('profile', {}).get('name', f'User {phone[-4:]}')
        }
    except Exception as e:
        print(f"Error parsing message data: {e}")
        return None

def process_incoming_message(db, socketio, parsed_data):
    """Process incoming WhatsApp message and generate response"""
    phone = parsed_data['phone']
    message_text = parsed_data['message_text']
    message_id = parsed_data['message_id']
    timestamp = parsed_data['timestamp']
    message_type = parsed_data['message_type']
    button_id = parsed_data['button_id']
    contact_name = parsed_data['contact_name']
    
    print(f"Processing message from {phone}: '{message_text}'")
    print(f"Message ID: {message_id}, Type: {message_type}")
    
    # Check if user exists
    user = db.users.find_one({'phone': phone})
    is_new_user = user is None
    print(f"User lookup for {phone}: {'NEW USER' if is_new_user else 'EXISTING USER'}")
    
    # Save incoming message
    message_doc = {
        'messageId': message_id,
        'phone': phone,
        'message': message_text,
        'direction': 'inbound',
        'timestamp': timestamp,
        'messageType': message_type,
        'isRead': False,
        'status': 'received'  # For incoming messages
    }
    db.messages.insert_one(message_doc)
    
    # Determine reply
    reply_text = None
    buttons = None
    referred_by = None
    
    if is_new_user:
        print(f"Getting auto-reply for new user message: '{message_text}'")
        reply_text, buttons, referred_by = get_auto_reply(message_text, True)
        print(f"Auto-reply result: reply_text={bool(reply_text)}, has_buttons={bool(buttons)}, referred_by={referred_by}")
    elif button_id:
        print(f"Handling button reply: {button_id}")
        reply_text, buttons = handle_button_reply(button_id)
        print(f"Button handler result: reply_text={bool(reply_text)}, has_buttons={bool(buttons)}")
    
    # Handle user creation/update
    if is_new_user and reply_text:
        # Create new user
        user_doc = {
            'phone': phone,
            'name': contact_name,
            'status': 'priority',
            'referredBy': referred_by,
            'createdAt': datetime.now(pytz.timezone('Asia/Kolkata')),
            'lastMessageAt': timestamp
        }
        print(f"Creating new user: {user_doc}")
        db.users.insert_one(user_doc)
    elif not is_new_user:
        # Update existing user
        print(f"Updating existing user {phone} with lastMessageAt: {timestamp}")
        db.users.update_one(
            {'phone': phone},
            {'$set': {'lastMessageAt': timestamp}}
        )
    
    # Send reply if we have one
    if reply_text:
        print(f"Sending auto-reply to {phone}: '{reply_text[:50]}...'")
        api_response = send_whatsapp_message(phone, reply_text, buttons)
        print(f"WhatsApp API response: {api_response}")
        
        # Determine message status based on API response
        message_status = 'failed'
        whatsapp_message_id = None
        if 'messages' in api_response and len(api_response['messages']) > 0:
            message_status = 'sent'
            whatsapp_message_id = api_response['messages'][0].get('id')
        
        # Save outbound message
        reply_doc = {
            'phone': phone,
            'message': reply_text,
            'direction': 'outbound',
            'timestamp': datetime.now(pytz.timezone('Asia/Kolkata')),
            'messageType': 'interactive' if buttons else 'text',
            'isRead': True,
            'status': message_status,
            'whatsappMessageId': whatsapp_message_id
        }
        db.messages.insert_one(reply_doc)
        
        # Emit outbound message to frontend
        if socketio:
            socketio.emit('new_message', {
                'phone': phone,
                'message': reply_text,
                'direction': 'outbound',
                'timestamp': datetime.now(pytz.timezone('Asia/Kolkata')).isoformat()
            })
    
    # Emit incoming message to frontend
    if socketio:
        socketio.emit('new_message', {
            'phone': phone,
            'message': message_text,
            'direction': 'inbound',
            'timestamp': timestamp.isoformat()
        })
    
    return True

def process_status_update(db, socketio, data):
    """Process WhatsApp message status updates (delivered, read, etc.)"""
    try:
        # Check if this webhook contains status updates
        if 'entry' not in data or not data['entry']:
            return False
            
        for entry in data['entry']:
            changes = entry.get('changes', [])
            for change in changes:
                value = change.get('value', {})
                
                # Check if this change contains statuses
                if 'statuses' in value:
                    statuses = value['statuses']
                    print(f"Processing {len(statuses)} status updates")
                    
                    for status in statuses:
                        message_id = status.get('id')
                        status_type = status.get('status')  # sent, delivered, read, failed
                        recipient = status.get('recipient_id')
                        timestamp = datetime.fromtimestamp(int(status.get('timestamp', 0)))
                        
                        print(f"Status update: Message {message_id} to {recipient} is {status_type}")
                        
                        # Update message status in database by WhatsApp message ID
                        result = db.messages.update_one(
                            {'whatsappMessageId': message_id},
                            {
                                '$set': {
                                    'status': status_type,
                                    'statusTimestamp': timestamp
                                }
                            }
                        )
                        
                        if result.modified_count > 0:
                            print(f"Updated message {message_id} status to {status_type}")
                            
                            # Get the message to have full context for frontend
                            message = db.messages.find_one({'whatsappMessageId': message_id})
                            
                            if message and socketio:
                                # Emit status update to frontend with message details
                                socketio.emit('message_status_update', {
                                    'messageId': str(message.get('_id')),
                                    'whatsappMessageId': message_id,
                                    'phone': recipient,
                                    'status': status_type,
                                    'timestamp': timestamp.isoformat()
                                })
                        else:
                            print(f"No message found with WhatsApp ID: {message_id}")
                    
                    return True  # We processed status updates
                    
        return False  # No status updates in this webhook
    except Exception as e:
        print(f"Error processing status update: {e}")
        import traceback
        traceback.print_exc()
        return False