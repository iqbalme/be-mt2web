#!/bin/bash

# Script untuk testing Dashboard MT2Web
# Jalankan dengan: bash test_dashboard.sh

echo "🚀 Testing MT2Web Dashboard"
echo "================================"

BASE_URL="http://localhost:8787"

# Function untuk send data
send_data() {
    local channel=$1
    local data=$2
    
    echo ""
    echo "📤 Mengirim data ke channel: $channel"
    
    curl -X POST "$BASE_URL/update" \
        -H "Content-Type: application/json" \
        -d "{
            \"channel\": \"$channel\",
            $data
        }"
    
    echo ""
}

# Test 1: Kirim data dari 4 terminal berbeda
echo ""
echo "📌 Test 1: Mengirim data dari 4 terminal MT2"
echo "--------"

send_data "MT2-Trading-01" "\"symbol\":\"EURUSD\",\"bid\":1.0945,\"ask\":1.0948,\"volume\":5000,\"status\":\"active\""

send_data "MT2-Trading-02" "\"symbol\":\"GBPUSD\",\"bid\":1.2650,\"ask\":1.2653,\"volume\":3000,\"status\":\"active\""

send_data "MT2-Trading-03" "\"symbol\":\"USDJPY\",\"bid\":149.50,\"ask\":149.53,\"volume\":7000,\"status\":\"standby\""

send_data "MT2-Trading-04" "\"symbol\":\"AUDUSD\",\"bid\":0.6580,\"ask\":0.6583,\"volume\":2500,\"status\":\"active\""

echo ""
echo "✅ Test 1 Complete"
echo "🌐 Buka dashboard di: $BASE_URL"
echo ""

# Test 2: Update data dengan parameter baru
echo ""
echo "📌 Test 2: Update data dengan parameter tambahan"
echo "--------"

send_data "MT2-Trading-01" "\"symbol\":\"EURUSD\",\"bid\":1.0950,\"ask\":1.0953,\"volume\":5500,\"spread\":0.0003,\"orders\":12"

echo ""
echo "✅ Test 2 Complete - Data MT2-Trading-01 sudah update"
echo ""

# Test 3: Loop untuk continuous update
echo ""
echo "📌 Test 3: Continuous update (tekan Ctrl+C untuk stop)"
echo "--------"

counter=1
while [ $counter -le 5 ]; do
    send_data "MT2-Continuous-$((counter % 2 + 1))" "\"count\":$counter,\"price\":$((45000 + RANDOM % 1000)),\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""
    counter=$((counter + 1))
    sleep 2
done

echo ""
echo "✅ All Tests Complete!"
echo ""
echo "📊 Dashboard Features:"
echo "  - Filter dropdown dengan checkbox untuk setiap terminal"
echo "  - Card list yang menampilkan semua data"
echo "  - Real-time update via WebSocket"
echo "  - Responsive design (desktop/tablet/mobile)"
echo "  - Auto-refresh setiap kali ada update dari terminal"
echo ""
echo "🎯 Coba:"
echo "  1. Buka $BASE_URL di browser"
echo "  2. Lihat 4 terminal muncul sebagai card"
echo "  3. Gunakan dropdown filter untuk show/hide terminal"
echo "  4. Jalankan script ini lagi untuk update data"
echo ""
