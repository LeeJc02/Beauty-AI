export default {
  title: 'Manajemen Poin',
  tabs: { rules: 'Aturan Poin', ledger: 'Buku Besar Poin', archive: 'Arsip Bulanan', backfill: 'Batch Rekonstruksi' },
  common: {
    all: 'Semua', search: 'Cari', reset: 'Atur Ulang', export: 'Ekspor', detail: 'Detail', close: 'Tutup',
    operation: 'Tindakan', status: 'Status', version: 'Versi', enabled: 'Aktif', disabled: 'Nonaktif',
    noData: 'Tidak ada data', current: 'Saat Ini', points: 'Poin', count: 'Jumlah'
  },
  categories: { ALL: 'Semua Poin', TASK: 'Poin Tugas', FREE: 'Poin Pembelajaran' },
  views: { ALL: 'Semua Poin', TASK: 'Poin Tugas', FREE: 'Poin Pembelajaran' },
  ruleCodes: {
    TASK_COMPLETION: 'Penyelesaian tugas', COURSE_COMPLETION: 'Penyelesaian kursus',
    AI_CUSTOMER_QUALIFIED: 'Latihan pelanggan AI memenuhi syarat', AI_SCENE_QUALIFIED: 'Latihan skenario AI memenuhi syarat',
    QUOTE_SESSION_QUALIFIED: 'Sesi kalimat unggulan memenuhi syarat', EXAM_PASS_BONUS: 'Bonus lulus ujian'
  },
  operations: { GRANT: 'Pemberian', REVERSAL: 'Pembalikan' },
  sources: {
    TASK_ASSIGNMENT: 'Penugasan', COURSE_LEARNING: 'Catatan belajar kursus', AI_CHAT_SESSION: 'Sesi latihan AI',
    QUOTE_SESSION: 'Sesi latihan kalimat unggulan', EXAM_ATTEMPT: 'Percobaan ujian'
  },
  statuses: {
    DRAFT: 'Draf', SCHEDULED: 'Terjadwal', ACTIVE: 'Aktif', RETIRED: 'Tidak Berlaku',
    OPEN: 'Waktu Nyata', CLOSING: 'Proses Tutup Buku', CLOSED: 'Diarsipkan',
    PENDING: 'Menunggu', RUNNING: 'Berjalan', COMPLETED: 'Selesai', FAILED: 'Gagal'
  },
  rules: {
    currentTitle: 'Aturan yang Sedang Berlaku', currentVersion: 'Versi saat ini V{version}', createDraft: 'Buat Draf Versi',
    editDraft: 'Edit Draf', draftVersion: 'Draf V{version}', history: 'Riwayat Versi Aturan',
    effectiveAt: 'Mulai Berlaku', jakartaTime: 'Waktu Jakarta (UTC+7)', publishedAt: 'Waktu Terbit',
    publishedBy: 'Diterbitkan Oleh', remark: 'Alasan Perubahan', remarkPlaceholder: 'Jelaskan alasan perubahan aturan ini',
    ruleName: 'Item Poin', ruleCode: 'Kode Aturan', category: 'Kategori', formula: 'Rumus',
    fixedPoints: 'Poin Tetap', divisor: 'Pembagi Nilai Ujian', scoreFormula: 'round(nilai ujian / {divisor})',
    saveDraft: 'Simpan Draf', publish: 'Terbitkan Aturan', createSuccess: 'Draf aturan berhasil dibuat',
    saveSuccess: 'Draf aturan berhasil disimpan', publishSuccess: 'Aturan diterbitkan dan akan berlaku sesuai jadwal',
    publishConfirm: 'Aturan yang diterbitkan tidak dapat diedit dan hanya berlaku untuk fakta setelah waktu efektif. Terbitkan V{version}?',
    effectiveRequired: 'Pilih waktu berlaku di masa depan', itemsRequired: 'Konfigurasikan keenam aturan poin',
    noCurrent: 'Versi aturan aktif tidak ditemukan', immutableTip: 'Versi yang diterbitkan tidak dapat diubah. Aturan baru hanya berlaku ke depan dan tidak menghitung ulang buku besar lama.'
  },
  ledger: {
    month: 'Bulan Poin', userId: 'ID Pengguna', userName: 'Pengguna', region: 'Wilayah', category: 'Kategori',
    rule: 'Item Poin', operation: 'Operasi', sourceType: 'Tipe Sumber', version: 'Versi Aturan',
    occurredAt: 'Waktu Bisnis', points: 'Poin', source: 'Sumber Bisnis', ledgerId: 'ID Buku Besar',
    exportFile: 'buku-besar-poin-{month}.xls', detailTitle: 'Detail Buku Besar Poin', sourceId: 'ID Sumber',
    generation: 'Generasi Sumber', reversalOf: 'Membalik Entri', reversedBy: 'Dibalik Oleh Entri',
    taskContext: 'Konteks Tugas', taskId: 'ID Tugas', assignmentId: 'ID Penugasan',
    taskResourceId: 'ID Sumber Daya Tugas', taskAttemptId: 'ID Attempt Eksekusi', backfillBatchId: 'ID Batch Rekonstruksi',
    ruleSnapshot: 'Snapshot Aturan', sourceSnapshot: 'Snapshot Fakta Bisnis', evidenceSnapshot: 'Snapshot Bukti Aktivitas',
    dailySummary: 'Ringkasan Harian Pengguna pada Bulan Ini', noSnapshot: 'Tidak ada isi snapshot',
    exportConfirm: 'Ekspor buku besar poin sesuai filter saat ini?'
  },
  archive: {
    month: 'Bulan', period: 'Periode Akuntansi', revision: 'Revisi', closedAt: 'Waktu Arsip', closedBy: 'Ditutup Oleh',
    view: 'Tampilan Peringkat', region: 'Wilayah', rank: 'Peringkat Lingkup', nationalRank: 'Peringkat Nasional',
    regionRank: 'Peringkat Wilayah', user: 'BA', allPoints: 'Semua Poin', taskPoints: 'Poin Tugas',
    freePoints: 'Poin Pembelajaran', viewPoints: 'Poin Tampilan Terpilih', people: '{count} orang',
    openTip: 'Bulan berjalan memakai buku besar waktu nyata dan belum memiliki snapshot tutup buku. Lihat peringkat langsung di Data Nasional atau Data Regional.',
    noSnapshot: 'Snapshot belum tersedia untuk bulan ini', exportFile: 'peringkat-poin-{month}-{view}.xls',
    exportConfirm: 'Ekspor snapshot sesuai bulan, revisi, wilayah, dan tampilan poin yang dipilih?', closeSummary: 'Ringkasan Tutup Buku'
  },
  backfill: {
    batchId: 'ID Batch', ruleVersion: 'Versi Aturan', range: 'Rentang Waktu Fakta', scanned: 'Dipindai',
    granted: 'Diberikan', skipped: 'Dilewati', failed: 'Gagal', startedAt: 'Waktu Mulai', finishedAt: 'Waktu Selesai',
    gapReport: 'Laporan Kesenjangan', readOnlyTip: 'Rekonstruksi historis dijalankan melalui tugas deployment terkontrol. Halaman ini hanya untuk audit.'
  }
}
