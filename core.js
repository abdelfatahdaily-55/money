/*
 * Money Tracker — shared core logic.
 *
 * This exact file runs in two places:
 *   1. the iPhone web app (browser), and
 *   2. Google Apps Script (the backend that owns the Google Sheet).
 *
 * Keep it plain ES2019: no optional chaining (?.), no nullish (??), no imports.
 * Everything that touches storage goes through a `store` object so the same
 * logic can run against a Google Sheet, localStorage, or an in-memory test store.
 */
var MT = (function () {
  'use strict';

  var VERSION = '1.0.0';

  // ------------------------------------------------------------------ schema
  var SCHEMA = {
    transactions: ['id', 'date', 'type', 'amount', 'currency', 'rate', 'accountId', 'toAccountId', 'toAmount',
      'fee', 'categoryId', 'merchant', 'note', 'source', 'sources', 'status', 'guess', 'card', 'sender', 'raw',
      'subscriptionId', 'createdAt', 'updatedAt'],
    accounts: ['id', 'name', 'kind', 'currency', 'opening', 'openingDate', 'match', 'icon', 'color', 'archived', 'order'],
    categories: ['id', 'name', 'nameEn', 'kind', 'icon', 'color', 'budget', 'keywords', 'order'],
    subscriptions: ['id', 'name', 'amount', 'currency', 'cycle', 'nextDate', 'accountId', 'categoryId', 'active',
      'autoLog', 'trialEnds', 'lastAmount', 'unused', 'notes'],
    goals: ['id', 'name', 'target', 'saved', 'deadline', 'icon'],
    debts: ['id', 'person', 'amount', 'direction', 'note', 'date', 'settled'],
    gameyas: ['id', 'name', 'monthly', 'months', 'startMonth', 'myTurn', 'paid', 'received', 'accountId', 'notes'],
    checks: ['id', 'date', 'accountId', 'actual', 'expected', 'diff', 'txId'],
    settings: ['key', 'value']
  };
  var NUM_FIELDS = ['amount', 'rate', 'toAmount', 'fee', 'opening', 'budget', 'order', 'target', 'saved', 'monthly',
    'months', 'myTurn', 'paid', 'actual', 'expected', 'diff', 'lastAmount'];
  var BOOL_FIELDS = ['archived', 'active', 'autoLog', 'unused', 'settled', 'received'];
  var DATE_ONLY_FIELDS = ['openingDate', 'nextDate', 'trialEnds', 'deadline'];
  var TABLES = ['transactions', 'accounts', 'categories', 'subscriptions', 'goals', 'debts', 'gameyas', 'checks'];

  function coerce(table, row) {
    var out = {};
    var cols = SCHEMA[table];
    for (var i = 0; i < cols.length; i++) {
      var k = cols[i];
      var v = row[k];
      if (NUM_FIELDS.indexOf(k) >= 0) {
        out[k] = (v === '' || v === null || v === undefined) ? 0 : toNum(v);
      } else if (BOOL_FIELDS.indexOf(k) >= 0) {
        out[k] = v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
      } else {
        out[k] = (v === null || v === undefined) ? '' : String(v);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ ids & dates
  function uid(prefix) {
    return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymdOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function addDays(ymd, n) {
    var d = parseYmd(ymd);
    d.setDate(d.getDate() + n);
    return ymdOf(d);
  }
  function daysBetween(aYmd, bYmd) {
    var a = parseYmd(aYmd), b = parseYmd(bYmd);
    return Math.round((b - a) / 86400000);
  }
  function addMonthsClamped(ymd, n) {
    var d = parseYmd(ymd);
    var day = d.getDate();
    var t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    var last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(day, last));
    return ymdOf(t);
  }
  function monthKey(ymd) { return String(ymd).slice(0, 7); }
  function monthsBetween(fromMonth, toMonth) {
    var a = String(fromMonth).split('-'), b = String(toMonth).split('-');
    return (Number(b[0]) - Number(a[0])) * 12 + (Number(b[1]) - Number(a[1]));
  }
  function lastDayOfMonth(ymd) {
    var d = parseYmd(ymd);
    return ymdOf(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }

  // ------------------------------------------------------------------ text & numbers
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function normDigits(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/[٠-٩]/g, function (d) { return String(AR_DIGITS.indexOf(d)); })
      .replace(/[۰-۹]/g, function (d) { return String(FA_DIGITS.indexOf(d)); })
      .replace(/٫/g, '.')
      .replace(/٬/g, ',');
  }
  function clean(s) {
    return normDigits(s)
      .replace(/[‎‏‪-‮⁦-⁩؜]/g, '')
      .replace(/[   ]/g, ' ')
      .replace(/[ـ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function numFrom(str) {
    var s = String(str).replace(/\s/g, '');
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ''));
    if (/^\d+,\d{1,2}$/.test(s)) return Number(s.replace(',', '.'));
    return Number(s.replace(/,/g, ''));
  }
  function toNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = clean(v);
    var m = s.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:[.,]\d+)?/);
    if (!m) return 0;
    var neg = m[0].charAt(0) === '-';
    var n = numFrom(m[0].replace('-', ''));
    return isFinite(n) ? (neg ? -n : n) : 0;
  }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  var CUR_SRC = '(EGP|L\\.\\s?E\\.?|LE|E£|£E|ج\\s?\\.\\s?م\\.?|جم|جنيه(?:ا|ات)?|جنية|USD|US\\$|\\$|دولار(?:ا|ات)?|EUR|€|يورو|SAR|ريال|AED|درهم)';
  var NUM_SRC = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:[.,]\\d+)?)';
  function curCode(token) {
    var t = String(token || '').toLowerCase().replace(/\s/g, '');
    if (/usd|\$|دولار/.test(t)) return 'USD';
    if (/eur|€|يورو/.test(t)) return 'EUR';
    if (/sar|ريال/.test(t)) return 'SAR';
    if (/aed|درهم/.test(t)) return 'AED';
    return 'EGP';
  }

  /** Every money-looking amount in a text, in order. */
  function findAmounts(text) {
    var t = clean(text);
    var out = [];
    var seen = {};
    var reBefore = new RegExp(CUR_SRC + '\\s?:?\\s?' + NUM_SRC, 'gi');
    var reAfter = new RegExp(NUM_SRC + '\\s?' + CUR_SRC, 'gi');
    var reKey = new RegExp('(?:amount|amt|مبلغ|بمبلغ|بقيمة|قيمة|القيمة|value)\\s?(?:of|:|=|قدره|وقدره)?\\s?' + NUM_SRC, 'gi');
    var m;
    while ((m = reBefore.exec(t))) {
      add(m.index, m.index + m[0].length, numFrom(m[2]), curCode(m[1]), false, m.index + m[0].length - m[2].length);
    }
    while ((m = reAfter.exec(t))) add(m.index, m.index + m[0].length, numFrom(m[1]), curCode(m[2]), false, m.index);
    while ((m = reKey.exec(t))) {
      var numStart = m.index + m[0].length - m[1].length;
      add(numStart, numStart + m[1].length, numFrom(m[1]), 'EGP', true, numStart);
    }
    out.sort(function (a, b) { return a.index - b.index; });
    return out;

    function add(start, end, amount, currency, guessed, numStart) {
      if (!isFinite(amount) || amount <= 0) return;
      var key = numStart + ':' + amount;
      for (var i = 0; i < out.length; i++) {
        // Same number already captured (e.g. "مبلغ 150 جنيه" matches twice): keep the one with a real currency.
        if (Math.abs(out[i].numStart - numStart) <= 1 && out[i].amount === amount) {
          if (out[i].guessed && !guessed) { out[i].currency = currency; out[i].guessed = false; }
          return;
        }
      }
      if (seen[key]) return;
      seen[key] = true;
      out.push({ amount: amount, currency: currency, index: start, end: end, numStart: numStart, guessed: guessed });
    }
  }

  /** Parse a single money string like "EGP 1,250.00", "ج.م.‏ ١٥٠٫٠٠", "$4.99". */
  function parseMoney(str) {
    var a = findAmounts(str);
    if (a.length) return { amount: a[0].amount, currency: a[0].currency };
    var n = toNum(str);
    if (n > 0) return { amount: n, currency: 'EGP' };
    return null;
  }

  // ------------------------------------------------------------------ SMS / receipt parsing
  var OTP_RE = /(otp|one[- ]?time|verification code|security code|activation code|passcode|رمز (?:التحقق|التفعيل|الأمان|الامان|المرور)|كود (?:التحقق|التفعيل)|كلمة (?:السر|المرور)|لا تشارك|do not share|don'?t share)/i;
  var DECLINED_RE = /(declined|rejected|unsuccessful|not successful|failed|insufficient|could not be completed|مرفوض|مرفوضة|تم رفض|رفض|لم تتم|لم يتم|غير ناجح|فشل|غير كاف)/i;
  var DEBIT_RE = /(debited|debit\b|purchase|purchased|spent|charged|paid|payment|withdraw|withdrawal|withdrawn|sent|transferred to|transfer to|outgoing|\bpos\b|خصم|مخصوم|سحب|شراء|مشتريات|دفع|سداد|تحويل (?:إلى|الى|ل)|حولت|تحويل صادر|صادر|مدين)/i;
  var CREDIT_RE = /(credited|credit to|deposit|deposited|received|incoming|refund|reversal|reversed|added to|إيداع|ايداع|إضافة|اضافة|أضيف|اضيف|تمت إضافة|تم إضافة|استلام|استلمت|وارد|دائن|استرداد|مرتجع|تحويل من|حوالة واردة|شحن رصيدك|تم شحن)/i;
  var REFUND_RE = /(refund|reversal|reversed|استرداد|مرتجع|رد مبلغ|إلغاء عملية|الغاء عملية)/i;
  var ATM_RE = /(\batm\b|cash withdrawal|سحب نقدي|ماكينة|ماكينه|الصراف)/i;
  var TOPUP_RE = /(recharge|top-?up|airtime|شحن رصيد|كارت شحن|شحن الرصيد|شحن موبايل|شحن خط)/i;
  var INSTAPAY_RE = /(insta ?pay|انستا ?باي|إنستا ?باي|انستاباى|\bipn\b)/i;
  var BALANCE_RE = /(balance|\bbal\b|avail|رصيد|الرصيد|المتاح|متاح)/i;
  var FEE_RE = /(fee|fees|charges|commission|رسوم|عمولة|مصاريف)/i;
  var CARRIER_RE = /(vodafone|orange|etisalat|\be&|\bwe\b|telecom egypt|فودافون|اورانج|أورانج|اتصالات|وي\b)/i;
  var APPSTORE_RE = /(apple\.com|itunes|app ?store|apple services|icloud|apple music|apple one)/i;

  function firstIndex(re, s) {
    var m = re.exec(s);
    re.lastIndex = 0;
    return m ? m.index : -1;
  }

  function extractCard(t) {
    var m = t.match(/(?:ending(?:\s+with|\s+in)?|ended with|ends with|last 4|المنتهي(?:ة|ه)?\s*(?:ب(?:الرقم|رقم|ـ)?)|المنتهي(?:ة|ه)?|منتهي(?:ة|ه)?\s*ب|رقم|no\.?|number)\s*:?\s*[*xX#]*\s*(\d{4})\b/i);
    if (m) return m[1];
    m = t.match(/[*xX#]{2,}\s?(\d{4})\b/);
    return m ? m[1] : '';
  }

  var EN_MERCHANT_RE = /\b(at|merchant|to|from|@)\s*:?\s+(.+?)(?=\s+(?:on|at|in|for|via|using|with|ref|reference|card|dated|date|amount|is|has|was|avail|available|bal|balance)\b|\s+\d{1,2}[\/\-.]\d{1,2}|\s+(?:EGP|USD|LE)\b|[;,]|\.\s|\.$|$)/gi;
  var AR_MERCHANT_RE = /(لدى|لدي|عند|لصالح|إلى|الى|للمستفيد|المستفيد|من)\s*:?\s+(.+?)(?=\s+(?:في|بتاريخ|يوم|بمبلغ|بقيمة|الساعة|برقم|رقم|عبر|بنجاح|وذلك|الرصيد|رصيدك|المتاح)(?:\s|$)|\s+\d|[.،,;:]|$)/g;
  var NOT_MERCHANT_RE = /^(?:your|the|a|an|my|account|acc|card|a\/c|ac|wallet|you|mobile|egp|usd|ال)?\s*(?:account|card|wallet|a\/c|acc\b)|^(?:ال)?(?:حساب|بطاق|رصيد|كارت|كرت|محفظ|البنك|بنك|خلال|طريق|فضلك)|^\d+$/i;
  var PRONOUN_RE = /^(?:your|the|my|a|an|you|this|it|us|me|him|her|them|حضرتك|سيادتكم|عميلنا)$/i;
  var AMOUNT_WORD_RE = /(مبلغ|بقيمة|قيمة|amount|\bof\b|\bby\b|\bwith\b|خصم|شحن|سحب|تحويل|charged|debited|credited)/i;
  /** Is the amount at `index` a balance figure ("Available balance EGP 5,000") rather than the payment? */
  function isBalanceAt(low, index) {
    var before = low.slice(Math.max(0, index - 28), index);
    var re = new RegExp(BALANCE_RE.source, 'gi');
    var m, last = null;
    while ((m = re.exec(before))) last = m;
    if (!last) return false;
    var tail = before.slice(last.index + last[0].length);
    return !AMOUNT_WORD_RE.test(tail);
  }

  function extractMerchant(t) {
    var cands = [];
    var m;
    while ((m = EN_MERCHANT_RE.exec(t))) cands.push({ kw: m[1].toLowerCase(), v: m[2], i: m.index });
    while ((m = AR_MERCHANT_RE.exec(t))) cands.push({ kw: m[1], v: m[2], i: m.index });
    EN_MERCHANT_RE.lastIndex = 0;
    AR_MERCHANT_RE.lastIndex = 0;
    var prio = { at: 0, merchant: 0, '@': 0, 'لدى': 0, 'لدي': 0, 'عند': 0, 'لصالح': 1, 'للمستفيد': 1, 'المستفيد': 1, to: 2, 'إلى': 2, 'الى': 2, from: 3, 'من': 3 };
    cands = cands.map(function (c) {
      var v = c.v.replace(/\s+/g, ' ').replace(/^[\s:'"-]+|[\s:'"-]+$/g, '').trim();
      return { kw: c.kw, v: v, i: c.i, p: prio[c.kw] === undefined ? 5 : prio[c.kw] };
    }).filter(function (c) {
      return c.v.length >= 2 && c.v.length <= 45 && !NOT_MERCHANT_RE.test(c.v) && !PRONOUN_RE.test(c.v) &&
        !BALANCE_RE.test(c.v.slice(0, 8));
    });
    cands.sort(function (a, b) { return a.p - b.p || a.i - b.i; });
    return cands.length ? cands[0].v : '';
  }

  /**
   * Understand a bank / wallet / carrier SMS or an OCR'd receipt.
   * Returns { kind: 'tx'|'ignore', reason, type, amount, currency, balance, fee, card, merchant,
   *           instapay, atm, topup, carrier, appstore, confidence }
   */
  function parseMessage(text, sender) {
    var raw = String(text || '');
    var t = clean(raw);
    var low = t.toLowerCase();
    var snd = clean(sender || '').toLowerCase();
    var res = { kind: 'ignore', reason: '', raw: raw };
    if (!t) { res.reason = 'empty'; return res; }
    if (OTP_RE.test(low)) { res.reason = 'otp'; return res; }
    if (DECLINED_RE.test(low)) { res.reason = 'declined'; return res; }

    var amounts = findAmounts(t);
    var main = null, balance = null, fee = null;
    for (var i = 0; i < amounts.length; i++) {
      var a = amounts[i];
      var isBal = isBalanceAt(low, a.index);
      var isFee = FEE_RE.test(low.slice(Math.max(0, a.index - 22), a.index));
      if (isBal) { if (!balance) balance = a; }
      else if (isFee) { if (!fee) fee = a; }
      else if (!main) main = a;
    }
    if (!main) { res.reason = 'no-amount'; return res; }

    var lowNoCC = low.replace(/credit\s*card|بطاقة\s*(?:ال)?ائتمان(?:ية|يه)?|بطاقتك الائتمانية/g, ' ');
    var d = firstIndex(DEBIT_RE, lowNoCC);
    var c = firstIndex(CREDIT_RE, lowNoCC);
    var type = 'expense';
    var confidence = 'high';
    if (d < 0 && c < 0) { confidence = 'low'; }
    else if (c >= 0 && (d < 0 || c < d)) { type = 'income'; }
    if (type === 'income' && REFUND_RE.test(lowNoCC)) type = 'refund';
    if (main.guessed && confidence === 'high' && amounts.length === 1) confidence = 'high';

    res.kind = 'tx';
    res.type = type;
    res.amount = main.amount;
    res.currency = main.currency;
    res.balance = balance ? balance.amount : null;
    res.balanceCurrency = balance ? balance.currency : null;
    res.fee = fee ? fee.amount : 0;
    res.card = extractCard(t);
    res.merchant = extractMerchant(t);
    res.instapay = INSTAPAY_RE.test(low) || /instapay|ipn/.test(snd);
    res.atm = ATM_RE.test(low) && type === 'expense';
    res.topup = TOPUP_RE.test(low);
    res.carrier = CARRIER_RE.test(snd) || (CARRIER_RE.test(low) && /(رصيدك|your balance|باقة|bundle|recharge|شحن)/.test(low) && !/(بنك|bank|بطاق|card|كارت)/.test(low));
    res.appstore = APPSTORE_RE.test(low);
    res.confidence = confidence;
    return res;
  }

  /** Parse a quick note like "60 كشري", "uber 85 بنك", "+500 مصروف من بابا", "شحنت رصيد 50". */
  var QUICK_INCOME_RE = /^\+|(استلمت|جالي|جاتلي|قبضت|مرتب|راتب|مصروف من|هدية من|دخل|received|got paid|salary|income|refund|استرجعت)/i;
  var QUICK_ACCOUNT = [
    { kind: 'cash', re: /(كاش|نقدي|نقدا|نقداً|\bcash\b)/i },
    { kind: 'card', re: /(redot|ريدوت|ريد ?وت)/i },
    { kind: 'bank', re: /(بنك|البنك|فيزا|الفيزا|visa|\bcard\b|كارت|الكارت|بطاقة|انستا ?باي|انستا|instapay|insta|bank|apple pay|ابل باي)/i },
    { kind: 'phone', re: /(من الرصيد|رصيد الموبايل|phone credit|من رصيدي)/i }
  ];
  function parseQuick(text) {
    var t = clean(text);
    var m = t.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?/);
    if (!m) return null;
    var amount = numFrom(m[0]);
    if (!(amount > 0)) return null;
    var currency = /(\$|usd|دولار)/i.test(t) ? 'USD' : 'EGP';
    var type = QUICK_INCOME_RE.test(t) ? 'income' : 'expense';
    var topup = /(شحنت|شحن رصيد|شحن|recharge|top ?up)/i.test(t);
    var accountKind = '';
    for (var i = 0; i < QUICK_ACCOUNT.length; i++) {
      if (QUICK_ACCOUNT[i].re.test(t)) { accountKind = QUICK_ACCOUNT[i].kind; break; }
    }
    var note = t.replace(m[0], ' ')
      .replace(/^\+/, ' ')
      .replace(new RegExp(CUR_SRC, 'gi'), ' ')
      .replace(/(كاش|نقدي|نقدا|نقداً|\bcash\b|redot ?pay|redot|ريدوت|بالفيزا|فيزا|visa|بالكارت|كارت|انستا ?باي|instapay|من البنك|بنك|bank|apple pay|ابل باي)/gi, ' ')
      .replace(/^\s*(صرفت|دفعت|اشتريت|spent|paid|bought|استلمت|جالي|جاتلي|قبضت|received|got)\s+/i, ' ')
      .replace(/\s+(على|علي|في|on|for)\s*$/i, ' ')
      .replace(/^\s*(على|علي|في|on|for)\s+/i, ' ')
      .replace(/\s+/g, ' ').trim();
    return { type: topup && type === 'expense' ? 'topup' : type, amount: amount, currency: currency, accountKind: accountKind, note: note };
  }

  // ------------------------------------------------------------------ defaults
  function defaultAccounts(now) {
    var d = String(now || '').slice(0, 10) || ymdOf(new Date());
    return [
      { id: 'bank', name: 'بنك مصر', kind: 'bank', currency: 'EGP', opening: 0, openingDate: d, match: 'banque misr,بنك مصر,bm,instapay,mastercard,visa', icon: '🏦', color: '#1f6f50', archived: false, order: 1 },
      { id: 'cash', name: 'كاش', kind: 'cash', currency: 'EGP', opening: 0, openingDate: d, match: 'cash,كاش', icon: '💵', color: '#3a7d2c', archived: false, order: 2 },
      { id: 'phone', name: 'رصيد الموبايل', kind: 'phone', currency: 'EGP', opening: 0, openingDate: d, match: 'vodafone,orange,etisalat,we,e&', icon: '📱', color: '#b4232c', archived: false, order: 3 },
      { id: 'redotpay', name: 'RedotPay', kind: 'card', currency: 'USD', opening: 0, openingDate: d, match: 'redotpay,redot', icon: '💳', color: '#c2410c', archived: false, order: 4 }
    ];
  }
  function defaultCategories() {
    var e = function (id, name, nameEn, icon, color, keywords, order) {
      return { id: id, name: name, nameEn: nameEn, kind: 'expense', icon: icon, color: color, budget: 0, keywords: keywords, order: order };
    };
    var i = function (id, name, nameEn, icon, color, keywords, order) {
      return { id: id, name: name, nameEn: nameEn, kind: 'income', icon: icon, color: color, budget: 0, keywords: keywords, order: order };
    };
    return [
      e('food', 'أكل ومطاعم', 'Food & dining', '🍔', '#e8590c', 'talabat,طلبات,mcdonald,ماكدونالدز,kfc,كنتاكي,koshary,كشري,كشرى,مطعم,restaurant,cafe,كافيه,coffee,قهوة,starbucks,ستاربكس,pizza,بيتزا,burger,برجر,شاورما,shawarma,فول,طعمية,هريسة,costa,cilantro,بطاطس,حلويات,dessert,sushi,elmenus,منيو,عصير,juice,سندوتش,crepe,كريب,buffalo,بافلو', 1),
      e('groceries', 'سوبر ماركت', 'Groceries', '🛒', '#2b8a3e', 'carrefour,كارفور,spinneys,سبينيز,hyper,هايبر,kazyon,كازيون,seoudi,سعودي,oscar,اوسكار,metro market,مترو ماركت,gourmet,breadfast,بريدفاست,rabbit,instashop,خير زمان,ماركت,market,بقالة,grocery,فاكهة,خضار,lulu,علوش,اولاد رجب,awlad ragab,فتح الله,fathalla', 2),
      e('transport', 'مواصلات', 'Transport', '🚕', '#1971c2', 'uber,اوبر,أوبر,careem,كريم,indrive,اندرايف,didi,ديدي,swvl,سويفل,metro,مترو,بنزين,fuel,petrol,wataniya,وطنية,total,mobil,موبيل,chillout,taxi,تاكسي,ميكروباص,اتوبيس,bus,توك توك,مواصلات,شل,shell,gas station,باركينج,parking,جراج', 3),
      e('subs', 'اشتراكات', 'Subscriptions', '🔁', '#7048e8', 'apple.com,apple,itunes,app store,icloud,netflix,نتفليكس,spotify,سبوتيفاي,shahid,شاهد,youtube,يوتيوب,chatgpt,openai,anthropic,claude,osn,watchit,واتش ات,anghami,انغامي,disney,prime video,canva,notion,adobe,microsoft,xbox,playstation plus,psn,gym,جيم', 4),
      e('bills', 'فواتير ونت', 'Bills & internet', '💡', '#f08c00', 'vodafone,فودافون,orange,اورانج,etisalat,اتصالات,\\bwe\\b,وي,telecom,كهرباء,electricity,مياه,water,غاز,فاتورة,bill,انترنت,internet,باقة,bundle,fawry,فوري', 5),
      e('shopping', 'شوبينج', 'Shopping', '🛍️', '#d6336c', 'amazon,امازون,noon,نون,jumia,جوميا,shein,شي ان,h&m,zara,زارا,defacto,ديفاكتو,lc waikiki,ال سي,max,ماكس,ikea,ايكيا,b.tech,بي تك,2b,raya,راية,هدوم,لبس,جزمة,shoes,clothes,temu,تيمو,aliexpress', 6),
      e('health', 'صحة', 'Health', '💊', '#0c8599', 'pharmacy,صيدلية,صيدليه,el ezaby,العزبي,seif,سيف,19011,vezeeta,فيزيتا,clinic,عيادة,دكتور,doctor,hospital,مستشفى,تحاليل,lab,دوا,دواء,medicine', 7),
      e('education', 'تعليم', 'Education', '📚', '#5c7cfa', 'aast,academy,الأكاديمية,الاكاديمية,course,كورس,udemy,coursera,book,كتاب,كتب,مكتبة,library,ieee,ملازم,ملزمة,طباعة,print,سنتر,درس', 8),
      e('fun', 'خروج وترفيه', 'Fun & outings', '🎮', '#ae3ec9', 'cinema,سينما,vox,فوكس,steam,game,لعبة,العاب,playstation,بلايستيشن,بلاي,خروجة,حفلة,concert,bowling,بولينج,ملاهي,club,نادي,تذكرة,ticket', 9),
      e('gifts', 'هدايا', 'Gifts', '🎁', '#e64980', 'gift,هدية,هديه,عيد ميلاد,birthday,ورد,flowers', 10),
      e('gameya', 'جمعية', 'Gameya', '🤝', '#495057', 'جمعية,جمعيه,gameya', 11),
      e('fees', 'رسوم بنكية', 'Bank fees', '🏦', '#868e96', 'fee,fees,رسوم,عمولة,commission', 12),
      e('untracked', 'مش متسجل', 'Untracked', '❓', '#adb5bd', '', 13),
      e('other', 'أخرى', 'Other', '📦', '#868e96', '', 14),
      i('allowance', 'مصروف / مرتب', 'Allowance / salary', '💰', '#2f9e44', 'مصروف,مرتب,راتب,salary,allowance,بابا,ماما,payroll', 20),
      i('transfer-in', 'تحويل جالي', 'Money received', '📥', '#37b24d', 'instapay,انستاباي,تحويل,transfer,received', 21),
      i('work', 'شغل', 'Work', '💻', '#0ca678', 'freelance,شغل,project,مشروع,client,عميل,upwork,fiverr,shopify,stripe,paypal', 22),
      i('income-other', 'دخل تاني', 'Other income', '➕', '#69db7c', '', 23)
    ];
  }

  // ------------------------------------------------------------------ helpers over data
  function settingsMap(rows) {
    var s = {};
    (rows || []).forEach(function (r) { s[r.key] = r.value; });
    return s;
  }
  function rateFor(currency, rates) {
    if (!currency || currency === 'EGP') return 1;
    var r = rates && rates[currency];
    return r && r > 0 ? r : (currency === 'USD' ? 50 : 1);
  }
  function txEgp(tx, rates) {
    var r = tx.rate && tx.rate > 0 ? tx.rate : rateFor(tx.currency, rates);
    return round2(tx.amount * r);
  }
  function feeEgp(tx, rates) {
    var r = tx.rate && tx.rate > 0 ? tx.rate : rateFor(tx.currency, rates);
    return round2((tx.fee || 0) * r);
  }
  function activeAccounts(accounts) {
    return (accounts || []).filter(function (a) { return !a.archived; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }
  function findAccountByKind(accounts, kind) {
    var list = activeAccounts(accounts);
    for (var i = 0; i < list.length; i++) if (list[i].kind === kind) return list[i];
    return null;
  }
  function matchAccount(accounts, text) {
    var low = clean(text).toLowerCase();
    if (!low) return null;
    var list = activeAccounts(accounts);
    var best = null, bestLen = 0;
    for (var i = 0; i < list.length; i++) {
      var tokens = String(list[i].match || '').split(',').concat([list[i].name]);
      for (var j = 0; j < tokens.length; j++) {
        var tok = clean(tokens[j]).toLowerCase();
        if (tok.length < 2) continue;
        var re = /^\d{4}$/.test(tok) ? new RegExp('\\b' + tok + '\\b') : null;
        var hit = re ? re.test(low) : low.indexOf(tok) >= 0;
        if (hit && tok.length > bestLen) { best = list[i]; bestLen = tok.length; }
      }
    }
    return best;
  }
  function merchantKey(m) { return clean(m).toLowerCase().replace(/[^a-z0-9؀-ۿ ]/g, '').replace(/\s+/g, ' ').trim(); }

  function categorize(text, kind, categories, settings) {
    var low = clean(text).toLowerCase();
    var cats = (categories || []).filter(function (c) { return c.kind === (kind === 'refund' ? 'expense' : kind); });
    if (low) {
      var map = {};
      try { map = JSON.parse((settings && settings.merchantMap) || '{}'); } catch (e) { map = {}; }
      var key = merchantKey(text);
      if (map[key]) {
        for (var k = 0; k < cats.length; k++) if (cats[k].id === map[key]) return map[key];
      }
      var best = null, bestLen = 0;
      for (var i = 0; i < cats.length; i++) {
        var kws = String(cats[i].keywords || '').split(',');
        for (var j = 0; j < kws.length; j++) {
          var kw = kws[j].trim().toLowerCase();
          if (!kw) continue;
          var hit;
          if (kw.indexOf('\\b') >= 0) { try { hit = new RegExp(kw, 'i').test(low); } catch (e2) { hit = false; } }
          else if (/^[a-z0-9&.' ]+$/.test(kw) && kw.length <= 3) hit = new RegExp('(^|[^a-z])' + kw.replace(/[.&]/g, '\\$&') + '([^a-z]|$)').test(low);
          else hit = low.indexOf(kw) >= 0;
          if (hit && kw.length > bestLen) { best = cats[i].id; bestLen = kw.length; }
        }
      }
      if (best) return best;
    }
    return kind === 'income' ? 'income-other' : 'other';
  }

  function learnMerchant(settings, merchant, categoryId) {
    var map = {};
    try { map = JSON.parse((settings && settings.merchantMap) || '{}'); } catch (e) { map = {}; }
    var key = merchantKey(merchant);
    if (!key) return null;
    map[key] = categoryId;
    return JSON.stringify(map);
  }

  // ------------------------------------------------------------------ balances & stats
  function isCounted(tx) { return tx.status !== 'review' && tx.status !== 'deleted'; }

  /** Balance of every account in its own currency. Transactions before an account's openingDate are already inside `opening`. */
  function balances(accounts, txs, dayOf) {
    dayOf = dayOf || function (tx) { return String(tx.date).slice(0, 10); };
    var out = {};
    (accounts || []).forEach(function (a) { out[a.id] = Number(a.opening) || 0; });
    var startOf = {};
    (accounts || []).forEach(function (a) { startOf[a.id] = a.openingDate || ''; });
    (txs || []).forEach(function (tx) {
      if (!isCounted(tx)) return;
      var day = dayOf(tx);
      var amt = Number(tx.amount) || 0, fee = Number(tx.fee) || 0;
      if (tx.accountId && out[tx.accountId] !== undefined && day >= startOf[tx.accountId]) {
        if (tx.type === 'expense') out[tx.accountId] -= amt + fee;
        else if (tx.type === 'income' || tx.type === 'refund') out[tx.accountId] += amt - fee;
        else if (tx.type === 'transfer') out[tx.accountId] -= amt + fee;
      }
      if (tx.type === 'transfer' && tx.toAccountId && out[tx.toAccountId] !== undefined && day >= startOf[tx.toAccountId]) {
        out[tx.toAccountId] += Number(tx.toAmount) > 0 ? Number(tx.toAmount) : amt;
      }
    });
    Object.keys(out).forEach(function (k) { out[k] = round2(out[k]); });
    return out;
  }

  /**
   * Month summary in EGP. `month` is 'YYYY-MM'; `dayOf(tx)` returns the local 'YYYY-MM-DD' of a transaction.
   */
  function monthStats(txs, month, rates, dayOf) {
    dayOf = dayOf || function (tx) { return String(tx.date).slice(0, 10); };
    var s = { month: month, spent: 0, income: 0, fees: 0, refunds: 0, byCategory: {}, byMerchant: {}, byDay: {}, count: 0, transfersOut: 0 };
    (txs || []).forEach(function (tx) {
      if (!isCounted(tx)) return;
      var day = dayOf(tx);
      if (monthKey(day) !== month) return;
      s.count++;
      var egp = txEgp(tx, rates);
      var fee = feeEgp(tx, rates);
      if (fee) { s.fees += fee; s.spent += fee; s.byCategory.fees = (s.byCategory.fees || 0) + fee; s.byDay[day] = (s.byDay[day] || 0) + fee; }
      if (tx.type === 'expense') {
        s.spent += egp;
        var c = tx.categoryId || 'other';
        s.byCategory[c] = (s.byCategory[c] || 0) + egp;
        s.byDay[day] = (s.byDay[day] || 0) + egp;
        var mk = tx.source === 'balance-check' ? '' : (tx.merchant || tx.note || '');
        if (mk) s.byMerchant[mk] = (s.byMerchant[mk] || 0) + egp;
      } else if (tx.type === 'refund') {
        s.refunds += egp;
        s.spent -= egp;
        var rc = tx.categoryId || 'other';
        s.byCategory[rc] = (s.byCategory[rc] || 0) - egp;
        s.byDay[day] = (s.byDay[day] || 0) - egp;
      } else if (tx.type === 'income') {
        s.income += egp;
      } else if (tx.type === 'transfer') {
        s.transfersOut += egp;
      }
    });
    ['spent', 'income', 'fees', 'refunds', 'transfersOut'].forEach(function (k) { s[k] = round2(s[k]); });
    s.net = round2(s.income - s.spent);
    return s;
  }

  // ------------------------------------------------------------------ subscriptions
  var CYCLE_FACTOR = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  function subMonthlyEgp(sub, rates) {
    return round2((Number(sub.amount) || 0) * rateFor(sub.currency, rates) * (CYCLE_FACTOR[sub.cycle] || 1));
  }
  function subsMonthlyTotal(subs, rates) {
    return round2((subs || []).filter(function (s) { return s.active; })
      .reduce(function (sum, s) { return sum + subMonthlyEgp(s, rates); }, 0));
  }
  function nextRenewal(ymd, cycle) {
    if (cycle === 'weekly') return addDays(ymd, 7);
    if (cycle === 'quarterly') return addMonthsClamped(ymd, 3);
    if (cycle === 'yearly') return addMonthsClamped(ymd, 12);
    return addMonthsClamped(ymd, 1);
  }
  /** Sum (EGP) of active subscriptions that will renew from `fromYmd` to `toYmd`, inclusive. */
  function subsDueBetween(subs, fromYmd, toYmd, rates) {
    var total = 0, items = [];
    (subs || []).forEach(function (s) {
      if (!s.active || !s.nextDate) return;
      var d = s.nextDate, guard = 0;
      while (d && d <= toYmd && guard++ < 60) {
        if (d >= fromYmd) {
          var egp = round2((Number(s.amount) || 0) * rateFor(s.currency, rates));
          total += egp;
          items.push({ sub: s, date: d, egp: egp });
        }
        d = nextRenewal(d, s.cycle);
      }
    });
    items.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return { total: round2(total), items: items };
  }

  // ------------------------------------------------------------------ safe to spend
  /**
   * How much can be spent today without breaking the month.
   * opts: { txs, accounts, subs, gameyas, settings, rates, today:'YYYY-MM-DD', dayOf }
   */
  function safeToSpend(opts) {
    var today = opts.today;
    var month = monthKey(today);
    var settings = opts.settings || {};
    var rates = opts.rates;
    var dayOf = opts.dayOf || function (tx) { return String(tx.date).slice(0, 10); };
    var payday = Math.round(toNum(settings.payday));
    var end = lastDayOfMonth(today);
    if (payday >= 1 && payday <= 31) {
      var d = parseYmd(today);
      var cand = new Date(d.getFullYear(), d.getMonth(), Math.min(payday, Number(lastDayOfMonth(today).slice(8))));
      if (ymdOf(cand) <= today) cand = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(payday, new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate()));
      end = addDays(ymdOf(cand), -1);
    }
    var daysLeft = Math.max(1, daysBetween(today, end) + 1);
    var stats = monthStats(opts.txs, month, rates, dayOf);
    var spentToday = round2(stats.byDay[today] || 0);
    var upcoming = subsDueBetween(opts.subs, addDays(today, 1), end, rates).total;
    var subsToday = subsDueBetween(opts.subs, today, today, rates);
    // a subscription renewing today that has not been auto-logged yet
    upcoming += subsToday.items.filter(function (it) {
      return !(opts.txs || []).some(function (tx) { return tx.subscriptionId === it.sub.id && dayOf(tx) === today; });
    }).reduce(function (s, it) { return s + it.egp; }, 0);
    var gameyaDue = 0;
    (opts.gameyas || []).forEach(function (g) {
      if (!g.startMonth || !g.months) return;
      var idx = monthsBetween(g.startMonth, month) + 1;
      if (idx >= 1 && idx <= g.months && (Number(g.paid) || 0) < idx) gameyaDue += (Number(g.monthly) || 0) * (idx - (Number(g.paid) || 0));
    });
    var save = toNum(settings.savingsTarget);
    var expected = toNum(settings.monthlyIncome);
    var mode, pool;
    if (expected > 0 || stats.income > 0) {
      mode = 'income';
      pool = Math.max(expected, stats.income) - (stats.spent - spentToday) - upcoming - gameyaDue - save;
    } else {
      mode = 'balance';
      var bal = balances(opts.accounts, opts.txs, dayOf);
      var liquid = 0;
      activeAccounts(opts.accounts).forEach(function (a) {
        if (a.kind === 'bank' || a.kind === 'cash' || a.kind === 'card' || a.kind === 'wallet') liquid += (bal[a.id] || 0) * rateFor(a.currency, rates);
      });
      pool = liquid + spentToday - upcoming - gameyaDue - save;
    }
    var perDay = round2(Math.max(0, pool / daysLeft));
    return {
      mode: mode, perDay: perDay, leftToday: round2(perDay - spentToday), spentToday: spentToday,
      daysLeft: daysLeft, upcoming: round2(upcoming), gameyaDue: round2(gameyaDue), save: save,
      income: Math.max(expected, stats.income), spent: stats.spent, end: end
    };
  }

  // ------------------------------------------------------------------ dedupe
  function hoursBetween(aIso, bIso) { return Math.abs(new Date(aIso) - new Date(bIso)) / 3600000; }
  function sourcesOf(tx) { return String(tx.sources || tx.source || '').split(',').filter(Boolean); }

  /**
   * Find an existing transaction that is the same real-world payment as `nt`
   * (e.g. Apple Pay tap + bank SMS for one purchase). One payment can be matched once per source.
   */
  function findDuplicate(nt, txs) {
    var best = null, bestH = 1e9;
    for (var i = 0; i < txs.length; i++) {
      var tx = txs[i];
      if (tx.id === nt.id || tx.status === 'deleted') continue;
      if (nt.raw && tx.raw && clean(nt.raw) === clean(tx.raw) && hoursBetween(tx.createdAt || tx.date, nt.createdAt || nt.date) < 24) return tx;
      var srcs = sourcesOf(tx);
      if (srcs.indexOf(nt.source) >= 0) continue;               // same channel twice = two real payments
      if (nt.source === 'manual' && srcs.indexOf('manual') >= 0) continue;
      if (tx.currency !== nt.currency) continue;
      if (Math.abs((Number(tx.amount) || 0) - (Number(nt.amount) || 0)) > 0.009) continue;
      var sameKind = tx.type === nt.type ||
        (tx.type === 'transfer' && nt.type === 'income' && tx.toAccountId === nt.accountId) ||
        (nt.type === 'transfer' && tx.type === 'income' && nt.toAccountId === tx.accountId) ||
        (tx.type === 'transfer' && nt.type === 'expense' && tx.accountId === nt.accountId) ||
        (nt.type === 'transfer' && tx.type === 'expense' && nt.accountId === tx.accountId);
      if (!sameKind) continue;
      var guessedAcct = String(tx.guess || '').indexOf('account') >= 0 || String(nt.guess || '').indexOf('account') >= 0;
      var acctOk = !tx.accountId || !nt.accountId || tx.accountId === nt.accountId || guessedAcct ||
        (tx.type === 'transfer' && tx.toAccountId === nt.accountId) || (nt.type === 'transfer' && nt.toAccountId === tx.accountId);
      if (!acctOk) continue;
      var windowH = (nt.source === 'subscription' || srcs.indexOf('subscription') >= 0) ? 36 : 6;
      var h = hoursBetween(tx.date, nt.date);
      if (h <= windowH && h < bestH) { best = tx; bestH = h; }
    }
    return best;
  }

  /** Merge info from a duplicate into the existing transaction. Returns the updated row. */
  function mergeInto(existing, nt, nowIso) {
    var m = {};
    Object.keys(existing).forEach(function (k) { m[k] = existing[k]; });
    var srcs = sourcesOf(existing);
    if (srcs.indexOf(nt.source) < 0) srcs.push(nt.source);
    m.sources = srcs.join(',');
    ['merchant', 'card', 'sender', 'raw', 'note'].forEach(function (k) { if (!m[k] && nt[k]) m[k] = nt[k]; });
    if ((!m.fee || m.fee === 0) && nt.fee) m.fee = nt.fee;
    // A precise source (SMS/receipt/Apple Pay) beats a guessed account / transfer type.
    if (String(m.guess || '').indexOf('account') >= 0 && nt.accountId && String(nt.guess || '').indexOf('account') < 0) {
      m.accountId = nt.accountId;
      m.guess = String(m.guess).replace('account', '').replace(/^,|,$/g, '');
    }
    if (nt.type === 'transfer' && existing.type !== 'transfer') { m.type = 'transfer'; m.toAccountId = nt.toAccountId; m.toAmount = nt.toAmount; }
    if (existing.type === 'transfer' && nt.type === 'income' && !m.accountId) m.accountId = nt.accountId;
    if (m.status === 'review' && nt.status === 'ok') m.status = 'ok';
    if ((m.categoryId === 'other' || !m.categoryId) && nt.categoryId && nt.categoryId !== 'other') m.categoryId = nt.categoryId;
    m.updatedAt = nowIso;
    return m;
  }

  // ------------------------------------------------------------------ messages back to the phone
  function fmtMoney(n, currency) {
    var v = round2(n);
    var s = Math.abs(v) % 1 ? Math.abs(v).toFixed(2) : String(Math.abs(v));
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var sign = v < 0 ? '-' : '';
    if (currency === 'USD') return sign + '$' + s;
    return sign + s + ' ج';
  }
  function catName(categories, id) {
    for (var i = 0; i < (categories || []).length; i++) if (categories[i].id === id) return categories[i].icon + ' ' + categories[i].name;
    return '';
  }
  function accName(accounts, id) {
    for (var i = 0; i < (accounts || []).length; i++) if (accounts[i].id === id) return accounts[i].name;
    return '';
  }

  // ------------------------------------------------------------------ request handling
  /**
   * The whole API. `store` provides: all(table), upsert(table,row), remove(table,id).
   * `env` provides: now (ISO), today ('YYYY-MM-DD'), offset ('+03:00'), rates ({USD:..}), sheetUrl.
   */
  function handleRequest(req, store, env) {
    req = req || {};
    var action = String(req.action || '').toLowerCase();
    switch (action) {
      case 'ping': return { ok: true, app: 'Money Tracker', version: VERSION, now: env.now };
      case 'getall': return getAll(store, env);
      case 'upsert': return upsertRow(store, req.table, req.row, env);
      case 'remove': case 'delete': return removeRow(store, req.table, req.id);
      case 'bulk': return bulk(store, req.ops || [], env);
      case 'applepay': return ingestApplePay(req, store, env);
      case 'sms': case 'message': return ingestSms(req, store, env);
      case 'receipt': return ingestReceipt(req, store, env);
      case 'quick': return ingestQuick(req, store, env);
      case 'instapay': return ingestInstapay(req, store, env);
      case 'tick': return tick(store, env);
      case 'reminders': return reminders(store, env, Number(req.days) || 0);
      case 'parse': return { ok: true, parsed: parseMessage(req.text, req.sender), quick: parseQuick(req.text) };
      case 'check': return balanceCheck(req, store, env);
      default: return { ok: false, error: 'unknown action: ' + action };
    }
  }

  function getAll(store, env) {
    var out = { ok: true, version: VERSION, now: env.now, rates: env.rates, sheetUrl: env.sheetUrl || '' };
    TABLES.forEach(function (t) { out[t] = store.all(t); });
    var s = settingsMap(store.all('settings'));
    delete s.token;
    out.settings = s;
    return out;
  }

  function upsertRow(store, table, row, env) {
    if (!SCHEMA[table]) return { ok: false, error: 'bad table' };
    if (!row) return { ok: false, error: 'missing row' };
    if (table === 'settings') {
      if (row.key === 'token' || row.key === 'usdRate') return { ok: false, error: 'read-only setting' };
      return { ok: true, row: store.upsert('settings', { key: String(row.key), value: row.value === undefined ? '' : String(row.value) }) };
    }
    var r = coerce(table, row);
    if (!r.id) r.id = uid(table.charAt(0));
    if (table === 'transactions') {
      if (!r.createdAt) r.createdAt = env.now;
      r.updatedAt = env.now;
      if (!r.status) r.status = 'ok';
      if (!r.currency) r.currency = 'EGP';
      if (!r.sources) r.sources = r.source || 'manual';
      if (!r.source) r.source = 'manual';
    }
    return { ok: true, row: store.upsert(table, r) };
  }
  function removeRow(store, table, id) {
    if (!SCHEMA[table] || !id) return { ok: false, error: 'bad request' };
    store.remove(table, id);
    return { ok: true };
  }
  function bulk(store, ops, env) {
    var results = [];
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      try { results.push(handleRequest(op, store, env)); }
      catch (e) { results.push({ ok: false, error: String(e && e.message || e) }); }
    }
    return { ok: true, results: results };
  }

  function ctx(store) {
    var accounts = store.all('accounts');
    var categories = store.all('categories');
    var settings = settingsMap(store.all('settings'));
    var txs = store.recent ? store.recent('transactions', 400) : store.all('transactions');
    return { accounts: accounts, categories: categories, settings: settings, txs: txs };
  }

  function rateOf(currency, env) { return rateFor(currency, env.rates); }

  /** Save a new automatic transaction, merging with a duplicate when there is one. */
  function saveAuto(nt, c, store, env) {
    nt.id = nt.id || uid('t');
    nt.createdAt = env.now;
    nt.updatedAt = env.now;
    nt.sources = nt.source;
    nt.rate = nt.rate || rateOf(nt.currency, env);
    var dup = findDuplicate(nt, c.txs);
    if (dup) {
      var merged = mergeInto(dup, nt, env.now);
      store.upsert('transactions', coerce('transactions', merged));
      return { ok: true, merged: true, tx: merged, message: '🔁 ' + fmtMoney(merged.amount, merged.currency) + ' — كانت متسجلة (' + sourcesOf(dup).join(' + ') + ')' };
    }
    var row = coerce('transactions', nt);
    store.upsert('transactions', row);
    return { ok: true, merged: false, tx: row, message: describe(row, c) };
  }

  function describe(tx, c) {
    var head = tx.status === 'review' ? '⚠️ راجعها في الـ app: ' : '✅ ';
    var what = tx.type === 'income' ? 'دخل ' : tx.type === 'refund' ? 'استرداد ' : tx.type === 'transfer' ? 'تحويل ' : '';
    var parts = [head + what + fmtMoney(tx.amount, tx.currency)];
    if (tx.merchant) parts.push(tx.merchant);
    if (tx.type === 'transfer') parts.push(accName(c.accounts, tx.accountId) + ' ← ' + accName(c.accounts, tx.toAccountId));
    else {
      var cn = catName(c.categories, tx.categoryId);
      if (cn) parts.push(cn);
      var an = accName(c.accounts, tx.accountId);
      if (an) parts.push(an);
    }
    return parts.join(' • ');
  }

  function ingestApplePay(req, store, env) {
    var c = ctx(store);
    var money = parseMoney(req.amount);
    if (!money || !(money.amount > 0)) return { ok: false, message: '⚠️ المبلغ مش واضح: ' + String(req.amount || '') };
    if (req.currency) money.currency = curCode(req.currency);
    var card = clean(req.card || '');
    var acct = matchAccount(c.accounts, card) || findAccountByKind(c.accounts, 'bank');
    var merchant = clean(req.merchant || '');
    var nt = {
      date: env.now, type: 'expense', amount: money.amount, currency: money.currency,
      accountId: acct ? acct.id : '', categoryId: categorize(merchant, 'expense', c.categories, c.settings),
      merchant: merchant, source: 'applepay', status: 'ok', card: card,
      guess: matchAccount(c.accounts, card) ? '' : 'account'
    };
    if (acct && acct.currency !== money.currency && acct.currency === 'USD' && money.currency === 'EGP') {
      // e.g. RedotPay (USD account) paying an EGP price: keep the EGP amount, conversion happens in reports
    }
    return saveAuto(nt, c, store, env);
  }

  function senderAccount(c, sender, p) {
    var s = clean(sender).toLowerCase();
    if (p.carrier) return findAccountByKind(c.accounts, 'phone');
    var byCard = p.card ? matchAccount(c.accounts, p.card) : null;
    if (byCard) return byCard;
    var bySender = s ? matchAccount(c.accounts, s) : null;
    if (bySender) return bySender;
    var byText = matchAccount(c.accounts, p.raw);
    if (byText && byText.kind !== 'phone' && byText.kind !== 'cash') return byText;
    return null;
  }

  function txFromParsed(p, c, env, source, sender) {
    var acct = senderAccount(c, sender, p);
    var guess = acct ? '' : 'account';
    if (!acct) acct = findAccountByKind(c.accounts, 'bank');
    var text = (p.merchant || '') + ' ' + p.raw;
    var nt = {
      date: env.now, type: p.type, amount: p.amount, currency: p.currency,
      accountId: acct ? acct.id : '', fee: p.fee || 0, merchant: p.merchant || '',
      note: p.instapay ? 'InstaPay' : '', source: (source === 'sms' && p.carrier) ? 'carrier' : source,
      status: p.confidence === 'high' ? 'ok' : 'review',
      guess: guess, card: p.card || '', sender: clean(sender || ''), raw: p.raw
    };
    if (p.atm) {
      var cash = findAccountByKind(c.accounts, 'cash');
      nt.type = 'transfer'; nt.toAccountId = cash ? cash.id : ''; nt.toAmount = p.amount; nt.categoryId = '';
      nt.note = 'سحب ATM';
    } else if (p.topup && p.type === 'expense' && acct && acct.kind !== 'phone') {
      var phone = findAccountByKind(c.accounts, 'phone');
      nt.type = 'transfer'; nt.toAccountId = phone ? phone.id : ''; nt.toAmount = p.amount; nt.categoryId = '';
      nt.note = 'شحن رصيد';
    } else if (p.carrier && p.type === 'income' && (p.topup || /شحن/.test(p.raw))) {
      // Carrier says the credit was recharged: money came from somewhere (cash by default, a bank SMS will correct it).
      var cash2 = findAccountByKind(c.accounts, 'cash');
      var phone2 = findAccountByKind(c.accounts, 'phone');
      nt.type = 'transfer'; nt.accountId = cash2 ? cash2.id : ''; nt.toAccountId = phone2 ? phone2.id : '';
      nt.toAmount = p.amount; nt.guess = 'account'; nt.note = 'شحن رصيد'; nt.categoryId = '';
    } else if (p.type === 'income') {
      nt.categoryId = categorize(text, 'income', c.categories, c.settings);
      if (nt.categoryId === 'income-other' && p.instapay) nt.categoryId = 'transfer-in';
    } else {
      nt.categoryId = p.appstore ? 'subs' : categorize(text, 'expense', c.categories, c.settings);
      if (p.carrier && nt.categoryId === 'other') nt.categoryId = 'bills';
    }
    if (acct && acct.currency && acct.currency !== nt.currency && nt.type !== 'transfer') {
      // keep the currency the bank reported; reports convert to EGP
    }
    return nt;
  }

  function ingestSms(req, store, env) {
    var c = ctx(store);
    var p = parseMessage(req.text, req.sender);
    if (p.kind !== 'tx') {
      var why = { otp: 'كود تحقق', declined: 'عملية مرفوضة', 'no-amount': 'مفيش مبلغ', empty: 'رسالة فاضية' }[p.reason] || p.reason;
      return { ok: true, ignored: true, reason: p.reason, message: '— اتجاهلت (' + why + ')' };
    }
    var nt = txFromParsed(p, c, env, 'sms', req.sender);
    var res = saveAuto(nt, c, store, env);
    if (p.balance !== null && p.balance !== undefined && res.tx && res.tx.accountId) {
      store.upsert('settings', { key: 'reported:' + res.tx.accountId, value: JSON.stringify({ balance: p.balance, currency: p.balanceCurrency, at: env.now }) });
    }
    return res;
  }

  function ingestReceipt(req, store, env) {
    var c = ctx(store);
    var p = parseMessage(req.text, req.sender || '');
    if (p.kind !== 'tx') return { ok: true, ignored: true, reason: p.reason, message: '⚠️ مش لاقي مبلغ في الصورة' };
    var t = clean(req.text).toLowerCase();
    var received = /(received|from:|استلام|استلمت|وارد|المرسل|sender|from )/.test(t) && !/(sent to|to:|إلى|الى|المستفيد|beneficiary|receiver|المستلم)/.test(t);
    p.type = received ? 'income' : 'expense';
    p.confidence = 'high';
    p.balance = null;
    if (/(instapay|انستا|إنستا|ipa|ipn)/i.test(t)) p.instapay = true;
    var to = clean(req.text).match(/(?:to|إلى|الى|المستفيد|beneficiary|receiver(?: name)?|المستلم|from|المرسل)\s*:?\s*([^\n\r:]{2,40}?)(?=\s{2,}|\s+(?:amount|المبلغ|egp|ج|reference|رقم|date|التاريخ)|$)/i);
    if (to && !p.merchant) p.merchant = to[1].trim();
    var nt = txFromParsed(p, c, env, 'receipt', req.sender || '');
    nt.raw = '';
    return saveAuto(nt, c, store, env);
  }

  function ingestQuick(req, store, env) {
    var c = ctx(store);
    var q = parseQuick(req.text);
    if (!q) return { ok: false, message: '⚠️ مفيش رقم — قول مثلاً: 60 كشري' };
    var acct = q.accountKind ? findAccountByKind(c.accounts, q.accountKind) : findAccountByKind(c.accounts, 'cash');
    var nt = {
      date: env.now, amount: q.amount, currency: q.currency, accountId: acct ? acct.id : '',
      merchant: q.type === 'topup' ? '' : q.note, note: q.type === 'topup' ? q.note : '', source: 'quick', status: 'ok',
      guess: q.accountKind ? '' : 'account'
    };
    if (q.type === 'topup') {
      var phone = findAccountByKind(c.accounts, 'phone');
      nt.type = 'transfer'; nt.toAccountId = phone ? phone.id : ''; nt.toAmount = q.amount; nt.categoryId = '';
      if (!nt.note) nt.note = 'شحن رصيد';
    } else {
      nt.type = q.type;
      nt.categoryId = categorize(q.note, q.type, c.categories, c.settings);
    }
    return saveAuto(nt, c, store, env);
  }

  function ingestInstapay(req, store, env) {
    var c = ctx(store);
    var money = parseMoney(req.amount);
    if (!money || !(money.amount > 0)) return { ok: true, ignored: true, message: '— مفيش مبلغ' };
    var dir = clean(req.direction || '').toLowerCase();
    var incoming = /(in|received|استلمت|جالي|وارد|income)/.test(dir);
    var acct = (req.account ? matchAccount(c.accounts, req.account) : null) || findAccountByKind(c.accounts, 'bank');
    var who = clean(req.to || req.person || '');
    var nt = {
      date: env.now, type: incoming ? 'income' : 'expense', amount: money.amount, currency: 'EGP',
      accountId: acct ? acct.id : '', merchant: who, note: clean(req.note || '') || 'InstaPay', source: 'instapay', status: 'ok',
      fee: toNum(req.fee)
    };
    nt.categoryId = incoming ? 'transfer-in' : categorize(who + ' ' + nt.note, 'expense', c.categories, c.settings);
    return saveAuto(nt, c, store, env);
  }

  function balanceCheck(req, store, env) {
    var accounts = store.all('accounts');
    var txs = store.all('transactions');
    var acct = null;
    for (var i = 0; i < accounts.length; i++) if (accounts[i].id === req.accountId) acct = accounts[i];
    if (!acct) return { ok: false, error: 'account not found' };
    var expected = balances(accounts, txs, env.dayOf)[acct.id] || 0;
    var actual = toNum(req.actual);
    var diff = round2(actual - expected);
    var check = { id: uid('c'), date: env.now, accountId: acct.id, actual: actual, expected: expected, diff: diff, txId: '' };
    if (req.adjust && Math.abs(diff) >= 0.01) {
      var tx = coerce('transactions', {
        id: uid('t'), date: env.now, type: diff < 0 ? 'expense' : 'income', amount: Math.abs(diff), currency: acct.currency,
        rate: rateFor(acct.currency, env.rates), accountId: acct.id, categoryId: diff < 0 ? 'untracked' : 'income-other',
        note: diff < 0 ? 'فرق رصيد — مصروف مش متسجل' : 'فرق رصيد — فلوس زيادة', source: 'balance-check',
        sources: 'balance-check', status: 'ok', createdAt: env.now, updatedAt: env.now
      });
      store.upsert('transactions', tx);
      check.txId = tx.id;
    }
    store.upsert('checks', coerce('checks', check));
    return { ok: true, check: check };
  }

  /** Daily job: log subscriptions whose renewal day arrived and move their next date forward. */
  function tick(store, env) {
    var subs = store.all('subscriptions');
    var accounts = store.all('accounts');
    var logged = [];
    subs.forEach(function (s) {
      if (!s.active || !s.nextDate) return;
      var changed = false, guard = 0;
      while (s.nextDate <= env.today && guard++ < 24) {
        if (s.autoLog) {
          var acct = null;
          for (var i = 0; i < accounts.length; i++) if (accounts[i].id === s.accountId) acct = accounts[i];
          var tx = coerce('transactions', {
            id: uid('t'), date: s.nextDate + 'T12:00:00' + (env.offset || '+02:00'), type: 'expense',
            amount: s.amount, currency: s.currency || 'EGP', rate: rateFor(s.currency, env.rates),
            accountId: s.accountId || (acct ? acct.id : ''), categoryId: s.categoryId || 'subs', merchant: s.name,
            note: 'تجديد اشتراك', source: 'subscription', sources: 'subscription', status: 'ok', subscriptionId: s.id,
            createdAt: env.now, updatedAt: env.now
          });
          var dup = findDuplicate(tx, store.all('transactions'));
          if (dup) store.upsert('transactions', coerce('transactions', mergeInto(dup, tx, env.now)));
          else store.upsert('transactions', tx);
          logged.push({ name: s.name, amount: s.amount, currency: s.currency, date: s.nextDate });
        }
        s.nextDate = nextRenewal(s.nextDate, s.cycle);
        changed = true;
      }
      if (changed) store.upsert('subscriptions', coerce('subscriptions', s));
    });
    return { ok: true, logged: logged };
  }

  /** Text for the daily reminder notification (subscriptions + free trials + gameya). */
  function reminders(store, env, days) {
    var settings = settingsMap(store.all('settings'));
    var n = days || Math.round(toNum(settings.remindDays)) || 2;
    var until = addDays(env.today, n);
    var lines = [];
    store.all('subscriptions').forEach(function (s) {
      if (!s.active) return;
      if (s.trialEnds && s.trialEnds >= env.today && s.trialEnds <= until) {
        lines.push('⏳ التجربة المجانية لـ ' + s.name + ' بتخلص ' + whenText(env.today, s.trialEnds) + ' — لو مش عايزه الغيه');
      } else if (s.nextDate && s.nextDate >= env.today && s.nextDate <= until) {
        lines.push('🔁 ' + s.name + ' هيتجدد ' + whenText(env.today, s.nextDate) + ' بـ ' + fmtMoney(s.amount, s.currency) + (s.unused ? ' (معلّم إنك مش بتستخدمه!)' : ''));
      }
    });
    var month = monthKey(env.today);
    store.all('gameyas').forEach(function (g) {
      var idx = monthsBetween(g.startMonth, month) + 1;
      if (idx >= 1 && idx <= g.months && (Number(g.paid) || 0) < idx) lines.push('🤝 قسط الجمعية "' + g.name + '" ' + fmtMoney(g.monthly, 'EGP') + ' لسه مدفعش الشهر ده');
    });
    return { ok: true, count: lines.length, text: lines.join('\n') };
  }
  function whenText(today, ymd) {
    var d = daysBetween(today, ymd);
    if (d <= 0) return 'النهارده';
    if (d === 1) return 'بكرة';
    return 'كمان ' + d + ' أيام (' + ymd.slice(8) + '/' + ymd.slice(5, 7) + ')';
  }

  return {
    VERSION: VERSION, SCHEMA: SCHEMA, TABLES: TABLES, NUM_FIELDS: NUM_FIELDS, BOOL_FIELDS: BOOL_FIELDS,
    DATE_ONLY_FIELDS: DATE_ONLY_FIELDS,
    coerce: coerce, uid: uid, ymdOf: ymdOf, parseYmd: parseYmd, addDays: addDays, daysBetween: daysBetween,
    addMonthsClamped: addMonthsClamped, monthKey: monthKey, monthsBetween: monthsBetween, lastDayOfMonth: lastDayOfMonth,
    normDigits: normDigits, clean: clean, toNum: toNum, round2: round2, findAmounts: findAmounts, parseMoney: parseMoney,
    parseMessage: parseMessage, parseQuick: parseQuick, defaultAccounts: defaultAccounts, defaultCategories: defaultCategories,
    settingsMap: settingsMap, rateFor: rateFor, txEgp: txEgp, feeEgp: feeEgp, activeAccounts: activeAccounts,
    findAccountByKind: findAccountByKind, matchAccount: matchAccount, categorize: categorize, learnMerchant: learnMerchant,
    merchantKey: merchantKey, isCounted: isCounted, balances: balances, monthStats: monthStats,
    subMonthlyEgp: subMonthlyEgp, subsMonthlyTotal: subsMonthlyTotal, nextRenewal: nextRenewal, subsDueBetween: subsDueBetween,
    safeToSpend: safeToSpend, findDuplicate: findDuplicate, mergeInto: mergeInto, fmtMoney: fmtMoney,
    handleRequest: handleRequest, sourcesOf: sourcesOf
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MT;
