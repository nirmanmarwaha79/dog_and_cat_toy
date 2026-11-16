import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const { client, user, error } = await requireUser(req);
  if (error || !client || !user) return error!;
  try {
    const { name, parent_id } = await req.json();
    if (typeof name !== "string" || !name.trim() || name.length > 100 || /[\\/]/.test(name)) return NextResponse.json({ error: "Enter a valid folder name." }, { status: 400 });
    if (parent_id) {
      const { data: parent } = await client.from("folders").select("id").eq("id", parent_id).single();
      if (!parent) return NextResponse.json({ error: "Parent folder not found." }, { status: 404 });
    }
    const { data, error: insertError } = await client.from("folders").insert({ user_id: user.id, name: name.trim(), parent_id: parent_id || null }).select().single();
    if (insertError) throw insertError;
    return NextResponse.json({ folder: data });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Could not create folder. A folder with that name may already exist here." }, { status: 500 });
  }
}
