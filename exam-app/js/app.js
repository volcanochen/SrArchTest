/* 系统架构设计师备考助手 · 交互逻辑 */
(function(){
  'use strict';
  var D = window.APP_DATA;
  var $ = function(s,r){return (r||document).querySelector(s);};
  var $$ = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};

  /* ---------- 工具 ---------- */
  function dateStr(d){var y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),da=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+da;}
  function parseDate(s){var p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2]);}
  function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
  function daysBetween(a,b){return Math.round((parseDate(b)-parseDate(a))/86400000);}
  function modName(id){var m=D.modules.find(function(x){return x.id===id;});return m?m.name:id;}
  function esc(v){return String(v===undefined||v===null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function difficultyName(v){return {easy:'基础',medium:'进阶',hard:'挑战'}[v]||'综合';}
  function sourceOf(id){return (D.quizSources&&D.quizSources[id])||{title:'应用内讲义整理',url:'',note:'',license:''};}
  function sourceHTML(q,compact){
    var s=sourceOf(q.sourceId),rs=sourceOf(q.readSourceId||q.sourceId);
    var qLink=s.url?'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+'</a>':esc(s.title);
    var rLink=rs.url?'<a href="'+esc(rs.url)+'" target="_blank" rel="noopener noreferrer">'+esc(rs.title)+'</a>':esc(rs.title);
    var html='<div class="qsource'+(compact?' compact':'')+'"><div><b>题目来源：</b>'+qLink+'</div><div><b>解读来源：</b>'+rLink+'（由本应用结构化整理）</div>';
    if(!compact&&s.note)html+='<div class="source-note">'+esc(s.note)+'</div>';
    if(!compact&&s.license)html+='<div class="source-license">授权/性质：'+esc(s.license)+'</div>';
    return html+'</div>';
  }

  /* ---------- 状态 ---------- */
  var KEY='sa_state_v1';
  var state = load();
  function load(){
    try{
      var s=JSON.parse(localStorage.getItem(KEY));
      if(s){
        s.studyDays=s.studyDays||{};s.streak=s.streak||{current:0,best:0};s.mastery=s.mastery||{};
        s.quiz=s.quiz||{};s._ans=s._ans||{};s.srs=s.srs||{};s.milestones=s.milestones||{};
        s.weekTasks=s.weekTasks||{};s.today=s.today||{};s.course=s.course||{};
        return s;
      }
    }catch(e){}
    return {
      examDate: D.meta.defaultExamDate,
      studyDays:{}, streak:{current:0,best:0},
      mastery:{}, quiz:{}, _ans:{}, srs:{}, milestones:{}, weekTasks:{}, today:{}, course:{}
    };
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}

  /* ---------- 课程状态 ---------- */
  var courseState = {open:null, test:null};
  function findQuiz(id){return D.quiz.find(function(q){return q.id===id;});}

  /* ---------- 打卡 / 连续天数 ---------- */
  function markStudied(){
    var t=dateStr(new Date());
    if(!state.studyDays[t]){state.studyDays[t]=true;save();}
    recomputeStreak();
  }
  function recomputeStreak(){
    var days=Object.keys(state.studyDays).sort();
    var set=new Set(days);
    var cur=new Date();
    if(!set.has(dateStr(cur))) cur=addDays(cur,-1);
    var s=0;
    while(set.has(dateStr(cur))){s++;cur=addDays(cur,-1);}
    state.streak.current=s;
    if(s>state.streak.best)state.streak.best=s;
    save();
  }

  /* ---------- 派生指标 ---------- */
  function knowledgePct(){
    var sum=0,n=D.modules.length;
    D.modules.forEach(function(m){sum+=(state.mastery[m.id]||0);});
    return Math.round(sum/(n*2)*100);
  }
  function quizStat(){
    var ans=0,correct=0;
    D.quiz.forEach(function(q){var r=state.quiz[q.id];if(r==='c')correct++;if(r==='c'||r==='w')ans++;});
    return {ans:ans,correct:correct,acc:ans?Math.round(correct/ans*100):0};
  }
  function milestoneStat(){
    var total=0,done=0,byPhase={};
    D.plan.phases.forEach(function(p){byPhase[p.id]={t:0,d:0};p.milestones.forEach(function(_,i){
      total++;byPhase[p.id].t++;
      if(state.milestones[p.id+'-'+i]){done++;byPhase[p.id].d++;}
    });});
    return {total:total,done:done,pct:total?Math.round(done/total*100):0,byPhase:byPhase};
  }
  function overall(){
    var k=knowledgePct(),q=quizStat().acc,pl=milestoneStat().pct;
    return Math.round(0.45*k+0.30*q+0.25*pl);
  }

  /* ---------- 计划时间轴 ---------- */
  function buildWeeks(){
    var today=dateStr(new Date());
    var total=Math.max(1,daysBetween(today,state.examDate));
    var weeks=Math.ceil(total/7);
    var bounds=[],acc=0;
    D.plan.phases.forEach(function(p){bounds.push(acc);acc+=p.weeks;});
    var totalDef=acc;
    var list=[];
    for(var i=0;i<weeks;i++){
      var scaled=Math.floor(i*totalDef/weeks);
      var ph=0;for(var k=0;k<D.plan.phases.length;k++){if(scaled>=bounds[k])ph=k;}
      var phase=D.plan.phases[ph];
      var wIn=scaled-bounds[ph];
      var focus=phase.rotation[wIn%phase.rotation.length];
      var dt=addDays(parseDate(today),i*7);
      var status=i===0?'current':(dt<parseDate(today)?'past':'future');
      list.push({i:i,phase:phase,focus:focus,date:dateStr(dt),status:status,
        tasks:[
          '学习/复习模块：'+modName(focus),
          ['做对应模块专项选择题','整理该模块思维导图','回顾本周错题本','写 200 字学习笔记'][i%4]
        ]});
    }
    return list;
  }

  /* ---------- Toast ---------- */
  var toastT;
  function toast(msg){
    var el=$('#toast');el.textContent=msg;el.classList.add('show');
    clearTimeout(toastT);toastT=setTimeout(function(){el.classList.remove('show');},1600);
  }

  /* ---------- 渲染：首页 ---------- */
  function renderHome(){
    var today=dateStr(new Date());
    var cd=daysBetween(today,state.examDate);
    $('#homeCountdown').textContent=cd>0?cd:0;
    $('#topCountdown').textContent=cd>0?cd:0;
    $('#homeExamDate').textContent='考试日期：'+state.examDate+(cd<0?'（已过期，请更新）':'');
    $('#mStreak').textContent=state.streak.current;
    $('#mMastery').textContent=knowledgePct()+'%';
    var qs=quizStat();$('#mQuiz').textContent=qs.acc+'%';

    var ov=overall();
    var C=2*Math.PI*40;
    var off=C*(1-ov/100);
    $('#ringProgress').setAttribute('stroke-dashoffset',off.toFixed(1));
    $('#ringText').textContent=ov+'%';

    var ms=milestoneStat();
    $('#pCompPct').textContent=Math.round(0.6*knowledgePct()+0.4*qs.acc)+'%';
    $('#pComp').style.width=(0.6*knowledgePct()+0.4*qs.acc)+'%';
    var pc=ms.byPhase;
    var caseT=(pc['p2'].t+pc['p3'].t)||1, caseD=pc['p2'].d+pc['p3'].d;
    var thT=pc['p4'].t||1, thD=pc['p4'].d;
    $('#pCasePct').textContent=Math.round(caseD/caseT*100)+'%';$('#pCase').style.width=(caseD/caseT*100)+'%';
    $('#pThesisPct').textContent=Math.round(thD/thT*100)+'%';$('#pThesis').style.width=(thD/thT*100)+'%';

    renderToday();
    var course=buildCourse();
    var cur=todayLesson(course);
    $('#courseTodayDate').textContent=cur.date;
    $('#courseTodayTitle').textContent=cur.title;
    $('#courseTodayDesc').textContent=(state.course[cur.idx]&&state.course[cur.idx].done)?'已完成，可复习或学下一课':'今日计划学习内容';
  }

  function renderToday(){
    var today=dateStr(new Date());
    var focusIdx=(Math.floor((parseDate(today)-parseDate('2026-01-01'))/86400000))%D.modules.length;
    var tasks=[
      {k:'mod',t:'精读模块：'+D.modules[focusIdx].name},
      {k:'quiz',t:'完成 5 道综合知识选择题'},
      {k:'card',t:'记忆卡复习 10 张'},
      {k:'case',t:'浏览案例分析答题框架'}
    ];
    var ul=$('#todayList');ul.innerHTML='';
    var remain=0;
    tasks.forEach(function(tk,idx){
      var done=!!state.today[today+'-'+idx];
      if(!done)remain++;
      var li=document.createElement('li');if(done)li.className='done';
      li.innerHTML='<div class="chk'+(done?' on':'')+'">'+(done?'✓':'')+'</div><div class="txt">'+tk.t+'</div>';
      li.querySelector('.chk').addEventListener('click',function(){
        state.today[today+'-'+idx]=!state.today[today+'-'+idx];
        if(state.today[today+'-'+idx]){markStudied();toast('已记录，坚持就是胜利');}else{recomputeStreak();}
        renderToday();renderHome();updateHomeBadge();save();
      });
      ul.appendChild(li);
    });
    $('#todayDate').textContent=today;
    updateHomeBadge(remain);
  }
  function updateHomeBadge(remain){
    if(remain===undefined){var t=dateStr(new Date());remain=0;[0,1,2,3].forEach(function(i){if(!state.today[t+'-'+i])remain++;});}
    var btn=$$('.tabbar button')[0];
    var b=btn.querySelector('.badge');
    if(remain>0){if(!b){b=document.createElement('span');b.className='badge';btn.appendChild(b);}b.textContent=remain;}
    else if(b){b.remove();}
  }

  /* ---------- 渲染：计划 ---------- */
  function renderPlan(){
    var pl=$('#phaseList');pl.innerHTML='';
    D.plan.phases.forEach(function(p){
      var div=document.createElement('div');div.className='phase';div.style.borderLeftColor=p.color;
      var ms=milestoneStat().byPhase[p.id];
      var html='<div class="ph-top"><span class="ph-name">'+p.name+'</span><span class="ph-weeks" style="background:'+p.color+'">'+p.weeks+'周</span></div>';
      html+='<div class="ph-desc">'+p.desc+'</div>';
      p.milestones.forEach(function(m,i){
        var done=!!state.milestones[p.id+'-'+i];
        html+='<div class="ms'+(done?' done':'')+'"><div class="box'+(done?' on':'')+'" data-ph="'+p.id+'" data-mi="'+i+'">'+(done?'✓':'')+'</div><div class="mt">'+m+'</div></div>';
      });
      div.innerHTML=html;pl.appendChild(div);
    });
    $$('#phaseList .box').forEach(function(box){
      box.addEventListener('click',function(){
        var ph=box.getAttribute('data-ph'),mi=+box.getAttribute('data-mi');
        state.milestones[ph+'-'+mi]=!state.milestones[ph+'-'+mi];
        if(state.milestones[ph+'-'+mi]){markStudied();toast('里程碑达成');}
        save();renderPlan();renderHome();renderMe();
      });
    });

    var wl=$('#weekList');wl.innerHTML='';
    buildWeeks().forEach(function(w){
      var div=document.createElement('div');div.className='week '+(w.status==='past'?'past':(w.status==='future'?'future':''));
      var html='<div class="rail"><div class="wn">W'+(w.i+1)+'</div><div class="wd">'+w.date.slice(5)+'</div><div class="dot"></div></div>';
      html+='<div class="wbody"><span class="wphase" style="background:'+w.phase.color+'">'+w.phase.name+'</span>';
      w.tasks.forEach(function(tk,j){
        var done=!!state.weekTasks['w'+w.i+'-'+j];
        html+='<div class="wtask'+(done?' done':'')+'"><div class="c'+(done?' on':'')+'" data-w="'+w.i+'" data-j="'+j+'">'+(done?'✓':'')+'</div>'+tk+'</div>';
      });
      html+='</div>';
      div.innerHTML=html;wl.appendChild(div);
    });
    $$('#weekList .c').forEach(function(c){
      c.addEventListener('click',function(){
        var wi=+c.getAttribute('data-w'),j=+c.getAttribute('data-j');
        state.weekTasks['w'+wi+'-'+j]=!state.weekTasks['w'+wi+'-'+j];
        if(state.weekTasks['w'+wi+'-'+j]){markStudied();}
        save();renderPlan();renderHome();
      });
    });
  }

  /* ---------- 知识点卡片 HTML（知识页与课程页共用） ---------- */
  function kpHTML(p){
    var body='';
    if(Array.isArray(p.v)){body+='<ul class="kv-list">'+p.v.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ul>';}
    else if(p.v){body+='<div class="kv">'+p.v+'</div>';}
    if(p.eg)body+='<div class="keg"><span class="tag eg">例子</span>'+p.eg+'</div>';
    if(p.memo)body+='<div class="kmemo"><span class="tag memo">记忆</span>'+p.memo+'</div>';
    if(p.warn)body+='<div class="kwarn"><span class="tag warn">易错</span>'+p.warn+'</div>';
    return '<div class="kp"><div class="kk">'+p.k+'</div>'+body+'</div>';
  }

  /* ---------- 渲染：知识 ---------- */
  function renderKnowledge(){
    var ml=$('#moduleList');ml.innerHTML='';
    D.modules.forEach(function(m){
      var div=document.createElement('div');div.className='mod';
      var lvl=state.mastery[m.id]||0;
      var html='<div class="mhead"><div class="mbadge" style="background:'+m.color+'">'+m.badge+'</div>'+
        '<div class="mname">'+m.name+'</div><div class="mwt">权重'+m.weight+'</div><div class="mchev">›</div></div>';
      html+='<div class="mbody">';
      m.points.forEach(function(p){html+=kpHTML(p);});
      html+='<div class="mfoot">'+
        '<div class="tag-btn t0'+(lvl===0?' active':'')+'" data-m="'+m.id+'" data-l="0">未学</div>'+
        '<div class="tag-btn t1'+(lvl===1?' active':'')+'" data-m="'+m.id+'" data-l="1">学习中</div>'+
        '<div class="tag-btn t2'+(lvl===2?' active':'')+'" data-m="'+m.id+'" data-l="2">已掌握</div>'+
        '</div></div>';
      div.innerHTML=html;ml.appendChild(div);
      div.querySelector('.mhead').addEventListener('click',function(){div.classList.toggle('open');});
    });
    $$('#moduleList .tag-btn').forEach(function(b){
      b.addEventListener('click',function(e){
        e.stopPropagation();
        var m=b.getAttribute('data-m'),l=+b.getAttribute('data-l');
        state.mastery[m]=(state.mastery[m]===l)?0:l;
        markStudied();save();renderKnowledge();renderHome();renderMe();
      });
    });
  }

  /* ---------- 渲染：课程（按天排课 + 学完即测） ---------- */
  function buildCourse(){
    var order = D.plan.phases[0].rotation; // 13 个模块的天然学习顺序
    var units=[];
    order.forEach(function(mid){
      var m=D.modules.find(function(x){return x.id===mid;});
      m.points.forEach(function(p,pi){units.push({modId:mid,pi:pi});});
    });
    var CHUNK=3;
    var lessons=[],li=0,i=0;
    while(i<units.length){
      var grp=units.slice(i,i+CHUNK);i+=CHUNK;
      var mid=grp[0].modId;
      var m=D.modules.find(function(x){return x.id===mid;});
      var lectureNo=lessons.filter(function(x){return x.modId===mid;}).length+1;
      var ids=[];
      grp.forEach(function(u){
        var key=u.modId+':'+u.pi;
        var pointPool=D.quiz.filter(function(q){return q.pointKey===key;});
        if(pointPool.length){
          ids.push(pointPool[(u.pi+lectureNo)%pointPool.length].id);
          ids.push(pointPool[(u.pi+lectureNo+2)%pointPool.length].id);
        }
      });
      if(ids.length<4){
        D.quiz.filter(function(q){return q.m===mid&&q.kind==='past';}).slice(0,4-ids.length).forEach(function(q){ids.push(q.id);});
      }
      lessons.push({idx:li++,type:'knowledge',modId:mid,
        title:m.name+' · 第'+lectureNo+'讲',
        sub:'本讲 '+grp.length+' 个要点（共 '+m.points.length+' 个）',
        points:grp,quizIds:ids});
    }
    // 案例分析课
    lessons.push({idx:li++,type:'case',title:'案例分析 · 答题框架与套路',sub:'通用结构 + 8 类题型',
      selfItems:[
        '答题五步：定位层面 → 分析根因 → 给方案 → 论证取舍 → 量化验证',
        '架构风格选型：列候选 → 对比优劣 → 结合场景选定 → 论证理由',
        '质量属性用战术实现：可用→冗余/心跳，性能→缓存/异步，安全→认证/加密',
        '性能/数据库/安全/分布式各有固定套路，先背框架再往里套'
      ]});
    // 论文课
    lessons.push({idx:li++,type:'thesis',title:'论文 · 四段式结构与素材',sub:'背景→需求→设计→效果→总结',
      selfItems:[
        '结构四段：项目背景 → 需求约束 → 架构设计(主体) → 实施效果 → 总结',
        '提前准备 3~4 个通用项目素材，覆盖不同论文角度',
        '时间分配：读题 5 + 提纲 10 + 写作 95 + 检查 10 分钟',
        '评分看重：真实项目 + 量化数据 + 结构清晰 + 技术细节充分'
      ]});
    // 分配日期：均匀铺到「考试前 14 天」
    var today=dateStr(new Date());
    var total=Math.max(1,daysBetween(today,state.examDate));
    var win=Math.max(lessons.length,total-14);
    lessons.forEach(function(L,idx){
      var off=Math.round(idx*win/lessons.length);
      L.date=dateStr(addDays(parseDate(today),off));
    });
    return lessons;
  }
  function courseDoneCount(course){
    return course.filter(function(L){return state.course[L.idx]&&state.course[L.idx].done;}).length;
  }
  function todayLesson(course){
    var today=dateStr(new Date());
    return course.find(function(L){return L.date<=today && !(state.course[L.idx]&&state.course[L.idx].done);}) || course[course.length-1];
  }
  function renderCourse(){
    var view=$('#view-course');
    if(courseState.open===null) renderCourseList(view);
    else renderCourseDetail(view,courseState.open);
  }
  function renderCourseList(view){
    var course=buildCourse();
    var today=dateStr(new Date());
    var done=courseDoneCount(course);
    var cur=todayLesson(course);
    var pct=Math.round(done/course.length*100);
    var html='<div class="section-title"><span class="bar"></span>备考课程（按天学习 · 学完即测）</div>';
    html+='<div class="card course-prog"><div class="cp-top"><span>课程总进度</span><b>'+done+' / '+course.length+' 课</b></div><div class="bar"><i style="width:'+pct+'%"></i></div></div>';
    html+='<div class="today-lesson" id="todayLesson">';
    html+='<div class="tl-top"><span class="tl-tag">今日课程</span><span class="tl-date">'+cur.date+'</span></div>';
    html+='<div class="tl-title">'+cur.title+'</div>';
    html+='<div class="tl-desc">'+cur.sub+'</div>';
    html+='<button class="btn btn-primary" id="startToday">开始学习本节课</button>';
    html+='</div>';
    html+='<div class="section-title"><span class="bar"></span>课程表</div><div class="course-list">';
    course.forEach(function(L){
      var st=state.course[L.idx];
      var status=(st&&st.done)?'done':(L.date<=today?'current':'future');
      var badge=(st&&st.done)?'已完成':(L.date<=today?'进行中 · 待学':'未开始');
      html+='<div class="cl-row '+status+'" data-idx="'+L.idx+'">';
      html+='<div class="cl-rail"><div class="cl-dot"></div></div>';
      html+='<div class="cl-body"><div class="cl-date">'+L.date+'</div><div class="cl-title">'+L.title+'</div><div class="cl-sub">'+badge+' · '+L.sub+'</div></div>';
      html+='</div>';
    });
    html+='</div>';
    view.innerHTML=html;
    $('#startToday').addEventListener('click',function(){courseState.open=cur.idx;renderCourse();window.scrollTo(0,0);});
    $$('#view-course .cl-row').forEach(function(r){r.addEventListener('click',function(){courseState.open=+r.getAttribute('data-idx');renderCourse();window.scrollTo(0,0);});});
  }
  function renderCourseDetail(view,idx){
    var course=buildCourse();
    var L=course[idx];
    var st=state.course[idx]||{};
    var today=dateStr(new Date());
    var html='<div class="lesson-top"><button class="back" id="lessonBack">‹ 返回课程表</button></div>';
    html+='<div class="lesson-head"><span class="lesson-badge">'+L.title+'</span></div>';
    html+='<div class="lesson-date">计划学习日：'+L.date+(L.date<=today?'（已到/已过）':'（未到，可提前学）')+'</div>';
    html+='<div class="lesson-content">';
    if(L.type==='knowledge'){
      L.points.forEach(function(u){var m=D.modules.find(function(x){return x.id===u.modId;});html+=kpHTML(m.points[u.pi]);});
    } else if(L.type==='case'){
      var cf=D.caseFramework;
      html+='<div class="guide-block"><p class="muted">'+cf.intro+'</p><h3>通用答题结构</h3><ol>'+cf.structure.map(function(s){return '<li>'+s+'</li>';}).join('')+'</ol></div>';
      html+='<div class="guide-block"><h3>常见题型与套路</h3><div class="gtype">'+cf.types.map(function(t){return '<div class="gt"><div class="gn">'+t.name+'</div><div class="gd">'+t.tip+'</div></div>';}).join('')+'</div></div>';
    } else if(L.type==='thesis'){
      var t=D.thesis;
      html+='<div class="guide-block"><p class="muted">'+t.intro+'</p><h3>推荐结构（四段式）</h3><ol>'+t.structure.map(function(s){return '<li>'+s+'</li>';}).join('')+'</ol></div>';
      html+='<div class="guide-block"><h3>常见选题方向</h3><div>'+t.topics.map(function(s){return '<span class="chip">'+s+'</span>';}).join('')+'</div></div>';
      html+='<div class="guide-block"><h3>项目素材准备</h3><ul>'+t.materials.map(function(s){return '<li>'+s+'</li>';}).join('')+'</ul></div>';
      html+='<div class="guide-block"><h3>时间分配</h3><p class="muted">'+t.timing+'</p></div>';
      html+='<div class="guide-block"><h3>评分要点</h3><p class="muted">'+t.scoring+'</p></div>';
    }
    html+='</div>';
    if(courseState.test && courseState.test.lessonIdx===idx){
      html+=renderLessonTestPanel(L);
    } else {
      html+='<div class="lesson-foot">';
      html+='<button class="btn '+(st.read?'btn-ghost':'btn-primary')+'" id="markRead">'+(st.read?'已读 ✓':'标记已读')+'</button>';
      if(L.type==='knowledge' && L.quizIds && L.quizIds.length){
        html+='<button class="btn btn-accent" id="startTest">开始课后测试（'+L.quizIds.length+' 题）</button>';
      } else {
        html+='<button class="btn btn-accent" id="startSelf">要点自检</button>';
      }
      if(st.done)html+='<div class="lesson-done-tag">本课已完成 ✓</div>';
      html+='</div>';
    }
    view.innerHTML=html;
    $('#lessonBack').addEventListener('click',function(){courseState.open=null;courseState.test=null;renderCourse();window.scrollTo(0,0);});
    if($('#markRead'))$('#markRead').addEventListener('click',function(){
      state.course[idx]=state.course[idx]||{};state.course[idx].read=true;
      markStudied();save();renderCourseDetail($('#view-course'),idx);renderHome();toast('已记录阅读');
    });
    if($('#startTest'))$('#startTest').addEventListener('click',function(){startLessonTest(idx,L);});
    if($('#startSelf'))$('#startSelf').addEventListener('click',function(){startLessonSelf(idx,L);});
    bindLessonTest(view,idx,L);
  }
  function renderLessonTestPanel(L){
    var t=courseState.test,html='<div class="lesson-test">';
    if(t.self){
      html+='<div class="lt-title">要点自检</div><div class="lt-sub">勾选你已掌握的要点，确认后完成本课</div>';
      t.items.forEach(function(it,i){var on=(t.checked&&t.checked[i])?'checked':'';html+='<label class="self-item"><input type="checkbox" data-i="'+i+'" '+on+'><span>'+it+'</span></label>';});
      html+='<button class="btn btn-primary" id="finishSelf">确认掌握，完成本课</button>';
    } else {
      var q=findQuiz(t.ids[t.idx]),total=t.ids.length,letters=['A','B','C','D','E'];
      html+='<div class="lt-title">课后测试 '+(t.idx+1)+' / '+total+'</div>';
      html+='<div class="lt-q">'+esc(q.q)+'</div>';
      q.o.forEach(function(o,i){
        var cls='lopt';
        if(t.locked){if(i===q.a)cls+=' correct';else if(i===t.sel&&i!==q.a)cls+=' wrong';}
        else if(i===t.sel)cls+=' sel';
        html+='<div class="'+cls+'" data-i="'+i+'">'+letters[i]+'. '+esc(o)+'</div>';
      });
      html+='<div class="lt-explain'+(t.locked?' show':'')+'"><div><b>题目解读：</b>'+esc(q.read)+'</div><div class="answer-explain"><b>答案解析：</b>'+esc(q.e)+'</div>'+sourceHTML(q,true)+'</div>';
      if(!t.locked)html+='<button class="btn btn-primary" id="lockTest">提交答案</button>';
      else if(t.idx<total-1)html+='<button class="btn btn-primary" id="nextTest">下一题</button>';
      else html+='<button class="btn btn-primary" id="finishTest">查看成绩并完成本课</button>';
    }
    html+='</div>';
    return html;
  }
  function bindLessonTest(view,idx,L){
    var t=courseState.test;if(!t||t.lessonIdx!==idx)return;
    if(t.self){
      $$('#view-course .self-item input').forEach(function(cb){cb.addEventListener('change',function(){var i=+cb.getAttribute('data-i');t.checked[i]=cb.checked;});});
      if($('#finishSelf'))$('#finishSelf').addEventListener('click',function(){completeLesson(idx);});
    } else {
      $$('#view-course .lopt').forEach(function(op){op.addEventListener('click',function(){if(t.locked)return;t.sel=+op.getAttribute('data-i');renderCourseDetail($('#view-course'),idx);});});
      if($('#lockTest'))$('#lockTest').addEventListener('click',function(){
        if(t.sel<0){toast('请先选择一个答案');return;}
        t.locked=true;var q=findQuiz(t.ids[t.idx]);if(t.sel===q.a)t.correct++;save();renderCourseDetail($('#view-course'),idx);
      });
      if($('#nextTest'))$('#nextTest').addEventListener('click',function(){t.idx++;t.locked=false;t.sel=-1;renderCourseDetail($('#view-course'),idx);});
      if($('#finishTest'))$('#finishTest').addEventListener('click',function(){
        var score=Math.round(t.correct/t.ids.length*100);toast('本课测试 '+t.correct+'/'+t.ids.length+' 正确（'+score+'%）');completeLesson(idx,score);
      });
    }
  }
  function startLessonTest(idx,L){
    courseState.test={lessonIdx:idx,self:false,ids:L.quizIds.slice(),idx:0,locked:false,sel:-1,correct:0};
    renderCourseDetail($('#view-course'),idx);window.scrollTo(0,0);
  }
  function startLessonSelf(idx,L){
    courseState.test={lessonIdx:idx,self:true,items:L.selfItems,checked:[]};
    renderCourseDetail($('#view-course'),idx);window.scrollTo(0,0);
  }
  function completeLesson(idx,score){
    state.course[idx]=state.course[idx]||{};
    state.course[idx].read=true;state.course[idx].tested=true;state.course[idx].done=true;
    if(score!==undefined)state.course[idx].score=score;
    courseState.test=null;courseState.open=null;
    markStudied();save();renderCourse();renderHome();toast('本课已完成');
  }

  /* ---------- 渲染：练习 / 题库 ---------- */
  var quizState={module:'all',kind:'all',year:'all',difficulty:'all',idx:0,locked:false};
  function resetQuizPosition(){quizState.idx=0;quizState.locked=false;}
  function quizList(){
    return D.quiz.filter(function(q){
      if(quizState.module!=='all'&&q.m!==quizState.module)return false;
      if(quizState.kind!=='all'&&q.kind!==quizState.kind)return false;
      if(quizState.year!=='all'&&String(q.year)!==quizState.year)return false;
      if(quizState.difficulty!=='all'&&q.difficulty!==quizState.difficulty)return false;
      return true;
    });
  }
  function makeQuizSelect(label,key,options){
    var lab=document.createElement('label');lab.className='qselect';
    var span=document.createElement('span');span.textContent=label;lab.appendChild(span);
    var sel=document.createElement('select');
    options.forEach(function(o){var op=document.createElement('option');op.value=o.v;op.textContent=o.t;if(String(quizState[key])===String(o.v))op.selected=true;sel.appendChild(op);});
    sel.addEventListener('change',function(){quizState[key]=sel.value;if(key==='kind'&&sel.value==='original')quizState.year='all';resetQuizPosition();renderQuiz();});
    lab.appendChild(sel);return lab;
  }
  function renderQuizFilter(){
    var wrap=document.createElement('div');wrap.className='qfilter-wrap';
    var mods=document.createElement('div');mods.className='qfilter';
    var opts=[{v:'all',t:'全部模块'}].concat(D.modules.map(function(m){return {v:m.id,t:m.name.slice(0,6)};}));
    opts.forEach(function(o){
      var b=document.createElement('button');b.textContent=o.t;b.dataset.f=o.v;
      if(o.v===quizState.module)b.className='active';
      b.addEventListener('click',function(){quizState.module=o.v;resetQuizPosition();renderQuiz();});mods.appendChild(b);
    });
    wrap.appendChild(mods);
    var controls=document.createElement('div');controls.className='qfilter-controls';
    var years=Array.from(new Set(D.quiz.filter(function(q){return q.kind==='past'&&q.year;}).map(function(q){return q.year;}))).sort(function(a,b){return b-a;});
    controls.appendChild(makeQuizSelect('来源','kind',[{v:'all',t:'全部来源'},{v:'past',t:'历年真题·社区整理'},{v:'original',t:'原创练习'}]));
    controls.appendChild(makeQuizSelect('年份','year',[{v:'all',t:'全部年份'}].concat(years.map(function(y){return {v:String(y),t:String(y)+' 年'};}))));
    controls.appendChild(makeQuizSelect('难度','difficulty',[{v:'all',t:'全部难度'},{v:'easy',t:'基础'},{v:'medium',t:'进阶'},{v:'hard',t:'挑战'}]));
    wrap.appendChild(controls);return wrap;
  }
  function renderQuiz(){
    var box=$('#sub-quiz');box.innerHTML='';
    var qs=quizStat(),meta=D.quizMeta||{};
    var stat=document.createElement('div');stat.className='qstat';
    stat.innerHTML='<div class="s"><div class="v">'+D.quiz.length+'</div><div class="l">题库总量</div></div>'+ 
      '<div class="s"><div class="v past-v">'+(meta.past||D.quiz.filter(function(q){return q.kind==='past';}).length)+'</div><div class="l">历年真题</div></div>'+ 
      '<div class="s"><div class="v ok">'+qs.ans+'</div><div class="l">已作答</div></div>'+ 
      '<div class="s"><div class="v">'+qs.acc+'%</div><div class="l">正确率</div></div>';
    box.appendChild(stat);
    if(meta.notice){var note=document.createElement('div');note.className='quiz-notice';note.textContent=meta.notice;box.appendChild(note);}
    box.appendChild(renderQuizFilter());

    var list=quizList();
    var found=document.createElement('div');found.className='qfound';found.textContent='当前筛选共 '+list.length+' 题';box.appendChild(found);
    if(!list.length){box.insertAdjacentHTML('beforeend','<div class="card center muted">当前筛选条件下暂无题目，请调整来源、年份或难度。</div>');return;}
    if(quizState.idx>=list.length)quizState.idx=list.length-1;
    var q=list[quizState.idx],answered=state.quiz[q.id];
    var card=document.createElement('div');card.className='qcard-q';
    var optLetters=['A','B','C','D','E'];
    var kindLabel=q.kind==='past'?'历年真题 · 社区整理':'原创练习';
    var kindClass=q.kind==='past'?'past':'original';
    var origin=q.year?(q.session+(q.paperNo?' · 第'+q.paperNo+'题':'')):q.session;
    var html='<div class="meta qmeta"><div class="q-tags"><span class="qkind '+kindClass+'">'+esc(kindLabel)+'</span><span>'+esc(modName(q.m))+'</span><span>'+esc(difficultyName(q.difficulty))+'</span>'+(answered?'<span class="answered">已作答</span>':'')+'</div><span>第 '+(quizState.idx+1)+'/'+list.length+' 题</span></div>';
    html+='<div class="qorigin">'+esc(origin||'')+'</div>';
    html+='<div class="qtext">'+esc(q.q)+'</div>';
    q.o.forEach(function(o,i){
      var cls='opt';
      if(quizState.locked){
        if(i===q.a)cls+=' correct';
        else if(i===state._ans[q.id])cls+=' wrong';
      }
      html+='<div class="'+cls+'" data-i="'+i+'">'+optLetters[i]+'. '+esc(o)+'</div>';
    });
    html+='<div class="qafter'+(quizState.locked?' show':'')+'">'+
      '<div class="qread"><b>题目解读：</b>'+esc(q.read)+'</div>'+ 
      '<div class="qexplain show"><b>答案解析：</b>'+esc(q.e)+'</div>'+sourceHTML(q,false)+'</div>';
    card.innerHTML=html;box.appendChild(card);

    if(!quizState.locked){
      $$('#sub-quiz .opt').forEach(function(op){op.addEventListener('click',function(){var i=+op.getAttribute('data-i');state._ans[q.id]=i;lockAnswer(q,i);});});
    }else{$$('#sub-quiz .opt').forEach(function(op){op.style.pointerEvents='none';});}

    var nav=document.createElement('div');nav.className='qnav';
    nav.innerHTML='<button class="prev">上一题</button><button class="random">随机一题</button><button class="next">下一题</button>';
    nav.querySelector('.prev').addEventListener('click',function(){if(quizState.idx>0){quizState.idx--;quizState.locked=false;renderQuiz();}});
    nav.querySelector('.next').addEventListener('click',function(){if(quizState.idx<list.length-1){quizState.idx++;quizState.locked=false;renderQuiz();}});
    nav.querySelector('.random').addEventListener('click',function(){quizState.idx=Math.floor(Math.random()*list.length);quizState.locked=false;renderQuiz();});
    box.appendChild(nav);
  }
  function lockAnswer(q,i){
    if(quizState.locked)return;
    var correct=(i===q.a);
    state.quiz[q.id]=correct?'c':'w';
    quizState.locked=true;
    markStudied();save();renderQuiz();renderHome();toast(correct?'回答正确':'查看题目解读与答案解析');
  }

  /* ---------- 渲染：练习 / 记忆卡 ---------- */
  function dueCards(){
    var today=dateStr(new Date());
    return D.flashcards.map(function(f,idx){return idx;}).filter(function(idx){
      var s=state.srs[idx];if(!s)return true;return s.due<=today;
    });
  }
  var cardPointer=0;
  function renderCards(){
    var box=$('#sub-cards');box.innerHTML='';
    var due=dueCards();
    if(!due.length){box.innerHTML='<div class="card center"><div style="font-size:40px;margin-bottom:8px">✓</div><div class="muted">本轮记忆卡已全部复习完毕！</div><div class="small muted">明天会按间隔重复安排复习</div></div>';return;}
    if(cardPointer>=due.length)cardPointer=0;
    var idx=due[cardPointer];
    var f=D.flashcards[idx];
    var stage=document.createElement('div');stage.className='fc-stage';
    stage.innerHTML=
      '<div class="fc-prog">进度 '+(cardPointer+1)+' / '+due.length+'　（共 '+D.flashcards.length+' 张）</div>'+
      '<div class="fc" id="fc"><div class="fc-inner">'+
        '<div class="fc-face fc-front"><span class="fc-tag">记忆卡</span><div class="term">'+f.t+'</div></div>'+
        '<div class="fc-face fc-back"><span class="fc-mod">'+modName(f.m)+'</span><div class="def">'+f.d+'</div></div>'+
      '</div></div>'+
      '<div class="fc-btns">'+
        '<button class="bad" data-r="again">不认识</button>'+
        '<button class="again" data-r="soon">模糊</button>'+
        '<button class="good" data-r="good">认识</button>'+
      '</div>';
    box.appendChild(stage);
    var fc=$('#fc');
    fc.addEventListener('click',function(){fc.classList.toggle('flip');});
    $$('#sub-cards .fc-btns button').forEach(function(b){
      b.addEventListener('click',function(e){
        e.stopPropagation();
        var r=b.getAttribute('data-r');
        var today=dateStr(new Date());
        var s=state.srs[idx]||{lvl:0};
        if(r==='again'){s.lvl=0;s.due=today;}
        else if(r==='soon'){s.lvl=Math.max(0,s.lvl-1);s.due=dateStr(addDays(parseDate(today),1));}
        else {s.lvl=Math.min(3,s.lvl+1);var iv=[0,1,3,7][s.lvl];s.due=dateStr(addDays(parseDate(today),iv));}
        state.srs[idx]=s;
        markStudied();save();
        cardPointer++;renderCards();renderHome();
      });
    });
  }

  /* ---------- 渲染：练习 / 案例 & 论文 ---------- */
  function renderCase(){
    var cf=D.caseFramework;var box=$('#sub-case');
    var html='<div class="guide-block"><p class="muted" style="margin-top:0">'+cf.intro+'</p>'+
      '<h3>通用答题结构</h3><ol>'+cf.structure.map(function(s){return '<li>'+s+'</li>';}).join('')+'</ol></div>';
    html+='<div class="guide-block"><h3>常见题型与套路</h3><div class="gtype">';
    cf.types.forEach(function(t){html+='<div class="gt"><div class="gn">'+t.name+'</div><div class="gd">'+t.tip+'</div></div>';});
    html+='</div></div>';
    box.innerHTML=html;
  }
  function renderThesis(){
    var t=D.thesis;var box=$('#sub-thesis');
    var html='<div class="guide-block"><p class="muted" style="margin-top:0">'+t.intro+'</p>'+
      '<h3>推荐结构（四段式）</h3><ol>'+t.structure.map(function(s){return '<li>'+s+'</li>';}).join('')+'</ol></div>';
    html+='<div class="guide-block"><h3>常见选题方向</h3><div>';
    t.topics.forEach(function(s){html+='<span class="chip">'+s+'</span>';});
    html+='</div></div>';
    html+='<div class="guide-block"><h3>项目素材准备</h3><ul>'+t.materials.map(function(s){return '<li>'+s+'</li>';}).join('')+'</ul></div>';
    html+='<div class="guide-block"><h3>时间分配</h3><p class="muted" style="margin:0">'+t.timing+'</p></div>';
    html+='<div class="guide-block"><h3>评分要点</h3><p class="muted" style="margin:0">'+t.scoring+'</p></div>';
    box.innerHTML=html;
  }

  /* ---------- 渲染：我的 ---------- */
  function renderMe(){
    var days=Object.keys(state.studyDays).length;
    var mastered=D.modules.filter(function(m){return (state.mastery[m.id]||0)===2;}).length;
    var qs=quizStat();
    $('#sTotal').textContent=Math.round(days*25); // 估算累计分钟
    $('#sDays').textContent=days;
    $('#sMod').textContent=mastered+'/'+D.modules.length;
    $('#sQuiz').textContent=qs.ans;
    $('#examDateInput').value=state.examDate;
    $('#aboutNote').textContent=D.meta.note;
  }

  /* ---------- 视图切换 ---------- */
  function switchView(v){
    $$('.view').forEach(function(s){s.classList.remove('active');});
    $('#view-'+v).classList.add('active');
    $$('.tabbar button').forEach(function(b){b.classList.toggle('active',b.dataset.view===v);});
    if(v==='home')renderHome();
    if(v==='plan')renderPlan();
    if(v==='knowledge')renderKnowledge();
    if(v==='practice')renderPractice('quiz');
    if(v==='course')renderCourse();
    if(v==='me')renderMe();
    window.scrollTo(0,0);
  }
  function renderPractice(sub){
    ['quiz','cards','case','thesis'].forEach(function(s){$('#sub-'+s).classList.toggle('hidden',s!==sub);});
    $$('#practiceSubnav button').forEach(function(b){b.classList.toggle('active',b.dataset.sub===sub);});
    if(sub==='quiz')renderQuiz();
    if(sub==='cards')renderCards();
    if(sub==='case')renderCase();
    if(sub==='thesis')renderThesis();
  }

  /* ---------- 事件绑定 ---------- */
  function bind(){
    $$('.tabbar button').forEach(function(b){b.addEventListener('click',function(){switchView(b.dataset.view);});});
    $$('[data-go]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();switchView(a.dataset.go);});});
    $('#practiceSubnav').addEventListener('click',function(e){if(e.target.dataset.sub)renderPractice(e.target.dataset.sub);});
    $('#examDateInput').addEventListener('change',function(e){
      state.examDate=e.target.value;save();toast('考试日期已更新');renderHome();renderPlan();
    });
    $('#resetBtn').addEventListener('click',function(){
      if(confirm('确定清空全部学习进度？此操作不可恢复。')){
        localStorage.removeItem(KEY);state=load();recomputeStreak();
        courseState.open=null;courseState.test=null;
        toast('已清空');switchView('home');renderPlan();renderKnowledge();renderMe();
      }
    });
  }

  /* ---------- 启动 ---------- */
  function init(){
    recomputeStreak();
    bind();
    renderHome();renderPlan();renderKnowledge();renderMe();
    updateHomeBadge();
  }
  init();
})();
