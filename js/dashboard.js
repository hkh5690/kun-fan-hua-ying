/**
 * 数据看板模块 — 鲲繁花影
 */

const Dashboard = {
  /**
   * 渲染数据看板
   */
  render(orders) {
    const visible = orders; // 已经经过 RLS 过滤
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const activeOrders = visible.filter(o => o.status !== '已取消');

    // 服务类型分布
    const typeCount = {};
    activeOrders.forEach(o => {
      const t = o.service_type || '其他';
      typeCount[t] = (typeCount[t] || 0) + 1;
    });
    const typeTotal = Object.values(typeCount).reduce((a, b) => a + b, 0) || 1;

    // 状态分布
    const statusCount = {};
    visible.forEach(o => {
      const s = o.status || '未知';
      statusCount[s] = (statusCount[s] || 0) + 1;
    });
    const statusTotal = Object.values(statusCount).reduce((a, b) => a + b, 0) || 1;

    // 近6个月收入
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const key = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
      monthlyRevenue.push({ month: key, amount: 0 });
    }
    visible.filter(o => o.status !== '已取消').forEach(o => {
      const d = new Date(o.order_date);
      const key = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
      const entry = monthlyRevenue.find(m => m.month === key);
      if (entry) entry.amount += (parseFloat(o.total_price) || 0);
    });
    const maxRev = Math.max(1, ...monthlyRevenue.map(m => m.amount));

    document.getElementById('dashGrid').innerHTML = `
      <div class="dash-card">
        <h3>📂 服务类型分布</h3>
        ${Object.entries(typeCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
          <div class="chart-bar-row">
            <span class="chart-label">${k}</span>
            <div class="chart-bar-bg"><div class="chart-bar-fill" style="width:${(v / typeTotal * 100)}%"></div></div>
            <span class="chart-value">${v} 单</span>
          </div>
        `).join('') || '<p style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px;">暂无数据</p>'}
      </div>
      <div class="dash-card">
        <h3>📊 订单状态分布</h3>
        ${Object.entries(statusCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `
          <div class="chart-bar-row">
            <span class="chart-label">${k}</span>
            <div class="chart-bar-bg"><div class="chart-bar-fill" style="width:${(v / statusTotal * 100)}%;background:${Utils.statusColor(k)}"></div></div>
            <span class="chart-value">${v} 单</span>
          </div>
        `).join('') || ''}
      </div>
      <div class="dash-card full-width">
        <h3>📈 近6个月收入趋势</h3>
        <div style="display:flex;align-items:flex-end;gap:8px;height:160px;padding-top:8px;">
          ${monthlyRevenue.map(m => `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%;">
              <span style="font-size:11px;margin-bottom:4px;font-weight:600;color:var(--primary-dark)">${Utils.formatMoney(m.amount)}</span>
              <div style="width:100%;background:var(--primary);border-radius:6px 6px 0 0;height:${Math.max(4, (m.amount / maxRev * 120))}px;min-height:4px;transition:height 0.3s;"></div>
              <span style="font-size:10px;color:var(--text-secondary);margin-top:6px;">${m.month}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },
};
