/* Money Tracker — iPhone web app. Shared money logic lives in core.js (window.MT). */
(function () {
  'use strict';

  // ================================================================ utilities
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  const todayYmd = () => MT.ymdOf(new Date());
  const dayOf = (tx) => MT.ymdOf(new Date(tx.date));

  // ================================================================ i18n
  let LANG = LS.get('mt.lang', 'ar');
  const STR = {
    appName: ['Money Tracker', 'Money Tracker'],
    home: ['الرئيسية', 'Home'], activity: ['العمليات', 'Activity'], subs: ['الاشتراكات', 'Subscriptions'], more: ['المزيد', 'More'],
    cancel: ['إلغاء', 'Cancel'], save: ['حفظ', 'Save'], done: ['تم', 'Done'], delete: ['حذف', 'Delete'], back: ['رجوع', 'Back'], add: ['إضافة', 'Add'], edit: ['تعديل', 'Edit'],
    confirmDelete: ['متأكد إنك عايز تمسح؟', 'Delete this?'],
    saved: ['اتسجل ✅', 'Saved ✅'], deleted: ['اتمسح', 'Deleted'],
    safeToday: ['تقدر تصرف النهارده', 'Safe to spend today'],
    safeSub: ['من {per} في اليوم • فاضل {days} يوم', '{per} a day • {days} days left'],
    overToday: ['صرفت زيادة النهارده', 'Over today'],
    monthSummary: ['ملخص الشهر', 'Month summary'],
    income: ['داخل', 'In'], spent: ['خارج', 'Out'], net: ['الفرق', 'Net'],
    accounts: ['الحسابات', 'Accounts'], allTx: ['كل العمليات', 'All activity'], recent: ['آخر العمليات', 'Recent'],
    byCategory: ['صرفت على إيه', 'Where it went'], topMerchants: ['أكتر أماكن صرفت فيها', 'Top places'],
    dailySpend: ['صرفك يوم بيوم', 'Daily spending'],
    feesMonth: ['رسوم بنكية الشهر ده', 'Bank fees this month'],
    subsMonthly: ['اشتراكاتك في الشهر', 'Subscriptions per month'], perYear: ['في السنة', 'per year'],
    renewSoon: ['هتتجدد قريب', 'Renewing soon'], seeAll: ['الكل', 'See all'],
    reviewBanner: ['فيه {n} عمليات محتاجة مراجعة', '{n} items need review'],
    reviewSub: ['رسايل مش واضحة — مش محسوبة لحد ما تأكدها', 'Unclear messages — not counted until you confirm'],
    bankSays: ['{acct}: البنك بيقول رصيدك {bank}', '{acct}: bank says {bank}'],
    bankDiff: ['وإنت متسجل {mine} — فرق {diff}', 'you have {mine} — gap {diff}'],
    logGap: ['سجّل الفرق', 'Log the gap'], dismiss: ['تمام', 'Dismiss'],
    startBanner: ['ابدأ: اكتب رصيدك الحالي في كل حساب', 'Start: enter your current balance in each account'],
    startSub: ['عشان الأرقام تبقى مظبوطة من أول يوم', 'So numbers are right from day one'],
    noTx: ['لسه مفيش عمليات الشهر ده', 'No activity this month yet'],
    noTxHint: ['دوس + وسجّل أول مصروف', 'Tap + to log your first expense'],
    search: ['دوّر…', 'Search…'],
    f_all: ['الكل', 'All'], f_expense: ['مصروف', 'Spent'], f_income: ['دخل', 'Income'], f_transfer: ['تحويل', 'Transfers'], f_review: ['للمراجعة', 'Review'],
    today: ['النهارده', 'Today'], yesterday: ['امبارح', 'Yesterday'],
    type_expense: ['مصروف', 'Expense'], type_income: ['دخل', 'Income'], type_transfer: ['تحويل', 'Transfer'], type_refund: ['استرداد', 'Refund'],
    newTx: ['عملية جديدة', 'New transaction'], editTx: ['تعديل العملية', 'Edit transaction'],
    quickPh: ['اكتب بسرعة: 60 كشري • uber 85 بنك', 'Quick: 60 lunch • uber 85 bank'],
    account: ['الحساب', 'Account'], from: ['من', 'From'], to: ['إلى', 'To'], category: ['التصنيف', 'Category'],
    whereSpent: ['صرفت فين؟', 'Where?'], whereFrom: ['جت منين؟', 'From who?'], whatFor: ['ملاحظة', 'Note'],
    note: ['ملاحظة', 'Note'], when: ['إمتى', 'When'], fee: ['رسوم', 'Fee'], toAmount: ['المبلغ اللي وصل', 'Amount received'],
    origMsg: ['الرسالة الأصلية', 'Original message'], sources: ['اتسجلت من', 'Logged from'],
    confirmOk: ['مظبوطة — احسبها', 'Looks right — count it'],
    needAmount: ['اكتب المبلغ', 'Enter an amount'], needTo: ['اختار الحساب اللي هتحول له', 'Pick the destination account'],
    src_manual: ['يدوي', 'Manual'], src_applepay: ['Apple Pay', 'Apple Pay'], src_sms: ['SMS', 'SMS'], src_carrier: ['شركة المحمول', 'Carrier'],
    src_quick: ['سريع', 'Quick'], src_receipt: ['إيصال', 'Receipt'], src_instapay: ['InstaPay', 'InstaPay'], src_subscription: ['اشتراك', 'Subscription'],
    'src_balance-check': ['مراجعة رصيد', 'Balance check'],
    review: ['للمراجعة', 'Review'],
    // subscriptions
    subsTitle: ['الاشتراكات', 'Subscriptions'], addSub: ['اشتراك جديد', 'New subscription'], editSub: ['تعديل الاشتراك', 'Edit subscription'],
    subName: ['الاسم', 'Name'], amount: ['المبلغ', 'Amount'], currency: ['العملة', 'Currency'], cycle: ['بيتجدد كل', 'Billed'],
    c_monthly: ['شهر', 'Monthly'], c_yearly: ['سنة', 'Yearly'], c_weekly: ['أسبوع', 'Weekly'], c_quarterly: ['3 شهور', 'Quarterly'],
    nextDate: ['التجديد الجاي', 'Next renewal'], payWith: ['بيتدفع من', 'Paid with'],
    autoLog: ['سجّله لوحده يوم التجديد', 'Auto-log on renewal day'], autoLogHint: ['مفيد للي بيتخصم من رصيد الموبايل', 'Great for carrier-billed App Store'],
    trialEnds: ['التجربة المجانية بتخلص', 'Free trial ends'], unused: ['مش بستخدمه', "I don't use it"], unusedHint: ['هيظهر في "ممكن توفّر"', 'Shows under "You could save"'],
    active: ['شغال', 'Active'], activeHint: ['اقفله لو لغيت الاشتراك', 'Turn off if you cancelled'], notes: ['ملاحظات', 'Notes'],
    renewsIn: ['بيتجدد {when}', 'Renews {when}'], inDays: ['بعد {n} يوم', 'in {n} days'], tomorrow: ['بكرة', 'tomorrow'],
    couldSave: ['ممكن توفّر', 'You could save'], couldSaveSub: ['لو لغيت اللي مش بتستخدمه: {m} في الشهر', 'Cancel what you don\'t use: {m} a month'],
    priceUp: ['السعر زاد', 'Price up'], trial: ['تجربة', 'Trial'], cancelled: ['ملغي', 'Cancelled'],
    noSubs: ['ضيف اشتراكاتك (Netflix، Spotify، iCloud، ChatGPT…) عشان تعرف بتدفع كام في الشهر', 'Add your subscriptions to see your monthly total'],
    ofThemUsd: ['منهم {m} بالدولار', '{m} of it in USD'],
    // more
    budgets: ['التصنيفات والميزانيات', 'Categories & budgets'], goals: ['أهداف الادخار', 'Savings goals'], debts: ['السلف', 'Debts'],
    gameya: ['الجمعيات', 'Gameya'], settings: ['الإعدادات', 'Settings'], shortcuts: ['إعداد الاختصارات (التسجيل التلقائي)', 'Shortcuts setup (auto-logging)'],
    connection: ['الربط بـ Google Sheet', 'Google Sheet connection'], openSheet: ['افتح الـ Google Sheet', 'Open Google Sheet'],
    reviewInbox: ['محتاج مراجعة', 'Needs review'], exportCsv: ['صدّر CSV', 'Export CSV'],
    // accounts
    addAccount: ['حساب جديد', 'New account'], editAccount: ['تعديل الحساب', 'Edit account'], name: ['الاسم', 'Name'], icon: ['أيقونة', 'Icon'],
    kind: ['النوع', 'Type'], k_bank: ['بنك', 'Bank'], k_cash: ['كاش', 'Cash'], k_phone: ['رصيد موبايل', 'Phone credit'], k_card: ['كارت / محفظة', 'Card / wallet'],
    k_wallet: ['محفظة إلكترونية', 'E-wallet'], k_savings: ['ادخار', 'Savings'], k_gameya: ['جمعية', 'Gameya'],
    currentBalance: ['الرصيد الحالي', 'Current balance'], currentBalanceHint: ['لو غيرته بنصحح الرصيد من غير ما نسجل مصروف', 'Changing it corrects the balance without logging spending'],
    matchWords: ['كلمات التعرّف', 'Match words'], matchHint: ['اسم الكارت زي ما بيظهر في Apple Wallet، وآخر 4 أرقام من الكارت — مفصولين بفاصلة', 'Card name as in Apple Wallet and its last 4 digits, comma separated'],
    archived: ['مخفي', 'Hidden'], checkBalance: ['راجع الرصيد', 'Check balance'],
    checkTitle: ['مراجعة رصيد {acct}', 'Check {acct}'], appSays: ['متسجل عندك', 'The app says'], actualIs: ['رصيدك الحقيقي كام؟', 'What is the real balance?'],
    diffIs: ['الفرق', 'Gap'], logAsUntracked: ['سجّل الفرق كمصروف مش متسجل', 'Log gap as untracked spending'], justRecord: ['سجّل المراجعة بس', 'Just record the check'],
    matches: ['مظبوط 👌', 'Matches 👌'], lastCheck: ['آخر مراجعة: {d}', 'Last check: {d}'],
    // categories
    addCat: ['تصنيف جديد', 'New category'], editCat: ['تعديل التصنيف', 'Edit category'], nameEn: ['الاسم بالإنجليزي', 'English name'],
    budget: ['الميزانية في الشهر', 'Monthly budget'], budgetHint: ['سيبها 0 لو مش عايز ميزانية', '0 = no budget'],
    keywords: ['كلمات بتتعرف بيها', 'Keywords'], keywordsHint: ['أي محل أو كلمة فيها الكلمات دي بتتحط هنا لوحدها', 'Merchants containing these words are auto-filed here'],
    k_expense: ['مصروف', 'Expense'], k_income: ['دخل', 'Income'], ofBudget: ['من {b}', 'of {b}'], left: ['فاضل {m}', '{m} left'], over: ['زيادة {m}', '{m} over'],
    // goals
    addGoal: ['هدف جديد', 'New goal'], target: ['المبلغ المطلوب', 'Target'], savedSoFar: ['اللي حوشته', 'Saved so far'], deadline: ['آخر ميعاد', 'Deadline'],
    addMoney: ['ضيف فلوس', 'Add money'], perMonthNeeded: ['محتاج {m} في الشهر', 'Need {m} a month'], goalDone: ['خلصت الهدف 🎉', 'Goal reached 🎉'],
    noGoals: ['حط هدف (لابتوب، سفرية، طوارئ…) وتابع وصلت لفين', 'Set a goal and track it'],
    // debts
    addDebt: ['سلفة جديدة', 'New debt'], person: ['مين', 'Who'], direction: ['النوع', 'Type'], owedToMe: ['ليّا عنده', 'Owes me'], iOwe: ['عليّا له', 'I owe'],
    settled: ['اتسددت', 'Settled'], date: ['التاريخ', 'Date'], totalOwedToMe: ['ليك عند الناس', 'Owed to you'], totalIOwe: ['عليك للناس', 'You owe'],
    noDebts: ['سجّل مين سلّفك ومين سلّفته', 'Track who owes whom'],
    // gameya
    addGameya: ['جمعية جديدة', 'New gameya'], monthly: ['القسط الشهري', 'Monthly payment'], months: ['عدد الشهور', 'Months'],
    startMonth: ['أول شهر', 'Start month'], myTurn: ['دوري رقم', 'My turn #'], paidCount: ['دفعت كام قسط', 'Payments made'], received: ['قبضت', 'Received payout'],
    payFrom: ['بدفع من', 'Pay from'], payInstallment: ['دفعت قسط الشهر', 'Paid this month'], gotPayout: ['قبضت الجمعية', 'Got the payout'],
    myTurnIs: ['دورك: {m} — هتقبض {amt}', 'Your turn: {m} — you get {amt}'], dueNow: ['قسط الشهر ده لسه', 'This month is due'],
    noGameya: ['سجّل جمعيتك: القسط، عدد الشهور، ودورك', 'Track your gameya'],
    // settings
    monthlyIncome: ['دخلك في الشهر (تقريبًا)', 'Monthly income (approx.)'], monthlyIncomeHint: ['مصروف أو مرتب — بنستخدمه لحساب "تقدر تصرف النهارده"', 'Used for safe-to-spend'],
    payday: ['يوم القبض', 'Payday'], paydayHint: ['رقم اليوم في الشهر (سيبها فاضية = آخر الشهر)', 'Day of month (blank = month end)'],
    savingsTarget: ['عايز تحوّش كام في الشهر', 'Monthly savings target'],
    usdRate: ['سعر الدولار', 'USD rate'], usdRateHint: ['الحالي من جوجل: {r} — اكتب رقم لو عايز تثبته', 'Live from Google: {r} — type a number to override'],
    remindDays: ['فكرني قبل التجديد بكام يوم', 'Remind me days before renewal'], emailReminders: ['إيميل تذكير كل يوم', 'Daily email reminders'],
    language: ['اللغة', 'Language'], faceId: ['قفل بـ Face ID', 'Face ID lock'], faceIdHint: ['الـ app يطلب Face ID لما تفتحه', 'Ask for Face ID when opening'],
    faceIdFail: ['Face ID مش متاح هنا', 'Face ID is not available here'],
    // connection
    connTitle: ['الربط بـ Google Sheet', 'Connect Google Sheet'], webAppUrl: ['رابط الـ Web app', 'Web app URL'], token: ['التوكن', 'Token'],
    connect: ['وصّل', 'Connect'], disconnect: ['افصل', 'Disconnect'], testing: ['بجرب…', 'Testing…'],
    connected: ['متوصل ✅', 'Connected ✅'], connFail: ['مش عارف أوصل: {e}', 'Could not connect: {e}'], localMode: ['على الموبايل بس', 'This phone only'],
    uploadLocal: ['عندك بيانات على الموبايل — أرفعها على الـ Sheet؟', 'Upload the data on this phone to the Sheet?'],
    synced: ['متزامن', 'Synced'], syncing: ['بيتزامن…', 'Syncing…'], offline: ['هيتبعت لما النت يرجع', 'Will sync when online'], syncErr: ['مشكلة في المزامنة', 'Sync problem'],
    // onboarding & lock
    welcome: ['أهلاً في Money Tracker', 'Welcome to Money Tracker'],
    welcomeSub: ['اعرف كل جنيه داخل وخارج', 'Know where every pound goes'],
    w1: ['Apple Pay ورسايل البنك بيتسجلوا لوحدهم', 'Apple Pay and bank SMS log themselves'],
    w2: ['اشتراكاتك في رقم واحد كل شهر', 'All your subscriptions in one monthly number'],
    w3: ['مراجعة الرصيد بتلقط أي جنيه هرب', 'Balance checks catch every missing pound'],
    w4: ['بياناتك في Google Sheet بتاعك', 'Your data lives in your own Google Sheet'],
    startSheet: ['وصّل بالـ Google Sheet', 'Connect Google Sheet'], startLocal: ['جرّب على الموبايل الأول', 'Try it on this phone first'],
    locked: ['Money Tracker مقفول', 'Money Tracker is locked'], unlock: ['افتح بـ Face ID', 'Unlock with Face ID'],
    unlockFallback: ['مش عارف تفتح؟ اكتب التوكن', "Can't unlock? Enter your token"],
    // safe-to-spend breakdown
    howCalc: ['اتحسبت إزاي', 'How it’s calculated'], b_income: ['دخل الشهر', 'Month income'], b_balance: ['الفلوس اللي معاك', 'Money you have'],
    b_spent: ['صرفت لحد امبارح', 'Spent until yesterday'], b_upcoming: ['اشتراكات جاية', 'Upcoming subscriptions'], b_gameya: ['قسط الجمعية', 'Gameya payment'],
    b_save: ['هدف الادخار', 'Savings target'], b_days: ['÷ أيام فاضلة', '÷ days left'], b_perDay: ['في اليوم', 'Per day'], b_spentToday: ['صرفت النهارده', 'Spent today'],
    b_tip: ['ظبط دخلك ويوم القبض وهدف الادخار من الإعدادات', 'Set income, payday and savings in Settings'],
    reviewEmpty: ['مفيش حاجة محتاجة مراجعة 👌', 'Nothing to review 👌'], notMoney: ['مش فلوس — امسحها', 'Not money — delete'],
    exported: ['اتعمل الملف', 'File ready']
  };
  function t(k, vars) {
    const v = STR[k];
    let s = v ? v[LANG === 'en' ? 1 : 0] : k;
    if (vars) Object.keys(vars).forEach((n) => { s = s.split('{' + n + '}').join(vars[n]); });
    return s;
  }
  const loc = () => (LANG === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn');

  // ================================================================ formatting
  function nf(n, dec) {
    const v = Math.abs(Number(n) || 0);
    const d = dec != null ? dec : (Math.round(v * 100) % 100 ? 2 : 0);
    return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function money(n, cur, o) {
    o = o || {};
    n = MT.round2(n);
    const sign = o.sign ? (n < 0 ? '−' : n > 0 ? '+' : '') : (n < 0 ? '−' : '');
    const num = nf(n, o.dec);
    if (cur === 'USD') return `<bdi class="money" dir="ltr">${sign}$${num}</bdi>`;
    if (LANG === 'en') return `<bdi class="money" dir="ltr">${sign}${num} <span class="cur">EGP</span></bdi>`;
    return `<bdi class="money"><span dir="ltr">${sign}${num}</span> <span class="cur">ج.م</span></bdi>`;
  }
  /** Plain-text money for sentences (no HTML). */
  function moneyText(n, cur) {
    if (LANG !== 'en' || cur === 'USD') return MT.fmtMoney(n, cur);
    const v = MT.round2(n);
    return (v < 0 ? '-' : '') + nf(v) + ' EGP';
  }
  function monthLabel(mk) {
    const [y, m] = mk.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(loc(), { month: 'long', year: 'numeric' });
  }
  function dayLabel(ymd) {
    const td = todayYmd();
    if (ymd === td) return t('today');
    if (ymd === MT.addDays(td, -1)) return t('yesterday');
    return MT.parseYmd(ymd).toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function shortDate(ymd) { return MT.parseYmd(ymd).toLocaleDateString(loc(), { day: 'numeric', month: 'short' }); }
  function timeLabel(iso) { return new Date(iso).toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit' }); }
  function toLocalInput(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function fromLocalInput(v) { const d = v ? new Date(v) : new Date(); return isNaN(d) ? new Date().toISOString() : d.toISOString(); }
  function whenText(ymd) {
    const d = MT.daysBetween(todayYmd(), ymd);
    if (d <= 0) return t('today');
    if (d === 1) return t('tomorrow');
    return t('inDays', { n: d });
  }

  // ================================================================ data layer
  const conn = () => LS.get('mt.conn', null);
  const isRemote = () => { const c = conn(); return !!(c && c.url && c.token); };
  function blankState() {
    const s = { settings: {}, rates: { USD: 50 }, sheetUrl: '', syncedAt: '' };
    MT.TABLES.forEach((tb) => { s[tb] = []; });
    return s;
  }
  let S = LS.get('mt.state', null);
  let outbox = LS.get('mt.outbox', []);
  function save() { LS.set('mt.state', S); }
  function seedLocal() {
    S = blankState();
    MT.defaultAccounts(todayYmd()).forEach((a) => S.accounts.push(MT.coerce('accounts', a)));
    MT.defaultCategories().forEach((c) => S.categories.push(MT.coerce('categories', c)));
    S.settings = { remindDays: '2', merchantMap: '{}' };
    save();
  }
  const localStore = {
    all: (tb) => (tb === 'settings'
      ? Object.keys(S.settings).map((k) => ({ key: k, value: S.settings[k] }))
      : (S[tb] || []).map((r) => Object.assign({}, r))),
    upsert: (tb, row) => {
      if (tb === 'settings') { S.settings[row.key] = row.value; return row; }
      const arr = S[tb];
      const i = arr.findIndex((r) => r.id === row.id);
      const c = MT.coerce(tb, Object.assign({}, i >= 0 ? arr[i] : {}, row));
      if (i >= 0) arr[i] = c; else arr.push(c);
      return row;
    },
    remove: (tb, id) => { S[tb] = S[tb].filter((r) => r.id !== id); }
  };
  function rates() {
    const manual = MT.toNum(S.settings.usdRateManual);
    const live = MT.toNum(S.rates && S.rates.USD);
    return { USD: manual > 0 ? manual : (live > 0 ? live : 50) };
  }
  function env() {
    const d = new Date();
    const off = -d.getTimezoneOffset();
    const p = (n) => String(n).padStart(2, '0');
    return {
      now: d.toISOString(), today: MT.ymdOf(d),
      offset: (off >= 0 ? '+' : '-') + p(Math.floor(Math.abs(off) / 60)) + ':' + p(Math.abs(off) % 60),
      rates: rates(), sheetUrl: S.sheetUrl, dayOf
    };
  }

  /** Apply a request locally (instant) and, when connected, queue it for the Sheet. */
  function act(req, opts) {
    if (req.action === 'upsert' && req.table !== 'settings' && req.row && !req.row.id) req.row.id = MT.uid(req.table.charAt(0));
    const res = MT.handleRequest(req, localStore, env());
    save();
    if (isRemote() && !(opts && opts.localOnly)) {
      outbox.push(req);
      LS.set('mt.outbox', outbox);
      flush();
    }
    if (!(opts && opts.noRender)) render();
    return res;
  }

  let sync = { status: isRemote() ? 'pending' : 'local', msg: '' };
  function setSync(status, msg) {
    sync = { status, msg: msg || '' };
    const el = $('#sync');
    if (el) el.outerHTML = syncHtml();
  }
  function syncHtml() {
    if (!isRemote()) return `<button class="sync" id="sync" data-go="connection"><span class="dot"></span>${t('localMode')}</button>`;
    const map = { ok: ['ok', t('synced')], pending: ['pending', outbox.length && !navigator.onLine ? t('offline') : t('syncing')], err: ['err', t('syncErr')] };
    const [cls, label] = map[sync.status] || map.pending;
    return `<button class="sync" id="sync" data-act="syncNow"><span class="dot ${cls}"></span>${label}${outbox.length ? ' • ' + outbox.length : ''}</button>`;
  }

  async function api(body) {
    const c = conn();
    const r = await fetch(c.url, { method: 'POST', body: JSON.stringify(Object.assign({ token: c.token }, body)), redirect: 'follow' });
    const txt = await r.text();
    let j;
    try { j = JSON.parse(txt); } catch (e) { throw new Error(r.status === 200 ? 'not the Money Tracker web app URL' : 'HTTP ' + r.status); }
    if (j.error === 'unauthorized') throw new Error('token');
    return j;
  }
  let flushing = false;
  async function flush() {
    if (!isRemote() || flushing) return;
    if (!outbox.length) return refresh();
    flushing = true;
    setSync('pending');
    const ops = outbox.slice();
    try {
      const res = await api({ action: 'bulk', ops });
      if (!res.ok) throw new Error(res.error || 'error');
      outbox.splice(0, ops.length);
      LS.set('mt.outbox', outbox);
      flushing = false;
      await refresh();
    } catch (e) {
      flushing = false;
      setSync('err', e.message);
    }
  }
  let refreshing = null;
  async function refresh() {
    if (!isRemote()) return;
    if (outbox.length) return flush();
    if (refreshing) return refreshing;
    setSync('pending');
    refreshing = (async () => {
      try {
        const res = await api({ action: 'getAll' });
        if (!res.ok) throw new Error(res.error || 'error');
        const next = blankState();
        MT.TABLES.forEach((tb) => { next[tb] = (res[tb] || []).map((r) => MT.coerce(tb, r)); });
        next.settings = res.settings || {};
        next.rates = res.rates || S.rates;
        next.sheetUrl = res.sheetUrl || '';
        next.syncedAt = new Date().toISOString();
        S = next;
        outbox.forEach((op) => MT.handleRequest(op, localStore, env()));
        save();
        setSync('ok');
        render();
      } catch (e) {
        setSync('err', e.message);
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }
  async function localRate() {
    if (isRemote()) return;
    const last = LS.get('mt.rateAt', 0);
    if (Date.now() - last < 12 * 3600 * 1000) return;
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      const j = await r.json();
      if (j && j.rates && j.rates.EGP) { S.rates = { USD: j.rates.EGP }; save(); LS.set('mt.rateAt', Date.now()); render(); }
    } catch (e) { /* offline: keep last rate */ }
  }
  function dailyTick() {
    const key = todayYmd();
    if (LS.get('mt.tickDay', '') === key) return;
    LS.set('mt.tickDay', key);
    const res = act({ action: 'tick' }, { noRender: true });
    if (res && res.logged && res.logged.length) toast('🔁 ' + res.logged.map((x) => x.name).join('، '));
  }

  // ================================================================ derived data
  const accById = (id) => S.accounts.find((a) => a.id === id);
  const catById = (id) => S.categories.find((c) => c.id === id);
  const kindAcct = (k) => MT.findAccountByKind(S.accounts, k);
  const spendAccounts = () => MT.activeAccounts(S.accounts).filter((a) => a.kind !== 'gameya');
  const catLabel = (c) => (c ? (LANG === 'en' && c.nameEn ? c.nameEn : c.name) : '');
  const reviewTx = () => S.transactions.filter((x) => x.status === 'review');
  function txTitle(tx) {
    if (tx.type === 'transfer') {
      const a = accById(tx.accountId), b = accById(tx.toAccountId);
      return (tx.note ? tx.note + ' • ' : '') + (a ? a.name : '?') + (LANG === 'en' ? ' → ' : ' ← ') + (b ? b.name : '?');
    }
    const c = catById(tx.categoryId);
    return tx.merchant || tx.note || catLabel(c) || t('type_' + tx.type);
  }
  function txIcon(tx) {
    if (tx.type === 'transfer') return '🔄';
    const c = catById(tx.categoryId);
    return c ? c.icon : (tx.type === 'income' ? '💰' : '📦');
  }
  function txAmountHtml(tx) {
    const cls = tx.status === 'review' ? 'review' : tx.type === 'transfer' ? 'xfer' : (tx.type === 'income' || tx.type === 'refund') ? 'in' : 'out';
    const sign = tx.type === 'income' || tx.type === 'refund' ? 1 : tx.type === 'expense' ? -1 : 0;
    const main = sign ? money(sign * tx.amount, tx.currency, { sign: sign > 0 }) : money(tx.amount, tx.currency);
    const egp = tx.currency !== 'EGP' ? `<small>≈ ${money(MT.txEgp(tx, rates()), 'EGP')}</small>` : '';
    return `<div class="amt ${cls}">${main}${egp}</div>`;
  }
  function sourceBadges(tx) {
    return MT.sourcesOf(tx).map((s) => `<span class="badge ${s === 'applepay' || s === 'sms' ? 'green' : ''}">${esc(t('src_' + s))}</span>`).join('');
  }
  function reportedGaps() {
    const out = [];
    S.accounts.forEach((a) => {
      const raw = S.settings['reported:' + a.id];
      if (!raw) return;
      let rep;
      try { rep = JSON.parse(raw); } catch (e) { return; }
      if (!rep || rep.dismissed) return;
      const at = new Date(rep.at).getTime();
      if (Date.now() - at > 7 * 86400000) return;
      // what the app thought the balance was when the bank sent that SMS
      const asOf = S.transactions.filter((x) => new Date(x.date).getTime() <= at + 120000);
      const mine = MT.balances(S.accounts, asOf, dayOf)[a.id] || 0;
      const diff = MT.round2(rep.balance - mine);
      if (Math.abs(diff) >= 1) out.push({ acct: a, bank: rep.balance, mine, diff, rep });
    });
    return out;
  }

  // ================================================================ UI state & shell
  const UI = { tab: 'home', page: null, month: MT.monthKey(todayYmd()), q: '', filter: 'all', acct: '' };
  let lastView = '';
  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></svg>',
    activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor"/></svg>',
    subs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>'
  };
  function renderTabbar() {
    const n = reviewTx().length;
    const tab = (k) => `<button class="tab ${UI.tab === k ? 'on' : ''}" data-tab="${k}">${ICONS[k]}<span>${t(k)}</span>${k === 'more' && n ? `<span class="count">${n}</span>` : ''}</button>`;
    $('#tabbar').innerHTML = tab('home') + tab('activity') + `<div><button class="fab" data-act="newTx" aria-label="${t('newTx')}">${ICONS.plus}</button></div>` + tab('subs') + tab('more');
  }
  function monthPill() {
    const prev = MT.monthKey(MT.addMonthsClamped(UI.month + '-01', -1));
    const next = MT.monthKey(MT.addMonthsClamped(UI.month + '-01', 1));
    const atNow = UI.month >= MT.monthKey(todayYmd());
    const [a, b] = LANG === 'en' ? ['‹', '›'] : ['›', '‹'];
    return `<div class="monthpill"><button data-month="${prev}">${a}</button><span>${esc(monthLabel(UI.month))}</span><button data-month="${next}" ${atNow ? 'disabled style="opacity:.3"' : ''}>${b}</button></div>`;
  }
  function render() {
    if (!S) return;
    document.documentElement.lang = LANG;
    document.documentElement.dir = LANG === 'en' ? 'ltr' : 'rtl';
    const view = UI.page ? 'p:' + UI.page : 't:' + UI.tab;
    const keepScroll = view === lastView ? window.scrollY : 0;
    let html;
    if (UI.page) html = (PAGES[UI.page] || TABS.more)();
    else html = (TABS[UI.tab] || TABS.home)();
    $('#app').innerHTML = `<div class="screen">${html}</div>`;
    renderTabbar();
    window.scrollTo(0, keepScroll);
    lastView = view;
  }
  function go(page) { UI.page = page; render(); }
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('in');
    clearTimeout(toast.tm);
    toast.tm = setTimeout(() => el.classList.remove('in'), 2400);
  }
  function header(title, opts) {
    opts = opts || {};
    const back = opts.back ? `<button class="back" data-back>${LANG === 'en' ? '‹' : '›'} ${t('back')}</button>` : '';
    return `<div class="topbar"><div class="left">${back}${opts.left || ''}</div><div class="right">${opts.right || ''}</div></div><h1 class="title">${esc(title)}</h1>${opts.sub ? `<div class="subtitle">${opts.sub}</div>` : ''}`;
  }

  // ================================================================ tabs
  const TABS = {};

  TABS.home = function () {
    const r = rates();
    const td = todayYmd();
    const isNow = UI.month === MT.monthKey(td);
    const st = MT.monthStats(S.transactions, UI.month, r, dayOf);
    const bal = MT.balances(S.accounts, S.transactions, dayOf);
    let html = header(t('appName'), { left: monthPill(), right: syncHtml() });

    // hero
    if (isNow) {
      const s = MT.safeToSpend({ txs: S.transactions, accounts: S.accounts, subs: S.subscriptions, gameyas: S.gameyas, settings: S.settings, rates: r, today: td, dayOf });
      const neg = s.leftToday < 0;
      html += `<button class="hero ${neg ? 'neg' : ''}" data-act="safeInfo" style="width:100%;text-align:start">
        <span class="chev">ⓘ</span>
        <div class="label">${neg ? t('overToday') : t('safeToday')}</div>
        <div class="big">${money(Math.abs(s.leftToday), 'EGP')}</div>
        <div class="small">${t('safeSub', { per: moneyText(s.perDay, 'EGP'), days: s.daysLeft })}</div></button>`;
    } else {
      html += `<div class="hero"><div class="label">${t('monthSummary')}</div><div class="big">${money(-st.spent, 'EGP')}</div><div class="small">${esc(monthLabel(UI.month))}</div></div>`;
    }
    html += `<div class="tiles">
      <div class="tile"><div class="k">${t('income')}</div><div class="v in">${money(st.income, 'EGP')}</div></div>
      <div class="tile"><div class="k">${t('spent')}</div><div class="v out">${money(st.spent, 'EGP')}</div></div>
      <div class="tile"><div class="k">${t('net')}</div><div class="v ${st.net < 0 ? 'out' : 'in'}">${money(st.net, 'EGP', { sign: true })}</div></div></div>`;

    // banners
    const rv = reviewTx();
    if (rv.length) html += `<button class="banner" data-go="review"><span class="em">⚠️</span><span><b>${t('reviewBanner', { n: rv.length })}</b>${t('reviewSub')}</span></button>`;
    reportedGaps().forEach((g) => {
      html += `<div class="banner"><span class="em">🏦</span><span><b>${esc(t('bankSays', { acct: g.acct.name, bank: moneyText(g.bank, g.acct.currency) }))}</b>${esc(t('bankDiff', { mine: moneyText(g.mine, g.acct.currency), diff: moneyText(g.diff, g.acct.currency) }))}
        <span class="actions"><button class="btn small" data-act="logGap" data-id="${g.acct.id}" data-actual="${g.bank}">${t('logGap')}</button><button class="btn small secondary" data-act="dismissGap" data-id="${g.acct.id}">${t('dismiss')}</button></span></span></div>`;
    });
    const fresh = !S.transactions.length && S.accounts.every((a) => !a.opening);
    if (fresh) html += `<button class="banner info" data-go="accounts"><span class="em">👋</span><span><b>${t('startBanner')}</b>${t('startSub')}</span></button>`;

    // accounts
    html += `<div class="accts">${spendAccounts().map((a) => {
      const b = bal[a.id] || 0;
      const egp = a.currency !== 'EGP' ? `<div class="s">≈ ${moneyText(b * MT.rateFor(a.currency, r), 'EGP')}</div>` : '';
      return `<button class="acct" data-act="editAccount" data-id="${a.id}"><div class="ic">${esc(a.icon || '💳')}</div><div class="n">${esc(a.name)}</div><div class="b ${b < 0 ? 'neg' : ''}">${money(b, a.currency)}</div>${egp}</button>`;
    }).join('')}</div>`;

    // subscriptions
    const subsTotal = MT.subsMonthlyTotal(S.subscriptions, r);
    const soon = MT.subsDueBetween(S.subscriptions, td, MT.addDays(td, 10), r).items.slice(0, 3);
    html += `<div class="card"><h3>${t('subsMonthly')}<button data-tab="subs">${t('seeAll')}</button></h3>
      <div style="font-size:26px;font-weight:800">${money(subsTotal, 'EGP')}</div>
      ${soon.length ? `<div style="margin-top:8px">${soon.map((it) => `<div style="display:flex;justify-content:space-between;font-size:14px;padding:3px 0"><span>${esc(it.sub.name)} <span class="badge">${esc(whenText(it.date))}</span></span>${money(it.sub.amount, it.sub.currency)}</div>`).join('')}</div>` : ''}</div>`;

    // categories with budgets
    const cats = Object.keys(st.byCategory).filter((k) => st.byCategory[k] > 0).sort((a, b) => st.byCategory[b] - st.byCategory[a]);
    const budgeted = S.categories.filter((c) => c.kind === 'expense' && c.budget > 0 && cats.indexOf(c.id) < 0).map((c) => c.id);
    const showCats = cats.slice(0, 6).concat(budgeted).slice(0, 8);
    if (showCats.length) {
      const max = Math.max.apply(null, showCats.map((id) => Math.max(st.byCategory[id] || 0, (catById(id) || {}).budget || 0)).concat([1]));
      html += `<div class="card"><h3>${t('byCategory')}<button data-go="budgets">${t('seeAll')}</button></h3>${showCats.map((id) => {
        const c = catById(id) || { icon: '📦', name: id };
        const v = st.byCategory[id] || 0;
        const b = c.budget || 0;
        const pct = b ? Math.min(100, (v / b) * 100) : Math.min(100, (v / max) * 100);
        const cls = b && v > b ? 'over' : b && v > b * 0.8 ? 'near' : '';
        const right = b ? (v > b ? t('over', { m: moneyText(v - b, 'EGP') }) : t('left', { m: moneyText(b - v, 'EGP') })) : '';
        return `<button class="bar-row" data-act="filterCat" data-id="${esc(id)}"><span style="font-size:20px">${esc(c.icon)}</span><span><span class="nm"><span>${esc(catLabel(c))}</span><span>${esc(right)}</span></span><span class="bar"><i class="${cls}" style="width:${pct.toFixed(1)}%;${!b && c.color ? 'background:' + esc(c.color) : ''}"></i></span></span><span class="v">${money(v, 'EGP')}</span></button>`;
      }).join('')}</div>`;
    }

    // daily chart
    if (st.spent > 0) html += `<div class="card"><h3>${t('dailySpend')}</h3>${dailyChart(st)}</div>`;

    // fees + top merchants
    if (st.fees > 0) html += `<div class="card" style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:600">🏦 ${t('feesMonth')}</span><b>${money(st.fees, 'EGP')}</b></div>`;
    const merchants = Object.keys(st.byMerchant).sort((a, b) => st.byMerchant[b] - st.byMerchant[a]).slice(0, 5);
    if (merchants.length >= 2) {
      html += `<div class="card"><h3>${t('topMerchants')}</h3>${merchants.map((m, i) => `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:15px"><span><span style="color:var(--faint)">${i + 1}.</span> ${esc(m)}</span><b>${money(st.byMerchant[m], 'EGP')}</b></div>`).join('')}</div>`;
    }

    // recent
    const recent = S.transactions.filter((x) => MT.monthKey(dayOf(x)) === UI.month).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
    html += `<div class="section-title" style="display:flex;justify-content:space-between"><span>${t('recent')}</span><button style="color:var(--accent);font-weight:600" data-tab="activity">${t('allTx')}</button></div>`;
    html += recent.length ? `<div class="list">${recent.map(txRow).join('')}</div>` : `<div class="card empty"><span class="e">🧾</span>${t('noTx')}<br><small>${t('noTxHint')}</small></div>`;
    return html;
  };

  function dailyChart(st) {
    const [y, m] = UI.month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const vals = [];
    for (let d = 1; d <= days; d++) vals.push(Math.max(0, st.byDay[UI.month + '-' + String(d).padStart(2, '0')] || 0));
    const max = Math.max.apply(null, vals.concat([1]));
    const w = 300, h = 64, bw = w / days;
    const td = todayYmd();
    const bars = vals.map((v, i) => {
      const bh = v ? Math.max(2, (v / max) * (h - 6)) : 1.5;
      const isToday = UI.month + '-' + String(i + 1).padStart(2, '0') === td;
      return `<rect x="${(i * bw + 1).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5" fill="${isToday ? 'var(--out)' : 'var(--accent)'}" opacity="${v ? 1 : 0.25}"><title>${i + 1}: ${nf(v)}</title></rect>`;
    }).join('');
    return `<svg class="daily" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="transform:${LANG === 'en' ? 'none' : 'scaleX(-1)'}">${bars}</svg>`;
  }

  function txRow(tx) {
    const acct = accById(tx.accountId);
    const c = catById(tx.categoryId);
    const sub = [tx.type === 'transfer' ? t('type_transfer') : catLabel(c), acct && tx.type !== 'transfer' ? acct.name : '', timeLabel(tx.date)].filter(Boolean).join(' • ');
    const badges = (tx.status === 'review' ? `<span class="badge warn">${t('review')}</span>` : '') +
      (MT.sourcesOf(tx).indexOf('applepay') >= 0 ? '<span class="badge"></span>' : '') +
      (MT.sourcesOf(tx).indexOf('sms') >= 0 ? '<span class="badge">SMS</span>' : '');
    return `<button class="row" data-act="editTx" data-id="${tx.id}"><span class="bubble">${esc(txIcon(tx))}</span><span class="mid"><div class="t1">${esc(txTitle(tx))}${badges}</div><div class="t2">${esc(sub)}</div></span>${txAmountHtml(tx)}</button>`;
  }

  TABS.activity = function () {
    let html = header(t('activity'), { left: monthPill(), right: syncHtml() });
    html += `<div class="searchbar"><span>🔎</span><input id="search" placeholder="${t('search')}" value="${esc(UI.q)}" autocomplete="off"></div>`;
    const filters = ['all', 'expense', 'income', 'transfer', 'review'];
    const acctChips = spendAccounts().map((a) => `<button class="chip ${UI.acct === a.id ? 'on' : ''}" data-acct="${a.id}">${esc(a.icon)} ${esc(a.name)}</button>`).join('');
    html += `<div class="filters">${filters.map((f) => `<button class="chip ${UI.filter === f ? 'on' : ''}" data-filter="${f}">${t('f_' + f)}</button>`).join('')}${acctChips}</div>`;
    if (UI.cat) {
      const c = catById(UI.cat);
      html += `<div class="filters"><button class="chip on" data-act="clearCat">${esc(c ? c.icon + ' ' + catLabel(c) : UI.cat)} ✕</button></div>`;
    }
    return html + `<div id="txlist">${activityList()}</div>`;
  };

  function activityList() {
    let html = '';
    const q = MT.clean(UI.q).toLowerCase();
    let list = S.transactions.filter((x) => (UI.filter === 'review' ? x.status === 'review' : MT.monthKey(dayOf(x)) === UI.month));
    if (UI.filter === 'expense') list = list.filter((x) => x.type === 'expense' || x.type === 'refund');
    if (UI.filter === 'income') list = list.filter((x) => x.type === 'income');
    if (UI.filter === 'transfer') list = list.filter((x) => x.type === 'transfer');
    if (UI.acct) list = list.filter((x) => x.accountId === UI.acct || x.toAccountId === UI.acct);
    if (UI.cat) list = list.filter((x) => x.categoryId === UI.cat);
    if (q) list = list.filter((x) => [x.merchant, x.note, x.raw, catLabel(catById(x.categoryId)), String(x.amount)].join(' ').toLowerCase().indexOf(q) >= 0);
    list.sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!list.length) return `<div class="card empty"><span class="e">🧾</span>${t('noTx')}</div>`;
    const groups = {};
    list.forEach((x) => { const d = dayOf(x); (groups[d] = groups[d] || []).push(x); });
    const r = rates();
    Object.keys(groups).sort().reverse().forEach((d) => {
      const out = groups[d].reduce((s, x) => s + (x.status !== 'review' ? (x.type === 'expense' ? MT.txEgp(x, r) + MT.feeEgp(x, r) : x.type === 'refund' ? -MT.txEgp(x, r) : 0) : 0), 0);
      html += `<div class="daygroup"><span>${esc(dayLabel(d))}</span><span>${out ? money(-out, 'EGP') : ''}</span></div><div class="list">${groups[d].map(txRow).join('')}</div>`;
    });
    return html;
  }

  TABS.subs = function () {
    const r = rates();
    const total = MT.subsMonthlyTotal(S.subscriptions, r);
    const usd = MT.round2(S.subscriptions.filter((s) => s.active && s.currency === 'USD').reduce((a, s) => a + MT.subMonthlyEgp(s, r), 0));
    let html = header(t('subsTitle'), { right: `<button class="iconbtn" data-act="newSub" aria-label="${t('addSub')}">${ICONS.plus}</button>` });
    html += `<div class="hero"><div class="label">${t('subsMonthly')}</div><div class="big">${money(total, 'EGP')}</div><div class="small">${moneyText(total * 12, 'EGP')} ${t('perYear')}${usd ? ' • ' + t('ofThemUsd', { m: moneyText(usd, 'EGP') }) : ''}</div></div>`;
    const unused = S.subscriptions.filter((s) => s.active && s.unused);
    if (unused.length) {
      const save = MT.round2(unused.reduce((a, s) => a + MT.subMonthlyEgp(s, r), 0));
      html += `<div class="banner info"><span class="em">💡</span><span><b>${t('couldSave')}</b>${t('couldSaveSub', { m: moneyText(save, 'EGP') })} — ${unused.map((s) => esc(s.name)).join('، ')}</span></div>`;
    }
    const active = S.subscriptions.filter((s) => s.active).sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));
    const off = S.subscriptions.filter((s) => !s.active);
    if (!S.subscriptions.length) return html + `<div class="card empty"><span class="e">🔁</span>${t('noSubs')}<br><br><button class="btn small" data-act="newSub">${t('addSub')}</button></div>`;
    const row = (s) => {
      const acct = accById(s.accountId);
      const badges = (s.trialEnds && s.trialEnds >= todayYmd() ? `<span class="badge warn">${t('trial')}</span>` : '') +
        (s.lastAmount && s.amount > s.lastAmount ? `<span class="badge red">↑ ${t('priceUp')}</span>` : '') +
        (s.unused ? `<span class="badge warn">${t('unused')}</span>` : '') + (!s.active ? `<span class="badge">${t('cancelled')}</span>` : '');
      const sub = [s.active && s.nextDate ? t('renewsIn', { when: whenText(s.nextDate) }) + ' (' + shortDate(s.nextDate) + ')' : '', acct ? acct.icon + ' ' + acct.name : ''].filter(Boolean).join(' • ');
      const per = s.cycle !== 'monthly' ? `<small>${moneyText(MT.subMonthlyEgp(s, r), 'EGP')}/${t('c_monthly')}</small>` : (s.currency !== 'EGP' ? `<small>≈ ${moneyText(MT.subMonthlyEgp(s, r), 'EGP')}</small>` : '');
      return `<button class="row" data-act="editSub" data-id="${s.id}"><span class="bubble">${esc((catById(s.categoryId) || {}).icon || '🔁')}</span><span class="mid"><div class="t1">${esc(s.name)}${badges}</div><div class="t2">${esc(sub)}</div></span><div class="amt out">${money(s.amount, s.currency)}<small>${t('c_' + s.cycle)}</small>${per}</div></button>`;
    };
    html += `<div class="list">${active.map(row).join('')}</div>`;
    if (off.length) html += `<div class="section-title">${t('cancelled')}</div><div class="list">${off.map(row).join('')}</div>`;
    return html;
  };

  TABS.more = function () {
    const n = reviewTx().length;
    const item = (go, icon, label, extra) => `<button class="row" data-go="${go}"><span class="bubble">${icon}</span><span class="mid"><div class="t1">${label}</div></span>${extra || ''}<span class="chev-s">${LANG === 'en' ? '›' : '‹'}</span></button>`;
    let html = header(t('more'), { right: syncHtml() });
    html += `<div class="list">${item('accounts', '🏦', t('accounts'))}${item('budgets', '📊', t('budgets'))}${item('review', '⚠️', t('reviewInbox'), n ? `<span class="count">${n}</span>` : '')}</div>`;
    html += `<div class="list">${item('goals', '🎯', t('goals'))}${item('debts', '🤝', t('debts'))}${item('gameya', '👥', t('gameya'))}</div>`;
    html += `<div class="list">${item('shortcuts', '⚡️', t('shortcuts'))}${item('connection', '🔗', t('connection'), `<span class="t2" style="margin-inline-end:6px">${isRemote() ? '✅' : t('localMode')}</span>`)}${item('settings', '⚙️', t('settings'))}</div>`;
    if (S.sheetUrl) html += `<div class="list"><a class="row" href="${esc(S.sheetUrl)}" target="_blank" rel="noopener"><span class="bubble">📗</span><span class="mid"><div class="t1">${t('openSheet')}</div></span></a></div>`;
    html += `<div class="list"><button class="row" data-act="exportCsv"><span class="bubble">⬇️</span><span class="mid"><div class="t1">${t('exportCsv')}</div></span></button></div>`;
    html += `<div style="text-align:center;color:var(--faint);font-size:12px;margin-top:10px">Money Tracker v${MT.VERSION}</div>`;
    return html;
  };

  // ================================================================ pages (inside "More")
  const PAGES = {};

  PAGES.accounts = function () {
    const bal = MT.balances(S.accounts, S.transactions, dayOf);
    const r = rates();
    let total = 0;
    let html = header(t('accounts'), { back: true, right: `<button class="iconbtn" data-act="newAccount">${ICONS.plus}</button>` });
    const groups = [['', MT.activeAccounts(S.accounts).filter((a) => a.kind !== 'gameya')], [t('gameya'), MT.activeAccounts(S.accounts).filter((a) => a.kind === 'gameya')], [t('archived'), S.accounts.filter((a) => a.archived)]];
    groups.forEach(([title, list]) => {
      if (!list.length) return;
      if (title) html += `<div class="section-title">${esc(title)}</div>`;
      html += `<div class="list">${list.map((a) => {
        const b = bal[a.id] || 0;
        if (!a.archived && a.kind !== 'gameya') total += b * MT.rateFor(a.currency, r);
        const last = S.checks.filter((c) => c.accountId === a.id).sort((x, y) => (x.date < y.date ? 1 : -1))[0];
        return `<div class="row"><span class="bubble">${esc(a.icon)}</span><button class="mid" style="text-align:start" data-act="editAccount" data-id="${a.id}"><div class="t1">${esc(a.name)}</div><div class="t2">${t('k_' + a.kind)}${last ? ' • ' + t('lastCheck', { d: shortDate(MT.ymdOf(new Date(last.date))) }) : ''}</div></button><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><div class="amt ${b < 0 ? 'out' : ''}" style="${b < 0 ? 'color:var(--out)' : ''}">${money(b, a.currency)}</div><button class="copy" data-act="checkAcct" data-id="${a.id}">${t('checkBalance')}</button></div></div>`;
      }).join('')}</div>`;
    });
    html += `<div class="card" style="display:flex;justify-content:space-between"><b>${LANG === 'en' ? 'Total' : 'الإجمالي'}</b><b>${money(total, 'EGP')}</b></div>`;
    return html;
  };

  PAGES.budgets = function () {
    const st = MT.monthStats(S.transactions, MT.monthKey(todayYmd()), rates(), dayOf);
    let html = header(t('budgets'), { back: true, right: `<button class="iconbtn" data-act="newCat">${ICONS.plus}</button>` });
    ['expense', 'income'].forEach((k) => {
      const list = S.categories.filter((c) => c.kind === k).sort((a, b) => a.order - b.order);
      html += `<div class="section-title">${t('k_' + k)}</div><div class="list">${list.map((c) => {
        const v = k === 'expense' ? (st.byCategory[c.id] || 0) : 0;
        const bar = c.budget ? `<span class="bar" style="display:block"><i class="${v > c.budget ? 'over' : v > c.budget * 0.8 ? 'near' : ''}" style="width:${Math.min(100, (v / c.budget) * 100).toFixed(1)}%"></i></span>` : '';
        const sub = c.budget ? `${moneyText(v, 'EGP')} ${t('ofBudget', { b: moneyText(c.budget, 'EGP') })}` : (k === 'expense' && v ? moneyText(v, 'EGP') : '');
        return `<button class="row" data-act="editCat" data-id="${c.id}"><span class="bubble">${esc(c.icon)}</span><span class="mid"><div class="t1">${esc(catLabel(c))}</div>${sub ? `<div class="t2">${esc(sub)}</div>` : ''}${bar}</span><span class="chev-s">${LANG === 'en' ? '›' : '‹'}</span></button>`;
      }).join('')}</div>`;
    });
    return html;
  };

  PAGES.review = function () {
    const list = reviewTx().sort((a, b) => (a.date < b.date ? 1 : -1));
    let html = header(t('reviewInbox'), { back: true, sub: esc(t('reviewSub')) });
    if (!list.length) return html + `<div class="card empty"><span class="e">✅</span>${t('reviewEmpty')}</div>`;
    list.forEach((tx) => {
      html += `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>${esc(txTitle(tx))}</b>${txAmountHtml(tx)}</div>
        ${tx.raw ? `<div class="raw" style="background:var(--card2)">${esc(tx.raw)}</div>` : ''}
        <div class="t2" style="color:var(--muted);font-size:12.5px;margin-bottom:8px">${esc(dayLabel(dayOf(tx)))} ${esc(timeLabel(tx.date))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" data-act="confirmTx" data-id="${tx.id}">${t('confirmOk')}</button><button class="btn small secondary" data-act="editTx" data-id="${tx.id}">${t('edit')}</button><button class="btn small danger" data-act="delTx" data-id="${tx.id}">${t('notMoney')}</button></div></div>`;
    });
    return html;
  };

  PAGES.goals = function () {
    let html = header(t('goals'), { back: true, right: `<button class="iconbtn" data-act="newGoal">${ICONS.plus}</button>` });
    if (!S.goals.length) return html + `<div class="card empty"><span class="e">🎯</span>${t('noGoals')}<br><br><button class="btn small" data-act="newGoal">${t('addGoal')}</button></div>`;
    S.goals.forEach((g) => {
      const pct = g.target ? Math.min(100, (g.saved / g.target) * 100) : 0;
      let need = '';
      if (g.saved >= g.target && g.target) need = t('goalDone');
      else if (g.deadline) {
        const months = Math.max(1, MT.monthsBetween(MT.monthKey(todayYmd()), MT.monthKey(g.deadline)) + 1);
        need = t('perMonthNeeded', { m: moneyText((g.target - g.saved) / months, 'EGP') }) + ' • ' + shortDate(g.deadline);
      }
      html += `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><button style="text-align:start;font-weight:700;font-size:17px" data-act="editGoal" data-id="${g.id}">${esc(g.icon || '🎯')} ${esc(g.name)}</button><button class="copy" data-act="goalAdd" data-id="${g.id}">+ ${t('addMoney')}</button></div>
        <div class="progress"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div style="display:flex;justify-content:space-between;font-size:14px"><span>${money(g.saved, 'EGP')} / ${money(g.target, 'EGP')}</span><span style="color:var(--muted)">${pct.toFixed(0)}%</span></div>
        ${need ? `<div class="t2" style="color:var(--muted);font-size:13px;margin-top:4px">${esc(need)}</div>` : ''}</div>`;
    });
    return html;
  };

  PAGES.debts = function () {
    let html = header(t('debts'), { back: true, right: `<button class="iconbtn" data-act="newDebt">${ICONS.plus}</button>` });
    const open = S.debts.filter((d) => !d.settled);
    const mine = open.filter((d) => d.direction === 'owedToMe').reduce((a, d) => a + d.amount, 0);
    const theirs = open.filter((d) => d.direction !== 'owedToMe').reduce((a, d) => a + d.amount, 0);
    html += `<div class="tiles" style="grid-template-columns:1fr 1fr"><div class="tile"><div class="k">${t('totalOwedToMe')}</div><div class="v in">${money(mine, 'EGP')}</div></div><div class="tile"><div class="k">${t('totalIOwe')}</div><div class="v out">${money(theirs, 'EGP')}</div></div></div>`;
    if (!S.debts.length) return html + `<div class="card empty"><span class="e">🤝</span>${t('noDebts')}</div>`;
    const row = (d) => `<button class="row" data-act="editDebt" data-id="${d.id}"><span class="bubble">${d.direction === 'owedToMe' ? '📥' : '📤'}</span><span class="mid"><div class="t1">${esc(d.person)}${d.settled ? `<span class="badge green">${t('settled')}</span>` : ''}</div><div class="t2">${esc([d.direction === 'owedToMe' ? t('owedToMe') : t('iOwe'), d.date ? shortDate(d.date) : '', d.note].filter(Boolean).join(' • '))}</div></span><div class="amt ${d.direction === 'owedToMe' ? 'in' : 'out'}">${money(d.amount, 'EGP')}</div></button>`;
    html += `<div class="list">${open.map(row).join('')}</div>`;
    const done = S.debts.filter((d) => d.settled);
    if (done.length) html += `<div class="section-title">${t('settled')}</div><div class="list">${done.map(row).join('')}</div>`;
    return html;
  };

  PAGES.gameya = function () {
    let html = header(t('gameya'), { back: true, right: `<button class="iconbtn" data-act="newGameya">${ICONS.plus}</button>` });
    if (!S.gameyas.length) return html + `<div class="card empty"><span class="e">👥</span>${t('noGameya')}<br><br><button class="btn small" data-act="newGameya">${t('addGameya')}</button></div>`;
    const month = MT.monthKey(todayYmd());
    S.gameyas.forEach((g) => {
      const idx = MT.monthsBetween(g.startMonth, month) + 1;
      const due = idx >= 1 && idx <= g.months && g.paid < idx;
      const turnMonth = MT.monthKey(MT.addMonthsClamped(g.startMonth + '-01', Math.max(0, g.myTurn - 1)));
      html += `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><button style="text-align:start;font-weight:700;font-size:17px" data-act="editGameya" data-id="${g.id}">👥 ${esc(g.name)}</button>${due ? `<span class="badge warn">${t('dueNow')}</span>` : ''}</div>
        <div class="progress"><i style="width:${Math.min(100, (g.paid / Math.max(1, g.months)) * 100).toFixed(1)}%"></i></div>
        <div style="font-size:14px;display:flex;justify-content:space-between"><span>${g.paid}/${g.months} • ${money(g.monthly, 'EGP')}</span><span style="color:var(--muted)">${esc(t('myTurnIs', { m: monthLabel(turnMonth), amt: moneyText(g.monthly * g.months, 'EGP') }))}</span></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">${g.paid < g.months ? `<button class="btn small" data-act="gameyaPay" data-id="${g.id}">${t('payInstallment')}</button>` : ''}${!g.received ? `<button class="btn small secondary" data-act="gameyaGet" data-id="${g.id}">${t('gotPayout')}</button>` : `<span class="badge green">${t('received')} ✓</span>`}</div></div>`;
    });
    return html;
  };

  PAGES.settings = function () {
    const r = rates();
    let html = header(t('settings'), { back: true });
    const s = S.settings;
    html += `<div class="field"><label>${t('monthlyIncome')}</label><input data-set="monthlyIncome" inputmode="decimal" value="${esc(s.monthlyIncome || '')}" placeholder="0"><div class="hint">${t('monthlyIncomeHint')}</div></div>
      <div class="field"><label>${t('payday')}</label><input data-set="payday" inputmode="numeric" value="${esc(s.payday || '')}" placeholder="—"><div class="hint">${t('paydayHint')}</div></div>
      <div class="field"><label>${t('savingsTarget')}</label><input data-set="savingsTarget" inputmode="decimal" value="${esc(s.savingsTarget || '')}" placeholder="0"></div>
      <div class="field"><label>${t('usdRate')}</label><input data-set="usdRateManual" inputmode="decimal" value="${esc(s.usdRateManual || '')}" placeholder="${nf(MT.toNum(S.rates && S.rates.USD) || r.USD, 2)}"><div class="hint">${t('usdRateHint', { r: nf(MT.toNum(S.rates && S.rates.USD) || r.USD, 2) })}</div></div>
      <div class="field"><label>${t('remindDays')}</label><input data-set="remindDays" inputmode="numeric" value="${esc(s.remindDays || '2')}"></div>`;
    if (isRemote()) html += `<div class="field toggle"><div><label>${t('emailReminders')}</label></div><span class="switch"><input type="checkbox" data-settoggle="emailReminders" ${s.emailReminders !== 'off' ? 'checked' : ''}><span></span></span></div>`;
    html += `<div class="section-title">${LANG === 'en' ? 'This phone' : 'الموبايل ده'}</div>
      <div class="seg" style="margin-bottom:10px"><button class="${LANG === 'ar' ? 'on' : ''}" data-lang="ar">العربي</button><button class="${LANG === 'en' ? 'on' : ''}" data-lang="en">English</button></div>
      <div class="field toggle"><div><label>${t('faceId')}</label><div class="hint">${t('faceIdHint')}</div></div><span class="switch"><input type="checkbox" id="lockToggle" ${LS.get('mt.lock', null) ? 'checked' : ''}><span></span></span></div>`;
    return html;
  };

  PAGES.connection = function () {
    const c = conn() || {};
    let html = header(t('connTitle'), { back: true });
    html += `<div class="banner info"><span class="em">${isRemote() ? '✅' : '📱'}</span><span><b>${isRemote() ? t('connected') : t('localMode')}</b>${isRemote() && S.syncedAt ? (LANG === 'en' ? 'Last sync ' : 'آخر مزامنة ') + esc(timeLabel(S.syncedAt)) : ''}</span></div>
      <div class="field"><label>${t('webAppUrl')}</label><input id="cUrl" value="${esc(c.url || '')}" placeholder="https://script.google.com/macros/s/…/exec" autocapitalize="off" autocorrect="off" spellcheck="false" dir="ltr"></div>
      <div class="field"><label>${t('token')}</label><input id="cTok" value="${esc(c.token || '')}" autocapitalize="off" autocorrect="off" spellcheck="false" dir="ltr"></div>
      <button class="btn" data-act="connect">${t('connect')}</button>
      ${isRemote() ? `<button class="btn danger" data-act="disconnect">${t('disconnect')}</button>` : ''}
      <div class="card guide" style="margin-top:16px"><h4 style="margin-top:0">${LANG === 'en' ? 'Set up the Sheet (once, ~5 min)' : 'إعداد الـ Sheet (مرة واحدة، 5 دقايق)'}</h4><ol>
        <li>افتح <b>sheets.new</b> على اللابتوب واعمل Sheet جديد اسمه Money Tracker.</li>
        <li>من فوق: <b>Extensions ← Apps Script</b>، امسح الكود اللي هناك والصق ملف <code>MoneyTracker.gs</code> كله، ودوس 💾.</li>
        <li>اختار <b>setup</b> من فوق ودوس <b>Run</b>، ووافق على الصلاحيات (Advanced ← Go to Money Tracker).</li>
        <li><b>Deploy ← New deployment</b> ← النوع <b>Web app</b>، Execute as: <b>Me</b>، Who has access: <b>Anyone</b> ← Deploy، وانسخ الـ <b>Web app URL</b>.</li>
        <li>التوكن هتلاقيه في تاب <b>Settings</b> جوه الـ Sheet (سطر token). الصق الاتنين هنا ودوس وصّل.</li></ol></div>`;
    return html;
  };

  PAGES.shortcuts = function () {
    const c = conn() || {};
    const url = c.url || '';
    const tok = c.token || '';
    const getUrl = url ? `${url}?token=${encodeURIComponent(tok)}&action=reminders&format=text` : '';
    const copyRow = (label, val) => `<span class="k">${label}</span><span style="display:flex;gap:6px;align-items:center;min-width:0"><code style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(val || '—')}</code>${val ? `<button class="copy" data-copy="${esc(val)}">${LANG === 'en' ? 'Copy' : 'نسخ'}</button>` : ''}</span>`;
    const body = (fields) => `<div class="kv">${fields.map(([k, v]) => `<span class="k" dir="ltr">${k}</span><span>${v}</span>`).join('')}</div>`;
    const base = [['token', `<code>${esc(tok ? tok.slice(0, 6) + '…' : 'التوكن')}</code> (${LANG === 'en' ? 'paste it' : 'الصقه'})`], ['format', '<code>text</code>']];
    let html = header('⚡️ ' + (LANG === 'en' ? 'Auto-logging' : 'التسجيل التلقائي'), { back: true, sub: 'كل اختصار بيبعت العملية للـ Sheet، والـ app بيدمج المكرر لوحده.' });
    if (!isRemote()) html += `<button class="banner" data-go="connection"><span class="em">🔗</span><span><b>وصّل بالـ Google Sheet الأول</b>الاختصارات بتبعت للـ Sheet، فلازم يكون متوصل.</span></button>`;
    html += `<div class="card"><div class="kv">${copyRow('URL', url)}${copyRow('token', tok)}</div><button class="btn small secondary" data-act="ping">${LANG === 'en' ? 'Test connection' : 'جرّب الاتصال'}</button></div>`;
    html += `<div class="guide">
      <div class="card"><h4 style="margin-top:0">1) Apple Pay — لوحده مع كل دفعة </h4><ol>
        <li>افتح <b>Shortcuts (الاختصارات)</b> ← تحت <b>Automation</b> ← <b>+</b> ← <b>Transaction</b>.</li>
        <li>اختار كروتك (بنك مصر وRedotPay)، وسيب باقي الاختيارات زي ما هي.</li>
        <li>اختار <b>Run Immediately</b> ← <b>Next</b> ← <b>New Blank Automation</b>.</li>
        <li>ضيف <b>Get Contents of URL</b> والصق الـ URL. دوس على السهم ﹥ واختار Method <b>POST</b> وRequest Body <b>JSON</b>، وضيف الحقول دي (كلها Text):</li></ol>
        ${body(base.concat([['action', '<code>applepay</code>'], ['amount', 'Shortcut Input ← <b>Amount</b>'], ['merchant', 'Shortcut Input ← <b>Merchant</b>'], ['card', 'Shortcut Input ← <b>Card or Pass</b>']]))}
        <ol start="5"><li>(اختياري) ضيف <b>Show Notification</b> واختار <b>Contents of URL</b> — هيطلعلك ✅ بعد كل دفعة.</li></ol>
        <div class="hint" style="color:var(--muted);font-size:13px">عشان تختار Amount: دوس على خانة القيمة ← Shortcut Input ← دوس عليها تاني واختار الخاصية.</div></div>

      <div class="card"><h4 style="margin-top:0">2) رسايل البنك وشركة المحمول 📩</h4><ol>
        <li><b>Automation ← + ← Message</b>.</li>
        <li><b>Message Contains</b>: اكتب <code>EGP</code> ← <b>Run Immediately</b> ← Next ← New Blank Automation.</li>
        <li><b>Get Contents of URL</b> بنفس الـ URL، POST، JSON:</li></ol>
        ${body(base.concat([['action', '<code>sms</code>'], ['text', 'Shortcut Input ← <b>Content</b>'], ['sender', 'Shortcut Input ← <b>Sender</b>']]))}
        <ol start="4"><li>(اختياري) <b>Show Notification</b> بـ Contents of URL.</li>
        <li>كرر نفس الأوتوميشن مرتين بكلمة <code>جنيه</code> وكلمة <code>ج.م</code>. لو رسالة جت فيها أكتر من كلمة، الـ app بيسجلها مرة واحدة.</li></ol>
        <div class="field" style="margin-top:10px"><label>جرّب رسالة حقيقية من البنك (مش بتتسجل)</label><textarea id="tryText" placeholder="الصق رسالة من بنك مصر هنا"></textarea></div>
        <button class="btn small secondary" data-act="tryParse">اقرا الرسالة</button><div id="tryOut"></div></div>

      <div class="card"><h4 style="margin-top:0">3) إنستاباي — لما تقفل التطبيق 💸</h4><ol>
        <li><b>Automation ← + ← App</b> ← اختار <b>InstaPay</b> ← <b>Is Closed</b> ← <b>Run Immediately</b> ← New Blank Automation.</li>
        <li>ضيف <b>Choose from Menu</b> والسؤال "عملت إيه في إنستاباي؟" والاختيارات: <b>حولت</b> / <b>جالي</b> / <b>ولا حاجة</b>.</li>
        <li>تحت <b>حولت</b>: <b>Ask for Input</b> (Number) "كام؟" ← <b>Ask for Input</b> (Text) "لمين؟" ← <b>Get Contents of URL</b>:</li></ol>
        ${body(base.concat([['action', '<code>instapay</code>'], ['direction', '<code>sent</code>'], ['amount', 'Provided Input (الأول)'], ['to', 'Provided Input (التاني)']]))}
        <ol start="4"><li>تحت <b>جالي</b>: نفس الخطوات بس <code>direction</code> = <code>received</code>. و"ولا حاجة" سيبها فاضية.</li></ol>
        <div class="hint" style="color:var(--muted);font-size:13px">لو رسالة البنك جت بعدها، بتتدمج مع اللي سجلته ومش بتتحسب مرتين.</div></div>

      <div class="card"><h4 style="margin-top:0">4) إيصال أو سكرين شوت 🧾</h4><ol>
        <li>في <b>Shortcuts</b> ← <b>+</b> اختصار جديد اسمه <b>سجّل إيصال</b>.</li>
        <li>من ⓘ فعّل <b>Show in Share Sheet</b> وخليه يستقبل <b>Images</b>.</li>
        <li>ضيف <b>Extract Text from Image</b> (على Shortcut Input) ← <b>Get Contents of URL</b>:</li></ol>
        ${body(base.concat([['action', '<code>receipt</code>'], ['text', '<b>Text</b> (من Extract Text)']]))}
        <ol start="4"><li>الاستخدام: من إيصال إنستاباي أو أي صورة ← Share ← <b>سجّل إيصال</b>.</li></ol></div>

      <div class="card"><h4 style="margin-top:0">5) كاش بصوتك 🎙️</h4><ol>
        <li>اختصار جديد اسمه <b>Log expense</b>.</li>
        <li>ضيف <b>Dictate Text</b> (أو Ask for Input لو عايز تكتب) ← <b>Get Contents of URL</b>:</li></ol>
        ${body(base.concat([['action', '<code>quick</code>'], ['text', '<b>Dictated Text</b>']]))}
        <ol start="3"><li>شغّله بـ "Hey Siri, log expense"، أو <b>Back Tap</b> (Settings ← Accessibility ← Touch ← Back Tap ← Double Tap)، أو زرار الأكشن.</li></ol>
        <div class="hint" style="color:var(--muted);font-size:13px">أمثلة: "60 كشري" • "uber 85 بنك" • "+500 مصروف من بابا" • "شحنت رصيد 50" • "20 دولار ريدوت".</div></div>

      <div class="card"><h4 style="margin-top:0">6) تذكير الاشتراكات كل يوم 🔔</h4><ol>
        <li><b>Automation ← + ← Time of Day</b> الساعة 9 الصبح، Daily، <b>Run Immediately</b>.</li>
        <li><b>Get Contents of URL</b> بالرابط ده (من غير POST):</li></ol>
        <div class="kv">${copyRow('URL', getUrl)}</div>
        <ol start="3"><li><b>If</b> Contents of URL <b>has any value</b> ← <b>Show Notification</b> بيها.</li></ol>
        <div class="hint" style="color:var(--muted);font-size:13px">والـ Sheet كمان بيبعتلك إيميل بنفس التذكير، وملخص الشهر يوم 1.</div></div>
    </div>`;
    return html;
  };

  // ================================================================ sheets (bottom modals)
  let openSheets = 0;
  function openSheet(o) {
    const host = $('#sheets');
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="grab"></div><div class="sheet-head"><button data-sh="cancel">${esc(o.left || t('cancel'))}</button><h2>${esc(o.title || '')}</h2>${o.right ? `<button class="primary" data-sh="ok">${esc(o.right)}</button>` : '<span style="min-width:64px"></span>'}</div><div class="sheet-body">${o.body || ''}</div>`;
    host.appendChild(scrim);
    host.appendChild(sh);
    openSheets++;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => { scrim.classList.add('in'); sh.classList.add('in'); });
    const api = { el: sh, body: $('.sheet-body', sh), onOk: null, close };
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      sh.classList.remove('in');
      scrim.classList.remove('in');
      openSheets = Math.max(0, openSheets - 1);
      if (!openSheets) document.body.style.overflow = '';
      setTimeout(() => { scrim.remove(); sh.remove(); }, 300);
    }
    scrim.onclick = close;
    $('[data-sh=cancel]', sh).onclick = close;
    if (o.right) $('[data-sh=ok]', sh).onclick = () => api.onOk && api.onOk();
    return api;
  }

  function fieldHtml(f, v) {
    const hint = f.hint ? `<div class="hint">${esc(f.hint)}</div>` : '';
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
    switch (f.type) {
      case 'toggle':
        return `<div class="field toggle" data-f="${f.k}"><div><label>${esc(f.label)}</label>${hint}</div><span class="switch"><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}><span></span></span></div>`;
      case 'select':
        return `<div class="field" data-f="${f.k}"><label>${esc(f.label)}</label><div class="select-wrap"><select name="${f.k}">${f.options.map((o) => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></div>${hint}</div>`;
      case 'textarea':
        return `<div class="field" data-f="${f.k}"><label>${esc(f.label)}</label><textarea name="${f.k}"${ph}>${esc(v)}</textarea>${hint}</div>`;
      case 'number':
        return `<div class="field" data-f="${f.k}"><label>${esc(f.label)}</label><input name="${f.k}" inputmode="decimal" value="${v === 0 || v === '' || v == null ? '' : esc(v)}"${ph || ' placeholder="0"'}>${hint}</div>`;
      case 'date': case 'month':
        return `<div class="field" data-f="${f.k}"><label>${esc(f.label)}</label><input type="${f.type}" name="${f.k}" value="${esc(v || '')}">${hint}</div>`;
      default:
        return `<div class="field" data-f="${f.k}"><label>${esc(f.label)}</label><input name="${f.k}" value="${esc(v)}" autocomplete="off"${ph}${f.ltr ? ' dir="ltr"' : ''}>${hint}</div>`;
    }
  }
  function formSheet(o) {
    const vals = o.values || {};
    const body = o.fields.map((f) => fieldHtml(f, vals[f.k])).join('') + (o.extra || '') +
      (o.onDelete ? `<button class="btn danger" data-del>${esc(o.deleteLabel || t('delete'))}</button>` : '');
    const sh = openSheet({ title: o.title, right: t('save'), body });
    sh.onOk = () => {
      const v = {};
      o.fields.forEach((f) => {
        const el = $(`[name="${f.k}"]`, sh.body);
        if (!el) return;
        if (f.type === 'toggle') v[f.k] = el.checked;
        else if (f.type === 'number') v[f.k] = MT.toNum(el.value);
        else v[f.k] = el.value.trim();
      });
      if (o.onSave(v) !== false) sh.close();
    };
    if (o.onDelete) $('[data-del]', sh.body).onclick = () => { if (confirm(t('confirmDelete'))) { o.onDelete(); sh.close(); } };
    if (o.onMount) o.onMount(sh);
    return sh;
  }
  const acctOptions = (blank) => (blank ? [{ v: '', l: '—' }] : []).concat(spendAccounts().map((a) => ({ v: a.id, l: a.icon + ' ' + a.name })));
  const catOptions = (kind) => S.categories.filter((c) => c.kind === kind).map((c) => ({ v: c.id, l: c.icon + ' ' + catLabel(c) }));

  // ---------------------------------------------------------------- transaction editor
  function txSheet(existing, preset) {
    const isNew = !existing;
    const accts = spendAccounts();
    const d = existing ? Object.assign({}, existing) : Object.assign({
      id: MT.uid('t'), date: new Date().toISOString(), type: 'expense', amount: 0, currency: 'EGP',
      accountId: (kindAcct('cash') || accts[0] || {}).id || '', toAccountId: '', toAmount: 0, fee: 0, categoryId: '',
      merchant: '', note: '', source: 'manual', sources: 'manual', status: 'ok'
    }, preset || {});
    let catTouched = !isNew && !!d.categoryId;
    const origCat = d.categoryId;
    const body = `
      ${isNew ? `<div class="quick"><span class="q-ic">⚡️</span><input id="q" placeholder="${esc(t('quickPh'))}" autocomplete="off"></div>` : ''}
      <div class="seg" id="seg">${['expense', 'income', 'transfer', 'refund'].map((k) => `<button data-type="${k}">${t('type_' + k)}</button>`).join('')}</div>
      <div class="amount-box" id="ab"><div class="row2"><input id="amt" inputmode="decimal" placeholder="0" value="${d.amount ? d.amount : ''}" autocomplete="off"><button class="cur" id="cur"></button></div></div>
      <div id="acctPart"></div>
      <div id="catPart"></div>
      <div class="field" id="merchF"><label id="merchLbl"></label><input id="merch" value="${esc(d.merchant)}" autocomplete="off"></div>
      <div class="field"><label>${t('note')}</label><input id="note" value="${esc(d.note)}" autocomplete="off"></div>
      <div class="field"><label>${t('when')}</label><input id="when" type="datetime-local" value="${toLocalInput(d.date)}"></div>
      <div class="field" id="feeF"><label>${t('fee')}</label><input id="fee" inputmode="decimal" value="${d.fee || ''}" placeholder="0"></div>
      ${d.raw ? `<div class="lbl-out">${t('origMsg')}</div><div class="raw">${esc(d.raw)}</div>` : ''}
      ${!isNew ? `<div class="lbl-out">${t('sources')}: ${sourceBadges(d)}</div>` : ''}
      ${d.status === 'review' ? `<button class="btn" id="confirmBtn">${t('confirmOk')}</button>` : ''}
      ${!isNew ? `<button class="btn danger" id="delBtn">${t('delete')}</button>` : ''}`;
    const sh = openSheet({ title: isNew ? t('newTx') : t('editTx'), right: t('save'), body });
    const B = sh.body;

    function chipsAcct(sel, attr) {
      return `<div class="chips">${accts.map((a) => `<button class="chip ${sel === a.id ? 'on' : ''}" ${attr}="${a.id}">${esc(a.icon)} ${esc(a.name)}</button>`).join('')}</div>`;
    }
    function autoCat() {
      if (catTouched || d.type === 'transfer') return;
      d.categoryId = MT.categorize(d.merchant + ' ' + d.note, d.type === 'income' ? 'income' : 'expense', S.categories, S.settings);
    }
    function renderParts() {
      $$('#seg button', B).forEach((b) => b.classList.toggle('on', b.dataset.type === d.type));
      $('#ab', B).className = 'amount-box ' + (d.type === 'transfer' ? 'xfer' : d.type === 'income' || d.type === 'refund' ? 'in' : 'out');
      $('#cur', B).textContent = d.currency;
      const from = accById(d.accountId), to = accById(d.toAccountId);
      if (d.type === 'transfer') {
        const diffCur = from && to && from.currency !== to.currency;
        $('#acctPart', B).innerHTML = `<div class="lbl-out">${t('from')}</div>${chipsAcct(d.accountId, 'data-from')}<div class="lbl-out">${t('to')}</div>${chipsAcct(d.toAccountId, 'data-to')}` +
          (diffCur ? `<div class="field"><label>${t('toAmount')} (${esc(to.currency)})</label><input id="toAmt" inputmode="decimal" value="${d.toAmount || ''}" placeholder="0"></div>` : '');
        $('#catPart', B).innerHTML = '';
      } else {
        $('#acctPart', B).innerHTML = `<div class="lbl-out">${t('account')}</div>${chipsAcct(d.accountId, 'data-from')}`;
        const kind = d.type === 'income' ? 'income' : 'expense';
        const cats = S.categories.filter((c) => c.kind === kind).sort((a, b) => a.order - b.order);
        $('#catPart', B).innerHTML = `<div class="lbl-out">${t('category')}</div><div class="chips cats">${cats.map((c) => `<button class="chip ${d.categoryId === c.id ? 'on' : ''}" data-cat="${c.id}"><span class="e">${esc(c.icon)}</span>${esc(catLabel(c))}</button>`).join('')}</div>`;
      }
      $('#merchLbl', B).textContent = d.type === 'income' ? t('whereFrom') : d.type === 'transfer' ? t('whatFor') : t('whereSpent');
      $('#merchF', B).classList.toggle('hidden', d.type === 'transfer');
      $('#feeF', B).classList.toggle('hidden', !(d.type === 'transfer' || d.type === 'expense'));
    }
    renderParts();

    B.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.type) {
        d.type = b.dataset.type;
        if (d.type === 'transfer' && !d.toAccountId) {
          const other = accts.find((a) => a.id !== d.accountId);
          d.toAccountId = other ? other.id : '';
        }
        if (!catTouched || (catById(d.categoryId) || {}).kind !== (d.type === 'income' ? 'income' : 'expense')) { catTouched = false; autoCat(); }
        renderParts();
      } else if (b.dataset.from) {
        d.accountId = b.dataset.from;
        const a = accById(d.accountId);
        if (a && isNew) d.currency = a.currency;
        renderParts();
      } else if (b.dataset.to) {
        d.toAccountId = b.dataset.to;
        renderParts();
      } else if (b.dataset.cat) {
        d.categoryId = b.dataset.cat;
        catTouched = true;
        renderParts();
      } else if (b.id === 'cur') {
        d.currency = d.currency === 'EGP' ? 'USD' : 'EGP';
        renderParts();
      } else if (b.id === 'delBtn') {
        if (confirm(t('confirmDelete'))) { act({ action: 'remove', table: 'transactions', id: d.id }); sh.close(); toast(t('deleted')); }
      } else if (b.id === 'confirmBtn') {
        d.status = 'ok';
        doSave();
      }
    });
    $('#amt', B).addEventListener('input', (e) => { d.amount = MT.toNum(e.target.value); });
    $('#merch', B).addEventListener('input', (e) => { d.merchant = e.target.value; autoCat(); renderParts(); });
    $('#note', B).addEventListener('input', (e) => { d.note = e.target.value; if (!d.merchant) { autoCat(); renderParts(); } });
    const q = $('#q', B);
    if (q) {
      q.addEventListener('input', () => {
        const p = MT.parseQuick(q.value);
        if (!p) return;
        d.amount = p.amount;
        d.currency = p.currency;
        $('#amt', B).value = p.amount;
        if (p.type === 'topup') {
          d.type = 'transfer';
          d.toAccountId = (kindAcct('phone') || {}).id || '';
          d.accountId = ((p.accountKind && kindAcct(p.accountKind)) || kindAcct('cash') || {}).id || d.accountId;
          d.note = p.note;
          $('#note', B).value = p.note;
        } else {
          d.type = p.type;
          const a = p.accountKind ? kindAcct(p.accountKind) : kindAcct('cash');
          if (a) d.accountId = a.id;
          if (p.accountKind === 'card' && a) d.currency = p.currency === 'USD' ? 'USD' : a.currency;
          d.merchant = p.note;
          $('#merch', B).value = p.note;
          catTouched = false;
          autoCat();
        }
        renderParts();
      });
      setTimeout(() => q.focus(), 350);
    }
    function doSave() {
      d.amount = MT.toNum($('#amt', B).value);
      if (!(d.amount > 0)) { toast(t('needAmount')); return; }
      if (d.type === 'transfer' && (!d.toAccountId || d.toAccountId === d.accountId)) { toast(t('needTo')); return; }
      d.merchant = $('#merch', B).value.trim();
      d.note = $('#note', B).value.trim();
      d.date = fromLocalInput($('#when', B).value);
      d.fee = MT.toNum($('#fee', B).value);
      const from = accById(d.accountId), to = accById(d.toAccountId);
      if (d.type === 'transfer') {
        d.categoryId = '';
        const toEl = $('#toAmt', B);
        if (from && to && from.currency !== to.currency) {
          d.toAmount = toEl && MT.toNum(toEl.value) > 0 ? MT.toNum(toEl.value)
            : MT.round2(d.amount * MT.rateFor(d.currency, rates()) / MT.rateFor(to.currency, rates()));
        } else d.toAmount = d.amount;
      } else {
        d.toAccountId = '';
        d.toAmount = 0;
        if (!d.categoryId) { catTouched = false; autoCat(); }
      }
      if (isNew || !d.rate || (existing && existing.currency !== d.currency)) d.rate = MT.rateFor(d.currency, rates());
      if (d.status === 'review' && !existing) d.status = 'ok';
      act({ action: 'upsert', table: 'transactions', row: d }, { noRender: true });
      const key = d.merchant || '';
      if (key && catTouched && d.categoryId && d.categoryId !== origCat && d.type !== 'transfer') {
        const map = MT.learnMerchant(S.settings, key, d.categoryId);
        if (map) act({ action: 'upsert', table: 'settings', row: { key: 'merchantMap', value: map } }, { noRender: true });
      }
      render();
      sh.close();
      toast(t('saved'));
    }
    sh.onOk = doSave;
    return sh;
  }

  // ---------------------------------------------------------------- other editors
  function subSheet(existing) {
    const s = existing || { id: '', name: '', amount: 0, currency: 'EGP', cycle: 'monthly', nextDate: MT.addMonthsClamped(todayYmd(), 1), accountId: (kindAcct('phone') || {}).id || '', categoryId: 'subs', active: true, autoLog: true, trialEnds: '', unused: false, notes: '', lastAmount: 0 };
    formSheet({
      title: existing ? t('editSub') : t('addSub'),
      values: s,
      fields: [
        { k: 'name', label: t('subName'), placeholder: 'Netflix, Spotify, iCloud…' },
        { k: 'amount', label: t('amount'), type: 'number' },
        { k: 'currency', label: t('currency'), type: 'select', options: [{ v: 'EGP', l: 'EGP ج.م' }, { v: 'USD', l: 'USD $' }] },
        { k: 'cycle', label: t('cycle'), type: 'select', options: ['monthly', 'yearly', 'quarterly', 'weekly'].map((c) => ({ v: c, l: t('c_' + c) })) },
        { k: 'nextDate', label: t('nextDate'), type: 'date' },
        { k: 'accountId', label: t('payWith'), type: 'select', options: acctOptions(true) },
        { k: 'categoryId', label: t('category'), type: 'select', options: catOptions('expense') },
        { k: 'autoLog', label: t('autoLog'), type: 'toggle', hint: t('autoLogHint') },
        { k: 'trialEnds', label: t('trialEnds'), type: 'date' },
        { k: 'unused', label: t('unused'), type: 'toggle', hint: t('unusedHint') },
        { k: 'active', label: t('active'), type: 'toggle', hint: t('activeHint') },
        { k: 'notes', label: t('notes') }
      ],
      onSave: (v) => {
        if (!v.name || !(v.amount > 0)) { toast(t('needAmount')); return false; }
        const row = Object.assign({}, s, v);
        if (existing && existing.amount !== v.amount) row.lastAmount = existing.amount;
        if (!row.nextDate) row.nextDate = todayYmd();
        act({ action: 'upsert', table: 'subscriptions', row });
        toast(t('saved'));
      },
      onDelete: existing ? () => act({ action: 'remove', table: 'subscriptions', id: s.id }) : null
    });
  }

  function accountSheet(existing) {
    const bal = MT.balances(S.accounts, S.transactions, dayOf);
    const a = existing || { id: '', name: '', kind: 'bank', currency: 'EGP', opening: 0, openingDate: todayYmd(), match: '', icon: '💳', color: '', archived: false, order: S.accounts.length + 1 };
    const cur = existing ? (bal[a.id] || 0) : 0;
    formSheet({
      title: existing ? t('editAccount') : t('addAccount'),
      values: Object.assign({}, a, { current: cur }),
      fields: [
        { k: 'name', label: t('name') },
        { k: 'icon', label: t('icon'), placeholder: '🏦' },
        { k: 'kind', label: t('kind'), type: 'select', options: ['bank', 'cash', 'phone', 'card', 'wallet', 'savings'].map((k) => ({ v: k, l: t('k_' + k) })) },
        { k: 'currency', label: t('currency'), type: 'select', options: [{ v: 'EGP', l: 'EGP ج.م' }, { v: 'USD', l: 'USD $' }] },
        { k: 'current', label: t('currentBalance'), type: 'number', hint: t('currentBalanceHint') },
        { k: 'match', label: t('matchWords'), type: 'textarea', hint: t('matchHint') },
        { k: 'archived', label: t('archived'), type: 'toggle' }
      ],
      onSave: (v) => {
        if (!v.name) return false;
        const row = Object.assign({}, a, v);
        delete row.current;
        row.opening = MT.round2((a.opening || 0) + (v.current - cur));
        act({ action: 'upsert', table: 'accounts', row });
        toast(t('saved'));
      },
      extra: existing ? `<button class="btn secondary" data-check>${t('checkBalance')}</button>` : '',
      onMount: (sh) => { const b = $('[data-check]', sh.body); if (b) b.onclick = () => { sh.close(); checkSheet(a.id); }; },
      onDelete: existing && !S.transactions.some((x) => x.accountId === a.id || x.toAccountId === a.id) ? () => act({ action: 'remove', table: 'accounts', id: a.id }) : null
    });
  }

  function checkSheet(accountId, presetActual) {
    const a = accById(accountId);
    if (!a) return;
    const expected = MT.balances(S.accounts, S.transactions, dayOf)[a.id] || 0;
    const body = `<div class="card breakdown"><div class="line"><span>${t('appSays')}</span><b>${money(expected, a.currency)}</b></div></div>
      <div class="field"><label>${t('actualIs')}</label><input id="actual" inputmode="decimal" value="${presetActual != null ? presetActual : ''}" placeholder="${nf(expected)}"></div>
      <div class="card breakdown"><div class="line total"><span>${t('diffIs')}</span><span id="diff">—</span></div></div>
      <button class="btn" id="adj">${t('logAsUntracked')}</button><button class="btn secondary" id="rec">${t('justRecord')}</button>`;
    const sh = openSheet({ title: t('checkTitle', { acct: a.name }), body });
    const inp = $('#actual', sh.body);
    const upd = () => {
      if (!inp.value) { $('#diff', sh.body).textContent = '—'; return; }
      const diff = MT.round2(MT.toNum(inp.value) - expected);
      $('#diff', sh.body).innerHTML = Math.abs(diff) < 0.01 ? t('matches') : money(diff, a.currency, { sign: true });
    };
    inp.addEventListener('input', upd);
    upd();
    const run = (adjust) => {
      if (!inp.value) { toast(t('needAmount')); return; }
      act({ action: 'check', accountId: a.id, actual: MT.toNum(inp.value), adjust });
      const raw = S.settings['reported:' + a.id];
      if (raw) { try { const rep = JSON.parse(raw); rep.dismissed = true; act({ action: 'upsert', table: 'settings', row: { key: 'reported:' + a.id, value: JSON.stringify(rep) } }); } catch (e) { /* ignore */ } }
      sh.close();
      toast(t('saved'));
    };
    $('#adj', sh.body).onclick = () => run(true);
    $('#rec', sh.body).onclick = () => run(false);
    if (presetActual == null) setTimeout(() => inp.focus(), 350);
  }

  function catSheet(existing) {
    const c = existing || { id: '', name: '', nameEn: '', kind: 'expense', icon: '🏷️', color: '', budget: 0, keywords: '', order: 50 };
    formSheet({
      title: existing ? t('editCat') : t('addCat'),
      values: c,
      fields: [
        { k: 'name', label: t('name') }, { k: 'nameEn', label: t('nameEn'), ltr: true }, { k: 'icon', label: t('icon') },
        { k: 'kind', label: t('kind'), type: 'select', options: [{ v: 'expense', l: t('k_expense') }, { v: 'income', l: t('k_income') }] },
        { k: 'budget', label: t('budget'), type: 'number', hint: t('budgetHint') },
        { k: 'keywords', label: t('keywords'), type: 'textarea', hint: t('keywordsHint') }
      ],
      onSave: (v) => {
        if (!v.name) return false;
        act({ action: 'upsert', table: 'categories', row: Object.assign({}, c, v) });
        toast(t('saved'));
      },
      onDelete: existing && ['other', 'income-other', 'untracked', 'fees', 'subs'].indexOf(c.id) < 0 ? () => act({ action: 'remove', table: 'categories', id: c.id }) : null
    });
  }

  function goalSheet(existing) {
    const g = existing || { id: '', name: '', target: 0, saved: 0, deadline: '', icon: '🎯' };
    formSheet({
      title: existing ? t('edit') : t('addGoal'), values: g,
      fields: [{ k: 'name', label: t('name') }, { k: 'icon', label: t('icon') }, { k: 'target', label: t('target'), type: 'number' }, { k: 'saved', label: t('savedSoFar'), type: 'number' }, { k: 'deadline', label: t('deadline'), type: 'date' }],
      onSave: (v) => { if (!v.name) return false; act({ action: 'upsert', table: 'goals', row: Object.assign({}, g, v) }); toast(t('saved')); },
      onDelete: existing ? () => act({ action: 'remove', table: 'goals', id: g.id }) : null
    });
  }
  function amountPrompt(title, onSave) {
    const sh = openSheet({ title, right: t('save'), body: `<div class="amount-box"><div class="row2"><input id="pa" inputmode="decimal" placeholder="0"></div></div>` });
    setTimeout(() => $('#pa', sh.body).focus(), 350);
    sh.onOk = () => { const v = MT.toNum($('#pa', sh.body).value); if (!(v > 0)) { toast(t('needAmount')); return; } onSave(v); sh.close(); };
  }
  function debtSheet(existing) {
    const d = existing || { id: '', person: '', amount: 0, direction: 'owedToMe', note: '', date: todayYmd(), settled: false };
    formSheet({
      title: existing ? t('edit') : t('addDebt'), values: d,
      fields: [{ k: 'person', label: t('person') }, { k: 'direction', label: t('direction'), type: 'select', options: [{ v: 'owedToMe', l: t('owedToMe') }, { v: 'iOwe', l: t('iOwe') }] },
        { k: 'amount', label: t('amount'), type: 'number' }, { k: 'date', label: t('date'), type: 'date' }, { k: 'note', label: t('note') }, { k: 'settled', label: t('settled'), type: 'toggle' }],
      onSave: (v) => { if (!v.person || !(v.amount > 0)) return false; act({ action: 'upsert', table: 'debts', row: Object.assign({}, d, v) }); toast(t('saved')); },
      onDelete: existing ? () => act({ action: 'remove', table: 'debts', id: d.id }) : null
    });
  }
  function gameyaSheet(existing) {
    const g = existing || { id: '', name: '', monthly: 0, months: 10, startMonth: MT.monthKey(todayYmd()), myTurn: 1, paid: 0, received: false, accountId: (kindAcct('cash') || {}).id || '', notes: '' };
    formSheet({
      title: existing ? t('edit') : t('addGameya'), values: g,
      fields: [{ k: 'name', label: t('name') }, { k: 'monthly', label: t('monthly'), type: 'number' }, { k: 'months', label: t('months'), type: 'number' },
        { k: 'startMonth', label: t('startMonth'), type: 'month' }, { k: 'myTurn', label: t('myTurn'), type: 'number' }, { k: 'paid', label: t('paidCount'), type: 'number' },
        { k: 'accountId', label: t('payFrom'), type: 'select', options: acctOptions(false) }, { k: 'received', label: t('received'), type: 'toggle' }, { k: 'notes', label: t('notes') }],
      onSave: (v) => {
        if (!v.name || !(v.monthly > 0) || !(v.months > 0)) return false;
        const row = Object.assign({}, g, v);
        if (!row.id) row.id = MT.uid('g');
        ensureGameyaAccount(row);
        act({ action: 'upsert', table: 'gameyas', row });
        toast(t('saved'));
      },
      onDelete: existing ? () => act({ action: 'remove', table: 'gameyas', id: g.id }) : null
    });
  }
  function ensureGameyaAccount(g) {
    const id = 'g-' + g.id;
    if (!accById(id)) act({ action: 'upsert', table: 'accounts', row: { id, name: (LANG === 'en' ? 'Gameya: ' : 'جمعية: ') + g.name, kind: 'gameya', currency: 'EGP', opening: 0, openingDate: todayYmd(), icon: '👥', archived: false, order: 90 } }, { noRender: true });
    return id;
  }

  function safeInfo() {
    const r = rates();
    const td = todayYmd();
    const s = MT.safeToSpend({ txs: S.transactions, accounts: S.accounts, subs: S.subscriptions, gameyas: S.gameyas, settings: S.settings, rates: r, today: td, dayOf });
    const line = (k, v, cls) => `<div class="line ${cls || ''}"><span>${k}</span><b>${v}</b></div>`;
    let body = '<div class="card breakdown">';
    if (s.mode === 'income') body += line(t('b_income'), money(s.income, 'EGP')) + line(t('b_spent'), money(-(s.spent - s.spentToday), 'EGP'));
    else {
      const bal = MT.balances(S.accounts, S.transactions, dayOf);
      let liquid = 0;
      MT.activeAccounts(S.accounts).forEach((a) => { if (['bank', 'cash', 'card', 'wallet'].indexOf(a.kind) >= 0) liquid += (bal[a.id] || 0) * MT.rateFor(a.currency, r); });
      body += line(t('b_balance'), money(liquid + s.spentToday, 'EGP'));
    }
    if (s.upcoming) body += line(t('b_upcoming'), money(-s.upcoming, 'EGP'));
    if (s.gameyaDue) body += line(t('b_gameya'), money(-s.gameyaDue, 'EGP'));
    if (s.save) body += line(t('b_save'), money(-s.save, 'EGP'));
    body += line(t('b_days'), s.daysLeft) + line(t('b_perDay'), money(s.perDay, 'EGP'), 'total') + line(t('b_spentToday'), money(-s.spentToday, 'EGP')) + line(t('safeToday'), money(s.leftToday, 'EGP'), 'total');
    body += `</div><button class="btn secondary" data-go-settings>${t('b_tip')}</button>`;
    const sh = openSheet({ title: t('howCalc'), left: t('done'), body });
    $('[data-go-settings]', sh.body).onclick = () => { sh.close(); UI.tab = 'more'; go('settings'); };
  }

  // ================================================================ export
  function exportCsv() {
    const cols = ['date', 'type', 'amount', 'currency', 'account', 'to', 'category', 'merchant', 'note', 'fee', 'status', 'sources'];
    const rows = [cols.join(',')].concat(S.transactions.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map((x) => [
      x.date, x.type, x.amount, x.currency, (accById(x.accountId) || {}).name || '', (accById(x.toAccountId) || {}).name || '',
      catLabel(catById(x.categoryId)), x.merchant, x.note, x.fee, x.status, x.sources
    ].map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')));
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'money-tracker-' + todayYmd() + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast(t('exported'));
  }

  // ================================================================ connection
  async function connect() {
    const url = $('#cUrl').value.trim();
    const token = $('#cTok').value.trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url) || !token) { toast(t('connFail', { e: 'URL / token' })); return; }
    const prev = conn();
    const hadLocal = !isRemote() && S && (S.transactions.length || S.subscriptions.length || S.goals.length || S.debts.length || S.gameyas.length || S.accounts.some((a) => a.opening));
    LS.set('mt.conn', { url, token });
    toast(t('testing'));
    try {
      const res = await api({ action: 'ping' });
      if (!res.ok) throw new Error(res.error || 'error');
    } catch (e) {
      if (prev) LS.set('mt.conn', prev); else LS.del('mt.conn');
      toast(t('connFail', { e: e.message === 'token' ? (LANG === 'en' ? 'wrong token' : 'التوكن غلط') : e.message }));
      return;
    }
    if (hadLocal && confirm(t('uploadLocal'))) {
      const ops = [];
      MT.TABLES.forEach((tb) => (S[tb] || []).forEach((row) => ops.push({ action: 'upsert', table: tb, row })));
      Object.keys(S.settings).forEach((k) => { if (k !== 'token' && k !== 'usdRate') ops.push({ action: 'upsert', table: 'settings', row: { key: k, value: S.settings[k] } }); });
      outbox = outbox.concat(ops);
      LS.set('mt.outbox', outbox);
    }
    toast(t('connected'));
    UI.page = null;
    UI.tab = 'home';
    await flush();
    render();
  }

  // ================================================================ Face ID lock (WebAuthn passkey on this device)
  const b64 = (buf) => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function enableLock() {
    try {
      if (!window.PublicKeyCredential) throw new Error('no webauthn');
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'Money Tracker' },
          user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'money-tracker', displayName: 'Money Tracker' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
          timeout: 60000
        }
      });
      LS.set('mt.lock', { id: b64(cred.rawId) });
      toast('🔒 ' + t('faceId'));
    } catch (e) {
      toast(t('faceIdFail'));
      render();
    }
  }
  async function unlock() {
    const lk = LS.get('mt.lock', null);
    if (!lk) return hideLock();
    try {
      await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64(lk.id) }], userVerification: 'required', timeout: 60000 } });
      hideLock();
    } catch (e) { /* user cancelled: stay locked */ }
  }
  function showLock() {
    if ($('#lock')) return;
    const el = document.createElement('div');
    el.className = 'overlay';
    el.id = 'lock';
    el.innerHTML = `<img class="logo" src="icons/icon-180.png" alt=""><h1>🔒</h1><p>${t('locked')}</p><button class="btn" id="unlockBtn">${t('unlock')}</button><button class="btn danger" id="fallbackBtn">${t('unlockFallback')}</button>`;
    document.body.appendChild(el);
    $('#unlockBtn').onclick = unlock;
    $('#fallbackBtn').onclick = () => {
      const v = prompt(t('token'));
      const c = conn();
      if (v && ((c && v.trim() === c.token) || (!c && v.trim().toLowerCase() === 'reset'))) { LS.del('mt.lock'); hideLock(); }
    };
  }
  function hideLock() { const el = $('#lock'); if (el) el.remove(); }

  // ================================================================ onboarding
  function showWelcome() {
    const el = document.createElement('div');
    el.className = 'overlay';
    el.id = 'welcome';
    el.innerHTML = `<img class="logo" src="icons/icon-180.png" alt=""><h1>${t('welcome')}</h1><p>${t('welcomeSub')}</p>
      <ul class="welcome-list"><li><span>⚡️</span>${t('w1')}</li><li><span>🔁</span>${t('w2')}</li><li><span>🔍</span>${t('w3')}</li><li><span>📗</span>${t('w4')}</li></ul>
      <button class="btn" id="wSheet">${t('startSheet')}</button><button class="btn secondary" id="wLocal">${t('startLocal')}</button>
      <div style="margin-top:14px"><button style="color:var(--muted);font-size:14px" id="wLang">${LANG === 'en' ? 'العربي' : 'English'}</button></div>`;
    document.body.appendChild(el);
    $('#wSheet').onclick = () => { seedLocal(); el.remove(); UI.tab = 'more'; UI.page = 'connection'; render(); };
    $('#wLocal').onclick = () => { seedLocal(); el.remove(); render(); dailyTick(); localRate(); };
    $('#wLang').onclick = () => { LANG = LANG === 'en' ? 'ar' : 'en'; LS.set('mt.lang', LANG); el.remove(); document.documentElement.dir = LANG === 'en' ? 'ltr' : 'rtl'; showWelcome(); };
  }

  // ================================================================ events
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-tab],[data-go],[data-back],[data-act],[data-month],[data-filter],[data-acct],[data-lang],[data-copy]');
    if (!el || el.closest('.sheet') && !el.closest('.sheet [data-copy]')) return;
    const ds = el.dataset;
    if (ds.tab) { UI.tab = ds.tab; UI.page = null; render(); window.scrollTo(0, 0); return; }
    if (ds.go) { if (ds.go !== 'connection' || UI.tab !== 'more') { /* keep tab */ } UI.page = ds.go; render(); window.scrollTo(0, 0); return; }
    if (el.hasAttribute('data-back')) { UI.page = null; render(); return; }
    if (ds.month) { UI.month = ds.month; render(); return; }
    if (ds.filter) { UI.filter = ds.filter; render(); return; }
    if (ds.acct) { UI.acct = UI.acct === ds.acct ? '' : ds.acct; render(); return; }
    if (ds.lang) { LANG = ds.lang; LS.set('mt.lang', LANG); render(); return; }
    if (ds.copy) { navigator.clipboard && navigator.clipboard.writeText(ds.copy).then(() => toast(LANG === 'en' ? 'Copied' : 'اتنسخ ✅')); return; }
    const id = ds.id;
    switch (ds.act) {
      case 'newTx': txSheet(null); break;
      case 'editTx': { const x = S.transactions.find((r) => r.id === id); if (x) txSheet(x); break; }
      case 'confirmTx': { const x = S.transactions.find((r) => r.id === id); if (x) { act({ action: 'upsert', table: 'transactions', row: Object.assign({}, x, { status: 'ok' }) }); toast(t('saved')); } break; }
      case 'delTx': if (confirm(t('confirmDelete'))) { act({ action: 'remove', table: 'transactions', id }); toast(t('deleted')); } break;
      case 'newSub': subSheet(null); break;
      case 'editSub': subSheet(S.subscriptions.find((r) => r.id === id)); break;
      case 'newAccount': accountSheet(null); break;
      case 'editAccount': accountSheet(accById(id)); break;
      case 'checkAcct': checkSheet(id); break;
      case 'logGap': checkSheet(id, ds.actual); break;
      case 'dismissGap': {
        const raw = S.settings['reported:' + id];
        try { const rep = JSON.parse(raw); rep.dismissed = true; act({ action: 'upsert', table: 'settings', row: { key: 'reported:' + id, value: JSON.stringify(rep) } }); } catch (err) { /* ignore */ }
        break;
      }
      case 'newCat': catSheet(null); break;
      case 'editCat': catSheet(catById(id)); break;
      case 'filterCat': UI.cat = id; UI.filter = 'all'; UI.tab = 'activity'; UI.page = null; render(); window.scrollTo(0, 0); break;
      case 'clearCat': UI.cat = ''; render(); break;
      case 'newGoal': goalSheet(null); break;
      case 'editGoal': goalSheet(S.goals.find((r) => r.id === id)); break;
      case 'goalAdd': { const g = S.goals.find((r) => r.id === id); if (g) amountPrompt(t('addMoney') + ' — ' + g.name, (v) => act({ action: 'upsert', table: 'goals', row: Object.assign({}, g, { saved: MT.round2(g.saved + v) }) })); break; }
      case 'newDebt': debtSheet(null); break;
      case 'editDebt': debtSheet(S.debts.find((r) => r.id === id)); break;
      case 'newGameya': gameyaSheet(null); break;
      case 'editGameya': gameyaSheet(S.gameyas.find((r) => r.id === id)); break;
      case 'gameyaPay': {
        const g = S.gameyas.find((r) => r.id === id);
        if (!g) break;
        const gid = ensureGameyaAccount(g);
        act({ action: 'upsert', table: 'transactions', row: { type: 'transfer', amount: g.monthly, currency: 'EGP', rate: 1, accountId: g.accountId || (kindAcct('cash') || {}).id, toAccountId: gid, toAmount: g.monthly, date: new Date().toISOString(), note: (LANG === 'en' ? 'Gameya: ' : 'قسط جمعية: ') + g.name, source: 'manual', status: 'ok' } }, { noRender: true });
        act({ action: 'upsert', table: 'gameyas', row: Object.assign({}, g, { paid: g.paid + 1 }) });
        toast(t('saved'));
        break;
      }
      case 'gameyaGet': {
        const g = S.gameyas.find((r) => r.id === id);
        if (!g) break;
        const gid = ensureGameyaAccount(g);
        act({ action: 'upsert', table: 'transactions', row: { type: 'transfer', amount: g.monthly * g.months, currency: 'EGP', rate: 1, accountId: gid, toAccountId: g.accountId || (kindAcct('cash') || {}).id, toAmount: g.monthly * g.months, date: new Date().toISOString(), note: (LANG === 'en' ? 'Gameya payout: ' : 'قبض جمعية: ') + g.name, source: 'manual', status: 'ok' } }, { noRender: true });
        act({ action: 'upsert', table: 'gameyas', row: Object.assign({}, g, { received: true }) });
        toast(t('saved'));
        break;
      }
      case 'safeInfo': safeInfo(); break;
      case 'syncNow': flush(); break;
      case 'connect': connect(); break;
      case 'disconnect': if (confirm(t('disconnect') + '?')) { LS.del('mt.conn'); outbox = []; LS.set('mt.outbox', outbox); setSync('local'); render(); } break;
      case 'exportCsv': exportCsv(); break;
      case 'ping':
        if (!isRemote()) { toast(t('localMode')); break; }
        api({ action: 'ping' }).then((r) => toast(r.ok ? t('connected') : t('connFail', { e: r.error }))).catch((err) => toast(t('connFail', { e: err.message })));
        break;
      case 'tryParse': {
        const txt = $('#tryText').value;
        const p = MT.parseMessage(txt, '');
        const out = $('#tryOut');
        if (p.kind !== 'tx') { out.innerHTML = `<div class="raw">— ${esc(p.reason)}</div>`; break; }
        out.innerHTML = `<div class="card breakdown" style="background:var(--card2);margin-top:10px">
          <div class="line"><span>${LANG === 'en' ? 'Type' : 'النوع'}</span><b>${t('type_' + (p.atm ? 'transfer' : p.type))}${p.atm ? ' (ATM ← كاش)' : ''}</b></div>
          <div class="line"><span>${t('amount')}</span><b>${money(p.amount, p.currency)}</b></div>
          ${p.merchant ? `<div class="line"><span>${t('whereSpent')}</span><b>${esc(p.merchant)}</b></div>` : ''}
          ${p.card ? `<div class="line"><span>Card</span><b>•••• ${esc(p.card)}</b></div>` : ''}
          ${p.fee ? `<div class="line"><span>${t('fee')}</span><b>${money(p.fee, 'EGP')}</b></div>` : ''}
          ${p.balance != null ? `<div class="line"><span>${LANG === 'en' ? 'Balance' : 'الرصيد'}</span><b>${money(p.balance, p.balanceCurrency || 'EGP')}</b></div>` : ''}
          <div class="line"><span>${LANG === 'en' ? 'Confidence' : 'متأكد؟'}</span><b>${p.confidence === 'high' ? '✅' : '⚠️ ' + t('review')}</b></div></div>`;
        break;
      }
      default: break;
    }
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'search') {
      UI.q = el.value;
      const box = $('#txlist');
      if (box) box.innerHTML = activityList();
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.set) {
      act({ action: 'upsert', table: 'settings', row: { key: el.dataset.set, value: el.value.trim() } }, { noRender: true });
      toast(t('saved'));
    } else if (el.dataset && el.dataset.settoggle) {
      act({ action: 'upsert', table: 'settings', row: { key: el.dataset.settoggle, value: el.checked ? 'on' : 'off' } }, { noRender: true });
    } else if (el.id === 'lockToggle') {
      if (el.checked) enableLock(); else { LS.del('mt.lock'); toast('🔓'); }
    }
  });

  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (LS.get('mt.lock', null) && hiddenAt && Date.now() - hiddenAt > 60000) showLock();
    if (!S) return;
    dailyTick();
    if (isRemote()) flush();
    else render();
  });
  window.addEventListener('online', () => flush());

  // ================================================================ boot
  function boot() {
    if (LS.get('mt.lock', null)) showLock();
    if (!S) { document.documentElement.dir = LANG === 'en' ? 'ltr' : 'rtl'; showWelcome(); return; }
    S = Object.assign(blankState(), S);
    render();
    dailyTick();
    if (isRemote()) flush(); else localRate();
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }
  window.MoneyTracker = { get state() { return S; }, act, render, txSheet, balances: () => MT.balances(S.accounts, S.transactions, dayOf) };
  boot();
})();
