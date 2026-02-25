# -*- coding: utf-8 -*-
import os
import re
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import pdfplumber

app = Flask(__name__)
CORS(app)


def extract_all_info(text):
    """从文本中提取所有关键信息"""
    info = {
        'name': None,
        'email': None,
        'phone': None,
        'skills': [],
        'experience': [],
        'education': {},
        'job_intent': None
    }

    lines = text.split('\n')
    text_lower = text.lower()

    # 1. 提取邮箱
    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
    if email_match:
        info['email'] = email_match.group(0)

    # 2. 提取电话（支持多种格式）
    phone_match = re.search(r'(1[3-9]\d{9})|(\d{3,4}[-\s]\d{7,8})', text)
    if phone_match:
        info['phone'] = phone_match.group(0)

    # 3. 提取姓名（通常在前几行，不含特殊字符）
    for line in lines[:10]:
        line = line.strip()
        if line and len(line) < 20 and not re.search(r'[0-9@\.]', line):
            if not any(word in line.lower() for word in ['简历', 'resume', '姓名', 'name', '电话', 'phone']):
                info['name'] = line
                break

    # 4. 提取技能（常见技能关键词）
    skill_keywords = [
        'python', 'java', 'javascript', 'sql', 'flask', 'django',
        'react', 'vue', 'docker', 'kubernetes', 'aws', 'git',
        '机器学习', '数据分析', '项目管理', 'office', 'excel'
    ]
    for skill in skill_keywords:
        if skill in text_lower:
            info['skills'].append(skill.capitalize())

    # 5. 提取工作经验段落
    exp_patterns = [
        r'(工作经验|工作经历|工作履历)[\s\S]*?(?=教育背景|教育经历|项目经验|$)',
        r'(EXPERIENCE|Work Experience)[\s\S]*?(?=EDUCATION|PROJECTS|$)'
    ]
    for pattern in exp_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            exp_text = match.group(0)
            # 按行分割，过滤出像工作经验的行
            exp_lines = exp_text.split('\n')
            for line in exp_lines[:8]:  # 取前8行
                line = line.strip()
                if line and len(line) > 10 and not any(x in line for x in ['工作经验', 'Work Experience']):
                    info['experience'].append(line[:100])  # 限制长度
            break

    # 如果没有找到工作经验段落，尝试找包含年份的行
    if not info['experience']:
        year_pattern = r'\b(19|20)\d{2}\s*[-—–到至]\s*(19|20)\d{2}|\b(19|20)\d{2}\s*[-—–到至]今'
        for line in lines:
            if re.search(year_pattern, line) and len(line) < 150:
                info['experience'].append(line.strip())
                if len(info['experience']) >= 3:
                    break

    # 6. 提取教育背景
    edu_patterns = [
        r'(教育背景|教育经历|学历)[\s\S]*?(?=工作经验|工作经历|技能|$)',
        r'(EDUCATION|Academic Background)[\s\S]*?(?=EXPERIENCE|SKILLS|$)'
    ]
    edu_text = ""
    for pattern in edu_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            edu_text = match.group(0)
            break

    if edu_text:
        # 提取学位
        degrees = ['博士', '硕士', '本科', '学士', '专科', '研究生', 'PhD', 'Master', 'Bachelor']
        for degree in degrees:
            if degree in edu_text:
                info['education']['degree'] = degree
                break

        # 提取学校（通常包含"大学"、"学院"）
        school_match = re.search(r'[\u4e00-\u9fa5]+(大学|学院|University|College)', edu_text)
        if school_match:
            info['education']['school'] = school_match.group(0)

        # 提取年份
        year_match = re.search(r'\b(19|20)\d{2}\b', edu_text)
        if year_match:
            info['education']['year'] = year_match.group(0)

    # 7. 提取求职意向
    intent_patterns = [
        r'(求职意向|应聘职位|目标职位)[：:]\s*([^\n]+)',
        r'(JOB OBJECTIVE|CAREER OBJECTIVE)[：:]\s*([^\n]+)'
    ]
    for pattern in intent_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            info['job_intent'] = match.group(2).strip() if len(match.groups()) > 1 else match.group(1).strip()
            break

    return info


def calculate_match_score(resume_info, job_desc):
    """计算匹配分数"""
    score = 50  # 基础分
    job_lower = job_desc.lower()

    # 技能匹配（最多加30分）
    for skill in resume_info.get('skills', []):
        if skill.lower() in job_lower:
            score += 10

    # 工作经验匹配（最多加20分）
    exp_text = ' '.join(resume_info.get('experience', [])).lower()
    keywords = ['经验', '开发', '设计', '管理', '项目', '负责', '参与']
    for kw in keywords:
        if kw in job_lower and kw in exp_text:
            score += 5

    return min(100, score)  # 不超过100分


@app.route('/health')
def health():
    return jsonify({'status': 'ok'})


@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        if 'file' not in request.files:
            return jsonify({'error': '请上传文件'}), 400

        file = request.files['file']
        job_desc = request.form.get('job_description', '')

        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            tmp.write(file.read())
            tmp_path = tmp.name

        try:
            # 解析PDF
            text = ""
            with pdfplumber.open(tmp_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"

            # 提取所有信息
            resume_info = extract_all_info(text)

            # 计算匹配分数
            match_score = calculate_match_score(resume_info, job_desc)

            # 找出匹配的技能
            job_lower = job_desc.lower()
            matched_skills = [s for s in resume_info['skills'] if s.lower() in job_lower]

            return jsonify({
                'success': True,
                'data': {
                    'match_score': match_score,
                    'resume_info': {
                        'basic_info': {
                            'name': resume_info['name'] or '未识别',
                            'email': resume_info['email'] or '未识别',
                            'phone': resume_info['phone'] or '未识别'
                        },
                        'skills': resume_info['skills'],
                        'experience': resume_info['experience'] or ['未提取到工作经验'],
                        'education': resume_info['education'] or {'degree': '未识别', 'school': '未识别'},
                        'job_intent': resume_info['job_intent'] or '未识别',
                        'raw_text': text[:500]
                    },
                    'match_result': {
                        'score': match_score,
                        'details': {
                            'matched_skills': matched_skills
                        }
                    }
                }
            })

        finally:
            os.unlink(tmp_path)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)