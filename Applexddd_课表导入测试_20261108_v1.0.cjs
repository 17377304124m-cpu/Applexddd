const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePath = path.join(__dirname, 'Applexddd_课表导入_20261108_v1.0.js');
const schedule = fs.existsSync(modulePath) ? require(modulePath) : null;

function row(changes = {}) {
  return {name:'高等数学', teacher:'张老师', day:1, periodsText:'1-2', weeksText:'1-16', room:'A-210', ...changes};
}

test('解析带标签的逐行课程及同行教师教室', () => {
  assert.ok(schedule, '尚未实现课表导入');
  const rows = schedule.parseOcr({text:'课程：高等数学\n星期：周一\n节次：1-2\n周次：1-16单周\n教师：张三 教室：A-210\n课程：英语\n星期：星期日\n节次：3,5\n周次：2,4,6\n老师：李四\n地点：B412'});
  assert.deepEqual(rows, [row({teacher:'张三',weeksText:'1-16单周'}),row({name:'英语',teacher:'李四',day:7,periodsText:'3,5',weeksText:'2,4,6',room:'B412'})]);
});

test('真实中文 OCR 的字符间空格与数字间“一”可还原，不改中文课程名', () => {
  assert.ok(schedule, '尚未实现课表导入');
  const data = {text:'2026 一 2027 学 年 第 一 学 期 课表\n课程 : 大 数据 与 商务 智能\n星期 一 第 3 一 5 节 第 10 一 13 周\n教师 : 邹 帆 教室 : A-210\n课程 : 跨 境 电子 商务\n\n星期 三 第 3 一 5 节 第 10 一 16 周\n教师 : 尹 叶 青 教室 : B412\n'};
  assert.deepEqual(schedule.parseOcr(data),[
    row({name:'大数据与商务智能',teacher:'邹帆',periodsText:'3-5',weeksText:'10-13'}),
    row({name:'跨境电子商务',teacher:'尹叶青',day:3,periodsText:'3-5',weeksText:'10-16',room:'B412'})
  ]);
  assert.equal(schedule.parseOcr({text:'课程：一元微积分\n星期一 第1-2节 第1-16周'})[0].name,'一元微积分');
});

test('未识别的必填信息留空而不猜测', () => {
  assert.ok(schedule, '尚未实现课表导入');
  assert.deepEqual(schedule.parseOcr({text:'课程：程序设计\n教师：李老师\n教室：B412'}),[row({name:'程序设计',teacher:'李老师',day:0,periodsText:'',weeksText:'',room:'B412'})]);
  assert.deepEqual(schedule.parseOcr({text:'2026–2027 学年第一学期课表\n星期 节次 周次'}),[]);
});

test('表头星期与词 bbox 可把相同一行的两列课程分开', () => {
  assert.ok(schedule, '尚未实现课表导入');
  const word=(text,x0,x1,y)=>({text,bbox:{x0,x1,y0:y,y1:y+16}});
  const line=(words,y)=>({text:words.map(w=>w.text).join(' '),bbox:{x0:words[0].bbox.x0,x1:words.at(-1).bbox.x1,y0:y,y1:y+16},words});
  const lines=[line([word('星期一',80,180,10),word('星期二',280,380,10)],10),
    line([word('课程：数学',60,200,50),word('课程：英语',260,400,50)],50),
    line([word('第1-2节',60,200,75),word('第3-4节',260,400,75)],75),
    line([word('第1-16周',60,200,100),word('第2-16周双周',260,400,100)],100),
    line([word('教室：A-210',60,200,125),word('老师：李四',260,400,125)],125)];
  const rows=schedule.parseOcr({text:lines.map(x=>x.text).join('\n'),blocks:[{paragraphs:[{lines}]}]});
  assert.deepEqual(rows,[row({name:'数学',teacher:'',day:1}),row({name:'英语',teacher:'李四',day:2,periodsText:'3-4',weeksText:'2-16双周',room:''})]);
});

test('表格左侧节次栏不会覆盖第一列课程，也不会产生“节”伪课程', () => {
  assert.ok(schedule, '尚未实现课表导入');
  const line=(text,x0,x1,y,words)=>({text,bbox:{x0,x1,y0:y,y1:y+30},words:(words||[[text,x0,x1]]).map(w=>({text:w[0],bbox:{x0:w[1],x1:w[2],y0:y,y1:y+30}}))});
  const lines=[line('星期 一',251,344,150,[['星期',251,340],['一',326,344]]),line('星期 二',611,701,150,[['星期',611,699],['二',680,701]]),
    line('运营 管理',159,278,220,[['运营',159,217],['管理',232,278]]),
    line('第 1 一 2 节 第 1 一 2 节',25,285,260,[['第',25,54],['1',60,66],['一',85,105],['2',109,121],['节',131,152],['第',168,196],['1',205,224],['一',223,245],['2',244,254],['节',262,285]]),
    line('第 10 周',158,251,312,[['第',158,196],['10',195,222],['周',230,251]]),
    line('教师 : 杨 从 平',159,337,358,[['教师',159,227],[':',222,234],['杨',256,276],['从',287,307],['平',318,337]]),
    line('教室 : A-210',159,334,404,[['教室',159,227],[':',228,243],['A-210',249,334]]),
    line('第 3 一 5 节',25,157,555,[['第',25,152],['3',62,86],['一',85,110],['5',109,130],['节',129,157]])];
  assert.deepEqual(schedule.parseOcr({blocks:[{paragraphs:[{lines}]}]}),[row({name:'运营管理',teacher:'杨从平',periodsText:'1-2',weeksText:'10'})]);
});

test('短课程名称不会被当成上一门课的教师，含学年字样的课程保留', () => {
  assert.ok(schedule, '尚未实现课表导入');
  const rows=schedule.parseOcr({text:'数学\n星期一 第1-2节 第1-16周\n英语\n星期二 第3-4节 第1-16周\n课程：学年论文\n星期五 第5-6节 第12-16周'});
  assert.deepEqual(rows.map(r=>r.name),['数学','英语','学年论文']);
  assert.deepEqual(rows.map(r=>r.teacher),['','','']);
});

test('OCR丢失节次单位时保留空节次，不把数字片段当成新课程', () => {
  const rows=schedule.parseOcr({text:'课程：运营管理\n第1-2\n第10周\n教师：杨从平\n教室：A-210'});
  assert.deepEqual(rows,[row({name:'运营管理',teacher:'杨从平',day:0,periodsText:'',weeksText:'10'})]);
});

test('表头只有整体 bbox 而没有词位置时不猜测星期列', () => {
  const data={text:'星期一 星期二\n课程：数学\n第1-2节 第1-16周',blocks:[{paragraphs:[{lines:[{text:'星期一 星期二',bbox:{x0:0,x1:400,y0:0,y1:20}}]}]}]};
  const rows=schedule.parseOcr(data);
  assert.equal(rows.length,1);
  assert.equal(rows[0].day,0);
});

test('接受连续范围、离散节次、单双周和中文标点', () => {
  assert.ok(schedule, '尚未实现课表导入');
  const result=schedule.validateRows([row({periodsText:'第1、3、5节',weeksText:'第1～8周（单周）'})]);
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.courses[0].periods,[1,3,5]);
  assert.deepEqual(result.courses[0].weeks,[1,3,5,7]);
  assert.equal(result.courses[0].color,'green');
  const even=schedule.validateRows([row({weeksText:'1-8双周'})]);
  assert.deepEqual(even.courses[0].weeks,[2,4,6,8]);
});

test('所有无效行均报告错误并阻止整批导入', () => {
  assert.ok(schedule, '尚未实现课表导入');
  const result=schedule.validateRows([row(),row({name:'',day:0,periodsText:'',weeksText:''})]);
  assert.deepEqual(result.courses,[]);
  assert.equal(result.errors.length,4);
  assert.ok(result.errors.every(e=>e.includes('第2条')));
});

test('空列表、负数、逆序、越界和无法解析文本都拒绝', () => {
  assert.ok(schedule, '尚未实现课表导入');
  assert.ok(schedule.validateRows([]).errors.length>0);
  for (const periodsText of ['-1','3-1','0','13','1,,2','abc','2-3单周']) {
    const result=schedule.validateRows([row({periodsText})]);
    assert.equal(result.courses.length,0,periodsText);
    assert.ok(result.errors.some(e=>e.includes('节次')),periodsText);
  }
  for (const weeksText of ['-1','4-2','0','61','1-16火周','2-2单周']) {
    const result=schedule.validateRows([row({weeksText})]);
    assert.equal(result.courses.length,0,weeksText);
    assert.ok(result.errors.some(e=>e.includes('周次')),weeksText);
  }
});

test('周末可导入，老师教室可空，重复数字去重并排序', () => {
  assert.ok(schedule, '尚未实现课表导入');
  const result=schedule.validateRows([row({day:7,teacher:'',room:'',periodsText:'5,1,3,1',weeksText:'2,1,2'})]);
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.courses[0].periods,[1,3,5]);
  assert.deepEqual(result.courses[0].weeks,[1,2]);
  assert.equal(result.courses[0].day,7);
});

test('格式化离散集不能误写成连续范围', () => {
  assert.ok(schedule, '尚未实现课表导入');
  assert.equal(schedule.formatRanges([1,2,3,5]),'1–3、5');
  assert.equal(schedule.formatRanges([1,3,5]),'1、3、5');
  assert.equal(schedule.formatRanges([4]),'4');
  assert.equal(schedule.formatRanges([]),'');
});
