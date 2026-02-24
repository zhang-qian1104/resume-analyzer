// API配置 - 已替换成你的地址
const API_BASE_URL = 'https://a0aba47ad0a54c2d99b6145cb614f163-cn-hangzhou.alicloudapi.com';

// DOM元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const removeFileBtn = document.getElementById('removeFileBtn');
const jobDesc = document.getElementById('jobDesc');
const sampleJobBtn = document.getElementById('sampleJobBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');

// 当前文件
let currentFile = null;

// 示例职位
const SAMPLE_JOBS = [
    `职位：Python开发工程师
要求：
- 3年以上Python开发经验
- 熟悉Django/Flask等Web框架
- 熟悉数据库设计和优化
- 有RESTful API开发经验
- 熟悉Git版本控制
- 良好的团队协作能力
- 计算机相关专业本科以上学历`,

    `职位：前端开发工程师
要求：
- 2年以上前端开发经验
- 熟练掌握HTML5、CSS3、JavaScript
- 熟悉Vue.js或React框架
- 有响应式布局开发经验
- 熟悉Webpack等构建工具
- 良好的用户体验意识`,

    `职位：数据分析师
要求：
- 1年以上数据分析经验
- 熟练掌握SQL
- 熟悉Python数据分析库(pandas, numpy)
- 有数据可视化经验
- 良好的业务理解能力
- 统计学或数学相关专业优先`
];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    testConnection();
});

// 测试API连接
async function testConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        console.log('API连接成功:', data);
    } catch (error) {
        console.error('API连接失败:', error);
        alert('警告: 无法连接到后端API，请检查网络或配置');
    }
}

// 设置事件监听
function setupEventListeners() {
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#4f46e5';
        uploadArea.style.backgroundColor = '#f5f3ff';
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#e2e8f0';
        uploadArea.style.backgroundColor = 'transparent';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#e2e8f0';
        uploadArea.style.backgroundColor = 'transparent';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    removeFileBtn.addEventListener('click', () => {
        resetFileSelection();
    });

    selectFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    sampleJobBtn.addEventListener('click', () => {
        const randomJob = SAMPLE_JOBS[Math.floor(Math.random() * SAMPLE_JOBS.length)];
        jobDesc.value = randomJob;
    });

    analyzeBtn.addEventListener('click', analyzeResume);

    jobDesc.addEventListener('input', () => {
        updateAnalyzeButton();
    });
}

function handleFileSelect(file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('请上传PDF格式的文件');
        return;
    }

    if (file.size > 16 * 1024 * 1024) {
        alert('文件大小不能超过16MB');
        return;
    }

    currentFile = file;
    fileName.textContent = file.name;
    fileInfo.style.display = 'flex';
    uploadArea.style.display = 'none';
    updateAnalyzeButton();
}

function resetFileSelection() {
    currentFile = null;
    fileInput.value = '';
    fileInfo.style.display = 'none';
    uploadArea.style.display = 'block';
    updateAnalyzeButton();
}

function updateAnalyzeButton() {
    analyzeBtn.disabled = !(currentFile && jobDesc.value.trim());
}

async function analyzeResume() {
    if (!currentFile || !jobDesc.value.trim()) {
        alert('请上传简历并填写职位描述');
        return;
    }

    loading.style.display = 'block';
    results.style.display = 'none';
    analyzeBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('file', currentFile);
        formData.append('job_description', jobDesc.value.trim());

        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            displayResults(data.data);
        } else {
            alert('分析失败：' + (data.error || '未知错误'));
        }
    } catch (error) {
        console.error('分析失败:', error);
        alert('分析失败，请稍后重试');
    } finally {
        loading.style.display = 'none';
        analyzeBtn.disabled = false;
    }
}

function displayResults(data) {
    const resumeInfo = data.resume_info;
    const matchResult = data.match_result;

    const score = matchResult.score || 0;
    document.getElementById('scoreValue').textContent = score;
    
    const scoreDetails = document.getElementById('scoreDetails');
    scoreDetails.innerHTML = `
        <div class="match-item">
            <span class="label">匹配分数</span>
            <span class="value">${score}分</span>
            <div class="match-bar">
                <div class="match-progress" style="width: ${score}%"></div>
            </div>
        </div>
    `;

    displayBasicInfo(resumeInfo.basic_info);
    displaySkills(resumeInfo.skills, matchResult.details?.matched_skills || []);
    displayExperience(resumeInfo.experience);
    displayEducation(resumeInfo.education);
    
    results.style.display = 'block';
    initTabs();
}

function displayBasicInfo(info) {
    const container = document.getElementById('basicInfo');
    if (!info) {
        container.innerHTML = '<p class="info-value">未提取到基本信息</p>';
        return;
    }

    const fields = [
        { label: '姓名', key: 'name' },
        { label: '电话', key: 'phone' },
        { label: '邮箱', key: 'email' },
        { label: '地址', key: 'address' }
    ];

    container.innerHTML = fields.map(field => `
        <div class="info-item">
            <span class="info-label">${field.label}</span>
            <span class="info-value">${info[field.key] || '未识别'}</span>
        </div>
    `).join('');
}

function displaySkills(skills, matchedSkills) {
    const container = document.getElementById('skillsCloud');
    if (!skills || skills.length === 0) {
        container.innerHTML = '<p class="info-value">未提取到技能信息</p>';
        return;
    }

    container.innerHTML = skills.map(skill => {
        const isMatched = matchedSkills.some(s => s.toLowerCase() === skill.toLowerCase());
        return `<span class="skill-tag ${isMatched ? 'matched' : ''}">${skill}</span>`;
    }).join('');
}

function displayExperience(experience) {
    const container = document.getElementById('experienceList');
    if (!experience || experience.length === 0) {
        container.innerHTML = '<p class="info-value">未提取到工作经验</p>';
        return;
    }

    container.innerHTML = experience.map(exp => `
        <div class="experience-item">
            <p class="experience-text">${exp}</p>
        </div>
    `).join('');
}

function displayEducation(education) {
    const container = document.getElementById('educationInfo');
    if (!education || Object.keys(education).length === 0) {
        container.innerHTML = '<p class="info-value">未提取到教育背景</p>';
        return;
    }

    const fields = [
        { label: '学位', key: 'degree' },
        { label: '学校', key: 'school' },
        { label: '专业', key: 'major' },
        { label: '毕业年份', key: 'year' }
    ];

    container.innerHTML = fields.map(field => `
        <div class="info-item">
            <span class="info-label">${field.label}</span>
            <span class="info-value">${education[field.key] || '未识别'}</span>
        </div>
    `).join('');
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
}