#!/bin/bash

echo "Testing WhatsApp CRM Backend Connection..."
echo ""

# Test health endpoint
echo "1. Testing health endpoint:"
curl -s http://localhost:5000/api/health | python3 -m json.tool

echo ""
echo "2. Testing chats endpoint:"
curl -s http://localhost:5000/api/chats | python3 -m json.tool | head -20

echo ""
echo "3. Checking if MongoDB is configured:"
if curl -s http://localhost:5000/api/chats | grep -q "Database not connected"; then
    echo "❌ MongoDB not connected - Please check MONGODB_URI in backend/.env"
else
    echo "✅ MongoDB appears to be connected"
fi

echo ""
echo "If you see 'Connection refused', make sure backend is running:"
echo "  cd backend && python app.py"