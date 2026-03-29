export const runtime = 'edge'

import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()

    // Fetch source with person
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('*, person:persons(*)')
      .eq('id', id)
      .single()

    if (sourceError || !source) {
      return NextResponse.json({ error: 'Bron niet gevonden' }, { status: 404 })
    }

    // Fetch chunks ordered by index
    const { data: chunks } = await supabase
      .from('chunks')
      .select('id, content, chunk_index')
      .eq('source_id', id)
      .order('chunk_index', { ascending: true })

    // Fetch tags via join table
    const { data: sourceTags } = await supabase
      .from('source_tags')
      .select('tag:tags(id, name, color)')
      .eq('source_id', id)

    const tags = sourceTags
      ?.map((st: Record<string, unknown>) => st.tag)
      .filter(Boolean) || []

    return NextResponse.json({
      source: {
        id: source.id,
        title: source.title,
        source_type: source.source_type,
        url: source.url,
        status: source.status,
        created_at: source.created_at,
        person_name: source.person?.name || null,
        person_color: source.person?.color || null,
        tags,
        chunks: chunks || [],
      },
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
