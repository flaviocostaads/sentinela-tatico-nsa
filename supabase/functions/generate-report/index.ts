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

    const { report_type, start_date, end_date, recipients } = await req.json()

    // Get report configuration
    const { data: config, error: configError } = await supabase
      .from('api_integrations')
      .select('config, enabled')
      .eq('integration_name', 'automated_reports')
      .single()

    if (configError || !config?.enabled) {
      throw new Error('Automated reports not configured or disabled')
    }

    const reportConfig = config.config as any
    const defaultRecipients = reportConfig.recipients || []
    const finalRecipients = recipients || defaultRecipients

    if (!finalRecipients.length) {
      throw new Error('No recipients configured for reports')
    }

    // Generate report data based on type
    let reportData: any = {}
    const startDateTime = new Date(start_date)
    const endDateTime = new Date(end_date)

    // Get rounds data
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select(`
        id, status, start_time, end_time, user_id,
        profiles!inner(name, email)
      `)
      .gte('created_at', startDateTime.toISOString())
      .lte('created_at', endDateTime.toISOString())

    if (roundsError) throw roundsError

    // Get incidents data
    const { data: incidents, error: incidentsError } = await supabase
      .from('incidents')
      .select('id, type, priority, status, reported_at, title')
      .gte('reported_at', startDateTime.toISOString())
      .lte('reported_at', endDateTime.toISOString())

    if (incidentsError) throw incidentsError

    // Get checkpoint visits
    const { data: visits, error: visitsError } = await supabase
      .from('checkpoint_visits')
      .select('id, status, visit_time, duration')
      .gte('visit_time', startDateTime.toISOString())
      .lte('visit_time', endDateTime.toISOString())

    if (visitsError) throw visitsError

    // Compile report data
    reportData = {
      period: {
        start: start_date,
        end: end_date,
        type: report_type
      },
      summary: {
        total_rounds: rounds?.length || 0,
        completed_rounds: rounds?.filter(r => r.status === 'completed').length || 0,
        active_rounds: rounds?.filter(r => r.status === 'active').length || 0,
        total_incidents: incidents?.length || 0,
        high_priority_incidents: incidents?.filter(i => i.priority === 'high').length || 0,
        total_checkpoint_visits: visits?.length || 0,
        average_visit_duration: visits?.length ? 
          Math.round(visits.reduce((sum, v) => sum + (v.duration || 0), 0) / visits.length) : 0
      },
      rounds: rounds || [],
      incidents: incidents || [],
      checkpoint_visits: visits || []
    }

    // Generate HTML report
    const reportHtml = generateReportHtml(reportData)
    
    // Send report to recipients
    const sendPromises = finalRecipients.map(async (recipient: string) => {
      const emailResponse = await supabase.functions.invoke('send-email', {
        body: {
          to: recipient,
          subject: `Relatório ${report_type === 'daily' ? 'Diário' : report_type === 'weekly' ? 'Semanal' : 'Mensal'} - ${new Date(start_date).toLocaleDateString('pt-BR')}`,
          html: reportHtml,
          template_name: `${report_type}_report`,
          provider: 'sendgrid'
        }
      })
      
      return emailResponse
    })

    await Promise.all(sendPromises)

    return new Response(
      JSON.stringify({ 
        success: true, 
        report_data: reportData,
        recipients_count: finalRecipients.length
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('Error in generate-report function:', error)
    
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

function generateReportHtml(data: any): string {
  const { period, summary } = data
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Relatório de Segurança</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #1f2937; color: white; padding: 20px; text-align: center; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
        .metric { font-size: 24px; font-weight: bold; color: #1f2937; }
        .label { color: #64748b; font-size: 14px; }
        .section { margin: 30px 0; }
        .section h2 { color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Relatório de Segurança</h1>
        <p>Período: ${new Date(period.start).toLocaleDateString('pt-BR')} - ${new Date(period.end).toLocaleDateString('pt-BR')}</p>
      </div>
      
      <div class="summary">
        <div class="card">
          <div class="metric">${summary.total_rounds}</div>
          <div class="label">Total de Rondas</div>
        </div>
        <div class="card">
          <div class="metric">${summary.completed_rounds}</div>
          <div class="label">Rondas Concluídas</div>
        </div>
        <div class="card">
          <div class="metric">${summary.total_incidents}</div>
          <div class="label">Total de Incidentes</div>
        </div>
        <div class="card">
          <div class="metric">${summary.high_priority_incidents}</div>
          <div class="label">Incidentes Alta Prioridade</div>
        </div>
        <div class="card">
          <div class="metric">${summary.total_checkpoint_visits}</div>
          <div class="label">Pontos Visitados</div>
        </div>
        <div class="card">
          <div class="metric">${summary.average_visit_duration}min</div>
          <div class="label">Tempo Médio por Ponto</div>
        </div>
      </div>
      
      <div class="section">
        <h2>Resumo de Atividades</h2>
        <p><strong>Taxa de Conclusão:</strong> ${summary.total_rounds > 0 ? Math.round((summary.completed_rounds / summary.total_rounds) * 100) : 0}%</p>
        <p><strong>Incidentes por Ronda:</strong> ${summary.total_rounds > 0 ? (summary.total_incidents / summary.total_rounds).toFixed(2) : 0}</p>
      </div>
      
      <div class="section">
        <p><em>Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}</em></p>
      </div>
    </body>
    </html>
  `
}