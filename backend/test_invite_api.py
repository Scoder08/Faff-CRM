#!/usr/bin/env python3
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def test_invite_api():
    """Test the invite API directly"""
    
    # External API endpoint
    external_api_url = 'https://faff-api-251644788910.asia-south1.run.app/api/whatsapp/message'
    
    # Prepare the request payload
    payload = {
        "to": "120363333602342373@g.us",
        "body": "OnboardingTest, TestUser, 919999999999, Ask, TestReferrer",
        "task_number": "0"
    }
    
    # Query parameters
    params = {
        'fallback': 'false',
        'internal': 'false'
    }
    
    try:
        print(f"Testing API: {external_api_url}")
        print(f"Payload: {payload}")
        
        # Create a session with proper configuration
        session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        adapter = HTTPAdapter(
            pool_connections=10,
            pool_maxsize=20,
            max_retries=retry_strategy
        )
        
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        # Set headers
        headers = {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; Python-Requests)'
        }
        
        print("\nMaking request...")
        
        # Make the request
        response = session.post(
            external_api_url,
            params=params,
            json=payload,
            headers=headers,
            timeout=30,
            verify=True
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print(f"Response Body: {response.text}")
        
        return response
        
    except requests.exceptions.ConnectionError as e:
        print(f"\n❌ Connection Error: {e}")
    except requests.exceptions.Timeout as e:
        print(f"\n❌ Timeout Error: {e}")
    except requests.exceptions.RequestException as e:
        print(f"\n❌ Request Error: {e}")
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_invite_api()