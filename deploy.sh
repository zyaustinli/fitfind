#!/bin/bash

# Production deployment script for FitFind

set -e

echo "🚀 Starting FitFind deployment..."

# Set production environment
export FLASK_ENV=production
export NODE_ENV=production

# Install backend dependencies
echo "📦 Installing backend dependencies..."
pip install -r requirements.txt

# Build frontend
echo "🔨 Building frontend..."
cd fitfind-frontend
npm install
npm run build
cd ..

# Run database migrations if needed
echo "🗄️ Preparing database..."
# Add your database setup commands here

# Set proper permissions
echo "🔒 Setting file permissions..."
chmod +x deploy.sh
chmod -R 755 uploads/
chmod -R 755 results/

# Start the application with gunicorn
echo "🌐 Starting application..."
if [ "$1" = "dev" ]; then
    echo "Starting in development mode..."
    python app.py
else
    echo "Starting in production mode with gunicorn..."
    gunicorn -c gunicorn.conf.py app:app
fi

echo "✅ FitFind deployed successfully!"