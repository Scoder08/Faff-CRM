#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime

# Test webhook data for a new user message
test_data = {
    "object": "whatsapp_business_account",
    "entry": [
        {
            "id": "123456789",
            "changes": [
                {
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {
                            "display_phone_number": "15550557234",
                            "phone_number_id": "123456789"
                        },
                        "contacts": [
                            {
                                "profile": {
                                    "name": f"Test User {datetime.now().strftime('%H%M%S')}"
                                },
                                "wa_id": f"919999{datetime.now().strftime('%H%M%S')}"
                            }
                        ],
                        "messages": [
                            {
                                "from": f"919999{datetime.now().strftime('%H%M%S')}",
                                "id": f"msg_{datetime.now().strftime('%H%M%S')}_{time.time()}",
                                "timestamp": str(int(time.time())),
                                "text": {
                                    "body": "Hi, I'm interested in your service. Referred by John Doe"
                                },
                                "type": "text"
                            }
                        ]
                    },
                    "field": "messages"
                }
            ]
        }
    ]
}

# Send the webhook to the backend
url = "http://localhost:5000/api/webhook"
headers = {"Content-Type": "application/json"}

print(f"Testing new user creation at {datetime.now()}")
print(f"Phone: {test_data['entry'][0]['changes'][0]['value']['messages'][0]['from']}")
print(f"Message: {test_data['entry'][0]['changes'][0]['value']['messages'][0]['text']['body']}")
print("\nSending webhook...")

try:
    response = requests.post(url, headers=headers, data=json.dumps(test_data))
    print(f"Response Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 200:
        print("\n✅ Test successful! Check the frontend to see if the new user appears.")
        print("The new user should appear immediately without refresh.")
    else:
        print("\n❌ Test failed. Check the backend logs for errors.")
except Exception as e:
    print(f"\n❌ Error sending webhook: {e}")
    print("Make sure the backend is running on port 5000")