/**
 * 订单 CRUD 模块 — 鲲繁花影
 * 所有数据操作通过 Supabase，替代 localStorage
 */

const Orders = {
  /**
   * 获取当前用户可见的订单列表
   * RLS 策略在数据库层面自动过滤
   */
  async fetchOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取订单失败:', error);
      throw new Error('获取订单列表失败，请检查网络连接');
    }

    return data || [];
  },

  /**
   * 创建新订单
   */
  async create(orderData) {
    const user = await Auth.getCurrentUser();
    if (!user) throw new Error('请先登录');

    const record = {
      id: orderData.id,
      order_number: orderData.orderNumber || '',
      producer: orderData.producer || '',
      order_date: orderData.orderDate || new Date().toISOString().slice(0, 10),
      customer: orderData.customer || '',
      contact: orderData.contact || '',
      service_type: orderData.serviceType || '',
      title: orderData.title || '',
      description: orderData.description || '',
      total_price: orderData.totalPrice || 0,
      deposit: orderData.deposit || 0,
      balance: orderData.balance || 0,
      status: orderData.status || '待付定金',
      deadline: orderData.deadline || '',
      created_by: user.id,
      editor_price: orderData.editorPrice || 0,
      assigned_to: orderData.assignedTo || null,
      promotion_fee: orderData.promotionFee || 0,
    };

    const { error } = await supabase.from('orders').insert(record);

    if (error) {
      console.error('创建订单失败:', error);
      throw new Error('创建订单失败: ' + error.message);
    }

    return record;
  },

  /**
   * 更新订单
   */
  async update(id, orderData) {
    const user = await Auth.getCurrentUser();
    if (!user) throw new Error('请先登录');

    const updates = {
      order_number: orderData.orderNumber || '',
      producer: orderData.producer || '',
      customer: orderData.customer || '',
      contact: orderData.contact || '',
      service_type: orderData.serviceType || '',
      title: orderData.title || '',
      description: orderData.description || '',
      total_price: orderData.totalPrice || 0,
      deposit: orderData.deposit || 0,
      balance: orderData.balance || 0,
      status: orderData.status || '待付定金',
      deadline: orderData.deadline || '',
      editor_price: orderData.editorPrice || 0,
      promotion_fee: orderData.promotionFee || 0,
    };
    // 始终更新 assigned_to（包括清空分配）
    updates.assigned_to = orderData.assignedTo || null;

    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('更新订单失败:', error);
      throw new Error('更新订单失败: ' + error.message);
    }
  },

  /**
   * 删除订单
   */
  async delete(id) {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除订单失败:', error);
      throw new Error('删除订单失败: ' + error.message);
    }
  },

  /**
   * 快速修改订单状态
   */
  async quickStatus(id, newStatus) {
    const updates = { status: newStatus };

    // 标记完成时自动清零尾款
    if (newStatus === '已完成') {
      // 先获取订单信息
      const { data: order } = await supabase
        .from('orders')
        .select('total_price, deposit')
        .eq('id', id)
        .single();

      updates.balance = 0;
      if (order && order.deposit === 0) {
        updates.deposit = order.total_price;
      }
    }

    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('更新状态失败:', error);
      throw new Error('更新状态失败: ' + error.message);
    }
  },

  /**
   * 清空所有订单（仅 admin）
   */
  async clearAll() {
    const { error } = await supabase
      .from('orders')
      .delete()
      .neq('id', '__placeholder__'); // 删除所有

    if (error) {
      console.error('清空订单失败:', error);
      throw new Error('清空订单失败: ' + error.message);
    }
  },

  /**
   * 批量导入订单
   */
  async importBatch(ordersArray) {
    const user = await Auth.getCurrentUser();
    if (!user) throw new Error('请先登录');

    const records = ordersArray.map(o => ({
      id: o.id || Utils.genId(),
      order_number: o.orderNumber || '',
      producer: o.producer || '',
      order_date: o.orderDate || new Date().toISOString().slice(0, 10),
      customer: o.customer || '',
      contact: o.contact || '',
      service_type: o.serviceType || '',
      title: o.title || '',
      description: o.description || '',
      total_price: o.totalPrice || 0,
      deposit: o.deposit || 0,
      balance: o.balance || 0,
      status: o.status || '待付定金',
      deadline: o.deadline || '',
      created_by: user.id,
      assigned_to: o.assignedTo || o.assigned_to || null,
      editor_price: o.editorPrice || o.editor_price || 0,
      promotion_fee: o.promotionFee || o.promotion_fee || 0,
    }));

    const { error } = await supabase.from('orders').insert(records);

    if (error) {
      console.error('导入订单失败:', error);
      throw new Error('导入失败: ' + error.message);
    }

    return records.length;
  },

  /**
   * 获取所有用户列表（仅 admin）
   */
  async fetchUsers() {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('获取用户列表失败:', error);
      return [];
    }

    return data || [];
  },

  /**
   * 删除用户（仅 admin）
   */
  async deleteUser(userId) {
    const token = await Utils.getAccessToken();
    const res = await fetch('/api/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ userId }),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || '删除失败');
    }
  },
};
