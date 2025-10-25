-- Criar função RPC para criar perfis faltantes manualmente

-- 1. Melhorar o trigger handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'tatico'::public.user_role),
    true
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    updated_at = now();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- 2. Garantir que o trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Criar função RPC para administradores criarem perfis faltantes manualmente
CREATE OR REPLACE FUNCTION public.create_missing_profiles()
RETURNS TABLE (
  created_count INTEGER,
  created_users TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_created_count INTEGER := 0;
  v_created_users TEXT[] := ARRAY[]::TEXT[];
  v_user RECORD;
BEGIN
  -- Verificar se o usuário é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'::public.user_role
  ) THEN
    RAISE EXCEPTION 'Only administrators can create missing profiles';
  END IF;

  -- Criar perfis faltantes
  FOR v_user IN 
    SELECT 
      u.id,
      u.email,
      u.raw_user_meta_data->>'name' as name,
      u.raw_user_meta_data->>'role' as role
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.user_id IS NULL
  LOOP
    INSERT INTO public.profiles (
      user_id,
      name,
      email,
      role,
      active
    ) VALUES (
      v_user.id,
      COALESCE(v_user.name, v_user.email),
      v_user.email,
      COALESCE(v_user.role::public.user_role, 'tatico'::public.user_role),
      true
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    v_created_count := v_created_count + 1;
    v_created_users := array_append(v_created_users, v_user.email);
  END LOOP;

  RETURN QUERY SELECT v_created_count, v_created_users;
END;
$function$;