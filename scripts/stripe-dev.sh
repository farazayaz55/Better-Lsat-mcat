#!/bin/bash

# Stripe Local Development Setup Script
# This script helps you set up Stripe webhooks for local development

echo "🚀 Setting up Stripe for local development..."

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found. Please install it first:"
    echo "   brew install stripe/stripe-cli/stripe"
    echo "   Or download from: https://github.com/stripe/stripe-cli/releases"
    exit 1
fi

# Check if user is logged in
if ! stripe config --list &> /dev/null; then
    echo "🔐 Please login to Stripe CLI first:"
    echo "   stripe login"
    exit 1
fi

echo "✅ Stripe CLI is ready!"

# Start the webhook forwarding
echo "🌐 Starting webhook forwarding to localhost:3000..."
echo "📝 Copy the webhook signing secret and update your .env file"
echo "🔄 Press Ctrl+C to stop"
echo ""

stripe listen --forward-to localhost:3000/api/webhooks/stripe
