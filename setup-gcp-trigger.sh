#!/bin/bash

# Script to create GCP Cloud Build trigger for GitHub integration
# This will automatically deploy when code is pushed to master branch

set -e

echo "Setting up GCP Cloud Build trigger for automatic deployment..."

# Variables - Update these with your values
PROJECT_ID="diesel-talon-453411-a1"
GITHUB_OWNER="scoder08"
GITHUB_REPO="feff-whatsapp-crm"
TRIGGER_NAME="whatsapp-crm-master-deploy"
TRIGGER_DESCRIPTION="Auto-deploy WhatsApp CRM backend to Cloud Run on push to master"
BRANCH_PATTERN="^master$"
REGION="us-central1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Prerequisites:${NC}"
echo "1. You must have gcloud CLI installed and authenticated"
echo "2. You must have connected your GitHub repository to Cloud Build"
echo "3. You must have necessary permissions in GCP project"
echo ""

# Check if user wants to proceed
read -p "Have you connected your GitHub repository to Cloud Build? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Please connect your GitHub repository first:${NC}"
    echo "1. Go to https://console.cloud.google.com/cloud-build/triggers"
    echo "2. Click 'Connect Repository'"
    echo "3. Select GitHub and authorize Cloud Build"
    echo "4. Select your repository: ${GITHUB_OWNER}/${GITHUB_REPO}"
    echo "5. Then run this script again"
    exit 1
fi

# Get project ID
echo ""
read -p "Enter your GCP Project ID (or press Enter for '${PROJECT_ID}'): " input_project
PROJECT_ID=${input_project:-$PROJECT_ID}

# Get GitHub owner
read -p "Enter your GitHub username (or press Enter for '${GITHUB_OWNER}'): " input_owner
GITHUB_OWNER=${input_owner:-$GITHUB_OWNER}

# Get GitHub repo
read -p "Enter your GitHub repo name (or press Enter for '${GITHUB_REPO}'): " input_repo
GITHUB_REPO=${input_repo:-$GITHUB_REPO}

echo ""
echo -e "${GREEN}Configuration:${NC}"
echo "Project ID: ${PROJECT_ID}"
echo "GitHub Repo: ${GITHUB_OWNER}/${GITHUB_REPO}"
echo "Branch: master"
echo "Region: ${REGION}"
echo ""

# Set the project
echo "Setting GCP project..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Ask about environment variables
echo ""
echo -e "${YELLOW}Environment Variables Setup${NC}"
read -p "Do you want to set up environment variables now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running environment variable setup..."
    if [ -f "./setup-gcp-env-secrets.sh" ]; then
        chmod +x ./setup-gcp-env-secrets.sh
        ./setup-gcp-env-secrets.sh
    else
        echo -e "${RED}setup-gcp-env-secrets.sh not found${NC}"
        echo "Please run it manually after this script completes"
    fi
fi

# Create the trigger
echo ""
echo -e "${YELLOW}Creating Cloud Build trigger...${NC}"

# Use cloudbuild-secrets.yaml if secrets are configured
BUILD_CONFIG="backend/cloudbuild-secrets.yaml"
if [ ! -f "$BUILD_CONFIG" ]; then
    BUILD_CONFIG="backend/cloudbuild.yaml"
fi

gcloud builds triggers create github \
    --repo-name="${GITHUB_REPO}" \
    --repo-owner="${GITHUB_OWNER}" \
    --branch-pattern="${BRANCH_PATTERN}" \
    --build-config="${BUILD_CONFIG}" \
    --name="${TRIGGER_NAME}" \
    --description="${TRIGGER_DESCRIPTION}" \
    --region="${REGION}" \
    --include-logs-with-status

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Success! Cloud Build trigger created.${NC}"
    echo ""
    echo "Trigger Details:"
    echo "- Name: ${TRIGGER_NAME}"
    echo "- Repo: ${GITHUB_OWNER}/${GITHUB_REPO}"
    echo "- Branch: master"
    echo "- Config: backend/cloudbuild.yaml"
    echo ""
    echo -e "${YELLOW}What happens now:${NC}"
    echo "1. Every push to master branch will trigger a build"
    echo "2. Cloud Build will run the steps in backend/cloudbuild.yaml"
    echo "3. Your backend will be automatically deployed to Cloud Run"
    echo ""
    echo -e "${YELLOW}To test the trigger:${NC}"
    echo "git add ."
    echo "git commit -m 'Test auto-deployment'"
    echo "git push origin master"
    echo ""
    echo -e "${YELLOW}To view build history:${NC}"
    echo "https://console.cloud.google.com/cloud-build/builds?project=${PROJECT_ID}"
    echo ""
    echo -e "${YELLOW}To manually trigger a build:${NC}"
    echo "gcloud builds triggers run ${TRIGGER_NAME} --branch=master"
else
    echo ""
    echo -e "${RED}❌ Failed to create trigger.${NC}"
    echo "Please check the error messages above."
    echo ""
    echo "Common issues:"
    echo "1. GitHub repository not connected to Cloud Build"
    echo "2. Insufficient permissions in GCP project"
    echo "3. APIs not enabled"
    echo ""
    echo "To connect GitHub repository:"
    echo "Visit: https://console.cloud.google.com/cloud-build/triggers"
fi