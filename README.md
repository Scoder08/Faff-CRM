# Faff WhatsApp CRM

A comprehensive WhatsApp Business CRM system for managing customer conversations, automating responses, and tracking user interactions.

## Features

- **WhatsApp Business API Integration** - Send and receive messages via WhatsApp
- **Real-time Messaging** - WebSocket-based real-time updates
- **Auto-Reply System** - Intelligent auto-responses for new users
- **Interactive Buttons** - Support for WhatsApp interactive button messages
- **User Management** - Track and manage customer profiles
- **Status Tracking** - Priority-based user status system
- **Message History** - Complete conversation history with search
- **Referral Tracking** - Track user referrals

## Tech Stack

### Backend
- **Flask** - Python web framework
- **Flask-SocketIO** - Real-time WebSocket communication
- **MongoDB** - NoSQL database for flexible data storage
- **WhatsApp Business API** - Official WhatsApp messaging

### Frontend
- **React** - UI framework
- **Socket.io Client** - Real-time updates
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool

## Prerequisites

- Python 3.8+
- Node.js 16+
- MongoDB
- WhatsApp Business Account with API access

## Environment Variables

### Backend (.env)
```env
MONGODB_URI=mongodb://localhost:27017/
WHATSAPP_TOKEN=your_whatsapp_api_token
WHATSAPP_PHONE_ID=your_phone_number_id
VERIFY_TOKEN=your_webhook_verify_token
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000
```

## Installation

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file with your credentials

5. Run the server:
```bash
python app.py
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file with API URL

4. Run development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## WhatsApp Webhook Configuration

1. Set up webhook URL in Meta Business Platform:
   - Webhook URL: `https://your-domain.com/webhook`
   - Verify Token: Use the same as `VERIFY_TOKEN` in .env

2. Subscribe to webhook fields:
   - messages
   - messaging_postbacks
   - messaging_optins

## Usage

### Sending Messages
- Select a chat from the sidebar
- Type your message in the input field
- Press Enter or click Send

### Auto-Reply Triggers
- New users sending "hi" and "faff" receive welcome message
- Interactive buttons for onboarding flow
- Automatic referral tracking from message content

### User Status Levels
- **Priority** - New users requiring attention
- **Active** - Engaged users
- **Inactive** - Users with no recent activity

## API Endpoints

- `GET /webhook` - WhatsApp webhook verification
- `POST /webhook` - Receive WhatsApp messages
- `GET /api/chats` - Get all chat conversations
- `GET /api/messages/<phone>` - Get messages for specific user
- `POST /api/send-message` - Send WhatsApp message
- `POST /api/update-status` - Update user status

## WebSocket Events

- `connect` - Client connection established
- `new_message` - Real-time message updates
- `disconnect` - Client disconnection

## Project Structure

```
feff-whatsapp-crm/
├── backend/
│   ├── app.py              # Main Flask application
│   ├── requirements.txt    # Python dependencies
│   └── .env                # Environment variables
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   ├── main.jsx       # Application entry point
│   │   └── index.css      # Global styles
│   ├── package.json       # Node dependencies
│   └── .env               # Frontend environment variables
└── README.md              # This file
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is proprietary and confidential.

## Support

For support, email support@faff.com or contact via WhatsApp.