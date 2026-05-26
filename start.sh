#!/bin/sh
# Detect the host's LAN IP, update .env, and start the stack.
# Usage: sh start.sh   (or chmod +x start.sh && ./start.sh)

# Prefer the IP on the interface used for outbound routing
IP=$(ip route get 1 2>/dev/null | grep -oP 'src \K[\d.]+' | head -1)

# Fall back to the first non-loopback address reported by hostname
if [ -z "$IP" ]; then
    IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [ -z "$IP" ]; then
    echo "Warning: could not detect a LAN IP address — falling back to localhost."
    IP="localhost"
fi

echo "Detected server IP: $IP"

ENVFILE="$(dirname "$0")/.env"
if [ ! -f "$ENVFILE" ]; then
    echo "Error: .env not found at $ENVFILE. Copy .env.example and fill in your values first."
    exit 1
fi

sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=http://$IP:3000|" "$ENVFILE"
sed -i "s|^API_URL=.*|API_URL=http://$IP/api|"           "$ENVFILE"

echo "Updated .env:"
echo "  FRONTEND_URL=http://$IP:3000"
echo "  API_URL=http://$IP/api"
echo ""

docker compose up -d --build
