import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResetPasswordRequest {
  targetUserId: string;
  newPassword: string;
  adminUserId: string;
  adminName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { targetUserId, newPassword, adminUserId, adminName }: ResetPasswordRequest = await req.json();

    // Verify admin permissions
    const { data: adminProfile, error: adminError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', adminUserId)
      .single();

    if (adminError || adminProfile?.role !== 'admin') {
      throw new Error('Apenas administradores podem redefinir senhas');
    }

    // Get target user info for audit log
    const { data: targetProfile, error: targetError } = await supabaseClient
      .from('profiles')
      .select('name, email')
      .eq('user_id', targetUserId)
      .single();

    if (targetError) {
      throw new Error('Usuário não encontrado');
    }

    // Update user password using admin API
    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateError) {
      throw updateError;
    }

    // Log the password reset action
    await supabaseClient.rpc('log_audit_event', {
      p_user_id: adminUserId,
      p_user_name: adminName,
      p_action: 'PASSWORD_RESET',
      p_table_name: 'auth.users',
      p_record_id: targetUserId,
      p_new_values: { 
        target_user: targetProfile.name,
        target_email: targetProfile.email,
        reset_method: 'admin_manual'
      }
    });

    console.log(`Password reset by admin ${adminName} for user ${targetProfile.name}`);

    return new Response(JSON.stringify({ 
      message: 'Senha redefinida com sucesso',
      success: true
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      },
    });

  } catch (error: any) {
    console.error('Error in admin-reset-password function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno do servidor',
        success: false
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);