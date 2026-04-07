#!/bin/bash

# PI Quiz Platform - Complete Setup Script
# Run this to set up the entire application from scratch

set -e  # Exit on error

echo "======================================"
echo "PI Quiz Platform - Setup Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check Prerequisites
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 16+"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found. Please install PostgreSQL 12+"
    exit 1
fi

echo -e "${GREEN}✓ Node.js and PostgreSQL found${NC}"
echo ""

# Step 2: Create Database
echo -e "${BLUE}Step 2: Setting up PostgreSQL database...${NC}"

DB_NAME="pi_quiz"
DB_USER="pi_quiz"
DB_PASSWORD="pi_quiz_password"

# Check if database exists
if psql -U postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "✓ Database $DB_NAME already exists"
else
    echo "Creating database $DB_NAME..."
    createdb -U postgres $DB_NAME
    echo "✓ Database created"
fi

# Check if user exists
if psql -U postgres -t -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    echo "✓ User $DB_USER already exists"
else
    echo "Creating user $DB_USER..."
    psql -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    echo "✓ User created"
fi

# Grant privileges
echo "Setting up privileges..."
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
echo "✓ Privileges granted"
echo ""

# Step 3: Setup Backend
echo -e "${BLUE}Step 3: Setting up backend...${NC}"

cd /home/vivek-yadav/pi-quiz/hmm

if [ -d "node_modules" ]; then
    echo "✓ Dependencies already installed"
else
    echo "Installing dependencies..."
    npm install
    echo "✓ Dependencies installed"
fi

echo ""
echo -e "${GREEN}Backend setup complete!${NC}"
echo ""

# Step 4: Setup Frontend
echo -e "${BLUE}Step 4: Setting up frontend...${NC}"

cd /home/vivek-yadav/pi-quiz/hmmm

if [ -d "node_modules" ]; then
    echo "✓ Dependencies already installed"
else
    echo "Installing dependencies..."
    npm install
    echo "✓ Dependencies installed"
fi

echo ""
echo -e "${GREEN}Frontend setup complete!${NC}"
echo ""

# Step 5: Summary
echo "======================================"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo "======================================"
echo ""
echo "Database Configuration:"
echo "  Name: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: $DB_PASSWORD"
echo "  Connection: postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the backend server (in Terminal 1):"
echo "   cd /home/vivek-yadav/pi-quiz/hmm"
echo "   npm run start:dev"
echo ""
echo "2. Populate sample data (in Terminal 2, after backend starts):"
echo "   bash /home/vivek-yadav/pi-quiz/scripts/setup-admin.sh"
echo ""
echo "3. Start the frontend (in Terminal 3):"
echo "   cd /home/vivek-yadav/pi-quiz/hmmm"
echo "   npm run start"
echo ""
echo "4. Open your browser:"
echo "   http://localhost:8081"
echo ""
echo "5. Login with any roll number (e.g., 21BCS001)"
echo ""
echo "Documentation:"
echo "  - Quick Start: QUICKSTART.md"
echo "  - Full Docs:   AUTHENTICATION_README.md"
echo "  - Changes:     CHANGES_SUMMARY.md"
echo ""
echo "======================================"
