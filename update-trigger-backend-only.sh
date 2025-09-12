#!/bin/bash

# Script to update GCP Cloud Build trigger to only run on backend changes
# This prevents unnecessary deployments when only frontend files change

set -e

# Variables
PROJECT_ID="diesel-talon-453411-a1"
TRIGGER_NAME="whatsapp-crm-master-deploy"
REGION="us-central1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Updating Cloud Build Trigger for Backend-Only Changes${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Get project ID
read -p "Enter your GCP Project ID (or press Enter for '${PROJECT_ID}'): " input_project
PROJECT_ID=${input_project:-$PROJECT_ID}

# Get trigger name
read -p "Enter your trigger name (or press Enter for '${TRIGGER_NAME}'): " input_trigger
TRIGGER_NAME=${input_trigger:-$TRIGGER_NAME}

echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "Project: ${PROJECT_ID}"
echo "Trigger: ${TRIGGER_NAME}"
echo "Region: ${REGION}"
echo ""

# Set the project
gcloud config set project ${PROJECT_ID}

echo -e "${YELLOW}Updating trigger to only deploy on backend changes...${NC}"

# Update the existing trigger with included files filter
gcloud builds triggers update ${TRIGGER_NAME} \
    --region=${REGION} \
    --included-files="backend/**" \
    --ignored-files="frontend/**,*.md,LICENSE,.gitignore,setup-*.sh,GCP_*.md"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Success! Trigger updated.${NC}"
    echo ""
    echo -e "${YELLOW}Trigger Configuration:${NC}"
    echo "• Will trigger on: Changes in backend/ directory"
    echo "• Will ignore: Changes in frontend/, *.md files, scripts"
    echo ""
    echo -e "${YELLOW}Examples of what WILL trigger deployment:${NC}"
    echo "✓ backend/app.py"
    echo "✓ backend/requirements.txt"
    echo "✓ backend/whatsapp_handler.py"
    echo "✓ backend/cloudbuild-secrets.yaml"
    echo ""
    echo -e "${YELLOW}Examples of what WON'T trigger deployment:${NC}"
    echo "✗ frontend/src/App.js"
    echo "✗ frontend/package.json"
    echo "✗ README.md"
    echo "✗ setup-gcp-trigger.sh"
    echo ""
    echo -e "${GREEN}To view trigger details:${NC}"
    echo "gcloud builds triggers describe ${TRIGGER_NAME} --region=${REGION}"
    echo ""
    echo -e "${GREEN}To test with a backend change:${NC}"
    echo "echo '# Backend update' >> backend/README.md"
    echo "git add backend/README.md"
    echo "git commit -m 'Test backend deployment trigger'"
    echo "git push origin master"
else
    echo ""
    echo -e "${RED}❌ Failed to update trigger.${NC}"
    echo ""
    echo "To manually update the trigger, run:"
    echo ""
    echo "gcloud builds triggers update ${TRIGGER_NAME} \\"
    echo "    --region=${REGION} \\"
    echo "    --included-files=\"backend/**\" \\"
    echo "    --ignored-files=\"frontend/**,*.md\""
fi