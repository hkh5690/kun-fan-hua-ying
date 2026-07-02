-- ============================================================
-- 鲲繁花影 · 订单管理系统 — Supabase 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================================

-- 1. 关闭邮箱验证（在 Authentication → Settings 中手动设置）
--    进入 Dashboard → Authentication → Settings
--    - 取消勾选 "Confirm email" / "Enable email confirmations"
--    这样用户注册后无需验证邮箱即可登录

-- 2. 创建 user_roles 表
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text NOT NULL UNIQUE,
  role       text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. 创建 orders 表
CREATE TABLE IF NOT EXISTS public.orders (
  id           text PRIMARY KEY,
  order_number text NOT NULL DEFAULT '',
  producer     text NOT NULL DEFAULT '',
  order_date   text NOT NULL DEFAULT '',
  customer     text NOT NULL DEFAULT '',
  contact      text NOT NULL DEFAULT '',
  service_type text NOT NULL DEFAULT '',
  title        text NOT NULL DEFAULT '',
  description  text NOT NULL DEFAULT '',
  total_price  float8 NOT NULL DEFAULT 0,
  deposit      float8 NOT NULL DEFAULT 0,
  balance      float8 NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT '待付定金',
  deadline     text NOT NULL DEFAULT '',
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 4. 开启 Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. user_roles 的 RLS 策略
-- 所有人可以读取（用于检查角色）
CREATE POLICY "允许所有人读取角色" ON public.user_roles
  FOR SELECT USING (true);

-- 只有自己能更新自己的角色信息（实际上由 trigger 管理）
CREATE POLICY "允许用户读取自己的角色" ON public.user_roles
  FOR SELECT USING (auth.uid() = id);

-- 6. 辅助函数：判断当前用户是否为 admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 7. orders 的 RLS 策略
-- Admin 可以读取所有订单
CREATE POLICY "管理员可读取所有订单" ON public.orders
  FOR SELECT USING (public.is_admin());

-- 普通用户只能读取自己的订单
CREATE POLICY "用户可读取自己订单" ON public.orders
  FOR SELECT USING (auth.uid() = created_by);

-- Admin 可以插入任意订单
CREATE POLICY "管理员可插入订单" ON public.orders
  FOR INSERT WITH CHECK (public.is_admin());

-- 普通用户可以插入自己的订单
CREATE POLICY "用户可插入自己订单" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Admin 可以更新任意订单
CREATE POLICY "管理员可更新任意订单" ON public.orders
  FOR UPDATE USING (public.is_admin());

-- 普通用户只能更新自己的订单
CREATE POLICY "用户可更新自己订单" ON public.orders
  FOR UPDATE USING (auth.uid() = created_by);

-- Admin 可以删除任意订单
CREATE POLICY "管理员可删除任意订单" ON public.orders
  FOR DELETE USING (public.is_admin());

-- 普通用户只能删除自己的订单
CREATE POLICY "用户可删除自己订单" ON public.orders
  FOR DELETE USING (auth.uid() = created_by);

-- 8. 触发器函数：新用户注册时自动创建 user_roles 记录
-- 第一个注册的用户自动成为 admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_count int;
  assigned_role text;
  raw_meta jsonb;
  display_name text;
BEGIN
  -- 获取用户元数据中的 username
  raw_meta := NEW.raw_user_meta_data;
  display_name := raw_meta ->> 'username';

  -- 如果没提供 username，用 email 前缀
  IF display_name IS NULL OR display_name = '' THEN
    display_name := split_part(NEW.email, '@', 1);
  END IF;

  -- 统计已有用户数
  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  -- 第一个用户是 admin
  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'user';
  END IF;

  -- 插入 user_roles
  INSERT INTO public.user_roles (id, username, role)
  VALUES (NEW.id, display_name, assigned_role);

  RETURN NEW;
END;
$$;

-- 绑定触发器到 auth.users 表
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 9. 创建更新时间自动更新的触发器
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
