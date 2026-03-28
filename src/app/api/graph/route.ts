import { createServiceClient } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET() {
  try {
    const supabase = createServiceClient()

    const [nodesRes, edgesRes, personsRes] = await Promise.all([
      supabase
        .from('graph_nodes')
        .select('id, label, color, node_type, source_count')
        .order('source_count', { ascending: false }),
      supabase
        .from('graph_edges')
        .select('id, from_node_id, to_node_id, strength, is_confirmed')
        .eq('is_confirmed', true),
      supabase
        .from('persons')
        .select('id, name, color'),
    ])

    if (nodesRes.error) throw nodesRes.error
    if (edgesRes.error) throw edgesRes.error
    if (personsRes.error) throw personsRes.error

    return Response.json({
      nodes: nodesRes.data,
      edges: edgesRes.data,
      persons: personsRes.data,
    })
  } catch (err) {
    console.error('Graph API error:', err)
    return Response.json(
      { error: 'Kon graph data niet ophalen' },
      { status: 500 }
    )
  }
}
