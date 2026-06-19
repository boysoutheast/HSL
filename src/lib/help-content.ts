export const HELP = {
  // ── Campaign Monitor (list) ──
  'cm.newLaunch':      { title: 'New Launch', body: 'Bikin campaign iklan baru dari awal lewat AI Buddy.' },
  'cm.import':         { title: 'Import Campaign', body: 'Tarik campaign Meta yang udah ada biar bisa dikelola & diautomasi di sini.' },
  'cm.refresh':        { title: 'Refresh', body: 'Muat ulang data campaign terbaru dari server.' },
  'cm.autoToggle':     { title: 'Automation On/Off', body: 'Nyalain = AI Buddy ngecek campaign ini berkala & jalanin rule otomatis. Mati = gak disentuh sama sekali.' },
  'cm.statusFilter':   { title: 'Filter Status', body: 'Saring campaign berdasarkan status (Running, Paused, dll).' },
  'cm.phaseFilter':    { title: 'Filter Fase', body: 'Saring berdasarkan fase: Testing, Scaling, Maintenance, Exited.' },

  // ── Campaign Detail · Overview ──
  'cd.autoToggle':     { title: 'Automation On/Off', body: 'Aktifin biar rule & top-up jalan otomatis. Butuh minimal 1 rule aktif.' },
  'cd.scanInterval':   { title: 'Interval Cek', body: 'Seberapa sering AI Buddy ngecek campaign ini (default 5 menit). Makin kecil makin responsif, makin sering manggil Meta.' },
  'cd.structure':      { title: 'Struktur Campaign', body: 'Lihat adset & ad di dalam campaign ini langsung dari Meta.' },

  // ── Campaign Detail · Automation (rules) ──
  'cd.attachRule':     { title: 'Pasang Template Rule', body: 'Tempel aturan otomatis (mis. "scale kalau ROAS bagus", "matiin kalau boros") ke campaign ini.' },
  'cd.ruleToggle':     { title: 'Aktif/Pause Rule', body: 'Aktif = rule dievaluasi tiap scan. Pause = berhenti tanpa dihapus.' },
  'cd.ruleDetach':     { title: 'Lepas Rule', body: 'Cabut rule ini dari campaign. Gak ngehapus template aslinya.' },

  // ── Campaign Detail · Top-Up ──
  'tu.minAds':         { title: 'Minimal Ads Aktif', body: 'Batas bawah jumlah ad aktif. Kalau kurang dari ini, AI Buddy nambah ad dari pool otomatis.' },
  'tu.enable':         { title: 'Top-Up On/Off', body: 'Nyalain auto top-up: jaga jumlah ad aktif gak turun di bawah batas.' },
  'tu.targetAdset':    { title: 'Adset Tujuan', body: 'Adset tempat ad baru dibuat saat top-up jalan.' },
  'tu.save':           { title: 'Simpan Setting', body: 'Simpan konfigurasi top-up campaign ini.' },
  'tu.runNow':         { title: 'Top-Up Sekarang', body: 'Jalanin top-up manual sekali, gak nunggu cron.' },
  'tu.addCreative':    { title: 'Tambah Creative', body: 'Siapin headline, deskripsi, primary text & media khusus campaign ini buat dipakai saat top-up.' },
  'tu.addToPool':      { title: 'Masukin ke Pool', body: 'Simpan creative ini ke pool campaign. AI Buddy ambil dari sini pas top-up.' },

  // ── Import Campaign ──
  'im.adAccount':      { title: 'Pilih Ad Account', body: 'Akun iklan Meta sumber campaign yang mau diimpor.' },
  'im.pickCampaign':   { title: 'Pilih Campaign', body: 'Campaign Meta yang mau ditarik ke AI Buddy.' },
  'im.confirm':        { title: 'Import & Sync', body: 'Tarik campaign + struktur adset/ad-nya ke AI Buddy.' },

  // ── Video Generator ──
  'vg.orientation':    { title: 'Orientasi', body: 'Rasio video: 16:9, 9:16 (story/reels), 1:1, dll.' },
  'vg.resolution':     { title: 'Resolusi', body: 'SD lebih murah, HD lebih tajam (2x kredit).' },
  'vg.duration':       { title: 'Durasi', body: '6 atau 10 detik. Makin panjang makin mahal.' },
  'vg.addAsset':       { title: 'Tambah Asset', body: 'Sisipin foto akun/library/produk sebagai referensi. Maks 5.' },
  'vg.mention':        { title: 'Mention Asset', body: 'Klik chip @image buat nyebut asset di prompt, biar AI tau gambar mana.' },
  'vg.cost':           { title: 'Biaya', body: 'Estimasi kredit = durasi × resolusi. Saldo dicek sebelum generate.' },
  'vg.generate':       { title: 'Generate Video', body: 'Kirim job ke AI. Hasil muncul di History pas selesai.' },
  'vg.download':       { title: 'Download', body: 'Simpan video hasil ke perangkat.' },

  // ── Connections (relevan buat user) ──
  'cn.apiKey':         { title: 'Generate API Key', body: 'Bikin kunci buat akses endpoint /api/gen dari sistem luar.' },
  'cn.revoke':         { title: 'Cabut Key', body: 'Nonaktifin API key. Sistem yang pakai key ini langsung kehilangan akses.' },
} as const

export type HelpKey = keyof typeof HELP
