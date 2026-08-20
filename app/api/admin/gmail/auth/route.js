import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

function getRedirectUri(req) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'rifemotion.com';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}/api/admin/gmail/callback`;
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const redirectUri = getRedirectUri(request);

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile https://www.googleapis.com/auth/gmail.readonly");
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "select_account consent");

  return NextResponse.redirect(googleAuthUrl.toString());
}
