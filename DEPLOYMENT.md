# WhatsApp CRM Deployment Guide

## Prerequisites
- Node.js 16+ and npm
- Python 3.8+
- MongoDB instance (local or cloud like MongoDB Atlas)
- WhatsApp Business API access
- Domain names for frontend and backend (for production)

## Deployment Options

### Option 1: Deploy to Render (Recommended - Free Tier Available)

#### Backend Deployment on Render

1. **Prepare Backend**
   ```bash
   cd backend
   # Create a new file called render.yaml
   ```

2. **Create render.yaml**
   ```yaml
   services:
     - type: web
       name: whatsapp-crm-backend
       env: python
       buildCommand: "pip install -r requirements.txt"
       startCommand: "gunicorn app:app"
       envVars:
         - key: MONGODB_URI
           sync: false
         - key: WHATSAPP_PHONE_NUMBER_ID
           sync: false
         - key: WHATSAPP_ACCESS_TOKEN
           sync: false
         - key: VERIFY_TOKEN
           sync: false
         - key: SECRET_KEY
           generateValue: true
         - key: FRONTEND_URL
           sync: false
   ```

3. **Deploy to Render**
   - Push your code to GitHub
   - Go to https://render.com
   - Connect your GitHub repo
   - Select "New Web Service"
   - Configure environment variables
   - Deploy

#### Frontend Deployment on Vercel

1. **Prepare Frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to Vercel**
   ```bash
   npm i -g vercel
   vercel
   ```

3. **Configure Environment Variables in Vercel Dashboard**
   - REACT_APP_API_URL = https://your-backend.onrender.com
   - REACT_APP_SOCKET_URL = https://your-backend.onrender.com

### Option 2: Deploy to Heroku

#### Backend on Heroku

1. **Create Procfile in backend folder**
   ```
   web: gunicorn app:app
   ```

2. **Add gunicorn to requirements.txt**
   ```
   gunicorn==21.2.0
   ```

3. **Deploy**
   ```bash
   cd backend
   heroku create your-app-name
   heroku config:set MONGODB_URI="your_mongodb_uri"
   heroku config:set WHATSAPP_PHONE_NUMBER_ID="your_id"
   heroku config:set WHATSAPP_ACCESS_TOKEN="your_token"
   heroku config:set VERIFY_TOKEN="your_verify_token"
   heroku config:set FRONTEND_URL="https://your-frontend.vercel.app"
   git push heroku main
   ```

#### Frontend on Netlify

1. **Build and Deploy**
   ```bash
   cd frontend
   npm run build
   netlify deploy --prod --dir=build
   ```

2. **Set Environment Variables in Netlify Dashboard**

### Option 3: Deploy to VPS (DigitalOcean/AWS/Google Cloud)

#### Setup Server

1. **SSH into your server**
   ```bash
   ssh root@your-server-ip
   ```

2. **Install dependencies**
   ```bash
   # Update system
   apt update && apt upgrade -y
   
   # Install Python
   apt install python3 python3-pip python3-venv -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
   apt install nodejs -y
   
   # Install MongoDB
   wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   apt update
   apt install mongodb-org -y
   systemctl start mongod
   systemctl enable mongod
   
   # Install nginx
   apt install nginx -y
   ```

3. **Deploy Backend**
   ```bash
   cd /var/www
   git clone your-repo
   cd your-repo/backend
   
   # Create virtual environment
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   pip install gunicorn
   
   # Create .env file
   nano .env
   # Add all your environment variables
   
   # Create systemd service
   nano /etc/systemd/system/whatsapp-crm.service
   ```

   **whatsapp-crm.service content:**
   ```ini
   [Unit]
   Description=WhatsApp CRM Backend
   After=network.target

   [Service]
   User=www-data
   WorkingDirectory=/var/www/your-repo/backend
   Environment="PATH=/var/www/your-repo/backend/venv/bin"
   ExecStart=/var/www/your-repo/backend/venv/bin/gunicorn --workers 3 --bind unix:whatsapp-crm.sock -m 007 app:app

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   # Start service
   systemctl start whatsapp-crm
   systemctl enable whatsapp-crm
   ```

4. **Deploy Frontend**
   ```bash
   cd /var/www/your-repo/frontend
   
   # Create .env file
   echo "REACT_APP_API_URL=https://api.yourdomain.com" > .env
   echo "REACT_APP_SOCKET_URL=https://api.yourdomain.com" >> .env
   
   # Build
   npm install
   npm run build
   
   # Copy to nginx folder
   cp -r build/* /var/www/html/
   ```

5. **Configure Nginx**
   ```bash
   nano /etc/nginx/sites-available/whatsapp-crm
   ```

   **Nginx configuration:**
   ```nginx
   # Backend API
   server {
       listen 80;
       server_name api.yourdomain.com;

       location / {
           include proxy_params;
           proxy_pass http://unix:/var/www/your-repo/backend/whatsapp-crm.sock;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }

   # Frontend
   server {
       listen 80;
       server_name yourdomain.com;
       root /var/www/html;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

   ```bash
   # Enable site
   ln -s /etc/nginx/sites-available/whatsapp-crm /etc/nginx/sites-enabled
   nginx -t
   systemctl restart nginx
   ```

6. **Setup SSL with Let's Encrypt**
   ```bash
   apt install certbot python3-certbot-nginx -y
   certbot --nginx -d yourdomain.com -d api.yourdomain.com
   ```

## WhatsApp Business API Setup

1. **Get WhatsApp Business API Access**
   - Apply at: https://business.facebook.com/
   - Create a WhatsApp Business App
   - Get your Phone Number ID and Access Token

2. **Configure Webhook**
   - In Facebook App Dashboard, go to WhatsApp > Configuration
   - Set Webhook URL: `https://api.yourdomain.com/webhook`
   - Set Verify Token: Same as in your .env file
   - Subscribe to messages and message_status webhook fields

## MongoDB Setup

### Option 1: MongoDB Atlas (Cloud - Recommended)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get connection string
4. Add to MONGODB_URI in .env

### Option 2: Local MongoDB
1. Install MongoDB locally
2. Use connection string: `mongodb://localhost:27017/whatsapp_crm`

## Environment Variables Reference

### Backend (.env)
```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp_crm

# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
VERIFY_TOKEN=your_verify_token

# Email (for calendar invites)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Server
PORT=5000
SECRET_KEY=generate-a-random-secret-key
FRONTEND_URL=https://your-frontend-domain.com
DEBUG=False
```

### Frontend (.env)
```env
REACT_APP_API_URL=https://your-backend-domain.com
REACT_APP_SOCKET_URL=https://your-backend-domain.com
```

## Post-Deployment Checklist

- [ ] Test webhook connection with WhatsApp
- [ ] Verify MongoDB connection
- [ ] Test sending/receiving messages
- [ ] Check WebSocket connection for real-time updates
- [ ] Test schedule call feature with email
- [ ] Monitor application logs
- [ ] Setup error tracking (e.g., Sentry)
- [ ] Configure backup strategy for MongoDB
- [ ] Setup monitoring (e.g., UptimeRobot)

## Troubleshooting

### WebSocket Connection Issues
- Ensure CORS is properly configured
- Check if your hosting supports WebSocket
- Verify socket.io versions match between frontend and backend

### WhatsApp Webhook Not Working
- Verify webhook URL is publicly accessible
- Check verify token matches
- Ensure SSL certificate is valid
- Look at webhook logs in Facebook App Dashboard

### MongoDB Connection Issues
- Check connection string format
- Verify IP whitelist in MongoDB Atlas
- Ensure MongoDB service is running

## Support

For issues, check the logs:
- Backend: `heroku logs --tail` or check server logs
- Frontend: Browser console
- MongoDB: Connection logs

## Security Recommendations

1. **Use HTTPS everywhere**
2. **Keep secrets in environment variables**
3. **Regularly update dependencies**
4. **Implement rate limiting**
5. **Add request validation**
6. **Setup proper CORS policies**
7. **Use strong SECRET_KEY**
8. **Enable MongoDB authentication**
9. **Implement user authentication (future enhancement)**
10. **Regular security audits**