#!/usr/bin/env python3
"""Test script to verify webhook handling"""

import requests
import json

# Test data - actual webhook format from WhatsApp
test_status_update = {
    'object': 'whatsapp_business_account',
    'entry': [{
        'id': '1680100749352904',
        'changes': [{
            'value': {
                'messaging_product': 'whatsapp',
                'metadata': {
                    'display_phone_number': '919663430348',
                    'phone_number_id': '701514549721570'
                },
                'statuses': [{
                    'id': 'wamid.HBgMOTE4Mjc5NzU2Mjk3FQIAERgSODc4QzNDMjU0MjIzNTlCMDFDAA==',
                    'status': 'read',
                    'timestamp': '1757609387',
                    'recipient_id': '918279756297'
                }]
            },
            'field': 'messages'
        }]
    }]
}

test_message = {
    'object': 'whatsapp_business_account',
    'entry': [{
        'id': '1680100749352904',
        'changes': [{
            'value': {
                'messaging_product': 'whatsapp',
                'metadata': {
                    'display_phone_number': '919663430348',
                    'phone_number_id': '701514549721570'
                },
                'contacts': [{
                    'profile': {'name': 'Test User'},
                    'wa_id': '918279756297'
                }],
                'messages': [{
                    'from': '918279756297',
                    'id': 'wamid.TEST_MESSAGE_ID',
                    'timestamp': '1757609387',
                    'text': {'body': 'Test message'},
                    'type': 'text'
                }]
            },
            'field': 'messages'
        }]
    }]
}

def test_webhook(data, description):
    """Send test webhook data to the server"""
    print(f"\nTesting: {description}")
    print("-" * 50)
    
    try:
        response = requests.post(
            'http://localhost:5000/webhook',
            json=data,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 200:
            print("✅ Test passed!")
        else:
            print("❌ Test failed!")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("WhatsApp Webhook Test Script")
    print("=" * 50)
    
    # Test status update
    test_webhook(test_status_update, "Status Update (Read Receipt)")
    
    # Test regular message
    test_webhook(test_message, "Regular Text Message")
    
    print("\n" + "=" * 50)
    print("Tests completed. Check server logs for details.")