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
    // 自动切到订单页
    this.switchPage('orders');
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

    // 剪辑不能创建订单，隐藏创建按钮和 FAB
    if (Auth.isEditor()) {
      document.getElementById('mainToolbar').style.display = 'none';
      document.getElementById('fabBtn').style.display = 'none';
    } else {
      document.getElementById('mainToolbar').style.display = 'flex';
      document.getElementById('fabBtn').style.display = 'flex';
    }

    // Header 用户信息
    document.getElementById('headerUsername').textContent = user.username;
    document.getElementById('headerAvatar').textContent = (user.username || '?')[0].toUpperCase();

    // 设置页信息
    document.getElementById('profileUsername').textContent = user.username;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileAvatar').textContent = (user.username || '?')[0].toUpperCase();
    const roleLabels = { admin: '👑 管理员', cs: '💼 客服', editor: '✂️ 剪辑' };
    const roleClasses = { admin: 'admin', cs: 'user', editor: 'user' };
    document.getElementById('profileRoleTag').textContent = roleLabels[user.role] || '👤 用户';
    document.getElementById('profileRoleTag').className = 'role-badge ' + (roleClasses[user.role] || 'user');
    document.getElementById('profileUserId').textContent = 'ID: ' + (user.id || '').substring(0, 8) + '...';

    if (user.role === 'admin') {
      document.getElementById('adminSection').style.display = 'block';
    }
    // 客服也能看到部分管理功能
    if (user.role === 'cs') {
      document.getElementById('userListArea').style.display = 'none';
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
   * 加载剪辑列表到分配下拉框
   */
  async loadEditorList() {
    try {
      const { data: users } = await supabase.from('user_roles').select('id, username').eq('role', 'editor');
      const sel = document.getElementById('fAssignedTo');
      if (sel) {
        sel.innerHTML = '<option value="">不分配</option>' +
          (users || []).map(u => `<option value="${u.id}">${Utils.escHtml(u.username)}</option>`).join('');
      }
    } catch {}
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

      const isEditorView = Auth.isEditor();
      const rows = filtered.map(o => {
        const statusClass = this._getStatusClass(o.status);
        const statusText = o.status;
        const canEdit = Auth.isAdmin() || Auth.isCS() || (Auth.currentUser && Auth.currentUser.id === o.created_by);
        const canDelete = Auth.isAdmin();
        const showPrice = isEditorView ? (parseFloat(o.editor_price)||0) : (parseFloat(o.total_price)||0);
        return `
          <tr onclick="App.toggleDetail('${o.id}')" style="cursor:pointer;">
            ${isEditorView ? '' : `<td style="font-size:11px;color:var(--text-muted);">${Utils.escHtml((o.order_number || o.id).substring(0, 12))}</td>`}
            <td class="cell-customer">${Utils.escHtml(o.customer)}</td>
            <td class="cell-title" title="${Utils.escHtml(o.title || '')}">${Utils.escHtml(o.title || '（无标题）')}</td>
            <td class="cell-amount">${isEditorView?'💰 ':''}${Utils.formatMoney(showPrice)}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td class="cell-actions" onclick="event.stopPropagation();">
              ${canEdit ? `<button onclick="App.openModal('${o.id}')" title="编辑">✏️</button>` : ''}
              ${canDelete ? `<button class="btn-del" onclick="App.deleteOrder('${o.id}')" title="删除">🗑️</button>` : ''}
            </td>
          </tr>`;
      }).join('');

      tableWrap.innerHTML = `
        <table class="order-table">
          <thead>
            <tr>
              ${isEditorView ? '' : '<th>编号</th>'}
              <th>客户</th>
              <th>项目</th>
              <th style="text-align:right;">${isEditorView ? '到手金额' : '金额'}</th>
              <th>状态</th>
              <th style="text-align:center;">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }
  },

  /**
   * 点击订单 → 弹出详情模态框
   */
  async toggleDetail(id) {
    const o = this.orders.find(x => x.id === id);
    if (!o) return;

    // 恢复表单状态（上次可能是查看模式，字段被禁用了）
    document.querySelectorAll('#orderForm input, #orderForm select, #orderForm textarea').forEach(el => el.disabled = false);
    // 恢复提交按钮
    const submitBtn = document.getElementById('modalSubmitBtn');
    if (submitBtn) submitBtn.style.display = 'inline-flex';

    const canEdit = Auth.isAdmin() || Auth.isCS() || (Auth.currentUser && Auth.currentUser.id === o.created_by);
    const canDelete = Auth.isAdmin();
    const statusClass = this._getStatusClass(o.status);

    let assignedName = '';
    if (o.assigned_to) {
      try {
        const { data: users } = await supabase.from('user_roles').select('username').eq('id', o.assigned_to).single();
        if (users) assignedName = users.username;
      } catch {}
    }

    // 用模态框展示详情
    const modal = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const isEditor = Auth.isEditor();
    title.textContent = '📝 订单详情';
    document.getElementById('editId').value = o.id;
    // 剪辑隐藏编号和联系方式
    document.getElementById('fOrderNumber').value = isEditor ? '-' : (o.order_number || '');
    document.getElementById('fProducer').value = o.producer || '';
    document.getElementById('fCustomer').value = o.customer || '';
    document.getElementById('fContact').value = isEditor ? '-' : (o.contact || '');
    document.getElementById('fServiceType').value = o.service_type || '';
    document.getElementById('fStatus').value = o.status || '';
    document.getElementById('fTitle').value = o.title || '';
    document.getElementById('fDesc').value = o.description || '';
    document.getElementById('fTotal').value = o.total_price || '';
    document.getElementById('fDeposit').value = o.deposit || '';
    document.getElementById('fBalance').value = o.balance || '';
    document.getElementById('fDeadline').value = o.deadline || '';
    try { document.getElementById('fAssignedTo').value = o.assigned_to || ''; } catch {}
    try { document.getElementById('fEditorPrice').value = o.editor_price || ''; } catch {}

    // 剪辑只能查看不能改
    if (isEditor) {
      document.getElementById('fStatus').disabled = true;
    }

    // 显示分配信息
    const assignGroup = document.getElementById('assignGroup');
    if (assignedName) {
      assignGroup.style.display = 'block';
      assignGroup.querySelector('label').textContent = '分配给: ' + assignedName;
    } else {
      assignGroup.style.display = 'none';
    }

    // 替换提交按钮为操作按钮
    const btn = document.getElementById('modalSubmitBtn');
    const actionsDiv = btn.parentElement;
    actionsDiv.innerHTML = canEdit ? `
      <button class="btn btn-primary btn-sm" onclick="App.openModal('${o.id}')">✏️ 编辑</button>
      <button class="btn btn-success btn-sm" onclick="App.quickStatus('${o.id}','已完成');App.closeModal()">✅ 标记完成</button>
      <button class="btn btn-outline btn-sm" onclick="App.quickStatus('${o.id}','进行中');App.closeModal()">▶️ 开始制作</button>
      ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="App.deleteOrder('${o.id}');App.closeModal()">🗑️ 删除</button>` : ''}
      <button class="btn btn-outline btn-sm" onclick="App.closeModal()">关闭</button>
    ` : `
      <span class="no-permission-hint">🔒 你无权修改此订单</span>
      <button class="btn btn-outline btn-sm" onclick="App.closeModal()">关闭</button>
    `;

    // 禁用表单编辑
    document.querySelectorAll('#orderForm input, #orderForm select, #orderForm textarea').forEach(el => {
      if (el.id !== 'editId') el.disabled = true;
    });

    modal.classList.add('open');
    this.selectedId = id;
  },

  // ── 页面切换 ──────────────────────────────

  switchPage(page) {
    // 更新页面内容区
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById('page-' + page);
    if (targetPage) targetPage.classList.add('active');

    // 更新页面标题
    const titles = { orders: '📋 订单列表', dashboard: '📊 数据看板', settings: '⚙️ 设置' };
    document.querySelector('.page-title').textContent = titles[page] || '📋 订单列表';

    // 工具栏和FAB仅订单页显示（剪辑永远不显示）
    const toolbar = document.getElementById('mainToolbar');
    const fab = document.getElementById('fabBtn');
    if (page === 'orders' && !Auth.isEditor()) {
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

    // 恢复表单为编辑状态
    document.querySelectorAll('#orderForm input, #orderForm select, #orderForm textarea').forEach(el => el.disabled = false);
    const sb = document.getElementById('modalSubmitBtn');
    if (!sb) {
      // 按钮被 toggleDetail 销毁了，重建
      const ad = document.querySelector('#orderForm .detail-actions');
      if (ad) ad.innerHTML = '<button type="submit" class="btn btn-primary" id="modalSubmitBtn">💾 保存订单</button><button type="button" class="btn btn-outline" onclick="App.closeModal()">取消</button>';
    }

    // 分配下拉框 + 剪辑金额：仅 admin 和 cs 可见
    const assignGroup = document.getElementById('assignGroup');
    const editorPriceGroup = document.getElementById('editorPriceGroup');
    if (Auth.isAdmin() || Auth.isCS()) {
      assignGroup.style.display = 'block';
      editorPriceGroup.style.display = 'block';
      this.loadEditorList();
    } else {
      assignGroup.style.display = 'none';
      editorPriceGroup.style.display = 'none';
    }

    if (editId) {
      const o = this.orders.find(x => x.id === editId);
      if (!o) return;
      const canEdit = Auth.isAdmin() || Auth.isCS() || (Auth.currentUser && Auth.currentUser.id === o.created_by);
      if (!canEdit) {
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
      document.getElementById('fAssignedTo').value = o.assigned_to || '';
      document.getElementById('fEditorPrice').value = o.editor_price || '';
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
    this.selectedId = null;
    // 恢复表单为可编辑状态
    document.querySelectorAll('#orderForm input, #orderForm select, #orderForm textarea').forEach(el => el.disabled = false);
    // 始终恢复提交按钮
    const actionsDiv = document.querySelector('#orderForm .detail-actions');
    if (actionsDiv) {
      actionsDiv.innerHTML = `
        <button type="submit" class="btn btn-primary" id="modalSubmitBtn">💾 保存订单</button>
        <button type="button" class="btn btn-outline" onclick="App.closeModal()">取消</button>
      `;
    }
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
      assignedTo: document.getElementById('fAssignedTo').value || null,
      editorPrice: parseFloat(document.getElementById('fEditorPrice').value) || 0,
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
      Utils.showToast(editId ? '✅ 订单已更新' : '🎉 新订单已创建');
    } catch (err) {
      Utils.showToast('❌ ' + err.message);
    }
  },

  async deleteOrder(id) {
    if (!Auth.isAdmin()) {
      Utils.showToast('🔒 仅管理员可删除订单');
      return;
    }
    const o = this.orders.find(x => x.id === id);
    if (!o) return;
    Utils.showConfirm('确定要删除这个订单吗？此操作不可恢复。', async () => {
      try {
        await Orders.delete(id);
        if (this.selectedId === id) this.selectedId = null;
        await this.refreshOrders();
        Utils.showToast('🗑️ 订单已删除');
      } catch (err) {
        Utils.showToast('❌ ' + err.message);
      }
    });
  },

  async quickStatus(id, newStatus) {
    const o = this.orders.find(x => x.id === id);
    if (!o) return;
    const canEdit = Auth.isAdmin() || Auth.isCS() || (Auth.currentUser && Auth.currentUser.id === o.created_by);
    if (!canEdit) {
      Utils.showToast('🔒 无权修改此订单');
      return;
    }
    try {
      await Orders.quickStatus(id, newStatus);
      await this.refreshOrders();
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
        await Auth.verifyAndSignUp(window._verifyToken, verifyCode, password, username, loginRole);
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
      if (result.emailSent) {
        Utils.showToast('📧 验证码已发送到 ' + email + '，如未收到请检查垃圾箱');
      } else if (result.code) {
        Utils.showToast('📧 验证码: ' + result.code);
      } else {
        Utils.showToast('📧 验证码已发送到 ' + email + '，如未收到请检查垃圾箱');
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
