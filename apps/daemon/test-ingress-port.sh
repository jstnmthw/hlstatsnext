#!/bin/bash

# Test script to verify INGRESS_PORT environment variable works

echo "Testing INGRESS_PORT environment variable configuration..."
echo ""

# Test 1: Default port (from .env file)
echo "Test 1: Running with default port from .env file (27500)"
echo "Starting daemon with INGRESS_PORT=27500..."
timeout 5s pnpm start 2>&1 | grep -E "UDP server listening|port" &
PID1=$!
sleep 3
kill $PID1 2>/dev/null
echo ""

# Test 2: Custom port via environment variable
echo "Test 2: Running with custom port via environment variable"
echo "Starting daemon with INGRESS_PORT=28500..."
INGRESS_PORT=28500 timeout 5s pnpm start 2>&1 | grep -E "UDP server listening|port" &
PID2=$!
sleep 3
kill $PID2 2>/dev/null
echo ""

# Test 3: Another custom port
echo "Test 3: Running with another custom port"
echo "Starting daemon with INGRESS_PORT=30000..."
INGRESS_PORT=30000 timeout 5s pnpm start 2>&1 | grep -E "UDP server listening|port" &
PID3=$!
sleep 3
kill $PID3 2>/dev/null
echo ""

echo "Test completed. Check the output above to verify different ports were used."