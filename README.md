# 🌌 Ciel AI — Personal Server Assistant Discord Bot

Ciel adalah asisten AI pribadi untuk Discord yang terintegrasi langsung dengan server Linux. Bisa **ngejalanin perintah shell, baca/tulis file, cari informasi**, dan bantu manage server kamu — semua dari Discord.

---

## ⚡ Fitur

| Fitur | Deskripsi |
|-------|-----------|
| 🖥️ **Execute Command** | Jalanin perintah shell di server langsung dari Discord |
| 📄 **Read/Write File** | Baca & edit file server tanpa SSH |
| 🌐 **Search Web** | Cari informasi di internet real-time |
| 📑 **Fetch Webpage** | Ambil konten halaman web |
| 🔧 **Server Management** | Cek status, restart service, maintain server |
| 🤖 **AI Chat (Gemini + DeepSeek)** | Dual AI provider, otomatis pilih yang terbaik |

---

## 🚀 Cara Install

### 1. Clone & Install

```bash
git clone https://github.com/zocanw1/Ciel-AI.git
cd Ciel-AI
npm install
```

### 2. Setup `.env`

```env
DISCORD_TOKEN=token_bot_kamu
GEMINI_API_KEY=api_key_gemini
GEMINI_MODEL=gemini-2.5-flash-preview-04-17
```

### 3. Jalankan

```bash
node index.js
```

### Systemd Service (auto-start)

```bash
sudo nano /etc/systemd/system/ciel.service
```

```ini
[Unit]
Description=Ciel AI Discord Bot
After=network.target

[Service]
Type=simple
User=zocanw
WorkingDirectory=/home/zocanw/ciel
ExecStart=node index.js
Restart=on-failure
RestartSec=10
EnvironmentFile=/home/zocanw/ciel/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now ciel.service
```

---

## 📁 Struktur Folder

```
ciel/
├── commands/              # Perintah Discord (help, info, dll)
│   ├── help.js
│   ├── info.js
│   ├── pm2list.js
│   └── ramusage.js
├── core/                  # AI Provider
│   ├── deepseek_provider.js
│   ├── gemini_provider.js
│   └── runtime_env.js
├── tools/                 # Tools yang bisa dipakai AI
│   ├── execute_command.js # Jalanin perintah shell
│   ├── fetch_webpage.js   # Ambil halaman web
│   ├── read_file.js       # Baca file
│   ├── search_web.js      # Cari di internet
│   └── write_file.js      # Tulis/edit file
├── index.js               # Entry point utama
└── test_provider.js
```

---

## 🧠 Sistem AI

Ciel punya **dua otak** yang bisa dipakai:

### DeepSeek (`deepseek_provider.js`)
- Provider utama (default)
- Lebih hemat token
- Cocok untuk task ringan — menengah

### Gemini (`gemini_provider.js`)
- Fallback / alternatif
- Lebih kuat untuk reasoning kompleks
- Diaktifkan via env `GEMINI_API_KEY`

Keduanya punya akses ke **tools yang sama** (execute, file, web), jadi bisa melakukan tindakan nyata di server.

---

## 🔌 Tools Detail

### `execute_command.js`
Jalanin perintah shell apa pun. Output langsung dikirim balik ke Discord.
> ⚠️ Perintah berbahaya seperti `rm -rf /` udah difilter safety.

### `read_file.js` & `write_file.js`
Baca dan edit file server. Berguna buat config, log, atau script tanpa perlu SSH.

### `search_web.js`
Cari informasi terbaru dari Google/Bing, lengkap dengan sumbernya.

### `fetch_webpage.js`
Ambil konten HTML dari URL, bersihin, kirim ke Discord.

---

## 🔧 Commands

| Command | Deskripsi |
|---------|-----------|
| `!help` | Daftar perintah yang tersedia |
| `!info` | Informasi server (uptime, RAM, CPU) |
| `!pm2list` | Lihat daftar proses PM2 |
| `!ramusage` | Cek pemakaian RAM server |

> Prefix bisa diubah di `index.js`

---

## 🖥️ Deploy di Server

Ciel jalan di **home server** (i5-2410M, 7GB RAM, Ubuntu) sebagai systemd service:

```bash
# Status
sudo systemctl status ciel.service

# Restart
sudo systemctl restart ciel.service

# Logs
sudo journalctl -u ciel.service -f
```

---

## 📦 Dependencies

- `discord.js` ^14 — Discord API v14
- `axios` — HTTP requests
- `cheerio` — HTML parsing
- `date-fns` — Date formatting

---

## 🤝 Kontribusi

Pull request & issues welcome! Feel free to fork dan bikin improvements.

---

*Dibuat dengan ☕ oleh [zocanw1](https://github.com/zocanw1)*
