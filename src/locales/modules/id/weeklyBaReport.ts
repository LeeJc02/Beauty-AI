export default {
  title: 'Laporan Mingguan',
  subtitle: 'Data operasional BA mingguan nasional dan regional',
  week: 'Minggu laporan',
  timezone: 'Waktu Jakarta',
  generatedAt: 'Diperbarui: {time}',
  refresh: 'Perbarui data',
  national: 'Data Nasional',
  activeBa: 'BA yang diaktifkan',
  coverage: 'Cakupan jaringan {rate}',
  weekRange: 'Periode (Senin-Minggu): {start} - {end}',
  assets: 'Aset konten baru minggu ini dan total',
  weeklyAdded: 'Baru minggu ini',
  total: 'Total historis',
  completedTaskMetrics: 'Rata-rata tugas yang selesai minggu ini',
  regions: 'Data dan peringkat regional',
  regionTasks: 'Metrik proses tugas regional',
  completedTaskHint: 'Rata-rata hanya mencakup periode tugas yang selesai minggu ini',
  emptyTasks: 'Tidak ada tugas berlangsung atau selesai minggu ini',
  noData: 'Data laporan mingguan belum tersedia',
  assetTypes: { COURSEWARE: 'Materi', AI_CUSTOMER: 'Manusia digital', AI_SCENE: 'Skenario', QUOTE: 'Kutipan produk' },
  metrics: {
    studyCompletion: 'Rata-rata penyelesaian belajar', practiceParticipation: 'Rata-rata partisipasi latihan',
    practiceQualification: 'Rata-rata kelulusan latihan', examSubmission: 'Rata-rata pengumpulan ujian', average: 'Rata-rata gabungan'
  },
  columns: {
    rank: 'Peringkat', region: 'Wilayah', activation: 'BA aktif / Total', weeklyNew: 'BA baru minggu ini',
    taskType: 'Jenis tugas', taskName: 'Nama tugas', taskStatus: 'Status', period: 'Periode belajar',
    assigned: 'Ditugaskan', completed: 'Selesai', currentRate: 'Penyelesaian / Kelulusan / Pengumpulan'
  },
  demandStat: {
    title: 'Progres penanganan masalah sistem',
    edit: 'Ubah', save: 'Simpan', cancel: 'Batal', saveSuccess: 'Berhasil disimpan',
    columns: {
      category: 'Kategori kebutuhan', weeklyAdded: 'Baru minggu ini ({start}-{end})',
      total: 'Total', resolved: 'Selesai (total)', remark: 'Tertunda minggu ini / Catatan'
    }
  },
  demandCategories: {
    SYSTEM_BUG: 'Bug sistem', DEMAND_OPTIMIZE: 'Optimasi kebutuhan',
    DEMAND_OPTIMIZE_QB_NOTIFY: 'Optimasi kebutuhan (bank soal & notifikasi)'
  },
  taskTypes: { STUDY: 'Belajar', PRACTICE: 'Latihan', EXAM: 'Ujian' },
  status: { ONGOING: 'Berlangsung', COMPLETED: 'Selesai' }
}
