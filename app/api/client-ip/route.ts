import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  const ip =
    cfConnectingIp ||
    (forwardedFor ? forwardedFor.split(',')[0].trim() : null) ||
    realIp ||
    request.ip ||
    '127.0.0.1';

  return NextResponse.json({ ip });
}
