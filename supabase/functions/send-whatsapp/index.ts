import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { phone, message, template_name } = await req.json()

    // Get WhatsApp configuration
    const { data: config, error: configError } = await supabase
      .from('api_integrations')
      .select('config, enabled')
      .eq('integration_name', 'whatsapp_business')
      .single()

    if (configError || !config?.enabled) {
      throw new Error('WhatsApp integration not configured or disabled')
    }

    const whatsappConfig = config.config as any
    const accessToken = whatsappConfig.api_key
    const phoneNumberId = whatsappConfig.phone_number

    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp credentials not configured')
    }

    // Send WhatsApp message using Graph API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: {
            body: message
          }
        }),
      }
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`)
    }

    // Log the notification
    await supabase
      .from('notification_logs')
      .insert({
        integration_type: 'whatsapp',
        recipient: phone,
        content: message,
        status: 'sent',
        metadata: {
          template_name,
          message_id: result.messages?.[0]?.id,
          whatsapp_response: result
        },
        sent_at: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: result.messages?.[0]?.id 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('Error in send-whatsapp function:', error)
    
    // Log failed notification
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      const { phone, message, template_name } = await req.json()
      
      await supabase
        .from('notification_logs')
        .insert({
          integration_type: 'whatsapp',
          recipient: phone || 'unknown',
          content: message || '',
          status: 'failed',
          error_message: error.message,
          metadata: { template_name }
        })
    } catch (logError) {
      console.error('Error logging failed notification:', logError)
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})