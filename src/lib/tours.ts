import type { TourDef } from './useTour'

export const CAMPAIGN_TOUR: TourDef = {
  id: 'campaign', version: 1,
  steps: [
    { element: '[data-tour="cm-import"]', popover: { title: 'Mulai dari sini', description: 'Import campaign Meta yang udah jalan biar bisa diatur otomatis di HSL.' } },
    { element: '[data-tour="cm-auto"]',   popover: { title: 'Saklar Automation', description: 'Ini ngidupin/matiin automasi per campaign. Mati = HSL gak nyentuh sama sekali.' } },
    { element: '[data-tour="cd-attach-rule"]', popover: { title: 'Pasang Rule', description: 'Tempel aturan: kapan budget naik, kapan ad dimatiin. Wajib minimal 1 rule aktif sebelum automation nyala.' } },
    { element: '[data-tour="cd-scan-interval"]', popover: { title: 'Interval Cek', description: 'Atur tiap berapa menit HSL ngecek campaign ini. Default 5 menit.' } },
    { element: '[data-tour="tu-enable"]', popover: { title: 'Auto Top-Up', description: 'Jaga jumlah ad aktif. Kalau turun di bawah batas, HSL nambah ad dari pool creative campaign ini.' } },
  ],
}

export const VIDEO_TOUR: TourDef = {
  id: 'video', version: 1,
  steps: [
    { element: '[data-tour="vg-format"]',   popover: { title: 'Atur Format', description: 'Pilih orientasi & durasi video. Durasi ngaruh ke biaya kredit.' } },
    { element: '[data-tour="vg-add-asset"]', popover: { title: 'Tambah Referensi', description: 'Masukin foto akun/produk biar AI ngikutin visualnya. Maks 5.' } },
    { element: '[data-tour="vg-prompt"]',    popover: { title: 'Tulis Prompt', description: 'Jelasin video yang lo mau. Klik chip @image buat nyebut asset tertentu.' } },
    { element: '[data-tour="vg-cost"]',      popover: { title: 'Cek Biaya', description: 'Estimasi kredit & sisa saldo muncul di sini sebelum generate.' } },
    { element: '[data-tour="vg-generate"]',  popover: { title: 'Generate', description: 'Kirim job. Hasil muncul di History pas kelar.' } },
  ],
}
