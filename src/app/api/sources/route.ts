import { createServiceClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET() {
  try {
    const supabase = createServiceClient()

    // Fetch ready sources with person info
    const { data: sources, error } = await supabase
      .from('sources')
      .select(`
        id, title, source_type, summary, source_date, created_at,
        persons!sources_person_id_fkey ( name, color )
      `)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    // Fetch tags per source
    const sourceIds = (sources || []).map(s => s.id)
    let tagsMap: Record<string, string[]> = {}

    if (sourceIds.length > 0) {
      const { data: sourceTags } = await supabase
        .from('source_tags')
        .select('source_id, tags!source_tags_tag_id_fkey ( name )')
        .in('source_id', sourceIds)

      if (sourceTags) {
        for (const st of sourceTags) {
          const tagName = (st as any).tags?.name
          if (tagName) {
            if (!tagsMap[st.source_id]) tagsMap[st.source_id] = []
            tagsMap[st.source_id].push(tagName)
          }
        }
      }
    }

    const result = (sources || []).map(s => ({
      id: s.id,
      title: s.title,
      source_type: s.source_type,
      summary: s.summary,
      source_date: s.source_date,
      created_at: s.created_at,
      person_name: (s as any).persons?.name || null,
      person_color: (s as any).persons?.color || null,
      tags: tagsMap[s.id] || [],
    }))

    return Response.json({ sources: result })
  } catch (err) {
    console.error('Sources API error:', err)
    return Response.json({ error: 'Kon bronnen niet ophalen' }, { status: 500 })
  }
}
