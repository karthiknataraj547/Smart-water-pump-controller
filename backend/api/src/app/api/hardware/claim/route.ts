import { NextRequest } from 'next/server';
import { POST as handleClaim } from '../route';

export async function POST(req: NextRequest) {
  return handleClaim(req);
}
