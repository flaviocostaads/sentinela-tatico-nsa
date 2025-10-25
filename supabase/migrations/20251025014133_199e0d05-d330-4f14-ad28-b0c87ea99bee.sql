-- Remover todos os triggers problemáticos e corrigir criação automática de perfis

-- 1. Remover todos os triggers e função com CASCADE
DROP FUNCTION IF EXISTS public.ensure_authenticated_user() CASCADE;

-- 2. Criar função handle_new_user melhorada
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    name, 
    email, 
    role,
    active
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'tatico'::user_role),
    true
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = now();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- 3. Garantir que o trigger on_auth_user_created existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Criar perfis para todos os usuários sem perfil
INSERT INTO public.profiles (user_id, name, email, role, active)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', u.email),
  u.email,
  COALESCE((u.raw_user_meta_data->>'role')::user_role, 'tatico'::user_role),
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;