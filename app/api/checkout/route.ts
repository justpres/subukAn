import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { createPaymentLink } from '@/lib/payment/paymongo'
import { sanitizeDatabaseError } from '@/lib/utils/error'

const checkoutSchema = z.object({
  listing_id: z.string().uuid('Invalid listing ID format'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const parseResult = checkoutSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input parameters', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { listing_id } = parseResult.data

    const supabase = createRouteHandlerClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized: Session missing or expired' }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch target listing and verify poster ownership
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, poster_id, title, total_budget, status')
      .eq('id', listing_id)
      .single()

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.poster_id !== userId) {
      return NextResponse.json({ error: 'Forbidden: You do not own this listing' }, { status: 403 })
    }

    if (listing.status !== 'open' && listing.status !== 'pending') {
      return NextResponse.json({ error: 'Listing is not in a payable status' }, { status: 400 })
    }

    // Fetch poster's custom payment settings or fallback
    const { data: posterSettings } = await supabase
      .from('poster_payment_settings')
      .select('payment_settings')
      .eq('id', userId)
      .single()

    const customSettings = posterSettings?.payment_settings

    // Call PayMongo API helper
    const amountInPHP = Number(listing.total_budget)
    const description = `Escrow Funding for SubukAn Round: ${listing.title.substring(0, 50)}`

    const paymentLinkResult = await createPaymentLink(
      amountInPHP,
      description,
      listing.id,
      customSettings
    )

    if (!paymentLinkResult?.url) {
      return NextResponse.json(
        { error: 'Failed to generate PayMongo payment link' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      checkout_url: paymentLinkResult.url,
      reference_number: paymentLinkResult.reference_number || listing.id,
      amount: listing.total_budget,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeDatabaseError(err, 'An unexpected error occurred generating checkout link.') },
      { status: 500 }
    )
  }
}
