#!/usr/bin/env python3
"""Build the browser question bank from MIT-licensed community past-paper notes.

The generated js/question-bank.js augments the hand-written questions in data.js,
adds five lecture-derived drills for every knowledge point, and appends valid
single-choice past-paper blocks that can be rendered without external images.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
RESEARCH = WORKSPACE / ".workbuddy" / "research"
OUTPUT = ROOT / "js" / "question-bank.js"

SOURCES = [
    {
        "path": RESEARCH / "2021_comprehensive.md",
        "id": "past-2021",
        "year": 2021,
        "session": "2021 年度卷",
        "title": "2021 年系统架构设计师综合知识（社区开源整理）",
        "url": "https://github.com/himozhang/system-architect-exam/blob/main/2021_first/comprehensive_knowledge.md",
    },
    {
        "path": RESEARCH / "2022_comprehensive.md",
        "id": "past-2022",
        "year": 2022,
        "session": "2022 年度卷",
        "title": "2022 年系统架构设计师综合知识（社区开源整理）",
        "url": "https://github.com/himozhang/system-architect-exam/blob/main/2022_first/comprehensive_knowledge.md",
    },
    {
        "path": RESEARCH / "2023_comprehensive.md",
        "id": "past-2023",
        "year": 2023,
        "session": "2023 年度卷",
        "title": "2023 年系统架构设计师综合知识（社区开源整理）",
        "url": "https://github.com/himozhang/system-architect-exam/blob/main/2023_first/comprehensive_knowledge.md",
    },
    {
        "path": RESEARCH / "2024_first_comprehensive_knowledge.md",
        "id": "past-2024-h1",
        "year": 2024,
        "session": "2024 上半年",
        "title": "2024 上半年系统架构设计师综合知识（社区开源整理）",
        "url": "https://github.com/himozhang/system-architect-exam/blob/main/2024_first/comprehensive_knowledge.md",
    },
    {
        "path": RESEARCH / "2024_second_comprehensive.md",
        "id": "past-2024-h2",
        "year": 2024,
        "session": "2024 下半年",
        "title": "2024 下半年系统架构设计师综合知识（社区开源整理）",
        "url": "https://github.com/himozhang/system-architect-exam/blob/main/2024_second/comprehensive_knowledge.md",
    },
    {
        "path": RESEARCH / "2025_comprehensive.md",
        "id": "past-2025-h1",
        "year": 2025,
        "session": "2025 上半年",
        "title": "2025 上半年系统架构设计师综合知识（社区开源整理）",
        "url": "https://github.com/himozhang/system-architect-exam/blob/main/2025_first/comprehensive_knowledge.md",
    },
]

MODULES = {
    "arch": "软件架构设计基础",
    "se": "软件工程",
    "quality": "质量属性与架构评估",
    "db": "数据库系统",
    "os": "操作系统",
    "net": "计算机网络",
    "sec": "信息安全",
    "reliab": "系统可靠性与可用性",
    "embed": "嵌入式系统",
    "tech": "信息系统与新技术",
    "pm": "项目管理与工程经济",
    "law": "法律法规与标准化",
    "eng": "专业英语",
}

KEYWORDS = {
    "arch": ["软件架构", "体系结构", "架构风格", "微服务", "SOA", "DSSA", "ABSD", "构件", "中间件", "ADL", "4+1", "REST", "领域模型", "软件复用"],
    "se": ["软件测试", "需求", "UML", "用例", "设计模式", "CMMI", "软件维护", "净室", "开发模型", "敏捷", "配置管理", "白盒", "黑盒", "回归测试", "面向对象"],
    "quality": ["质量属性", "ATAM", "SAAM", "敏感点", "权衡点", "可修改性", "可测试性", "性能场景", "效用树"],
    "db": ["数据库", "关系模式", "关系代数", "SQL", "事务", "范式", "函数依赖", "索引", "聚簇", "数据仓库", "ER图", "E-R", "数据模型"],
    "os": ["进程", "线程", "调度", "页面置换", "虚拟内存", "文件系统", "死锁", "信号量", "磁盘", "操作系统", "中断", "页式", "PV操作"],
    "net": ["网络", "OSI", "TCP", "UDP", "IP", "路由器", "交换机", "协议", "带宽", "信道", "HTTP", "SMTP", "DNS", "5G", "WLAN"],
    "sec": ["信息安全", "加密", "解密", "数字签名", "访问控制", "认证", "密码", "防火墙", "机密性", "完整性", "安全等级", "AES", "RSA", "病毒"],
    "reliab": ["可靠性", "可用性", "MTTF", "MTBF", "MTTR", "失效率", "容错", "冗余", "故障", "灾难恢复", "FMEA"],
    "embed": ["嵌入式", "实时系统", "实时操作系统", "RTOS", "鸿蒙", "传感器", "采样", "中间件屏蔽"],
    "tech": ["云计算", "大数据", "物联网", "人工智能", "机器学习", "深度学习", "区块链", "数字孪生", "数据资产", "DCMM", "边缘计算", "虚拟化", "GPU", "AI芯片", "信息系统"],
    "pm": ["项目", "成本", "进度", "工期", "关键路径", "挣值", "风险管理", "线性规划", "PERT", "采购", "工程经济", "投资", "现值"],
    "law": ["著作权", "专利", "商标", "知识产权", "法律", "标准化", "侵权", "软件许可", "权利要求"],
    "eng": ["architecture", "software", "system", "service", "application", "development", "micro-service", "requirements", "quality", "technology"],
}

STRATEGIES = {
    "arch": "先识别题干中的构件、连接件、约束或风格特征，再与架构模式逐项匹配",
    "se": "先判断题目处于生命周期哪个阶段，再区分方法、产物与验证目标",
    "quality": "把刺激源、刺激、环境、制品、响应、响应度量六要素与质量战术对应起来",
    "db": "先判断题目考关系代数、规范化、事务还是物理存储，再使用相应规则",
    "os": "画出状态或资源变化过程，区分调度、同步、死锁和存储管理概念",
    "net": "先定位协议层次，再判断设备、协议、端口或性能公式",
    "sec": "先明确安全目标，再区分加密、签名、认证、授权和审计各自作用",
    "reliab": "先区分可靠性与可用性，再代入 MTBF、MTTR、冗余或故障模型",
    "embed": "抓住资源受限、实时约束和软硬件协同三个特征进行判断",
    "tech": "先识别技术定义与典型能力边界，避免把相邻新技术概念混用",
    "pm": "先画网络图或列公式，明确时间、成本、范围与风险之间的约束",
    "law": "先确认权利客体与保护条件，再判断权利归属、期限和侵权行为",
    "eng": "根据上下文语义和专业术语搭配排除不符合技术语境的选项",
}


def clean_inline(value: str) -> str:
    value = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", value)
    value = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", value)
    value = value.replace("`", "")
    value = re.sub(r"\*\*([^*]+)\*\*", r"\1", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip(" \t\r\n-#>")


def clean_explanation(value: str) -> str:
    lines = []
    in_code = False
    for raw in value.splitlines():
        line = raw.strip()
        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code or not line:
            continue
        if line.startswith(("<details", "</details", "<summary", "</summary")):
            continue
        if line.startswith("!["):
            continue
        if re.match(r"^##+\s*", line):
            line = re.sub(r"^##+\s*", "", line)
        if line.startswith("|"):
            continue
        line = re.sub(r"^>\s*", "", line)
        line = re.sub(r"^[-*]\s+", "", line)
        line = re.sub(r"^\d+[.、]\s*", "", line)
        line = clean_inline(line)
        if line and line not in ("查看解析", "答案", "解析", "---"):
            lines.append(line)
    text = " ".join(lines)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > 900:
        cut = max(text.rfind("。", 0, 900), text.rfind("；", 0, 900))
        text = text[: cut + 1 if cut > 320 else 900].rstrip() + "…"
    return text


def classify(text: str) -> tuple[str, list[str]]:
    lower = text.lower()
    scores = {}
    hits_by_module = {}
    for module, words in KEYWORDS.items():
        hits = [word for word in words if word.lower() in lower]
        score = sum(3 if len(word) >= 4 else 2 for word in hits)
        if module == "eng":
            ascii_letters = len(re.findall(r"[A-Za-z]", text))
            if ascii_letters > 180:
                score += 20
        scores[module] = score
        hits_by_module[module] = hits
    module = max(scores, key=scores.get)
    if scores[module] == 0:
        module = "se"
    return module, hits_by_module.get(module, [])[:3]


def difficulty(question: str, explanation: str) -> str:
    hard_words = ["计算", "最大", "最小", "复杂度", "前趋", "调度序列", "关键路径", "线性规划", "函数依赖", "概率", "吞吐量"]
    if any(word in question for word in hard_words) or len(question) > 220:
        return "hard"
    if len(explanation) > 500 or len(question) > 110:
        return "medium"
    return "easy"


def question_blocks(text: str):
    pattern = re.compile(r"^##\s+第\s*(\d+)\s*题\s*$", re.M)
    matches = list(pattern.finditer(text))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        yield int(match.group(1)), text[match.end():end]


def parse_source(source: dict) -> list[dict]:
    path = source["path"]
    if not path.exists():
        print(f"WARN missing: {path}")
        return []
    text = path.read_text(encoding="utf-8", errors="ignore")
    result = []
    for number, block in question_blocks(text):
        before_answer = re.split(r"^###\s*答案\s*$|参考答案[：:]", block, maxsplit=1, flags=re.M)[0]
        if "![" in before_answer or re.search(r"^\s*\|", before_answer, re.M):
            continue
        options = []
        for match in re.finditer(r"^\s*>\s*(?:\(\d+\)\s*)?([A-E])[.．、]\s*(.+?)\s*$", before_answer, re.M):
            label, value = match.group(1), clean_inline(match.group(2))
            if value:
                options.append((label, value))
        labels = [label for label, _ in options]
        if len(options) not in (4, 5) or labels != list("ABCDE"[: len(options)]):
            continue
        first_option = re.search(r"^\s*>\s*(?:\(\d+\)\s*)?[A-E][.．、]", before_answer, re.M)
        if not first_option:
            continue
        question_part = before_answer[: first_option.start()]
        q_lines = []
        for raw in question_part.splitlines():
            line = raw.strip()
            if not line or re.match(r"^\*\*【第.*题】\*\*", line) or line.startswith("---"):
                continue
            line = clean_inline(line)
            if line:
                q_lines.append(line)
        question = " ".join(q_lines)
        placeholder = re.search(r"__\s*([A-E])\s*__", question)
        answer_match = re.search(r"^###\s*答案\s*$[\s\r\n]*\*\*\s*([A-E])", block, re.M)
        if not answer_match:
            answer_match = re.search(r"参考答案[：:]\s*\*?\*?\s*([A-E])", block)
        answer = answer_match.group(1) if answer_match else (placeholder.group(1) if placeholder else "")
        if answer not in labels:
            continue
        question = re.sub(r"（?\(?\s*__\s*[A-E]\s*__\s*\)?）?", "（ ）", question)
        question = re.sub(r"\s+", " ", question).strip()
        if len(question) < 8 or len(question) > 900:
            continue
        explanation_part = ""
        explain_match = re.search(r"^###\s*解析\s*$", block, re.M)
        if explain_match:
            explanation_part = block[explain_match.end():]
        elif answer_match:
            explanation_part = block[answer_match.end():]
        explanation = clean_explanation(explanation_part)
        module, hits = classify(question + " " + " ".join(value for _, value in options) + " " + explanation)
        answer_index = labels.index(answer)
        if len(explanation) < 24:
            explanation = f"正确答案为 {answer}。正确项“{options[answer_index][1]}”与该考点的定义或规则相符；其余选项应结合题干限定条件逐项排除。"
        keyword_text = "、".join(hits) if hits else MODULES[module]
        read = (
            f"本题定位在“{MODULES[module]}”，关键词是“{keyword_text}”。"
            f"解题时应{STRATEGIES[module]}。社区解析给出的正确项为 {answer}，"
            f"复习时还要确认题干问的是“正确”还是“不正确”，避免方向性失分。"
        )
        result.append(
            {
                "id": f"{source['id']}-{number}",
                "m": module,
                "q": question,
                "o": [value for _, value in options],
                "a": answer_index,
                "e": explanation,
                "read": read,
                "kind": "past",
                "year": source["year"],
                "session": source["session"],
                "paperNo": number,
                "difficulty": difficulty(question, explanation),
                "sourceId": source["id"],
                "readSourceId": source["id"],
            }
        )
    return result


def main() -> None:
    questions = []
    for source in SOURCES:
        questions.extend(parse_source(source))

    deduped = []
    seen_questions = set()
    for question in questions:
        key = re.sub(r"[\s，。！？、；：]", "", question["q"])
        if key in seen_questions:
            continue
        seen_questions.add(key)
        deduped.append(question)
    questions = deduped
    counts = {
        source["id"]: sum(1 for question in questions if question["sourceId"] == source["id"])
        for source in SOURCES
    }

    source_registry = {
        "syllabus": {
            "title": "《系统架构设计师考试大纲（第2版）》知识域与应用内讲义",
            "url": "https://www.ruankao.org.cn/",
            "note": "原创练习题；依据考试大纲知识域和本应用讲义编写，不是历年真题。",
            "license": "原创整理",
        }
    }
    for source in SOURCES:
        source_registry[source["id"]] = {
            "title": source["title"],
            "url": source["url"],
            "note": "历年真题/回忆题的社区开源整理版，非考试机构官方原卷；题干与解析可能存在复原、转述或勘误。",
            "license": "MIT License（himozhang/system-architect-exam）",
        }

    past_json = json.dumps(questions, ensure_ascii=False, separators=(",", ":"))
    source_json = json.dumps(source_registry, ensure_ascii=False, separators=(",", ":"))
    count_json = json.dumps(counts, ensure_ascii=False, separators=(",", ":"))

    js = f'''/* 系统架构设计师大题库：原创分层练习 + MIT 开源社区历年题整理\n * 自动生成，请通过 tools/build_question_bank.py 更新。\n */\n(function(){{\n  'use strict';\n  var D=window.APP_DATA;if(!D)return;\n  D.quizSources={source_json};\n  var PAST={past_json};\n  var sourceCounts={count_json};\n\n  function text(v){{return Array.isArray(v)?v.join('；'):(v||'');}}\n  function short(v,n){{v=String(v||'').replace(/\\s+/g,' ').trim();return v.length>n?v.slice(0,n-1)+'…':v;}}\n  function cleanLabel(v){{return String(v||'').replace(/^易错[：:]?\\s*/,'').trim();}}\n  function rotate(correct,wrong,seed){{\n    var unique=[];[correct].concat(wrong).forEach(function(x){{x=short(x,105);if(x&&unique.indexOf(x)<0)unique.push(x);}});\n    while(unique.length<4)unique.push('以上表述与本考点的核心定义不符（选项'+(unique.length+1)+'）');\n    unique=unique.slice(0,4);var pos=Math.abs(seed)%4,out=[],wi=1;\n    for(var i=0;i<4;i++)out.push(i===pos?unique[0]:unique[wi++]);\n    return {{o:out,a:pos}};\n  }}\n  function peerValues(points,index,getter){{\n    var out=[];for(var step=1;step<points.length&&out.length<3;step++){{var p=points[(index+step)%points.length];var v=getter(p);if(v)out.push(v);}}return out;\n  }}\n  function generatedQuestions(){{\n    var out=[];D.modules.forEach(function(m,mi){{m.points.forEach(function(p,pi){{\n      var facts=Array.isArray(p.v)?p.v:[p.v];var fact=facts.filter(Boolean)[0]||p.memo||p.k;\n      var variants=[\n        {{q:'关于「'+p.k+'」，下列描述最准确的是？',correct:fact,wrong:peerValues(m.points,pi,function(x){{var a=Array.isArray(x.v)?x.v:[x.v];return a[0];}}),read:'本题直接检查“'+p.k+'”的定义边界。先锁定本知识点的核心主语，再排除虽然正确但属于同模块其他概念的干扰项。',e:'“'+short(fact,180)+'”直接对应“'+p.k+'”的讲义定义；其余选项来自相邻考点，不能张冠李戴。',difficulty:'easy'}},\n        {{q:'场景「'+short(p.eg||p.memo||fact,150)+'」最能体现下列哪个考点？',correct:p.k,wrong:peerValues(m.points,pi,function(x){{return x.k;}}),read:'本题考查从场景反推概念。提取场景中的对象、约束和动作，再与候选考点的典型适用范围逐一匹配。',e:'该场景是讲义中用于说明“'+p.k+'”的直接案例，因此应选择该考点。',difficulty:'medium'}},\n        {{q:'复习「'+p.k+'」时，下列哪条记忆线索最匹配？',correct:p.memo||fact,wrong:peerValues(m.points,pi,function(x){{return x.memo||x.k;}}),read:'本题考查快速回忆线索。不要只看选项是否“听起来正确”，要确认它是否专门对应题干中的知识点。',e:'对应的记忆线索是“'+short(p.memo||fact,180)+'”。其他线索属于同模块的不同知识点。',difficulty:'easy'}},\n        {{q:'学习「'+p.k+'」时，下列哪项易错提醒与该考点直接对应？',correct:cleanLabel(p.warn)||('不要把“'+p.k+'”与相邻概念混淆'),wrong:peerValues(m.points,pi,function(x){{return cleanLabel(x.warn)||'';}}),read:'本题专门训练易错辨析。先判断每个提醒针对的概念，再确认是否与题干考点存在直接关系。',e:'本考点对应的易错提醒是“'+short(cleanLabel(p.warn)||('不要把“'+p.k+'”与相邻概念混淆'),180)+'”。',difficulty:'medium'}},\n        {{q:'下列哪一个例子最适合用于说明「'+p.k+'」？',correct:p.eg||fact,wrong:peerValues(m.points,pi,function(x){{return x.eg||x.memo||x.k;}}),read:'本题要求把抽象概念映射到工程实例。比较各选项的结构特征，而不是只凭技术名词相似度选择。',e:'“'+short(p.eg||fact,180)+'”是该知识点的直接工程化示例，能体现其关键结构或约束。',difficulty:'medium'}}\n      ];\n      variants.forEach(function(v,vi){{var r=rotate(v.correct,v.wrong,mi*97+pi*13+vi);out.push({{\n        id:'gen-'+m.id+'-'+pi+'-'+vi,m:m.id,q:v.q,o:r.o,a:r.a,e:v.e,read:v.read,kind:'original',year:null,session:'原创专项练习',difficulty:v.difficulty,sourceId:'syllabus',readSourceId:'syllabus',pointKey:m.id+':'+pi\n      }});}});\n    }});}});return out;\n  }}\n\n  D.quiz.forEach(function(q,i){{\n    q.kind=q.kind||'original';q.session=q.session||'原创基础题';q.difficulty=q.difficulty||((i%4===0)?'medium':'easy');q.sourceId=q.sourceId||'syllabus';q.readSourceId=q.readSourceId||q.sourceId;\n    q.read=q.read||('本题考查“'+(D.modules.find(function(m){{return m.id===q.m;}})||{{name:q.m}}).name+'”的基础概念。先识别题干限定词，再逐项判断选项是否符合定义、适用条件和概念边界。');\n  }});\n  D.quiz=D.quiz.concat(generatedQuestions(),PAST);\n  D.quizMeta={{\n    total:D.quiz.length,original:D.quiz.filter(function(q){{return q.kind==='original';}}).length,past:D.quiz.filter(function(q){{return q.kind==='past';}}).length,sourceCounts:sourceCounts,\n    notice:'“历年真题”均标注为社区开源整理/回忆版，并非考试机构官方原卷；请结合来源链接核验。'\n  }};\n}})();\n'''
    OUTPUT.write_text(js, encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "past": len(questions), "sources": counts}, ensure_ascii=False))


if __name__ == "__main__":
    main()
