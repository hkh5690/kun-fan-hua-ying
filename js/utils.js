/**
 * 工具函数 — 鲲繁花影
 */

const Utils = {
  formatDate(d) {
    if (!d) return '-';
    const parts = d.split('T')[0].split('-');
    if (parts.length === 3) {
      return parts[0] + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
    }
    return d;
  },

  formatMoney(n) {
    const num = parseFloat(n) || 0;
    return '¥' + num.toFixed(2);
  },

  genId() {
    return 'ORD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  },

  genOrderNumber(existingOrders) {
    const now = new Date();
    const today = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const prefix = 'WG' + today;
    const todayOrders = existingOrders.filter(o => o.order_number && o.order_number.startsWith(prefix));
    const seq = String(todayOrders.length + 1).padStart(3, '0');
    return prefix + '-' + seq;
  },

  getServiceTypeTag(type) {
    const map = { '视频剪辑': 'tag-video', 'PPT制作': 'tag-ppt', '朗诵背景视频': 'tag-recite', '网页制作': 'tag-web', '其他': 'tag-other' };
    return map[type] || 'tag-other';
  },

  getStatusTag(status) {
    const map = { '待付定金': 'tag-deposit', '进行中': 'tag-progress', '待付尾款': 'tag-balance', '已完成': 'tag-done', '已取消': 'tag-cancel' };
    return map[status] || 'tag-other';
  },

  statusColor(status) {
    const map = { '待付定金': '#ED8936', '进行中': '#2B579A', '待付尾款': '#E53E3E', '已完成': '#38A169', '已取消': '#999' };
    return map[status] || '#999';
  },

  isDeadlineUrgent(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const diff = d - now;
    return diff > 0 && diff < 2 * 24 * 3600 * 1000;
  },

  escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  },

  showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  },

  showConfirm(msg, cb) {
    document.getElementById('confirmMsg').textContent = msg;
    document.getElementById('confirmOverlay').classList.add('open');
    window._confirmCallback = cb;
  },

  closeConfirm() {
    document.getElementById('confirmOverlay').classList.remove('open');
    window._confirmCallback = null;
  },

  downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    Utils.showToast('📤 文件已下载: ' + filename);
  },
};
