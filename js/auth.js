/**
 * 认证模块 — 鲲繁花影
 * 处理用户注册、登录、登出、会话管理
 */

const Auth = {
  // 当前用户信息缓存
  currentUser: null,

  /**
   * 获取当前登录用户（含角色信息）
   */
  async getCurrentUser() {
    // 先检查 Supabase 会话
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      this.currentUser = null;
      return null;
    }

    // 从 user_roles 表获取用户名和角色
    const { data: roleData, error } = await supabase
      .from('user_roles')
      .select('username, role')
      .eq('id', session.user.id)
      .single();

    if (error || !roleData) {
      console.error('获取用户角色失败:', error);
      this.currentUser = null;
      return null;
    }

    this.currentUser = {
      id: session.user.id,
      email: session.user.email,
      username: roleData.username,
      role: roleData.role,
    };

    return this.currentUser;
  },

  /**
   * 注册新用户
   */
      async sendCode(email) {
    const res = await fetch('/api/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || '发送失败');
    return result;
  },

  async verifyAndSignUp(token, code, password, username, role) {
    const res = await fetch('/api/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, code, password, username, role: role || 'editor' }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || '验证失败');
    return result;
  },

  async signUp(email, password, username) {
    throw new Error('请使用验证码注册');
  },



  /**
   * 登录
   */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('邮箱或密码错误');
      }
      throw new Error(error.message);
    }

    // 获取角色信息
    await this.getCurrentUser();
    if (!this.currentUser) {
      throw new Error('账号尚未激活，请确认数据库触发器是否已配置。如需帮助请联系管理员。');
    }
    return this.currentUser;
  },

  /**
   * 登出
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('登出失败:', error);
    }
    this.currentUser = null;
  },

  /**
   * 判断当前用户是否为管理员
   */
  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  },

  /**
   * 判断当前用户是否为客服
   */
  isCS() {
    return this.currentUser && this.currentUser.role === 'cs';
  },

  /**
   * 判断当前用户是否为剪辑
   */
  isEditor() {
    return this.currentUser && this.currentUser.role === 'editor';
  },

  /**
   * 监听认证状态变化
   */
  onAuthStateChange(callback) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await this.getCurrentUser();
        callback('SIGNED_IN', this.currentUser);
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        callback('SIGNED_OUT', null);
      } else if (event === 'TOKEN_REFRESHED') {
        await this.getCurrentUser();
        callback('TOKEN_REFRESHED', this.currentUser);
      }
    });
  },
};
