/**
 * 设置模块 — 鲲繁花影
 * 导出/导入、用户管理、数据清理
 */

const Settings = {
  showImportArea: false,
  showUserMgmt: false,

  /**
   * 导出 CSV
   */
  exportCSV(orders) {
    const headers = ['订单编号', '下单日期', '客户', '联系方式', '制作人', '服务类型', '标题', '描述', '总价', '定金', '尾款', '状态', '截止日期', '创建者'];
    const keys = ['order_number', 'order_date', 'customer', 'contact', 'producer', 'service_type', 'title', 'description', 'total_price', 'deposit', 'balance', 'status', 'deadline', 'created_by'];
    const csvRows = [headers.join(',')];
    orders.forEach(o => {
      csvRows.push(keys.map(k => {
        let v = (o[k] || '').toString();
        if (v.includes(',') || v.includes('"')) v = '"' + v.replace(/"/g, '""') + '"';
        return v;
      }).join(','));
    });
    Utils.downloadBlob('﻿' + csvRows.join('\n'), 'orders_' + new Date().toISOString().slice(0, 10) + '.csv', 'text/csv;charset=utf-8');
  },

  /**
   * 导出 JSON 备份
   */
  exportJSON(orders) {
    Utils.downloadBlob(JSON.stringify(orders, null, 2), 'orders_backup_' + new Date().toISOString().slice(0, 10) + '.json', 'application/json');
  },

  /**
   * 切换导入区域
   */
  toggleImport() {
    this.showImportArea = !this.showImportArea;
    document.getElementById('importArea').style.display = this.showImportArea ? 'block' : 'none';
    document.getElementById('toggleImportBtn').textContent = this.showImportArea ? '收起' : '粘贴 JSON 文本导入';
    if (!this.showImportArea) document.getElementById('importText').value = '';
  },

  /**
   * 执行导入
   */
  async doImport() {
    const text = document.getElementById('importText').value.trim();
    if (!text) { Utils.showToast('请粘贴 JSON 内容'); return; }
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('格式错误');
      Utils.showConfirm(`即将导入 ${data.length} 条订单，会覆盖当前全部数据。确定继续？`, async () => {
        try {
          // 先清空再导入
          await Orders.clearAll();
          const count = await Orders.importBatch(data);
          this.showImportArea = false;
          document.getElementById('importArea').style.display = 'none';
          document.getElementById('toggleImportBtn').textContent = '粘贴 JSON 文本导入';
          document.getElementById('importText').value = '';
          Utils.showToast('✅ 已导入 ' + count + ' 条订单');
          // 触发刷新
          if (typeof App !== 'undefined' && App.refreshOrders) {
            await App.refreshOrders();
          }
        } catch (err) {
          Utils.showToast('❌ 导入失败: ' + err.message);
        }
      });
    } catch (err) {
      Utils.showToast('❌ JSON 格式错误，请检查后重试');
    }
  },

  /**
   * 切换用户管理区域
   */
  async toggleUserMgmt() {
    this.showUserMgmt = !this.showUserMgmt;
    await this.renderUserList();
  },

  /**
   * 渲染用户列表
   */
  async renderUserList() {
    const users = await Orders.fetchUsers();
    document.getElementById('toggleUserMgmtBtn').textContent = this.showUserMgmt ? '收起' : `查看用户列表（共 ${users.length} 人）`;
    const area = document.getElementById('userListArea');
    area.style.display = this.showUserMgmt ? 'block' : 'none';
    if (this.showUserMgmt) {
      area.innerHTML = users.map(u => `
        <div class="user-list-item">
          <div class="user-list-left">
            <span class="user-list-name">${Utils.escHtml(u.username)}</span>
            <span class="tag ${u.role === 'admin' ? 'tag-cancel' : 'tag-video'}">${u.role === 'admin' ? '👑 管理员' : '👤 用户'}</span>
          </div>
          ${u.id !== Auth.currentUser?.id
            ? `<button class="btn btn-sm btn-danger" onclick="Settings.deleteUserConfirm('${u.id}', '${Utils.escHtml(u.username)}')">删除</button>`
            : '<span style="font-size:11px;color:var(--text-secondary);">当前用户</span>'}
        </div>
      `).join('');
    }
  },

  /**
   * 确认删除用户
   */
  deleteUserConfirm(userId, username) {
    if (userId === Auth.currentUser?.id) {
      Utils.showToast('不能删除自己');
      return;
    }
    Utils.showConfirm(`确定删除用户「${username}」吗？该用户创建的订单也将被删除。`, async () => {
      try {
        await Orders.deleteUser(userId);
        await this.renderUserList();
        await App.refreshOrders();
        Utils.showToast('🗑️ 用户已删除');
      } catch (err) {
        Utils.showToast('❌ 删除失败: ' + err.message);
      }
    });
  },

  /**
   * 确认清空全部数据
   */
  confirmClearAll() {
    Utils.showConfirm('⚠️ 确定要清空全部订单数据吗？此操作不可恢复！建议先导出备份。', async () => {
      try {
        await Orders.clearAll();
        if (typeof App !== 'undefined') {
          App.selectedId = null;
          await App.refreshOrders();
        }
        Utils.showToast('🗑️ 全部订单已清空');
      } catch (err) {
        Utils.showToast('❌ 清空失败: ' + err.message);
      }
    });
  },

  /**
   * 加载示例数据
   */
  async loadDemoData(orders) {
    const doLoad = async () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const demoData = [
        { orderNumber: '', producer: '小光', orderDate: todayStr, customer: '小明同学', contact: '微信 xm_2024', serviceType: '朗诵背景视频', title: '朗诵《再别康桥》背景视频', description: '3分钟左右，水墨江南风格，配钢琴曲《致爱丽丝》，需要字幕同步', totalPrice: 120, deposit: 60, balance: 60, status: '进行中', deadline: new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10) },
        { orderNumber: '', producer: '小光', orderDate: todayStr, customer: '李经理', contact: '旺旺联系', serviceType: 'PPT制作', title: 'Q2工作汇报PPT', description: '15页左右，科技风，蓝色主色调，需要图表美化和动画效果', totalPrice: 600, deposit: 300, balance: 300, status: '待付定金', deadline: new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10) },
        { orderNumber: '', producer: '微光', orderDate: todayStr, customer: '小红薯666', contact: '微信 red_668', serviceType: '视频剪辑', title: '生日派对Vlog', description: '3-5分钟混剪，素材约50个片段，要卡点配乐欢快风格', totalPrice: 150, deposit: 150, balance: 0, status: '已完成', deadline: '' },
        { orderNumber: '', producer: '微光', orderDate: todayStr, customer: '张老师', contact: '138xxxx8888', serviceType: '视频剪辑', title: '学校活动宣传片', description: '校庆活动回顾，多素材整合，3分钟，大气风', totalPrice: 350, deposit: 175, balance: 175, status: '待付尾款', deadline: new Date(now.getTime() + 1 * 86400000).toISOString().slice(0, 10) },
      ];

      await Orders.clearAll();
      const count = await Orders.importBatch(demoData);
      Utils.showToast('✅ 已加载 ' + count + ' 条示例数据');
    };

    if (orders.length > 0) {
      Utils.showConfirm('加载示例数据会覆盖当前数据，确定继续？', async () => {
        await doLoad();
        await App.refreshOrders();
      });
    } else {
      await doLoad();
      await App.refreshOrders();
    }
  },
};
