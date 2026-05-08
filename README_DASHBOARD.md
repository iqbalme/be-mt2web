# 📊 MT2Web Terminal Data Dashboard

Dashboard responsif untuk menampilkan data real-time dari multiple terminal MT2 dalam format card list.

## 🎯 Fitur Utama

✅ **Responsive UI** - Bekerja di desktop, tablet, dan mobile  
✅ **Card List** - Setiap terminal ditampilkan sebagai card dengan data dinamis  
✅ **Filter Dropdown** - Dropdown dengan checkbox untuk pilih/batalkan terminal  
✅ **Real-time Updates** - WebSocket connection untuk live data  
✅ **Auto-refresh** - Dashboard otomatis update tanpa refresh page  
✅ **Terminal Detection** - Otomatis detect terminal baru  

## 🚀 Quick Start

### 1. Development Server
```bash
npm run dev
```
Dashboard akan berjalan di `http://localhost:8787`

### 2. Kirim Data dari Terminal
```bash
curl -X POST http://localhost:8787/update \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "Terminal-1",
    "price": 45000,
    "volume": 1250,
    "status": "active"
  }'
```

### 3. Test dengan Script
**PowerShell (Windows):**
```bash
.\test_dashboard.ps1
```

**Bash (Linux/Mac):**
```bash
bash test_dashboard.sh
```

## 📦 What You Get

```
📁 public/
  └─ index.html          # Dashboard UI (responsive, real-time)
📁 src/
  └─ index.ts            # Backend (DashboardHub + TradingChannel)
DASHBOARD_USAGE.md       # Dokumentasi lengkap
test_dashboard.ps1       # Test script (PowerShell)
test_dashboard.sh        # Test script (Bash)
```

## 🎨 UI Preview

### Desktop View
- **Header**: Judul + Filter dropdown dengan checkbox
- **Main Content**: Grid 3 kolom card list
- **Connection Status**: Indicator di bawah kanan

### Mobile View
- **Filter**: Full-width dropdown
- **Cards**: Single column layout
- **Responsive**: Semua elemen scale dengan sempurna

## 📝 Dashboard Features

### Filter Dropdown
- Menampilkan semua terminal aktif
- Checkbox untuk select/deselect
- Status indicator (hijau=aktif, abu-abu=tidak aktif)
- Counter: "X dari Y terminal"

### Card Display
- Terminal name (channel)
- Relative timestamp ("5m lalu", "1h lalu")
- Semua parameter data yang dikirim
- Smooth animation & hover effect

### Real-time Sync
- Auto-update saat ada data baru
- Terminal baru otomatis ditambah ke dropdown
- Terputus otomatis reconnect setiap 3 detik

### 🆕 Advanced Features (Issue #5)

#### 1. Auto-delete Idle Channels
Dashboard secara otomatis akan menghapus card terminal yang sudah tidak aktif (idle) selama durasi tertentu.
- **Default:** 3600 detik (1 jam).
- **Konfigurasi:** Anda dapat mengubah durasi ini di `src/index.ts` pada variabel `IDLE_TIMEOUT_SECONDS` di dalam fungsi `alarm()`.

#### 2. Dynamic UI Updates
Dashboard tidak lagi "terkunci" pada struktur JSON awal. Setiap kali terminal mengirim data dengan struktur key yang berbeda, UI akan langsung menyesuaikan tampilannya (overwrite data lama).

#### 3. Color Coding (Profit/Loss)
Nilai pada key berikut akan berwarna secara otomatis:
- `profit_all`, `profit_today`, `floating`
- **Biru:** Jika nilai positif (> 0).
- **Merah:** Jika nilai negatif (< 0).

## 🔧 API


### POST /update
Kirim data dari terminal
```json
{
  "channel": "Terminal-1",
  "key1": "value1",
  "key2": 12345,
  "remove": ["old_key"]
}
```

### WebSocket /ws
Connect dashboard ke server

## 📚 Full Documentation
Baca [DASHBOARD_USAGE.md](DASHBOARD_USAGE.md) untuk:
- API reference lengkap
- Contoh implementasi (Python, Node.js, Bash)
- Customization guide
- Troubleshooting

## 🚢 Deploy ke Production

```bash
npm run deploy
```

Update `wrangler.jsonc`:
- Change `name` dan `main` jika diperlukan
- Pastikan Durable Objects sudah configured

## 🐛 Troubleshooting

**Dashboard tidak menampilkan data?**
- Pastikan server berjalan: `npm run dev`
- Cek browser console untuk error
- Verifikasi POST ke `/update` dengan format JSON benar

**Koneksi WebSocket terputus?**
- Dashboard auto-reconnect setiap 3 detik
- Buka network tab browser untuk debug

**Data tidak update real-time?**
- Refresh browser
- Pastikan terminal masih mengirim data
- Check Content-Type header: `application/json`

## 📞 Support

Lihat [DASHBOARD_USAGE.md](DASHBOARD_USAGE.md) untuk FAQ dan contoh lengkap.

---

**Version:** 1.0  
**Framework:** Cloudflare Workers + Durable Objects  
**Last Updated:** 2025-01-15
