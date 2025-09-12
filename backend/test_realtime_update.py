#!/usr/bin/env python3
import socketio
import time
import threading

# Create a Socket.IO client
sio = socketio.Client()

# Flag to track connection status
connected = False
received_events = []

@sio.event
def connect():
    global connected
    print("✅ Connected to Socket.IO server")
    connected = True

@sio.event
def disconnect():
    print("❌ Disconnected from Socket.IO server")

@sio.on('new_user_created')
def on_new_user_created(data):
    print(f"🎉 Received new_user_created event!")
    print(f"   User: {data.get('name', 'Unknown')}")
    print(f"   Phone: {data.get('phone', 'Unknown')}")
    print(f"   Status: {data.get('status', 'Unknown')}")
    print(f"   Referred By: {data.get('referredBy', 'None')}")
    received_events.append(data)

@sio.on('new_message')
def on_new_message(data):
    print(f"📨 Received new_message event!")
    print(f"   Phone: {data.get('phone', 'Unknown')}")
    print(f"   Direction: {data.get('direction', 'Unknown')}")

# Connect to the server
print("Connecting to Socket.IO server at http://localhost:5000...")
try:
    sio.connect('http://localhost:5000')
    
    # Wait for connection
    timeout = 5
    start = time.time()
    while not connected and time.time() - start < timeout:
        time.sleep(0.1)
    
    if connected:
        print("\n🔊 Listening for socket events...")
        print("Now trigger a new user message in another terminal or through WhatsApp")
        print("Press Ctrl+C to stop\n")
        
        # Keep the script running
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\nStopping...")
    else:
        print("❌ Failed to connect within 5 seconds")
        
except Exception as e:
    print(f"❌ Error connecting: {e}")
finally:
    if connected:
        sio.disconnect()
    print(f"\n📊 Total events received: {len(received_events)}")