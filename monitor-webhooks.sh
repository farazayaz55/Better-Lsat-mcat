#!/bin/bash

echo "🔍 Monitoring webhook activity..."
echo "Press Ctrl+C to stop"
echo ""

# Monitor logs for webhook-related activity
docker-compose logs app -f | grep -i --line-buffered "webhook\|stripe\|=== STRIPE WEBHOOK RECEIVED ===\|=== CHECKOUT SESSION COMPLETED ===\|=== CREATING GOOGLE CALENDAR EVENTS ==="
