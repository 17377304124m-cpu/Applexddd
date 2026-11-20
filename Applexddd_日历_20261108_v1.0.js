(function (root) {
  'use strict';

  var fixedEvents = {
    '01-01': '元旦', '02-14': '情人节', '03-08': '妇女节',
    '03-12': '植树节', '04-01': '愚人节', '05-01': '劳动节',
    '05-04': '青年节', '05-20': '520', '06-01': '儿童节',
    '07-01': '建党节', '08-01': '建军节', '09-10': '教师节',
    '10-01': '国庆节', '11-08': '记者节', '12-24': '平安夜', '12-25': '圣诞节'
  };
  var lunarEvents = {
    '1-1': '春节', '1-15': '元宵节', '5-5': '端午节',
    '7-7': '七夕', '7-15': '中元节', '8-15': '中秋节',
    '9-9': '重阳节', '12-8': '腊八节'
  };
  var festivalDescriptions = {
    '元旦': '公历新年的第一天。人们以倒数、互道祝福等方式迎接新的一年。',
    '情人节': '源自西方的节日。人们常用贺卡、鲜花或巧克力向恋人表达爱意。',
    '妇女节': '国际妇女节致敬女性在社会各领域的贡献，也提醒人们关注妇女权利和性别平等。',
    '植树节': '倡导公众植树护绿的纪念日。各地常组织义务植树和树木养护活动。',
    '愚人节': '流行于许多国家的民间娱乐日。人们常用无伤大雅的玩笑或恶作剧互相逗乐。',
    '劳动节': '也称五一国际劳动节，纪念劳动者争取合理工时等权益的历程，致敬各行各业的劳动者。',
    '青年节': '为纪念1919年的五四运动而设立，也是青年回顾历史、参与社会活动的日子。',
    '520': '“520”在中文网络用语中谐音“我爱你”，不少人选在这一天表白或送出祝福。',
    '儿童节': '为孩子庆祝的节日，也提醒大家关注儿童的健康、教育与权利。',
    '建党节': '中国共产党成立纪念日。各地常举办纪念活动，回顾党的历史。',
    '建军节': '中国人民解放军建军纪念日，与1927年的南昌起义有关。各地常开展慰问和拥军活动。',
    '教师节': '向教师表达感谢的日子。学生常以贺卡或一句问候，感谢老师的教导。',
    '国庆节': '纪念中华人民共和国成立。1949年10月1日，开国大典在北京天安门广场举行。',
    '记者节': '中国新闻工作者的职业节日。11月8日也是中国记协前身成立的日子。',
    '平安夜': '圣诞节前一晚。有些人会参加教堂礼拜、唱圣诞颂歌，或与亲友相聚。',
    '圣诞节': '基督教纪念耶稣诞生的节日。在一些地方，人们也会装饰圣诞树、互赠礼物。',
    '春节': '农历正月初一开启农历新年。拜年、贴春联、走亲访友是常见的过年习俗。',
    '元宵节': '农历正月十五是元宵节。人们常赏花灯、猜灯谜，也会吃元宵或汤圆。',
    '端午节': '农历五月初五，不少地方包粽子、赛龙舟。许多地方也借这些习俗纪念屈原。',
    '七夕': '农历七月初七，又称乞巧节，民间流传着牛郎织女鹊桥相会的故事。',
    '中元节': '农历七月十五，俗称“七月半”。许多地方有祭祖、追思先人的习俗。',
    '中秋节': '农历八月十五是亲友团聚的传统节日，人们常一起赏月、分月饼。',
    '重阳节': '农历九月初九，有登高、赏菊等习俗，也寄托着对长辈的敬意和祝福。',
    '腊八节': '农历腊月初八，不少地方会煮腊八粥。民间有“过了腊八就是年”的说法。',
    '除夕': '农历一年的最后一天。家人常在这天围坐吃年夜饭，一起守岁迎新。',
    '清明节': '清明既是二十四节气之一，也是传统节日。人们常在这时扫墓祭祖、踏青赏春。',
    '母亲节': '五月的第二个星期日，人们常用鲜花、贺卡或陪伴，感谢母亲的付出。',
    '父亲节': '六月的第三个星期日，人们常以问候、礼物或相聚，向父亲表达感谢。'
  };
  // 假期范围与补班日期按国务院办公厅年度通知录入。
  var holidayYears = {
    2026: {
      source: 'https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm',
      breaks: [
        ['01-01', '01-03', '元旦'], ['02-15', '02-23', '春节'],
        ['04-04', '04-06', '清明节'], ['05-01', '05-05', '劳动节'],
        ['06-19', '06-21', '端午节'], ['09-25', '09-27', '中秋节'],
        ['10-01', '10-07', '国庆节']
      ],
      workdays: ['01-04', '02-14', '02-28', '05-09', '09-20', '10-10']
    },
    2027: {
      source: 'https://www.gov.cn/zhengce/content/202611/content_7085101.htm',
      breaks: [
        ['01-01', '01-03', '元旦'], ['02-05', '02-13', '春节'],
        ['04-03', '04-05', '清明节'], ['05-01', '05-05', '劳动节'],
        ['06-09', '06-09', '端午节'], ['09-15', '09-15', '中秋节'],
        ['10-01', '10-07', '国庆节']
      ],
      workdays: ['01-31', '02-14', '05-08', '09-26', '10-09']
    }
  };
  var almanac = typeof module === 'object' && module.exports ? require('./Applexddd_农历历法_20261108_v1.0.js') : root;
  var lunarMonths = ['正月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '冬月', '腊月'];
  var lunarDays = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
  function pad(value) { return String(value).padStart(2, '0'); }

  function lunarDate(date) {
    var lunar = almanac.Solar.fromYmd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()).getLunar();
    return { year: lunar.getYear(), month: Math.abs(lunar.getMonth()), day: lunar.getDay(), leap: lunar.getMonth() < 0 };
  }

  function getDayInfo(year, month, day) {
    // 固定取北京时间中午，农历日期不受设备所在时区影响。
    var date = new Date(Date.UTC(year, month - 1, day, 4));
    var md = pad(month) + '-' + pad(day);
    var lunar = lunarDate(date);
    var events = [];
    if (fixedEvents[md]) events.push(fixedEvents[md]);
    var traditional = lunarEvents[lunar.month + '-' + lunar.day];
    if (!lunar.leap && traditional) events.push(traditional);
    var tomorrow = new Date(date.getTime() + 86400000);
    var nextLunar = lunarDate(tomorrow);
    if (nextLunar.month === 1 && nextLunar.day === 1 && !nextLunar.leap) events.push('除夕');
    if ((year === 2026 || year === 2027) && md === '04-05') events.push('清明节');
    if (date.getUTCDay() === 0) {
      if (month === 5 && day >= 8 && day <= 14) events.push('母亲节');
      if (month === 6 && day >= 15 && day <= 21) events.push('父亲节');
    }
    var data = holidayYears[year];
    var holiday = '';
    if (data) data.breaks.forEach(function (range) {
      if (md >= range[0] && md <= range[1]) holiday = range[2];
    });
    return {
      key: year + '-' + md, day: day, weekday: date.getUTCDay(),
      lunar: (lunar.leap ? '闰' : '') + lunarMonths[lunar.month - 1] + lunarDays[lunar.day - 1],
      lunarShort: lunar.day === 1 ? (lunar.leap ? '闰' : '') + lunarMonths[lunar.month - 1] : lunarDays[lunar.day - 1],
      lunarYear: lunar.year, lunarMonth: lunar.month, lunarDay: lunar.day, leap: lunar.leap,
      events: events, holiday: holiday, workday: !!data && data.workdays.indexOf(md) !== -1
    };
  }

  function getFestivalDetails(dayInfo) {
    return Array.from(new Set(dayInfo.events.concat(dayInfo.holiday)))
      .filter(function (name) { return typeof festivalDescriptions[name] === 'string'; })
      .map(function (name) { return { name: name, description: festivalDescriptions[name] }; });
  }

  function getMonthDays(year, month) {
    var start = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    var count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    var days = Array(start).fill(null);
    for (var day = 1; day <= count; day++) days.push(getDayInfo(year, month, day));
    while (days.length % 7) days.push(null);
    return days;
  }

  var birthdayCache = {};

  function birthdayLabel(birthday) {
    return '农历' + (birthday.leap ? '闰' : '') + lunarMonths[birthday.month - 1] + lunarDays[birthday.day - 1];
  }

  function birthdayInLunarYear(birthday, year) {
    var cacheKey = [year, birthday.month, birthday.day, birthday.leap].join('-');
    if (birthdayCache[cacheKey]) return birthdayCache[cacheKey];
    var monthNumber = birthday.leap ? -birthday.month : birthday.month;
    var month = almanac.LunarMonth.fromYm(year, monthNumber);
    var adjustments = [];
    if (!month) {
      monthNumber = birthday.month;
      month = almanac.LunarMonth.fromYm(year, monthNumber);
      adjustments.push('本年无对应闰月，按普通月份');
    }
    var day = Math.min(birthday.day, month.getDayCount());
    if (day !== birthday.day) adjustments.push('本月无三十，按廿九');
    var solar = almanac.Lunar.fromYmd(year, monthNumber, day).getSolar();
    var result = { key: solar.toYmd(), lunarYear: year, adjustment: adjustments.join('；') };
    birthdayCache[cacheKey] = result;
    return result;
  }

  function nextBirthday(birthday, fromKey) {
    var parts = fromKey.split('-').map(Number);
    var year = almanac.Solar.fromYmd(parts[0], parts[1], parts[2]).getLunar().getYear();
    var date = birthdayInLunarYear(birthday, year);
    return date.key >= fromKey ? date : birthdayInLunarYear(birthday, year + 1);
  }

  function getPersonalEntries(key, birthdays, events) {
    var year = Number(key.slice(0, 4));
    var entries = [];
    birthdays.forEach(function (birthday) {
      [year - 1, year].forEach(function (lunarYear) {
        var occurrence = birthdayInLunarYear(birthday, lunarYear);
        if (occurrence.key === key) entries.push({
          id: birthday.id, type: 'birthday', title: birthday.name + '的生日',
          note: birthday.note, date: key, adjustment: occurrence.adjustment
        });
      });
    });
    events.forEach(function (event) {
      if (event.date === key) entries.push({
        id: event.id, type: 'event', title: event.title, note: event.note, date: key, adjustment: ''
      });
    });
    return entries;
  }

  var api = {
    getDayInfo: getDayInfo, getMonthDays: getMonthDays,
    getFestivalDetails: getFestivalDetails,
    birthdayLabel: birthdayLabel, birthdayInLunarYear: birthdayInLunarYear,
    nextBirthday: nextBirthday, getPersonalEntries: getPersonalEntries,
    lunarMonthNames: lunarMonths, lunarDayNames: lunarDays,
    hasHolidayData: function (year) { return !!holidayYears[year]; },
    holidaySource: function (year) { return holidayYears[year] ? holidayYears[year].source : ''; }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LifeCalendar = api;
})(typeof window === 'object' ? window : globalThis);
