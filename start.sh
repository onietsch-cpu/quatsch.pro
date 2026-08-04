#!/bin/bash
set -e

echo "Installing dependencies..."
npm install

echo "Building frontend..."
cd apps/web
npm run build
cd ../..

echo "Starting API server..."
cd apps/api
npm start
