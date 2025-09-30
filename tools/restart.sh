#!/bin/bash

# Check if ecosystem.config.js exists
if [ ! -f ecosystem.config.js ]; then
  echo "Error: ecosystem.config.js not found."
  exit 1
fi

# Get the app name from ecosystem.config.js using node
APP_NAME=$(node -p "require('./ecosystem.config.js').apps[0].name")

# Check if the app name was retrieved
if [ -z "$APP_NAME" ]; then
  echo "Error: Could not get app name from ecosystem.config.js."
  exit 1
fi

# Restart the app with pm2
echo "Restarting: $APP_NAME"
pm2 restart "$APP_NAME" --update-env

echo "Done."
