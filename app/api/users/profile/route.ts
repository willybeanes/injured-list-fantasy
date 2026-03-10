import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// POST /api/users/profile — create or update user profile after signup
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username, email } = await request.json();

  if (!username?.trim()) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-20 chars: letters, numbers, underscores" },
      { status: 400 }
    );
  }

  // Check username taken
  const existing = await prisma.user.findFirst({
    where: { username, NOT: { id: user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Username is already taken" }, { status: 400 });
  }

  const profile = await prisma.user.upsert({
    where: { id: user.id },
    update: { username, email: email ?? user.email },
    create: {
      id: user.id,
      username,
      email: email ?? user.email ?? "",
    },
  });

  return NextResponse.json({ user: profile }, { status: 201 });
}

// GET /api/users/profile — get current user profile
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, username: true, email: true, avatarUrl: true, createdAt: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ user: profile });
}
