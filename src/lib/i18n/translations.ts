// Translations for STC AutoTrade
// Languages: English (en), Indonesian (id), Russian (ru)

export type Language = 'en' | 'id' | 'ru';

export interface Translations {
  // Common
  common: {
    loading: string;
    processing: string;
    save: string;
    cancel: string;
    close: string;
    confirm: string;
    delete: string;
    edit: string;
    add: string;
    search: string;
    filter: string;
    reset: string;
    yes: string;
    no: string;
    active: string;
    inactive: string;
    standby: string;
    success: string;
    error: string;
    warning: string;
    info: string;
    notFound: string;
    noData: string;
    copy: string;
    copied: string;
    refresh: string;
    viewAll: string;
    showMore: string;
    showLess: string;
    next: string;
    previous: string;
    submit: string;
    back: string;
    continue: string;
    done: string;
    optional: string;
    required: string;
    select: string;
    all: string;
    none: string;
    other: string;
    language: string;
    currency: string;
    balance: string;
    demo: string;
    real: string;
    virtual: string;
    encrypted: string;
    secure: string;
  };

  // Login Page
  login: {
    title: string;
    subtitle: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    rememberMe: string;
    forgotPassword: string;
    signIn: string;
    signingIn: string;
    noAccount: string;
    register: string;
    terms: string;
    privacy: string;
    welcome: string;
    loginSuccess: string;
    redirecting: string;
    invalidCredentials: string;
    enterEmail: string;
    enterPassword: string;
    invalidEmail: string;
    invalidPassword: string;
  };

  // Profile Page
  profile: {
    title: string;
    personalInfo: string;
    accountInfo: string;
    settings: string;
    help: string;
    logout: string;
    logoutConfirm: string;
    logoutMessage: string;
    balanceReal: string;
    balanceDemo: string;
    email: string;
    phone: string;
    country: string;
    joined: string;
    birthday: string;
    verified: string;
    notVerified: string;
    verificationStatus: string;
    emailVerified: string;
    phoneVerified: string;
    documentsVerified: string;
    id: string;
    selectCurrency: string;
    searchCurrency: string;
    termsOfService: string;
    privacyPolicy: string;
    version: string;
    loadError: string;
    updateError: string;
  };

  // History Page
  history: {
    title: string;
    summary: string;
    trades: string;
    totalTrades: string;
    win: string;
    loss: string;
    draw: string;
    winRate: string;
    profitLoss: string;
    type: string;
    period: string;
    today: string;
    week: string;
    month: string;
    all: string;
    signal: string;
    fastTrade: string;
    ctc: string;
    indicator: string;
    momentum: string;
    call: string;
    put: string;
    amount: string;
    result: string;
    time: string;
    date: string;
    note: string;
    noTransactions: string;
    noTransactionsFilter: string;
    startTrading: string;
    loading: string;
    filterByType: string;
    filterByResult: string;
    filterByPeriod: string;
    resetFilters: string;
  };

  // Dashboard Page
  dashboard: {
    title: string;
    localTime: string;
    live: string;
    balance: string;
    profitToday: string;
    asset: string;
    notSelected: string;
    selectAsset: string;
    searchAsset: string;
    profitRate: string;
    mode: string;
    tradingMode: string;
    amount: string;
    duration: string;
    minutes: string;
    start: string;
    stop: string;
    running: string;
    stopped: string;
    schedule: {
      title: string;
      addSignal: string;
      manageSignals: string;
      inputSignal: string;
      signalFormat: string;
      example: string;
      activeSignals: string;
      deleteAll: string;
      next: string;
      call: string;
      put: string;
      noSignals: string;
      allCompleted: string;
    };
    fastTrade: {
      title: string;
      session: string;
      ctcSession: string;
      pnl: string;
      wins: string;
      losses: string;
      winRate: string;
      phase: string;
      trend: string;
      noActiveSession: string;
    };
    aiSignal: {
      title: string;
      sendSignal: string;
      manualSignal: string;
      signalDirection: string;
      executeIn: string;
      seconds: string;
      message: string;
      messageOptional: string;
      pending: string;
      now: string;
      step: string;
      waiting: string;
    };
    indicator: {
      title: string;
      sma: string;
      ema: string;
      rsi: string;
      value: string;
      monitoring: string;
    };
    momentum: {
      title: string;
      pattern: string;
      signalTime: string;
      scanning: string;
      patterns: {
        candleSabit: string;
        dojiTerjepit: string;
        dojiPembatalan: string;
        bbSarBreak: string;
      };
    };
    martingale: {
      title: string;
      enabled: string;
      maxStep: string;
      multiplier: string;
      alwaysSignal: string;
    };
    errors: {
      loadAssets: string;
      loadBalance: string;
      startBot: string;
      stopBot: string;
      invalidAmount: string;
      minAmount: string;
    };
  };

  // Language Selector
  language: {
    title: string;
    selectLanguage: string;
    english: string;
    indonesian: string;
    russian: string;
  };
}

const translations: Record<Language, Translations> = {
  // English
  en: {
    common: {
      loading: 'Loading...',
      processing: 'Processing...',
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      confirm: 'Confirm',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      search: 'Search',
      filter: 'Filter',
      reset: 'Reset',
      yes: 'Yes',
      no: 'No',
      active: 'Active',
      inactive: 'Inactive',
      standby: 'Standby',
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Info',
      notFound: 'Not found',
      noData: 'No data',
      copy: 'Copy',
      copied: 'Copied!',
      refresh: 'Refresh',
      viewAll: 'View All',
      showMore: 'Show More',
      showLess: 'Show Less',
      next: 'Next',
      previous: 'Previous',
      submit: 'Submit',
      back: 'Back',
      continue: 'Continue',
      done: 'Done',
      optional: 'Optional',
      required: 'Required',
      select: 'Select',
      all: 'All',
      none: 'None',
      other: 'Other',
      language: 'Language',
      currency: 'Currency',
      balance: 'Balance',
      demo: 'Demo',
      real: 'Real',
      virtual: 'Virtual',
      encrypted: 'Encrypted',
      secure: 'Secure',
    },
    login: {
      title: 'STC AutoTrade',
      subtitle: 'Sign in to continue',
      email: 'Email',
      emailPlaceholder: 'name@example.com',
      password: 'Password',
      passwordPlaceholder: '••••••••',
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot password?',
      signIn: 'Sign In',
      signingIn: 'Verifying...',
      noAccount: "Don't have an account?",
      register: 'Register now',
      terms: 'Terms',
      privacy: 'Privacy',
      welcome: 'Welcome',
      loginSuccess: 'Login Successful',
      redirecting: 'Redirecting to dashboard...',
      invalidCredentials: 'Invalid email or password',
      enterEmail: 'Please enter your email',
      enterPassword: 'Please enter your password',
      invalidEmail: 'Please enter a valid email',
      invalidPassword: 'Password must be at least 6 characters',
    },
    profile: {
      title: 'Profile',
      personalInfo: 'Personal Information',
      accountInfo: 'Account Information',
      settings: 'Settings',
      help: 'Help & Legal',
      logout: 'Logout',
      logoutConfirm: 'Logout from STC AutoTrade',
      logoutMessage: 'You will need to login again to access your account.',
      balanceReal: 'Real',
      balanceDemo: 'Demo',
      email: 'Email',
      phone: 'Phone',
      country: 'Country',
      joined: 'Joined',
      birthday: 'Birthday',
      verified: 'Verified',
      notVerified: 'Not Verified',
      verificationStatus: 'Verification Status',
      emailVerified: 'Email Verified',
      phoneVerified: 'Phone Verified',
      documentsVerified: 'Documents Verified',
      id: 'ID',
      selectCurrency: 'Select Currency',
      searchCurrency: 'Search',
      termsOfService: 'Terms of Service',
      privacyPolicy: 'Privacy Policy',
      version: 'Version',
      loadError: 'Failed to load profile. Please try again.',
      updateError: 'Failed to update. Please try again.',
    },
    history: {
      title: 'History',
      summary: 'Summary',
      trades: 'Trades',
      totalTrades: 'Total Trades',
      win: 'Win',
      loss: 'Loss',
      draw: 'Draw',
      winRate: 'Win Rate',
      profitLoss: 'P&L',
      type: 'Type',
      period: 'Period',
      today: 'Today',
      week: '7 Days',
      month: '30 Days',
      all: 'All',
      signal: 'Signal',
      fastTrade: 'FastTrade',
      ctc: 'CTC',
      indicator: 'Indicator',
      momentum: 'Momentum',
      call: 'CALL',
      put: 'PUT',
      amount: 'Amount',
      result: 'Result',
      time: 'Time',
      date: 'Date',
      note: 'Note',
      noTransactions: 'No transactions',
      noTransactionsFilter: 'Try changing the filter',
      startTrading: 'Start trading to see history',
      loading: 'Loading history...',
      filterByType: 'Type',
      filterByResult: 'Result',
      filterByPeriod: 'Period',
      resetFilters: 'Reset Filters',
    },
    dashboard: {
      title: 'Dashboard',
      localTime: 'Local Time',
      live: 'Live',
      balance: 'Balance',
      profitToday: "Today's Profit",
      asset: 'Asset',
      notSelected: 'Not selected',
      selectAsset: 'Select Asset',
      searchAsset: 'Search asset...',
      profitRate: 'Profit Rate',
      mode: 'Mode',
      tradingMode: 'Trading Mode',
      amount: 'Amount',
      duration: 'Duration',
      minutes: 'min',
      start: 'Start',
      stop: 'Stop',
      running: 'Running',
      stopped: 'Stopped',
      schedule: {
        title: 'Signal',
        addSignal: 'Add Signal',
        manageSignals: 'Manage',
        inputSignal: 'Input Signal',
        signalFormat: 'Format: HH:MM call/put or HH.MM B/S',
        example: 'Example',
        activeSignals: 'active signals',
        deleteAll: 'Delete All',
        next: 'Next',
        call: 'CALL',
        put: 'PUT',
        noSignals: 'No signals',
        allCompleted: 'All signals completed',
      },
      fastTrade: {
        title: 'FastTrade',
        session: 'Session',
        ctcSession: 'CTC Session',
        pnl: 'P&L',
        wins: 'W',
        losses: 'L',
        winRate: 'Win Rate',
        phase: 'Phase',
        trend: 'Trend',
        noActiveSession: 'No active session',
      },
      aiSignal: {
        title: 'AI Signal',
        sendSignal: 'Send Signal',
        manualSignal: 'Send Manual Signal',
        signalDirection: 'Signal Direction',
        executeIn: 'Execute in',
        seconds: 'sec',
        message: 'Message',
        messageOptional: 'Signal note (optional)',
        pending: 'Pending',
        now: 'Now',
        step: 'Step',
        waiting: 'Waiting for signal...',
      },
      indicator: {
        title: 'Indicator',
        sma: 'SMA',
        ema: 'EMA',
        rsi: 'RSI',
        value: 'Value',
        monitoring: 'Monitoring indicator...',
      },
      momentum: {
        title: 'Momentum',
        pattern: 'Pattern',
        signalTime: 'Signal Time',
        scanning: 'Scanning candle patterns...',
        patterns: {
          candleSabit: 'Candle Sabit',
          dojiTerjepit: 'Doji Terjepit',
          dojiPembatalan: 'Doji Pembatalan',
          bbSarBreak: 'BB + SAR Break',
        },
      },
      martingale: {
        title: 'Martingale',
        enabled: 'Enabled',
        maxStep: 'Max Step',
        multiplier: 'Multiplier',
        alwaysSignal: 'Always Signal',
      },
      errors: {
        loadAssets: 'Failed to load assets',
        loadBalance: 'Failed to load balance',
        startBot: 'Failed to start bot',
        stopBot: 'Failed to stop bot',
        invalidAmount: 'Invalid amount',
        minAmount: 'Minimum amount is',
      },
    },
    language: {
      title: 'Language',
      selectLanguage: 'Select Language',
      english: 'English',
      indonesian: 'Indonesian',
      russian: 'Russian',
    },
  },

  // Indonesian
  id: {
    common: {
      loading: 'Memuat...',
      processing: 'Memproses...',
      save: 'Simpan',
      cancel: 'Batal',
      close: 'Tutup',
      confirm: 'Konfirmasi',
      delete: 'Hapus',
      edit: 'Ubah',
      add: 'Tambah',
      search: 'Cari',
      filter: 'Filter',
      reset: 'Reset',
      yes: 'Ya',
      no: 'Tidak',
      active: 'Aktif',
      inactive: 'Nonaktif',
      standby: 'Standby',
      success: 'Berhasil',
      error: 'Error',
      warning: 'Peringatan',
      info: 'Info',
      notFound: 'Tidak ditemukan',
      noData: 'Tidak ada data',
      copy: 'Salin',
      copied: 'Tersalin!',
      refresh: 'Segarkan',
      viewAll: 'Lihat Semua',
      showMore: 'Tampilkan Lebih',
      showLess: 'Tampilkan Lebih Sedikit',
      next: 'Selanjutnya',
      previous: 'Sebelumnya',
      submit: 'Kirim',
      back: 'Kembali',
      continue: 'Lanjutkan',
      done: 'Selesai',
      optional: 'Opsional',
      required: 'Wajib',
      select: 'Pilih',
      all: 'Semua',
      none: 'Tidak Ada',
      other: 'Lainnya',
      language: 'Bahasa',
      currency: 'Mata Uang',
      balance: 'Saldo',
      demo: 'Demo',
      real: 'Real',
      virtual: 'Virtual',
      encrypted: 'Terenkripsi',
      secure: 'Aman',
    },
    login: {
      title: 'STC AutoTrade',
      subtitle: 'Masuk untuk melanjutkan',
      email: 'Email',
      emailPlaceholder: 'nama@contoh.com',
      password: 'Password',
      passwordPlaceholder: '••••••••',
      rememberMe: 'Ingat saya',
      forgotPassword: 'Lupa password?',
      signIn: 'Masuk',
      signingIn: 'Memverifikasi...',
      noAccount: 'Belum punya akun?',
      register: 'Daftar sekarang',
      terms: 'Ketentuan',
      privacy: 'Privasi',
      welcome: 'Selamat Datang',
      loginSuccess: 'Berhasil Masuk',
      redirecting: 'Mengarahkan ke dashboard...',
      invalidCredentials: 'Email atau password salah',
      enterEmail: 'Silakan masukkan email Anda',
      enterPassword: 'Silakan masukkan password Anda',
      invalidEmail: 'Silakan masukkan email yang valid',
      invalidPassword: 'Password minimal 6 karakter',
    },
    profile: {
      title: 'Profil',
      personalInfo: 'Informasi Pribadi',
      accountInfo: 'Informasi Akun',
      settings: 'Pengaturan',
      help: 'Bantuan & Legalitas',
      logout: 'Keluar',
      logoutConfirm: 'Keluar dari STC AutoTrade',
      logoutMessage: 'Anda perlu login kembali untuk mengakses akun.',
      balanceReal: 'Real',
      balanceDemo: 'Demo',
      email: 'Email',
      phone: 'Telepon',
      country: 'Negara',
      joined: 'Bergabung',
      birthday: 'Tgl. Lahir',
      verified: 'Terverifikasi',
      notVerified: 'Belum Terverifikasi',
      verificationStatus: 'Status Verifikasi',
      emailVerified: 'Email Terverifikasi',
      phoneVerified: 'Telepon Terverifikasi',
      documentsVerified: 'Dokumen Terverifikasi',
      id: 'ID',
      selectCurrency: 'Pilih Mata Uang',
      searchCurrency: 'Cari',
      termsOfService: 'Ketentuan Layanan',
      privacyPolicy: 'Kebijakan Privasi',
      version: 'Versi',
      loadError: 'Gagal memuat profil. Coba lagi.',
      updateError: 'Gagal memperbarui. Coba lagi.',
    },
    history: {
      title: 'Riwayat',
      summary: 'Ringkasan',
      trades: 'Transaksi',
      totalTrades: 'Total Transaksi',
      win: 'Menang',
      loss: 'Kalah',
      draw: 'Seri',
      winRate: 'Win Rate',
      profitLoss: 'P&L',
      type: 'Tipe',
      period: 'Periode',
      today: 'Hari Ini',
      week: '7 Hari',
      month: '30 Hari',
      all: 'Semua',
      signal: 'Signal',
      fastTrade: 'FastTrade',
      ctc: 'CTC',
      indicator: 'Indicator',
      momentum: 'Momentum',
      call: 'CALL',
      put: 'PUT',
      amount: 'Jumlah',
      result: 'Hasil',
      time: 'Waktu',
      date: 'Tanggal',
      note: 'Catatan',
      noTransactions: 'Tidak ada transaksi',
      noTransactionsFilter: 'Coba ubah filter',
      startTrading: 'Mulai trading untuk melihat riwayat',
      loading: 'Memuat riwayat...',
      filterByType: 'Tipe',
      filterByResult: 'Hasil',
      filterByPeriod: 'Periode',
      resetFilters: 'Reset Filter',
    },
    dashboard: {
      title: 'Dashboard',
      localTime: 'Waktu Lokal',
      live: 'Live',
      balance: 'Saldo',
      profitToday: 'Profit Hari Ini',
      asset: 'Aset',
      notSelected: 'Belum dipilih',
      selectAsset: 'Pilih Aset',
      searchAsset: 'Cari aset...',
      profitRate: 'Rate Profit',
      mode: 'Mode',
      tradingMode: 'Mode Trading',
      amount: 'Jumlah',
      duration: 'Durasi',
      minutes: 'mnt',
      start: 'Mulai',
      stop: 'Berhenti',
      running: 'Berjalan',
      stopped: 'Berhenti',
      schedule: {
        title: 'Signal',
        addSignal: 'Tambah Signal',
        manageSignals: 'Kelola',
        inputSignal: 'Input Signal',
        signalFormat: 'Format: JJ:MM call/put atau JJ.MM B/S',
        example: 'Contoh',
        activeSignals: 'signal aktif',
        deleteAll: 'Hapus Semua',
        next: 'Berikutnya',
        call: 'CALL',
        put: 'PUT',
        noSignals: 'Belum ada signal',
        allCompleted: 'Semua signal selesai',
      },
      fastTrade: {
        title: 'FastTrade',
        session: 'Sesi',
        ctcSession: 'Sesi CTC',
        pnl: 'P&L',
        wins: 'M',
        losses: 'K',
        winRate: 'Win Rate',
        phase: 'Fase',
        trend: 'Trend',
        noActiveSession: 'Belum ada sesi aktif',
      },
      aiSignal: {
        title: 'AI Signal',
        sendSignal: 'Kirim Sinyal',
        manualSignal: 'Kirim Sinyal Manual',
        signalDirection: 'Arah Sinyal',
        executeIn: 'Eksekusi dalam',
        seconds: 'dtk',
        message: 'Pesan',
        messageOptional: 'Keterangan sinyal (opsional)',
        pending: 'Pending',
        now: 'Sekarang',
        step: 'Step',
        waiting: 'Menunggu sinyal...',
      },
      indicator: {
        title: 'Indicator',
        sma: 'SMA',
        ema: 'EMA',
        rsi: 'RSI',
        value: 'Nilai',
        monitoring: 'Memantau indikator...',
      },
      momentum: {
        title: 'Momentum',
        pattern: 'Pola',
        signalTime: 'Waktu Sinyal',
        scanning: 'Memindai pola candle...',
        patterns: {
          candleSabit: 'Candle Sabit',
          dojiTerjepit: 'Doji Terjepit',
          dojiPembatalan: 'Doji Pembatalan',
          bbSarBreak: 'BB + SAR Break',
        },
      },
      martingale: {
        title: 'Martingale',
        enabled: 'Aktif',
        maxStep: 'Max Step',
        multiplier: 'Multiplier',
        alwaysSignal: 'Always Signal',
      },
      errors: {
        loadAssets: 'Gagal memuat aset',
        loadBalance: 'Gagal memuat saldo',
        startBot: 'Gagal memulai bot',
        stopBot: 'Gagal menghentikan bot',
        invalidAmount: 'Jumlah tidak valid',
        minAmount: 'Jumlah minimum adalah',
      },
    },
    language: {
      title: 'Bahasa',
      selectLanguage: 'Pilih Bahasa',
      english: 'English',
      indonesian: 'Indonesia',
      russian: 'Russian',
    },
  },

  // Russian
  ru: {
    common: {
      loading: 'Загрузка...',
      processing: 'Обработка...',
      save: 'Сохранить',
      cancel: 'Отмена',
      close: 'Закрыть',
      confirm: 'Подтвердить',
      delete: 'Удалить',
      edit: 'Изменить',
      add: 'Добавить',
      search: 'Поиск',
      filter: 'Фильтр',
      reset: 'Сброс',
      yes: 'Да',
      no: 'Нет',
      active: 'Активно',
      inactive: 'Неактивно',
      standby: 'Ожидание',
      success: 'Успешно',
      error: 'Ошибка',
      warning: 'Предупреждение',
      info: 'Информация',
      notFound: 'Не найдено',
      noData: 'Нет данных',
      copy: 'Копировать',
      copied: 'Скопировано!',
      refresh: 'Обновить',
      viewAll: 'Показать все',
      showMore: 'Показать больше',
      showLess: 'Показать меньше',
      next: 'Далее',
      previous: 'Назад',
      submit: 'Отправить',
      back: 'Назад',
      continue: 'Продолжить',
      done: 'Готово',
      optional: 'Необязательно',
      required: 'Обязательно',
      select: 'Выбрать',
      all: 'Все',
      none: 'Нет',
      other: 'Другое',
      language: 'Язык',
      currency: 'Валюта',
      balance: 'Баланс',
      demo: 'Демо',
      real: 'Реальный',
      virtual: 'Виртуальный',
      encrypted: 'Зашифровано',
      secure: 'Безопасно',
    },
    login: {
      title: 'STC AutoTrade',
      subtitle: 'Войдите, чтобы продолжить',
      email: 'Email',
      emailPlaceholder: 'name@example.com',
      password: 'Пароль',
      passwordPlaceholder: '••••••••',
      rememberMe: 'Запомнить меня',
      forgotPassword: 'Забыли пароль?',
      signIn: 'Войти',
      signingIn: 'Проверка...',
      noAccount: 'Нет аккаунта?',
      register: 'Зарегистрироваться',
      terms: 'Условия',
      privacy: 'Конфиденциальность',
      welcome: 'Добро пожаловать',
      loginSuccess: 'Успешный вход',
      redirecting: 'Переход на панель управления...',
      invalidCredentials: 'Неверный email или пароль',
      enterEmail: 'Пожалуйста, введите ваш email',
      enterPassword: 'Пожалуйста, введите ваш пароль',
      invalidEmail: 'Пожалуйста, введите действительный email',
      invalidPassword: 'Пароль должен быть не менее 6 символов',
    },
    profile: {
      title: 'Профиль',
      personalInfo: 'Личная информация',
      accountInfo: 'Информация об аккаунте',
      settings: 'Настройки',
      help: 'Помощь и правовая информация',
      logout: 'Выйти',
      logoutConfirm: 'Выйти из STC AutoTrade',
      logoutMessage: 'Вам нужно будет войти снова, чтобы получить доступ к аккаунту.',
      balanceReal: 'Реальный',
      balanceDemo: 'Демо',
      email: 'Email',
      phone: 'Телефон',
      country: 'Страна',
      joined: 'Присоединился',
      birthday: 'День рождения',
      verified: 'Подтверждено',
      notVerified: 'Не подтверждено',
      verificationStatus: 'Статус подтверждения',
      emailVerified: 'Email подтвержден',
      phoneVerified: 'Телефон подтвержден',
      documentsVerified: 'Документы подтверждены',
      id: 'ID',
      selectCurrency: 'Выбрать валюту',
      searchCurrency: 'Поиск',
      termsOfService: 'Условия обслуживания',
      privacyPolicy: 'Политика конфиденциальности',
      version: 'Версия',
      loadError: 'Не удалось загрузить профиль. Попробуйте снова.',
      updateError: 'Не удалось обновить. Попробуйте снова.',
    },
    history: {
      title: 'История',
      summary: 'Сводка',
      trades: 'Сделки',
      totalTrades: 'Всего сделок',
      win: 'Победа',
      loss: 'Проигрыш',
      draw: 'Ничья',
      winRate: 'Процент побед',
      profitLoss: 'P&L',
      type: 'Тип',
      period: 'Период',
      today: 'Сегодня',
      week: '7 дней',
      month: '30 дней',
      all: 'Все',
      signal: 'Сигнал',
      fastTrade: 'FastTrade',
      ctc: 'CTC',
      indicator: 'Индикатор',
      momentum: 'Моментум',
      call: 'CALL',
      put: 'PUT',
      amount: 'Сумма',
      result: 'Результат',
      time: 'Время',
      date: 'Дата',
      note: 'Примечание',
      noTransactions: 'Нет транзакций',
      noTransactionsFilter: 'Попробуйте изменить фильтр',
      startTrading: 'Начните торговлю, чтобы увидеть историю',
      loading: 'Загрузка истории...',
      filterByType: 'Тип',
      filterByResult: 'Результат',
      filterByPeriod: 'Период',
      resetFilters: 'Сбросить фильтры',
    },
    dashboard: {
      title: 'Панель управления',
      localTime: 'Местное время',
      live: 'Live',
      balance: 'Баланс',
      profitToday: 'Прибыль сегодня',
      asset: 'Актив',
      notSelected: 'Не выбрано',
      selectAsset: 'Выбрать актив',
      searchAsset: 'Поиск актива...',
      profitRate: 'Ставка прибыли',
      mode: 'Режим',
      tradingMode: 'Режим торговли',
      amount: 'Сумма',
      duration: 'Длительность',
      minutes: 'мин',
      start: 'Старт',
      stop: 'Стоп',
      running: 'Работает',
      stopped: 'Остановлено',
      schedule: {
        title: 'Сигнал',
        addSignal: 'Добавить сигнал',
        manageSignals: 'Управление',
        inputSignal: 'Ввод сигнала',
        signalFormat: 'Формат: ЧЧ:ММ call/put или ЧЧ.ММ B/S',
        example: 'Пример',
        activeSignals: 'активных сигналов',
        deleteAll: 'Удалить все',
        next: 'Следующий',
        call: 'CALL',
        put: 'PUT',
        noSignals: 'Нет сигналов',
        allCompleted: 'Все сигналы выполнены',
      },
      fastTrade: {
        title: 'FastTrade',
        session: 'Сессия',
        ctcSession: 'Сессия CTC',
        pnl: 'P&L',
        wins: 'П',
        losses: 'Пр',
        winRate: 'Процент побед',
        phase: 'Фаза',
        trend: 'Тренд',
        noActiveSession: 'Нет активной сессии',
      },
      aiSignal: {
        title: 'AI Сигнал',
        sendSignal: 'Отправить сигнал',
        manualSignal: 'Отправить ручной сигнал',
        signalDirection: 'Направление сигнала',
        executeIn: 'Выполнить через',
        seconds: 'сек',
        message: 'Сообщение',
        messageOptional: 'Примечание к сигналу (необязательно)',
        pending: 'В ожидании',
        now: 'Сейчас',
        step: 'Шаг',
        waiting: 'Ожидание сигнала...',
      },
      indicator: {
        title: 'Индикатор',
        sma: 'SMA',
        ema: 'EMA',
        rsi: 'RSI',
        value: 'Значение',
        monitoring: 'Мониторинг индикатора...',
      },
      momentum: {
        title: 'Моментум',
        pattern: 'Паттерн',
        signalTime: 'Время сигнала',
        scanning: 'Сканирование паттернов свечей...',
        patterns: {
          candleSabit: 'Candle Sabit',
          dojiTerjepit: 'Doji Terjepit',
          dojiPembatalan: 'Doji Pembatalan',
          bbSarBreak: 'BB + SAR Break',
        },
      },
      martingale: {
        title: 'Мартингейл',
        enabled: 'Включено',
        maxStep: 'Макс. шаг',
        multiplier: 'Множитель',
        alwaysSignal: 'Всегда сигнал',
      },
      errors: {
        loadAssets: 'Не удалось загрузить активы',
        loadBalance: 'Не удалось загрузить баланс',
        startBot: 'Не удалось запустить бота',
        stopBot: 'Не удалось остановить бота',
        invalidAmount: 'Неверная сумма',
        minAmount: 'Минимальная сумма',
      },
    },
    language: {
      title: 'Язык',
      selectLanguage: 'Выбрать язык',
      english: 'English',
      indonesian: 'Indonesian',
      russian: 'Русский',
    },
  },
};

export default translations;

// Helper function to get nested translation value
export function getTranslation(
  lang: Language,
  key: string
): string {
  const keys = key.split('.');
  let value: any = translations[lang];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English if key not found
      let fallback: any = translations['en'];
      for (const fk of keys) {
        if (fallback && typeof fallback === 'object' && fk in fallback) {
          fallback = fallback[fk];
        } else {
          return key; // Return key if not found in fallback
        }
      }
      return typeof fallback === 'string' ? fallback : key;
    }
  }
  
  return typeof value === 'string' ? value : key;
}