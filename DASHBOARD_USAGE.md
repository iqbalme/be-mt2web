# Terminal Data Dashboard - Panduan Penggunaan

## 📋 Deskripsi

Dashboard ini menampilkan data real-time dari multiple terminal/client dalam format card list yang responsif. Setiap terminal dapat mengirim data dinamis, dan dashboard akan otomatis menampilkan dan memperbarui tampilan.

## 🌐 Akses Dashboard

Buka browser dan akses:
```
http://localhost:8787/
```

Dashboard akan menampilkan:
- **Dropdown Filter** di bagian atas untuk memilih terminal mana saja yang ingin ditampilkan
- **Card List** yang menampilkan data dari setiap terminal
- **Real-time Updates** ketika ada data baru atau terminal baru

## 📤 Mengirim Data dari Terminal/Client

### Endpoint: POST /update

Kirim data dengan format JSON:

```bash
curl -X POST http://localhost:8787/update \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "Terminal-1",
    "price": 45000,
    "volume": 1250,
    "status": "active",
    "timestamp": "2025-01-15T10:30:00Z"
  }'
```

### Format Payload

```json
{
  "channel": "Terminal-1",        // ✓ Required: Identitas terminal/client
  "key1": "value1",               // Data dinamis - bisa berapa pun jumlahnya
  "key2": 12345,
  "key3": true,
  "remove": ["old_key1", "old_key2"]  // Optional: Hapus key dari data
}
```

### Contoh Implementasi di Python

```python
import requests
import json

def send_terminal_data(channel_id, data):
    payload = {
        "channel": channel_id,
        **data
    }
    
    response = requests.post(
        "http://localhost:8787/update",
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    
    return response.json()

# Contoh penggunaan
data = {
    "price": 45000,
    "volume": 1250,
    "status": "active"
}

result = send_terminal_data("Terminal-1", data)
print(result)
```

### Contoh Implementasi di JavaScript/Node.js

```javascript
async function sendTerminalData(channelId, data) {
  const payload = {
    channel: channelId,
    ...data
  };

  const response = await fetch('/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return response.json();
}

// Contoh penggunaan
sendTerminalData('Terminal-1', {
  price: 45000,
  volume: 1250,
  status: 'active'
}).then(result => console.log(result));
```

## 🎯 Fitur Dashboard

### 1. **Filter Dropdown**
- Menampilkan list semua terminal yang aktif
- Checkbox untuk memilih/membatalkan terminal
- Indikator status (hijau = aktif, abu-abu = tidak aktif)
- Counter: "X dari Y terminal"

### 2. **Card Display**
- Setiap terminal ditampilkan dalam satu card
- Menampilkan nama terminal (channel)
- Menampilkan waktu update terakhir (relative: "5m lalu", "1h lalu")
- Menampilkan semua data parameter yang dikirim

### 3. **Real-time Update**
- Dashboard terhubung via WebSocket
- Update otomatis tanpa perlu refresh page
- Connection status indicator (bawah kanan)

### 4. **Responsive Design**
- Desktop: Grid 3 kolom
- Tablet: Grid 2 kolom
- Mobile: Grid 1 kolom
- Semua card responsif dengan smooth animation

## 🔄 Flow Diagram

```
Terminal-1 → POST /update → DashboardHub
Terminal-2 → POST /update → DashboardHub
Terminal-3 → POST /update → DashboardHub
                                  ↓
                            Broadcast ke
                            WebSocket Clients
                                  ↓
                            Dashboard UI Update
```

## 🚀 Development

### Build
```bash
npm run cf-typegen  # Generate types dari Cloudflare Workers
```

### Development Server
```bash
npm run dev
```

### Deploy
```bash
npm run deploy
```

## 📝 Contoh Skenario

### Skenario 1: 4 Terminal MT2 Trading

```bash
# Terminal 1
curl -X POST http://localhost:8787/update -H "Content-Type: application/json" \
  -d '{"channel":"MT2-Terminal-01","symbol":"EURUSD","bid":1.0945,"ask":1.0948,"volume":5000}'

# Terminal 2
curl -X POST http://localhost:8787/update -H "Content-Type: application/json" \
  -d '{"channel":"MT2-Terminal-02","symbol":"GBPUSD","bid":1.2650,"ask":1.2653,"volume":3000}'

# Terminal 3
curl -X POST http://localhost:8787/update -H "Content-Type: application/json" \
  -d '{"channel":"MT2-Terminal-03","symbol":"USDJPY","bid":149.50,"ask":149.53,"volume":7000}'

# Terminal 4
curl -X POST http://localhost:8787/update -H "Content-Type: application/json" \
  -d '{"channel":"MT2-Terminal-04","symbol":"AUDUSD","bid":0.6580,"ask":0.6583,"volume":2500}'
```

Dashboard akan menampilkan 4 card dengan data real-time dari masing-masing terminal.

### Skenario 2: Update Data Terminal

```bash
# Update data yang sudah ada
curl -X POST http://localhost:8787/update -H "Content-Type: application/json" \
  -d '{"channel":"MT2-Terminal-01","symbol":"EURUSD","bid":1.0950,"ask":1.0953,"volume":5500}'

# Dashboard akan update card Terminal-01 dengan bid dan volume terbaru
```

### Skenario 3: Hapus Parameter

```bash
curl -X POST http://localhost:8787/update -H "Content-Type: application/json" \
  -d '{"channel":"MT2-Terminal-01","volume":6000,"remove":["ask"]}'

# Key "ask" akan dihapus dari data Terminal-01, hanya bid dan volume yang ditampilkan
```

## 🔧 Customization

### Mengubah Warna
Edit `public/index.html` section `<style>`:
- Primary color: `#667eea` → ganti dengan warna pilihan
- Background gradient: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`

### Mengubah Layout Grid
Cari di CSS:
```css
.cards-container {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}
```
- Ubah `300px` untuk width minimum card
- Ubah `auto-fill` menjadi `auto-fit` untuk space optimization

### Menambah Polling Interval
Edit di JavaScript, method `connect()` pada reconnection delay:
```javascript
setTimeout(() => this.connect(), 3000); // 3 detik
```

## ❓ FAQ

**Q: Berapa terminal maksimal yang bisa ditampilkan?**
A: Unlimited. Dashboard akan terus menambah card sesuai terminal yang mengirim data.

**Q: Apakah data persisten?**
A: Ya, data disimpan di Durable Object Storage. Data akan tersedia meskipun dashboard refresh.

**Q: Bagaimana jika terminal disconnect?**
A: Terminal akan tetap ditampilkan di dashboard (status indicator berubah abu-abu).

**Q: Bisakah saya menghapus terminal?**
A: Tidak ada fitur delete. Terminal akan tetap ada sampai server di-reset atau storage dihapus.

## 🐛 Troubleshooting

### Dashboard tidak menampilkan data
1. Pastikan server berjalan: `npm run dev`
2. Pastikan terminal mengirim POST ke `/update` dengan format JSON yang benar
3. Buka browser console (F12) untuk melihat error WebSocket

### Koneksi WebSocket terputus
- Dashboard akan auto-reconnect setiap 3 detik
- Check browser network tab untuk error details

### Data tidak update real-time
- Refresh dashboard browser
- Cek apakah terminal masih mengirim data
- Verifikasi Content-Type header: `application/json`

## 📚 API Reference

### POST /update
Update data terminal

**Request:**
```
Content-Type: application/json

{
  "channel": "string",      // Required
  "key": "any",             // Any additional keys/values
  "remove": ["string"]      // Optional: keys to remove
}
```

**Response:**
```json
{
  "success": true
}
```

### WebSocket /ws
Connect ke dashboard hub

**Connect:**
```
ws://localhost:8787/ws
```

**Message Format:**
```json
{
  "channel-1": {
    "key1": "value1",
    "updated_at": "2025-01-15T10:30:00Z"
  },
  "channel-2": {
    "key2": "value2",
    "updated_at": "2025-01-15T10:31:00Z"
  }
}
```

---

**Last Updated:** 2025-01-15
**Version:** 1.0
