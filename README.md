# 鲲繁花影 · 订单管理系统

一个基于 **Supabase + Vercel + Cloudflare** 的全栈订单管理 Web 应用，适合自由职业者/小型团队管理接单流程。

## 🚀 部署步骤

### 第 1 步：注册账号

| 服务 | 注册地址 | 说明 |
|------|---------|------|
| Supabase | [supabase.com](https://supabase.com) | 免费套餐含 500MB 数据库 |
| Vercel | [vercel.com](https://vercel.com) | 免费套餐含 100GB 带宽/月 |
| Cloudflare | [cloudflare.com](https://cloudflare.com) | 域名注册 + DNS 管理 |

### 第 2 步：Supabase 数据库配置

1. 登录 Supabase，创建新项目（记住数据库密码）
2. 进入 **SQL Editor**，复制 `setup.sql` 的全部内容并执行
3. 进入 **Authentication → Settings**：
   - 取消勾选 **Confirm email** (禁用邮箱验证)
   - 点击 Save
4. 进入 **Settings → API**，复制：
   - `Project URL` (作为 SUPABASE_URL)
   - `anon public` key (作为 SUPABASE_ANON_KEY)

### 第 3 步：配置环境变量

编辑 `js/supabase-client.js`，将占位符替换为你在第 2 步获取的值：

```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

### 第 4 步：Vercel 部署

1. 将本项目推送到 GitHub 仓库
2. 登录 Vercel，点击 **New Project**
3. 导入你的 GitHub 仓库
4. 无需配置 Framework（纯静态站点），直接点击 **Deploy**
5. 部署成功后获得 `https://xxx.vercel.app` 地址

### 第 5 步：Cloudflare 域名配置（可选）

1. 在 Cloudflare 注册域名（如 `my-order-app.com`）
2. 在 DNS 中添加 CNAME 记录：
   - 类型：`CNAME`
   - 名称：`@`（或 `www`）
   - 目标：`xxx.vercel.app`（你在 Vercel 的域名）
3. 在 Vercel 项目设置 → **Domains** 中添加自定义域名
4. SSL 证书会自动签发

## 📦 项目结构

```
kun-fan-hua-ying/
├── index.html           # 主页面入口
├── css/
│   └── style.css        # 样式表
├── js/
│   ├── supabase-client.js  # Supabase SDK 初始化
│   ├── utils.js            # 工具函数
│   ├── auth.js             # 认证模块
│   ├── orders.js           # 订单 CRUD
│   ├── dashboard.js        # 数据看板
│   ├── settings.js         # 设置 + 用户管理
│   └── app.js              # 主应用逻辑
├── setup.sql            # 数据库初始化脚本
├── vercel.json          # Vercel 配置
└── README.md
```

## 🔐 权限说明

| 角色 | 权限 |
|------|------|
| **管理员** | 查看/编辑/删除所有订单、管理用户、导出数据 |
| **普通用户** | 只能查看/编辑/删除自己创建的订单 |

首位注册用户自动成为管理员。

## 🛠️ 技术栈

- **前端**: Vanilla HTML/CSS/JS（无框架依赖）
- **后端**: Supabase (PostgreSQL + Auth)
- **托管**: Vercel (Static Hosting)
- **DNS**: Cloudflare
