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

    const requestData = await req.json()
    const { to, subject, html, template_name, provider = 'sendgrid' } = requestData

    // Input validation
    if (!to || typeof to !== 'string') {
      throw new Error('Valid email address is required')
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      throw new Error('Invalid email address format')
    }
    
    if (to.length > 255) {
      throw new Error('Email address too long (max 255 characters)')
    }

    if (!subject || typeof subject !== 'string') {
      throw new Error('Subject is required')
    }
    
    if (subject.length > 500) {
      throw new Error('Subject too long (max 500 characters)')
    }
    
    // Check for email header injection attempts
    if (subject.includes('\n') || subject.includes('\r')) {
      throw new Error('Invalid characters in subject')
    }

    if (!html || typeof html !== 'string') {
      throw new Error('Email content is required')
    }
    
    if (html.length > 100000) {
      throw new Error('Email content too long (max 100KB)')
    }

    if (provider && !['sendgrid', 'mailchimp'].includes(provider)) {
      throw new Error('Invalid email provider')
    }

    // Get email configuration
    const { data: config, error: configError } = await supabase
      .from('api_integrations')
      .select('config, enabled')
      .eq('integration_name', provider)
      .single()

    if (configError || !config?.enabled) {
      throw new Error(`${provider} integration not configured or disabled`)
    }

    const emailConfig = config.config as any
    let result

    if (provider === 'sendgrid') {
      // SendGrid implementation
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${emailConfig.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: to }],
              subject: subject,
            },
          ],
          from: {
            email: emailConfig.from_email,
            name: emailConfig.from_name || 'Sistema de Rondas'
          },
          content: [
            {
              type: 'text/html',
              value: html,
            },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`SendGrid API error: ${error}`)
      }

      result = { provider: 'sendgrid', status: 'sent' }
    } else if (provider === 'mailchimp') {
      // Mailchimp Transactional (Mandrill) implementation
      const response = await fetch(`https://${emailConfig.server_prefix}.api.mailchimp.com/3.0/messages/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${emailConfig.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            html: html,
            subject: subject,
            from_email: emailConfig.from_email,
            from_name: emailConfig.from_name || 'Sistema de Rondas',
            to: [{ email: to, type: 'to' }],
          },
        }),
      })

      const mailchimpResult = await response.json()
      
      if (!response.ok) {
        throw new Error(`Mailchimp API error: ${mailchimpResult.detail || 'Unknown error'}`)
      }

      result = { provider: 'mailchimp', status: 'sent', response: mailchimpResult }
    }

    // Log the notification
    await supabase
      .from('notification_logs')
      .insert({
        integration_type: 'email',
        recipient: to,
        subject: subject,
        content: html,
        status: 'sent',
        metadata: {
          template_name,
          provider,
          result
        },
        sent_at: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        provider,
        result 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('Error in send-email function:', error)
    
    // Log failed notification
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      const { to, subject, html, template_name, provider } = await req.json()
      
      await supabase
        .from('notification_logs')
        .insert({
          integration_type: 'email',
          recipient: to || 'unknown',
          subject: subject || '',
          content: html || '',
          status: 'failed',
          error_message: error.message,
          metadata: { template_name, provider }
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