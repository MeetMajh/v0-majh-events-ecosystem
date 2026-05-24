import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Clip ID is required' },
        { status: 400 }
      );
    }

    // Increment view count atomically
    const { data, error } = await supabaseAdmin
      .from('player_media')
      .update({
        views: supabaseAdmin.rpc('increment', {
          row_id: id,
          num_increments: 1
        })
      })
      .eq('id', id)
      .select('id, views');

    if (error) {
      // Fallback: increment manually if RPC not available
      const { data: clip } = await supabaseAdmin
        .from('player_media')
        .select('views')
        .eq('id', id)
        .single();

      if (clip) {
        const newViews = (clip.views || 0) + 1;
        await supabaseAdmin
          .from('player_media')
          .update({ views: newViews })
          .eq('id', id);

        return NextResponse.json({
          success: true,
          views: newViews
        });
      }
    }

    return NextResponse.json({
      success: true,
      views: data?.[0]?.views || 0
    });
  } catch (error) {
    console.error('[v0] Clip view tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track view' },
      { status: 500 }
    );
  }
}
