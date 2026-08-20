import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

function getRedirectUri(req) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'rifemotion.com';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}/api/admin/gmail/callback`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL(`/admin?error=${encodeURIComponent(error || 'No code returned')}`, request.url));
  }

  try {
    const redirectUri = getRedirectUri(request);
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      const errMsg = tokenData.error_description || tokenData.error || 'token_exchange_failed';
      return NextResponse.redirect(new URL(`/admin?error=${encodeURIComponent(errMsg)}`, request.url));
    }

    // Get user email
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userInfo = await userRes.json();
    const email = (userInfo.email || "").toLowerCase();

    if (email) {
      const db = await getDb();
      const accounts = Array.isArray(db.connectedGmailAccounts) ? [...db.connectedGmailAccounts] : [];
      const existingIdx = accounts.findIndex(a => a.email.toLowerCase() === email);

      const accObj = {
        email: email,
        name: userInfo.name || email,
        refreshToken: tokenData.refresh_token || (existingIdx !== -1 ? accounts[existingIdx].refreshToken : null),
        updatedAt: Date.now()
      };

      if (existingIdx !== -1) {
        accounts[existingIdx] = { ...accounts[existingIdx], ...accObj };
      } else {
        accounts.push(accObj);
      }

      db.connectedGmailAccounts = accounts;
      await saveDb(db);
    }

    return NextResponse.redirect(new URL(`/admin?account_connected=${encodeURIComponent(email)}`, request.url));
  } catch(err) {
    console.error("Gmail OAuth Callback error:", err);
    return NextResponse.redirect(new URL('/admin?error=server_error', request.url));
  }
}
