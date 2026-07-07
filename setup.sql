-- ============================================================
-- 鲲繁花影 · 订单管理系统 — Supabase 数据库初始化脚本 v2
-- 在 Supabase SQL Editor 中执行此脚本
-- 角色: admin(管理员) / cs(客服) / editor(剪辑)
-- ============================================================

-- 1. 关闭邮箱验证（在 Authentication → Settings 中手动设置）
--    进入 Dashboard → Authentication → Settings
--    - 取消勾选 "Confirm email" / "Enable email confirmations"
--    这样用户注册后无需验证邮箱即可登录

-- 2. 创建 user_roles 表
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text NOT NULL UNIQUE,
  role       text NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'cs')),
  approved   boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. 创建 orders 表（含 assigned_to 分配字段）
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
  assigned_to  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 4. 扩展角色约束（升级已有表）
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'editor', 'cs'));

-- 5. 添加 assigned_to 列 + approved 列（升级已有表）
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true;

-- 6. 开启 Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 7. user_roles 的 RLS 策略
-- 所有人可以读取（用于检查角色）
DROP POLICY IF EXISTS "允许所有人读取角色" ON public.user_roles;
CREATE POLICY "允许所有人读取角色" ON public.user_roles
  FOR SELECT USING (true);

-- 只有自己能读取自己的角色（实际仍由上面的策略覆盖）
DROP POLICY IF EXISTS "允许用户读取自己的角色" ON public.user_roles;
CREATE POLICY "允许用户读取自己的角色" ON public.user_roles
  FOR SELECT USING (auth.uid() = id);

-- 8. 辅助函数

-- 判断当前用户是否为 admin
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

-- 判断当前用户是否为客服
CREATE OR REPLACE FUNCTION public.is_cs()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE id = auth.uid() AND role = 'cs'
  );
$$;

-- 判断当前用户是否为剪辑
CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE id = auth.uid() AND role = 'editor'
  );
$$;

-- 判断当前用户是否可以编辑订单（admin 或 cs 或订单所有者）
CREATE OR REPLACE FUNCTION public.can_edit_order(order_row public.orders)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    public.is_admin()
    OR public.is_cs()
    OR (public.is_editor() AND order_row.assigned_to = auth.uid())
    OR order_row.created_by = auth.uid();
$$;

-- 9. orders 的 RLS 策略（先删后建，确保幂等）

-- SELECT: admin全部 + cs全部 + editor自己的(assigned_to) + 用户自己的(created_by)
DROP POLICY IF EXISTS "管理员可读取所有订单" ON public.orders;
CREATE POLICY "管理员可读取所有订单" ON public.orders
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "客服可读取所有订单" ON public.orders;
CREATE POLICY "客服可读取所有订单" ON public.orders
  FOR SELECT USING (public.is_cs());

DROP POLICY IF EXISTS "剪辑可读取自己订单" ON public.orders;
CREATE POLICY "剪辑可读取自己订单" ON public.orders
  FOR SELECT USING (auth.uid() = assigned_to OR auth.uid() = created_by);

-- INSERT: admin + cs
DROP POLICY IF EXISTS "管理员可插入订单" ON public.orders;
CREATE POLICY "管理员可插入订单" ON public.orders
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "客服可插入订单" ON public.orders;
CREATE POLICY "客服可插入订单" ON public.orders
  FOR INSERT WITH CHECK (public.is_cs());

-- UPDATE: admin全部 + cs全部 + editor自己的
DROP POLICY IF EXISTS "管理员可更新任意订单" ON public.orders;
CREATE POLICY "管理员可更新任意订单" ON public.orders
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "客服可更新任意订单" ON public.orders;
CREATE POLICY "客服可更新任意订单" ON public.orders
  FOR UPDATE USING (public.is_cs());

DROP POLICY IF EXISTS "剪辑可更新自己订单" ON public.orders;
CREATE POLICY "剪辑可更新自己订单" ON public.orders
  FOR UPDATE USING (auth.uid() = assigned_to);

-- DELETE: 仅 admin
DROP POLICY IF EXISTS "管理员可删除任意订单" ON public.orders;
CREATE POLICY "管理员可删除任意订单" ON public.orders
  FOR DELETE USING (public.is_admin());

-- 移除旧的普通用户策略
DROP POLICY IF EXISTS "用户可读取自己订单" ON public.orders;
DROP POLICY IF EXISTS "用户可插入自己订单" ON public.orders;
DROP POLICY IF EXISTS "用户可更新自己订单" ON public.orders;
DROP POLICY IF EXISTS "用户可删除自己订单" ON public.orders;

-- 10. 触发器函数：新用户注册时自动创建 user_roles 记录
-- 第一个注册的用户自动成为 admin
-- 后续用户通过 user_metadata.role 指定角色，默认 editor
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
  -- 获取用户元数据
  raw_meta := NEW.raw_user_meta_data;
  display_name := raw_meta ->> 'username';

  -- 如果没提供 username，用 email 前缀
  IF display_name IS NULL OR display_name = '' THEN
    display_name := split_part(NEW.email, '@', 1);
  END IF;

  -- 统计已有用户数
  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  -- 第一个用户是 admin，自动审批
  IF user_count = 0 THEN
    assigned_role := 'admin';
    INSERT INTO public.user_roles (id, username, role, approved)
    VALUES (NEW.id, display_name, assigned_role, true);
    RETURN NEW;
  END IF;

  -- 从注册元数据中读取角色，默认 editor
  assigned_role := COALESCE(raw_meta ->> 'role', 'editor');
  -- 校验角色合法性
  IF assigned_role NOT IN ('admin', 'editor', 'cs') THEN
    assigned_role := 'editor';
  END IF;

  -- 客服需要管理员审批，editor 自动审批
  INSERT INTO public.user_roles (id, username, role, approved)
  VALUES (NEW.id, display_name, assigned_role, assigned_role != 'cs');

  RETURN NEW;
END;
$$;

-- 绑定触发器到 auth.users 表
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 11. 创建更新时间自动更新的触发器
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
