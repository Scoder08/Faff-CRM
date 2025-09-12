# GCP Deployment Guide for WhatsApp CRM Backend

## Option 1: Cloud Run (Recommended - Faster & Auto-scaling)

### Prerequisites
1. Install Google Cloud SDK: `brew install google-cloud-sdk`
2. Authenticate: `gcloud auth login`
3. Set project: `gcloud config set project YOUR_PROJECT_ID`

### Deploy to Cloud Run

1. **Quick Deploy (One Command)**:
   ```bash
   cd backend
   ./deploy-cloudrun.sh
   ```

2. **Manual Deploy**:
   ```bash
   # Build and push Docker image
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/whatsapp-crm-backend
   
   # Deploy to Cloud Run
   gcloud run deploy whatsapp-crm-backend \
     --image gcr.io/YOUR_PROJECT_ID/whatsapp-crm-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --port 8080 \
     --memory 2Gi \
     --cpu 2 \
     --min-instances 1 \
     --cpu-boost
   ```

3. **Set Environment Variables** in Cloud Run Console:
   - Go to Cloud Run → whatsapp-crm-backend → Edit & Deploy New Revision
   - Under "Variables & Secrets" add:
     - `MONGODB_URI` or `MONGO_PUBLIC_URL`
     - `WHATSAPP_API_TOKEN`
     - `WHATSAPP_PHONE_NUMBER_ID`
     - `SECRET_KEY`
     - `FRONTEND_URL` (your frontend URL)

## Option 2: App Engine Flexible

### Deploy to App Engine

1. **Initialize App Engine**:
   ```bash
   gcloud app create --region=us-central1
   ```

2. **Deploy**:
   ```bash
   cd backend
   gcloud app deploy app.yaml --version=v1
   ```

3. **Set Environment Variables**:
   Edit `app.yaml` and add under `env_variables`:
   ```yaml
   env_variables:
     MONGODB_URI: "your-mongodb-uri"
     WHATSAPP_API_TOKEN: "your-token"
     WHATSAPP_PHONE_NUMBER_ID: "your-phone-id"
     SECRET_KEY: "your-secret-key"
   ```

## Performance Comparison

| Feature | Cloud Run | App Engine Flex |
|---------|-----------|-----------------|
| Cold Start | ~2-5 seconds | ~10-30 seconds |
| Auto-scaling | Instant (0-100) | Slower (1-10) |
| WebSocket Support | Yes | Yes |
| Cost | Pay per use | Minimum 1 instance |
| Memory | Up to 32GB | Up to 32GB |
| CPU | Up to 8 vCPUs | Up to 8 vCPUs |
| Deployment Time | ~2 minutes | ~5-10 minutes |

## Why GCP is Faster than Railway

1. **Global Network**: Google's premium network with edge locations
2. **CPU Boost**: Cloud Run's CPU boost feature for faster cold starts
3. **Better Resources**: Dedicated CPU/memory vs shared resources
4. **Regional Proximity**: Deploy closer to your users
5. **Auto-scaling**: Handles traffic spikes better

## Monitoring

1. **Cloud Run Metrics**:
   ```bash
   gcloud run services describe whatsapp-crm-backend --region=us-central1
   ```

2. **View Logs**:
   ```bash
   gcloud logs read --service=whatsapp-crm-backend --limit=50
   ```

3. **Cloud Console**: 
   - Visit: https://console.cloud.google.com/run
   - Check metrics, logs, and performance

## Update Frontend

Update your frontend to point to the new GCP backend URL:
```javascript
// In your frontend .env
REACT_APP_BACKEND_URL=https://whatsapp-crm-backend-xxxxx-uc.a.run.app
```

## Estimated Costs (Monthly)

- **Cloud Run**: $5-20 (with 1 min instance, 2M requests)
- **App Engine Flex**: $40-60 (1 instance always running)

## Troubleshooting

1. **WebSocket Issues**: Ensure session affinity is enabled
2. **CORS Errors**: Check CORS configuration in app.py
3. **MongoDB Connection**: Whitelist Cloud Run/App Engine IPs in MongoDB Atlas
4. **Slow Cold Starts**: Enable CPU boost and keep min-instances=1