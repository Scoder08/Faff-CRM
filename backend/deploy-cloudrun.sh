#!/bin/bash

# Set your GCP project ID
PROJECT_ID="diesel-talon-453411-a1"
REGION="us-central1"
SERVICE_NAME="whatsapp-crm-backend"

echo "Building and deploying to Cloud Run..."

# Build and deploy in one step using Cloud Run's built-in build
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 100 \
  --concurrency 1000 \
  --cpu-boost \
  --set-env-vars "FLASK_ENV=production" \
  --project $PROJECT_ID

echo "Deployment complete!"
echo "Don't forget to set your environment variables in Cloud Run console:"
echo "- MONGODB_URI or MONGO_PUBLIC_URL"
echo "- WHATSAPP_API_TOKEN"
echo "- WHATSAPP_PHONE_NUMBER_ID"
echo "- SECRET_KEY"