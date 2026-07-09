/**
 * WinBrain Frontend Application
 * 基础交互逻辑
 */

const app = {
  // 应用状态
  state: {
    currentPage: 'newchat',
    sidebarCollapsed: false,
    dbConnected: false
  },

  // 页面配置
  pages: {
    newchat: { label: '新建对话', icon: '💬' },
    chats: { label: '历史对话', icon: '📋' },
    config: { label: '配置中心', icon: '⚙️' },
    assets: { label: '资产管理', icon: '📦' },
    analytics: { label: '用量统计', icon: '📊' },
    graph: { label: '知识图谱', icon: '🕸️' },
    dispatch: { label: '调度中心', icon: '🎯' },
    messages: { label: '消息中心', icon: '📬' }
  },

  // 初始化应用
  init() {
    this.loadState();
    this.bindEvents();
    this.renderNav();
    this.renderPage();
  },

  // 从 localStorage 加载状态
  loadState() {
    const saved = localStorage.getItem('winbrain-state');
    if (saved) {
      try {
        this.state = { ...this.state, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to load state:', e);
      }
    }
  },

  // 保存状态到 localStorage
  saveState() {
    localStorage.setItem('winbrain-state', JSON.stringify(this.state));
  },

  // 绑定事件监听
  bindEvents() {
    // 侧边栏折叠按钮
    const collapseBtn = document.getElementById('collapseBtn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => this.toggleSidebar());
    }

    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettings());
    }

    // 模态框关闭按钮
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    // 模态框背景点击关闭
    const modalBackdrop = document.getElementById('settingsModal');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
          this.closeModal();
        }
      });
    }

    // ESC 键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  },

  // 渲染导航栏
  renderNav() {
    const navList = document.getElementById('navList');
    if (!navList) return;

    navList.innerHTML = '';
    Object.entries(this.pages).forEach(([key, page]) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = `nav-item ${this.state.currentPage === key ? 'active' : ''}`;
      btn.dataset.page = key;
      btn.innerHTML = `
        <span style="font-size: 24px;">${page.icon}</span>
        <span>${page.label}</span>
      `;
      btn.addEventListener('click', () => this.navigate(key));
      li.appendChild(btn);
      navList.appendChild(li);
    });
  },

  // 页面导航
  navigate(page) {
    this.state.currentPage = page;
    this.saveState();
    this.renderNav();
    this.renderPage();
  },

  // 渲染当前页面
  renderPage() {
    const main = document.getElementById('main');
    if (!main) return;

    const pageConfig = this.pages[this.state.currentPage];
    if (!pageConfig) return;

    main.innerHTML = `
      <section class="stage">
        <header class="topbar">
          <div class="top-inner">
            <nav class="crumb">
              <span>工作区</span>
              <span>/</span>
              <b>${pageConfig.label}</b>
            </nav>
            <div class="title-row">
              <div class="title">
                <h1>${pageConfig.label}</h1>
                <p>这是 ${pageConfig.label} 页面</p>
              </div>
              ${this.renderStatusBadge()}
            </div>
          </div>
        </header>
        <div class="content">
          ${this.renderPageContent()}
        </div>
      </section>
    `;
  },

  // 渲染状态徽章
  renderStatusBadge() {
    return `
      <span class="badge ${this.state.dbConnected ? 'green' : 'gray'}">
        ${this.state.dbConnected ? '● 数据已连接' : '● 数据未连接'}
      </span>
    `;
  },

  // 渲染页面内容
  renderPageContent() {
    const page = this.state.currentPage;

    // 根据不同页面返回不同内容
    switch (page) {
      case 'newchat':
        return this.renderNewChatPage();
      case 'chats':
        return this.renderChatsPage();
      case 'config':
        return this.renderConfigPage();
      default:
        return this.renderPlaceholderPage();
    }
  },

  // 新建对话页面
  renderNewChatPage() {
    return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">
            <span class="icon-box">💬</span>
            <div>
              <h3>新建对话</h3>
              <p>开始与 AI 助手的对话</p>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="mb-4">
            <label class="block mb-2 font-semibold">对话主题</label>
            <input type="text" class="input" placeholder="输入对话主题..." />
          </div>
          <div class="mb-4">
            <label class="block mb-2 font-semibold">对话模式</label>
            <div class="option-grid">
              <div class="option selected">
                <h4>标准对话</h4>
                <p>适合日常问答和任务处理</p>
              </div>
              <div class="option">
                <h4>专家诊断</h4>
                <p>深度分析和专业建议</p>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button class="btn ghost">取消</button>
            <button class="btn primary">开始对话</button>
          </div>
        </div>
      </div>
    `;
  },

  // 历史对话页面
  renderChatsPage() {
    return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">
            <span class="icon-box green">📋</span>
            <div>
              <h3>历史对话</h3>
              <p>查看和管理历史对话记录</p>
            </div>
          </div>
          <button class="btn ghost">筛选</button>
        </div>
        <div class="card-body">
          <div class="muted text-center p-6">
            <p class="mb-2">暂无历史对话</p>
            <p class="tiny">开始新对话后将在此显示</p>
          </div>
        </div>
      </div>
    `;
  },

  // 配置中心页面
  renderConfigPage() {
    return `
      <div class="grid grid-2">
        <div class="card">
          <div class="card-head">
            <div class="card-title">
              <span class="icon-box">🔗</span>
              <div>
                <h3>数据连接</h3>
                <p>配置数据源连接</p>
              </div>
            </div>
          </div>
          <div class="card-body">
            <button class="btn ${this.state.dbConnected ? 'green' : 'primary'}"
                    onclick="app.toggleConnection()">
              ${this.state.dbConnected ? '✓ 已连接' : '连接数据源'}
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div class="card-title">
              <span class="icon-box amber">⚡</span>
              <div>
                <h3>API 设置</h3>
                <p>配置 API 密钥和端点</p>
              </div>
            </div>
          </div>
          <div class="card-body">
            <button class="btn ghost">配置</button>
          </div>
        </div>
      </div>
    `;
  },

  // 占位页面
  renderPlaceholderPage() {
    const pageConfig = this.pages[this.state.currentPage];
    return `
      <div class="card">
        <div class="card-body text-center p-6">
          <div style="font-size: 48px; margin-bottom: 16px;">${pageConfig.icon}</div>
          <h2 class="font-bold text-xl mb-2">${pageConfig.label}</h2>
          <p class="muted">此页面正在开发中</p>
        </div>
      </div>
    `;
  },

  // 切换侧边栏折叠状态
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    sidebar.classList.toggle('collapsed');
    this.saveState();

    // 更新 aria 属性
    const collapseBtn = document.getElementById('collapseBtn');
    if (collapseBtn) {
      collapseBtn.setAttribute('aria-expanded', !this.state.sidebarCollapsed);
    }
  },

  // 打开设置模态框
  openSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }
  },

  // 关闭模态框
  closeModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }
  },

  // 切换数据连接状态
  toggleConnection() {
    this.state.dbConnected = !this.state.dbConnected;
    this.saveState();
    this.renderPage();
  },

  // 重置演示数据
  resetDemo() {
    if (confirm('确定要重置所有演示数据吗?')) {
      localStorage.removeItem('winbrain-state');
      this.state = {
        currentPage: 'newchat',
        sidebarCollapsed: false,
        dbConnected: false
      };
      this.closeModal();
      this.renderNav();
      this.renderPage();
      alert('演示数据已重置');
    }
  }
};

// 当 DOM 加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
