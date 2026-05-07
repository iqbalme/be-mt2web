# Script untuk testing Dashboard MT2Web (PowerShell)
# Jalankan dengan: .\test_dashboard.ps1

Write-Host "🚀 Testing MT2Web Dashboard" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

$BASE_URL = "http://localhost:8787"

# Function untuk send data
function Send-Data {
    param(
        [string]$channel,
        [hashtable]$data
    )
    
    Write-Host ""
    Write-Host "📤 Mengirim data ke channel: $channel" -ForegroundColor Cyan
    
    $payload = @{
        "channel" = $channel
    } + $data
    
    $json = $payload | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$BASE_URL/update" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $json
    
    Write-Host "✓ Response: $($response.StatusCode)" -ForegroundColor Green
}

# Test 1: Kirim data dari 4 terminal berbeda
Write-Host ""
Write-Host "📌 Test 1: Mengirim data dari 4 terminal MT2" -ForegroundColor Yellow
Write-Host "--------" -ForegroundColor Yellow

Send-Data "MT2-Trading-01" @{
    "symbol" = "EURUSD"
    "bid" = 1.0945
    "ask" = 1.0948
    "volume" = 5000
    "status" = "active"
}

Send-Data "MT2-Trading-02" @{
    "symbol" = "GBPUSD"
    "bid" = 1.2650
    "ask" = 1.2653
    "volume" = 3000
    "status" = "active"
}

Send-Data "MT2-Trading-03" @{
    "symbol" = "USDJPY"
    "bid" = 149.50
    "ask" = 149.53
    "volume" = 7000
    "status" = "standby"
}

Send-Data "MT2-Trading-04" @{
    "symbol" = "AUDUSD"
    "bid" = 0.6580
    "ask" = 0.6583
    "volume" = 2500
    "status" = "active"
}

Write-Host ""
Write-Host "✅ Test 1 Complete" -ForegroundColor Green
Write-Host "🌐 Buka dashboard di: $BASE_URL" -ForegroundColor Green
Write-Host ""

# Test 2: Update data dengan parameter baru
Write-Host ""
Write-Host "📌 Test 2: Update data dengan parameter tambahan" -ForegroundColor Yellow
Write-Host "--------" -ForegroundColor Yellow

Send-Data "MT2-Trading-01" @{
    "symbol" = "EURUSD"
    "bid" = 1.0950
    "ask" = 1.0953
    "volume" = 5500
    "spread" = 0.0003
    "orders" = 12
}

Write-Host ""
Write-Host "✅ Test 2 Complete - Data MT2-Trading-01 sudah update" -ForegroundColor Green
Write-Host ""

# Test 3: Loop untuk continuous update
Write-Host ""
Write-Host "📌 Test 3: Continuous update (Ctrl+C untuk stop)" -ForegroundColor Yellow
Write-Host "--------" -ForegroundColor Yellow

$counter = 1
while ($counter -le 5) {
    $terminalNum = ($counter % 2) + 1
    $price = 45000 + (Get-Random -Maximum 1000)
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    Send-Data "MT2-Continuous-$terminalNum" @{
        "count" = $counter
        "price" = $price
        "timestamp" = $timestamp
    }
    
    $counter++
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "✅ All Tests Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Dashboard Features:" -ForegroundColor Cyan
Write-Host "  - Filter dropdown dengan checkbox untuk setiap terminal"
Write-Host "  - Card list yang menampilkan semua data"
Write-Host "  - Real-time update via WebSocket"
Write-Host "  - Responsive design (desktop/tablet/mobile)"
Write-Host "  - Auto-refresh setiap kali ada update dari terminal"
Write-Host ""
Write-Host "🎯 Coba:" -ForegroundColor Cyan
Write-Host "  1. Buka $BASE_URL di browser"
Write-Host "  2. Lihat 4 terminal muncul sebagai card"
Write-Host "  3. Gunakan dropdown filter untuk show/hide terminal"
Write-Host "  4. Jalankan script ini lagi untuk update data"
Write-Host ""
