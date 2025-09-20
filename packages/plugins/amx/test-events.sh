#!/bin/bash
# HLStatsNext Event Testing Script
# Tests all structured event commands via RCON

RCON_IP="${RCON_IP:-127.0.0.1}"
RCON_PORT="${RCON_PORT:-27015}"
RCON_PASSWORD="${RCON_PASSWORD:-password}"

# Function to send RCON command
send_rcon() {
    echo "Sending: $1"
    # Replace with actual RCON tool command
    # Example: rcon -H $RCON_IP -P $RCON_PORT -p $RCON_PASSWORD "$1"
    echo "rcon -H $RCON_IP -P $RCON_PORT -p $RCON_PASSWORD \"$1\""
}

echo "=== HLStatsNext Event Testing ==="
echo "Testing structured event commands..."
echo ""

# Test Kill Event
echo "1. Testing KILL event (broadcast):"
send_rcon 'hlx_event 0 KILL 5 "ProPlayer" 1500 12 "NoobPlayer" 1450 15 ak47 0'
sleep 1

echo "2. Testing KILL event with headshot (broadcast):"
send_rcon 'hlx_event 0 KILL 5 "ProPlayer" 1500 12 "NoobPlayer" 1450 20 deagle 1'
sleep 1

# Test Suicide Event
echo "3. Testing SUICIDE event (broadcast):"
send_rcon 'hlx_event 0 SUICIDE 5 "ProPlayer" 1500 -5'
sleep 1

# Test TeamKill Event
echo "4. Testing TEAMKILL event (broadcast):"
send_rcon 'hlx_event 0 TEAMKILL 5 "ProPlayer" 12 "TeamMate" -10'
sleep 1

# Test Action Event
echo "5. Testing ACTION event (broadcast):"
send_rcon 'hlx_event 0 ACTION 5 "ProPlayer" 1500 "bomb_planted" "Planted the bomb" 5'
sleep 1

echo "6. Testing ACTION event - defuse (broadcast):"
send_rcon 'hlx_event 0 ACTION 5 "ProPlayer" 1500 "bomb_defused" "Defused the bomb" 10'
sleep 1

# Test Team Action Event
echo "7. Testing TEAM_ACTION event (broadcast):"
send_rcon 'hlx_event 0 TEAM_ACTION "TERRORIST" "round_win" "Won the round" 5 4'
sleep 1

# Test Connect Event
echo "8. Testing CONNECT event (broadcast):"
send_rcon 'hlx_event 0 CONNECT 5 "ProPlayer" "United States"'
sleep 1

# Test Disconnect Event
echo "9. Testing DISCONNECT event (broadcast):"
send_rcon 'hlx_event 0 DISCONNECT 5 "ProPlayer" 3600'
sleep 1

# Test Rank Response (private message to player 5)
echo "10. Testing RANK event (private to player 5):"
send_rcon 'hlx_event 5 RANK 5 42 1243 1850'
sleep 1

# Test Stats Response (private message to player 5)
echo "11. Testing STATS event (private to player 5):"
send_rcon 'hlx_event 5 STATS 5 42 1243 1850 150 60 2.5 75 25'
sleep 1

# Test Generic Message (broadcast)
echo "12. Testing MESSAGE event (broadcast):"
send_rcon 'hlx_event 0 MESSAGE "Server will restart in 5 minutes"'
sleep 1

# Test Announce Command
echo "13. Testing hlx_announce command:"
send_rcon 'hlx_announce Welcome to HLStatsNext Server!'
sleep 1

echo ""
echo "=== Testing Complete ==="
echo ""
echo "Check the game console to verify all messages appear correctly with colors."
echo ""
echo "Expected results:"
echo "- Kill/Suicide/TeamKill events show player names and points with colors"
echo "- Action events show action descriptions with colored points"
echo "- Team actions show team name and player count"
echo "- Connect/Disconnect events show player info"
echo "- Rank/Stats show formatted statistics (private to specific player)"
echo "- Messages and announcements show with [HLStatsNext] tag"