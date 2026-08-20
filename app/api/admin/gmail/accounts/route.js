import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDb, saveDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const accounts = db.connectedGmailAccounts || [];
    const list = accounts.map(a => ({
      email: a.email,
      name: a.name || a.email,
      updatedAt: a.updatedAt || Date.now()
    }));

    // Ensure session email is included
    if (session.user.email && !list.some(a => a.email.toLowerCase() === session.user.email.toLowerCase())) {
      list.unshift({
        email: session.user.email.toLowerCase(),
        name: session.user.name || session.user.email,
        updatedAt: Date.now()
      });
    }

    return NextResponse.json({ ok: true, accounts: list });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const db = await getDb();
    let accounts = db.connectedGmailAccounts || [];
    accounts = accounts.filter(a => a.email.toLowerCase() !== email.toLowerCase());
    db.connectedGmailAccounts = accounts;
    await saveDb(db);

    return NextResponse.json({ ok: true, accounts: accounts.map(a => ({ email: a.email, name: a.name })) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
