/**
 * 主应用逻辑 — 鲲繁花影 v3
 * 暗色主题，4 层布局，表格渲染
 */

const App = {
  orders: [],
  selectedId: null,
  _activeStatusFilter: 'all',

  /**
   * 初始化应用
   */
  async init() {
    this.bindEvents();

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      await Auth.getCurrentUser();
      this.showApp();
      await this.refreshOrders();
    } else {
      this.showLogin();
    }

    Auth.onAuthStateChange(async (event, user) => {
      if (event === 'SIGNED_IN') {
        this.showApp();
        await this.refreshOrders();
      } else if (event === 'SIGNED_OUT') {
        this.showLogin();
      }
    });
  },

  /**
   * 绑定全局事件
   */
  bindEvents() {
    // 搜索框
    document.getElementById('searchInput').addEventListener('input', () => this.renderOrders());

    // Header 状态筛选标签
    document.getElementById('statusFilterTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.status-tab');
      if (!tab) return;
      this.filterByStatus(tab.dataset.filter);
    });

    // 模态框背景点击关闭
    document.getElementById('modalOverlay').addEventListener('click', function (e) {
      if (e.target === this) App.closeModal();
    });

    // ESC 关闭
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        App.closeModal();
        Utils.closeConfirm();
      }
    });

    // 确认对话框
    document.getElementById('confirmYes').addEventListener('click', () => {
      const cb = window._confirmCallback;
      Utils.closeConfirm();
      if (cb) cb();
    });

    // 登录回车
    document.getElementById('loginPassword').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') App.handleLoginSubmit();
    });
    document.getElementById('loginConfirmPwd').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') App.handleLoginSubmit();
    });
  },

  /**
   * 状态筛选
   */
  filterByStatus(status) {
    this._activeStatusFilter = status;
    // 更新标签 active 样式
    document.querySelectorAll('#statusFilterTabs .status-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === status);
    });
    this.renderOrders();
  },

  /**
   * 显示登录页
   */
  showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appContainer').classList.remove('logged-in');
    document.getElementById('mainToolbar').style.display = 'none';
    document.getElementById('adminSection').style.display = 'none';
    this.orders = [];
    this.selectedId = null;
    this.checkFirstUser();
  },

  /**
   * 显示主应用
   */
  showApp() {
    const user = Auth.currentUser;
    if (!user) return;

    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appContainer').classList.add('logged-in');
    document.getElementById('mainToolbar').style.display = 'flex';

    // Header 用户信息
    document.getElementById('headerUsername').textContent = user.username;
    document.getElementById('headerAvatar').textContent = (user.username || '?')[0].toUpperCase();

    // 设置页信息
    document.getElementById('profileUsername').textContent = user.username;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileAvatar').textContent = (user.username || '?')[0].toUpperCase();
    document.getElementById('profileRoleTag').textContent = user.role === 'admin' ? '👑 管理员' : '👤 普通用户';
    document.getElementById('profileRoleTag').className = 'role-badge ' + (user.role === 'admin' ? 'admin' : 'user');
    document.getElementById('profileUserId').textContent = 'ID: ' + (user.id || '').substring(0, 8) + '...';

    if (user.role === 'admin') {
      document.getElementById('adminSection').style.display = 'block';
    }

    // 清空登录表单
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginConfirmPwd').value = '';
    document.getElementById('loginError').textContent = '';
  },

  /**
   * 检查是否需要显示注册模式
   */
  async checkFirstUser() {
    const { data: users } = await supabase.from('user_roles').select('id');
    const count = users ? users.length : 0;

    if (count === 0) {
      loginMode = 'register';
      document.getElementById('firstUserHint').style.display = 'block';
    } else {
      loginMode = 'login';
      document.getElementById('firstUserHint').style.display = 'none';
    }
    switchMode(loginMode);
  },

  /**
   * 刷新订单列表
   */
  async refreshOrders() {
    try {
      this.orders = await Orders.fetchOrders();
      this.renderOrders();
      this.renderRevenue();
    } catch (err) {
      Utils.showToast('❌ ' + err.message);
      this.orders = [];
      this.renderOrders();
      this.renderRevenue();
    }
  },

  /**
   * 更新 Header 中的总收入
   */
  renderRevenue() {
    const total = this.orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
    document.getElementById('headerRevenue').textContent = '💰 ¥' + total.toLocaleString('zh-CN');
  },

  /**
   * 渲染统计卡片
   */
  renderStats(filteredOrders) {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const totalOrders = filteredOrders.length;
    const thisMonthOrders = filteredOrders.filter(o => {
      const d = new Date(o.created_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const thisMonthIncome = thisMonthOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
    const pendingBalance = filteredOrders.filter(o => o.status !== '已完成' && o.status !== '已取消')
      .reduce((sum, o) => sum + (parseFloat(o.balance) || 0), 0);
    const inProgress = filteredOrders.filter(o => o.status === '进行中' || o.status === '待付定金').length;

    document.getElementById('statsRow').innerHTML = `
      <div class="stat-card"><div class="stat-icon">📋</div><div><div class="stat-label">总订单数</div><div class="stat-value">${totalOrders}</div></div></div>
      <div class="stat-card"><div class="stat-icon">💰</div><div><div class="stat-label">本月收入</div><div class="stat-value">${Utils.formatMoney(thisMonthIncome)}</div></div></div>
      <div class="stat-card"><div class="stat-icon">⏳</div><div><div class="stat-label">待收尾款</div><div class="stat-value">${Utils.formatMoney(pendingBalance)}</div></div></div>
      <div class="stat-card"><div class="stat-icon">🔄</div><div><div class="stat-label">进行中</div><div class="stat-value">${inProgress} 单</div></div></div>
    `;
  },

  /**
   * 获取状态对应的 CSS class
   */
  _getStatusClass(status) {
    const map = {
      '待付定金': 'deposit',
      '进行中': 'progress',
      '待付尾款': 'balance',
      '已完成': 'done',
      '已取消': 'cancel',
    };
    return map[status] || 'progress';
  },

  /**
   * 渲染订单表格
   */
  renderOrders() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = this._activeStatusFilter;

    let filtered = this.orders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (search) {
        const haystack = (o.customer + ' ' + o.title + ' ' + (o.order_number || '') + ' ' + (o.description || '')).toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    // 按创建时间倒序
    filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    this.renderStats(filtered);

    const tableWrap = document.getElementById('orderTableWrap');
    const emptyState = document.getElementById('emptyState');

    if (filtered.length === 0) {
      tableWrap.innerHTML = '';
      tableWrap.style.display = 'none';
      emptyState.style.display = 'flex';
    } else {
      emptyState.style.display = 'none';
      tableWrap.style.display = 'block';

      const rows = filtered.map(o => {
        const statusClass = this._getStatusClass(o.status);
        const statusText = o.status;
        const canEdit = Auth.isAdmin() || (Auth.currentUser && Auth.currentUser.id === o.created_by);
        return `
          <tr onclick="App.toggleDetail('${o.id}')" class="${this.selectedId === o.id ? 'row-selected' : ''}">
            <td style="font-size:11px;color:var(--text-muted);">${Utils.escHtml((o.order_number || o.id).substring(0, 12))}</td>
            <td class="cell-customer">${Utils.escHtml(o.customer)}</td>
            <td class="cell-title" title="${Utils.escHtml(o.title || '')}">${Utils.escHtml(o.title || '（无标题）')}</td>
            <td class="cell-amount">${Utils.formatMoney(o.total_price)}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td class="cell-actions" onclick="event.stopPropagation();">
              ${canEdit ? `<button onclick="App.openModal('${o.id}')" title="编辑">✏️</button><button class="btn-del" onclick="App.deleteOrder('${o.id}')" title="删除">🗑️</button>` : '<span style="font-size:11px;color:var(--text-muted);">🔒</span>'}
            </td>
          </tr>`;
      }).join('');

      tableWrap.innerHTML = `
        <table class="order-table">
          <thead>
            <tr>
              <th>编号</th>
              <th>客户</th>
              <th>项目</th>
              <th style="text-align:right;">金额</th>
              <th>状态</th>
              <th style="text-align:center;">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    this.renderDetailPanel();
  },

  /**
   * 切换详情面板
   */
  toggleDetail(id) {
    if (this.selectedId === id) {
      this.selectedId = null;
    } else {
      this.selectedId = id;
    }
    this.renderDetailPanel();
    this.renderOrders();
  },

  /**
   * 渲染详情面板
   */
  renderDetailPanel() {
    const panel = document.getElementById('detailPanel');
    if (!this.selectedId) {
      panel.classList.remove('open');
      panel.innerHTML = '';
      return;
    }

    const o = this.orders.find(x => x.id === this.selectedId);
    if (!o) {
      panel.classList.remove('open');
      return;
    }

    const canEdit = Auth.isAdmin() || (Auth.currentUser && Auth.currentUser.id === o.created_by);
    const statusClass = this._getStatusClass(o.status);

    panel.classList.add('open');
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <h3 style="font-size:15px;color:var(--text);">📝 ${Utils.escHtml(o.title) || '订单详情'}</h3>
        <span class="status-badge ${statusClass}">${o.status}</span>
      </div>
      <div class="detail-grid">
        <div><div class="dl-label">订单编号</div><div class="dl-value" style="color:var(--primary);font-weight:600;">${Utils.escHtml(o.order_number) || '-'}</div></div>
        <div><div class="dl-label">制作人</div><div class="dl-value">${Utils.escHtml(o.producer) || '-'}</div></div>
        <div><div class="dl-label">客户</div><div class="dl-value">${Utils.escHtml(o.customer)}</div></div>
        <div><div class="dl-label">联系方式</div><div class="dl-value">${Utils.escHtml(o.contact) || '-'}</div></div>
        <div><div class="dl-label">服务类型</div><div class="dl-value"><span class="tag ${Utils.getServiceTypeTag(o.service_type)}">${o.service_type}</span></div></div>
        <div><div class="dl-label">下单日期</div><div class="dl-value">${Utils.formatDate(o.order_date || o.created_at)}</div></div>
        <div><div class="dl-label">总价</div><div class="dl-value" style="font-weight:700;color:var(--gold)">${Utils.formatMoney(o.total_price)}</div></div>
        <div><div class="dl-label">截止日期</div><div class="dl-value ${Utils.isDeadlineUrgent(o.deadline) ? 'deadline-urgent' : ''}">${o.deadline ? Utils.formatDate(o.deadline) : '不限'}</div></div>
        <div><div class="dl-label">已付定金</div><div class="dl-value" style="color:var(--warning)">${Utils.formatMoney(o.deposit)}</div></div>
        <div><div class="dl-label">待付尾款</div><div class="dl-value" style="color:var(--danger)">${Utils.formatMoney(o.balance)}</div></div>
        ${Auth.isAdmin() ? `<div><div class="dl-label">创建者 ID</div><div class="dl-value" style="font-size:12px;">${Utils.escHtml((o.created_by || '-').substring(0, 8))}...</div></div>` : ''}
      </div>
      ${o.description ? `<div class="detail-desc">${Utils.escHtml(o.description)}</div>` : ''}

      ${canEdit ? `
      <div class="detail-actions">
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();App.openModal('${o.id}')">✏️ 编辑</button>
        <button class="btn btn-success btn-sm" onclick="event.stopPropagation();App.quickStatus('${o.id}','已完成')">✅ 标记完成</button>
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();App.quickStatus('${o.id}','进行中')">▶️ 开始制作</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();App.deleteOrder('${o.id}')">🗑️ 删除</button>
      </div>` : `
      <div class="no-permission-hint">🔒 你无权修改此订单（仅创建者和管理员可操作）</div>
      `}
    `;
  },

  // ── 页面切换 ──────────────────────────────

  switchPage(page) {
    // 更新页面内容区
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById('page-' + page);
    if (targetPage) targetPage.classList.add('active');

    // 工具栏仅订单页显示
    const toolbar = document.getElementById('mainToolbar');
    const fab = document.getElementById('fabBtn');
    if (page === 'orders') {
      toolbar.style.display = 'flex';
      fab.style.display = 'flex';
    } else {
      toolbar.style.display = 'none';
      fab.style.display = 'none';
    }

    if (page === 'dashboard') Dashboard.render(this.orders);
    if (page === 'settings' && Auth.isAdmin()) Settings.renderUserList();
  },

  // ── 模态框 ──────────────────────────────

  openModal(editId = null) {
    const modal = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');

    if (editId) {
      const o = this.orders.find(x => x.id === editId);
      if (!o) return;
      if (!Auth.isAdmin() && Auth.currentUser?.id !== o.created_by) {
        Utils.showToast('🔒 无权编辑此订单');
        return;
      }
      title.textContent = '编辑订单';
      document.getElementById('editId').value = o.id;
      document.getElementById('fOrderNumber').value = o.order_number || '';
      document.getElementById('fProducer').value = o.producer || '';
      document.getElementById('fCustomer').value = o.customer || '';
      document.getElementById('fContact').value = o.contact || '';
      document.getElementById('fServiceType').value = o.service_type || '';
      document.getElementById('fStatus').value = o.status || '待付定金';
      document.getElementById('fTitle').value = o.title || '';
      document.getElementById('fDesc').value = o.description || '';
      document.getElementById('fTotal').value = o.total_price || '';
      document.getElementById('fDeposit').value = o.deposit || '';
      document.getElementById('fBalance').value = o.balance || '';
      document.getElementById('fDeadline').value = o.deadline || '';
    } else {
      title.textContent = '新增订单';
      document.getElementById('editId').value = '';
      document.getElementById('orderForm').reset();
      document.getElementById('fOrderNumber').value = Utils.genOrderNumber(this.orders);
      document.getElementById('fStatus').value = '待付定金';
    }
    modal.classList.add('open');
  },

  closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
  },

  async saveOrder(e) {
    e.preventDefault();
    const editId = document.getElementById('editId').value;

    const orderData = {
      id: editId || Utils.genId(),
      orderNumber: document.getElementById('fOrderNumber').value.trim(),
      producer: document.getElementById('fProducer').value.trim(),
      customer: document.getElementById('fCustomer').value.trim(),
      contact: document.getElementById('fContact').value.trim(),
      serviceType: document.getElementById('fServiceType').value,
      title: document.getElementById('fTitle').value.trim(),
      description: document.getElementById('fDesc').value.trim(),
      totalPrice: parseFloat(document.getElementById('fTotal').value) || 0,
      deposit: parseFloat(document.getElementById('fDeposit').value) || 0,
      balance: parseFloat(document.getElementById('fBalance').value) || 0,
      status: document.getElementById('fStatus').value,
      deadline: document.getElementById('fDeadline').value || '',
    };

    try {
      if (editId) {
        await Orders.update(editId, orderData);
      } else {
        await Orders.create(orderData);
      }
      this.closeModal();
      this.selectedId = orderData.id;
      await this.refreshOrders();
      this.renderDetailPanel();
      Utils.showToast(editId ? '✅ 订单已更新' : '🎉 新订单已创建');
    } catch (err) {
      Utils.showToast('❌ ' + err.message);
    }
  },

  async deleteOrder(id) {
    const o = this.orders.find(x => x.id === id);
    if (!o) return;
    if (!Auth.isAdmin() && Auth.currentUser?.id !== o.created_by) {
      Utils.showToast('🔒 无权删除此订单');
      return;
    }
    Utils.showConfirm('确定要删除这个订单吗？此操作不可恢复。', async () => {
      try {
        await Orders.delete(id);
        if (this.selectedId === id) this.selectedId = null;
        await this.refreshOrders();
        this.renderDetailPanel();
        Utils.showToast('🗑️ 订单已删除');
      } catch (err) {
        Utils.showToast('❌ ' + err.message);
      }
    });
  },

  async quickStatus(id, newStatus) {
    const o = this.orders.find(x => x.id === id);
    if (!o) return;
    if (!Auth.isAdmin() && Auth.currentUser?.id !== o.created_by) {
      Utils.showToast('🔒 无权修改此订单');
      return;
    }
    try {
      await Orders.quickStatus(id, newStatus);
      await this.refreshOrders();
      this.renderDetailPanel();
      Utils.showToast('✅ 状态已更新: ' + newStatus);
    } catch (err) {
      Utils.showToast('❌ ' + err.message);
    }
  },

  // ── 认证 ──────────────────────────────

  async handleLoginSubmit() {
    const email = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const confirmPwd = document.getElementById('loginConfirmPwd').value;
    const errEl = document.getElementById('loginError');

    if (!email) { errEl.textContent = '请输入邮箱'; return; }
    if (!email.includes('@')) { errEl.textContent = '请输入有效的邮箱地址'; return; }
    if (!password) { errEl.textContent = '请输入密码'; return; }
    if (password.length < 6) { errEl.textContent = '密码至少6位'; return; }

    if (loginMode === 'register') {
      if (password !== confirmPwd) { errEl.textContent = '两次密码不一致'; return; }

      const verifyCode = document.getElementById('loginVerifyCode').value.trim();
      if (!verifyCode || verifyCode.length !== 6) { errEl.textContent = '请输入6位验证码'; return; }

      if (!window._verifyToken) { errEl.textContent = '请先获取验证码'; return; }

      const username = email.split('@')[0];
      try {
        await Auth.verifyAndSignUp(window._verifyToken, verifyCode, password, username);
        window._verifyToken = null;
        Utils.showToast('🎉 注册成功！请登录');
        switchMode('login');
      } catch (err) {
        errEl.textContent = err.message;
      }
    } else {
      try {
        const user = await Auth.signIn(email, password);
        if (!user) {
          errEl.textContent = '登录失败，请检查数据库配置或联系管理员';
          return;
        }
        Utils.showToast('✅ 登录成功！');
      } catch (err) {
        errEl.textContent = err.message;
      }
    }
  },

  sendVerificationCode() {
    const email = document.getElementById('loginUsername').value.trim();
    const errEl = document.getElementById('loginError');
    const btn = document.getElementById('sendCodeBtn');

    if (!email || !email.includes('@')) { errEl.textContent = '请输入正确的邮箱地址'; return; }

    btn.disabled = true;
    let countdown = 60;
    btn.textContent = countdown + 's 后重发';
    const timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) { clearInterval(timer); btn.disabled = false; btn.textContent = '发送验证码'; }
      else btn.textContent = countdown + 's 后重发';
    }, 1000);

    Auth.sendCode(email).then(result => {
      window._verifyToken = result.token;
      if (result.code) {
        Utils.showToast('📧 验证码: ' + result.code + '（开发模式，稍后将通过邮件发送）');
      } else {
        Utils.showToast('📧 验证码已发送到 ' + email);
      }
    }).catch(e => {
      errEl.textContent = e.message;
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = '发送验证码';
    });
  },

  async logout() {
    Utils.showConfirm('确定要退出当前账号吗？', async () => {
      await Auth.signOut();
      this.orders = [];
      this.selectedId = null;
      Utils.showToast('👋 已退出登录');
    });
  },
};
