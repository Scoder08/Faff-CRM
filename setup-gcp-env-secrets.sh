#!/bin/bash

# Script to set up environment variables in Google Secret Manager
# These secrets will be used during Cloud Build and Cloud Run deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}     GCP Secret Manager Setup for WhatsApp CRM Backend${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Default values
PROJECT_ID="diesel-talon-453411-a1"

# Get project ID
read -p "Enter your GCP Project ID (or press Enter for '${PROJECT_ID}'): " input_project
PROJECT_ID=${input_project:-$PROJECT_ID}

echo -e "${YELLOW}Setting up secrets for project: ${PROJECT_ID}${NC}"
echo ""

# Set the project
gcloud config set project ${PROJECT_ID}

# Enable Secret Manager API
echo "Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com

echo ""
echo -e "${YELLOW}Please provide your environment variable values:${NC}"
echo ""

# Function to create or update a secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2
    
    # Check if secret exists
    if gcloud secrets describe ${secret_name} >/dev/null 2>&1; then
        echo -e "${YELLOW}Secret '${secret_name}' exists. Updating...${NC}"
        echo -n "${secret_value}" | gcloud secrets versions add ${secret_name} --data-file=-
    else
        echo -e "${GREEN}Creating secret '${secret_name}'...${NC}"
        echo -n "${secret_value}" | gcloud secrets create ${secret_name} --data-file=- --replication-policy="automatic"
    fi
}

# Collect environment variables
echo "1. MongoDB URI (e.g., mongodb+srv://user:pass@cluster.mongodb.net/dbname)"
read -p "   Enter MONGODB_URI: " MONGODB_URI
while [ -z "$MONGODB_URI" ]; do
    echo -e "${RED}   MongoDB URI is required!${NC}"
    read -p "   Enter MONGODB_URI: " MONGODB_URI
done

echo ""
echo "2. WhatsApp Business API Token"
read -p "   Enter WHATSAPP_TOKEN: " WHATSAPP_TOKEN
while [ -z "$WHATSAPP_TOKEN" ]; do
    echo -e "${RED}   WhatsApp Token is required!${NC}"
    read -p "   Enter WHATSAPP_TOKEN: " WHATSAPP_TOKEN
done

echo ""
echo "3. WhatsApp Phone Number ID"
read -p "   Enter WHATSAPP_PHONE_ID: " WHATSAPP_PHONE_ID
while [ -z "$WHATSAPP_PHONE_ID" ]; do
    echo -e "${RED}   WhatsApp Phone ID is required!${NC}"
    read -p "   Enter WHATSAPP_PHONE_ID: " WHATSAPP_PHONE_ID
done

echo ""
echo "4. Application Secret Key (for session management)"
read -p "   Enter SECRET_KEY (or press Enter for auto-generated): " SECRET_KEY
if [ -z "$SECRET_KEY" ]; then
    SECRET_KEY=$(openssl rand -hex 32)
    echo -e "${GREEN}   Generated SECRET_KEY: ${SECRET_KEY:0:10}...${NC}"
fi

echo ""
echo "5. Frontend URL (e.g., https://your-app.vercel.app)"
read -p "   Enter FRONTEND_URL: " FRONTEND_URL
while [ -z "$FRONTEND_URL" ]; do
    echo -e "${RED}   Frontend URL is required!${NC}"
    read -p "   Enter FRONTEND_URL: " FRONTEND_URL
done

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Creating/Updating secrets in Secret Manager...${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# Create secrets
create_or_update_secret "mongodb-uri" "$MONGODB_URI"
create_or_update_secret "whatsapp-token" "$WHATSAPP_TOKEN"
create_or_update_secret "whatsapp-phone-id" "$WHATSAPP_PHONE_ID"
create_or_update_secret "app-secret-key" "$SECRET_KEY"
create_or_update_secret "frontend-url" "$FRONTEND_URL"

echo ""
echo -e "${GREEN}✅ Secrets created successfully!${NC}"
echo ""

# Grant Cloud Build access to secrets
echo -e "${YELLOW}Granting Cloud Build access to secrets...${NC}"

# Get project number
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
SERVICE_ACCOUNT="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo "Service Account: ${SERVICE_ACCOUNT}"

# Grant access to each secret
for secret in mongodb-uri whatsapp-token whatsapp-phone-id app-secret-key frontend-url; do
    echo "Granting access to ${secret}..."
    gcloud secrets add-iam-policy-binding ${secret} \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
done

# Also grant Cloud Run service account access
COMPUTE_SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo ""
echo -e "${YELLOW}Granting Cloud Run service account access...${NC}"

for secret in mongodb-uri whatsapp-token whatsapp-phone-id app-secret-key frontend-url; do
    gcloud secrets add-iam-policy-binding ${secret} \
        --member="serviceAccount:${COMPUTE_SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
done

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Secret Manager setup complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update your Cloud Build trigger to use these secrets"
echo "2. Use the following command to deploy with secrets:"
echo ""
echo -e "${BLUE}gcloud builds submit --config=backend/cloudbuild-secrets.yaml \\
    --substitutions=\\
_MONGODB_URI=\$(gcloud secrets versions access latest --secret=mongodb-uri),\\
_WHATSAPP_TOKEN=\$(gcloud secrets versions access latest --secret=whatsapp-token),\\
_WHATSAPP_PHONE_ID=\$(gcloud secrets versions access latest --secret=whatsapp-phone-id),\\
_SECRET_KEY=\$(gcloud secrets versions access latest --secret=app-secret-key),\\
_FRONTEND_URL=\$(gcloud secrets versions access latest --secret=frontend-url)${NC}"
echo ""

echo -e "${YELLOW}Or deploy Cloud Run service with secrets:${NC}"
echo ""
echo -e "${BLUE}gcloud run deploy whatsapp-crm-backend \\
    --image gcr.io/${PROJECT_ID}/whatsapp-crm-backend:latest \\
    --region us-central1 \\
    --set-secrets=\\
MONGODB_URI=mongodb-uri:latest,\\
WHATSAPP_TOKEN=whatsapp-token:latest,\\
WHATSAPP_PHONE_ID=whatsapp-phone-id:latest,\\
SECRET_KEY=app-secret-key:latest,\\
FRONTEND_URL=frontend-url:latest${NC}"
echo ""

echo -e "${GREEN}To view your secrets:${NC}"
echo "gcloud secrets list"
echo ""
echo -e "${GREEN}To update a secret value:${NC}"
echo "echo -n 'new-value' | gcloud secrets versions add SECRET_NAME --data-file=-"