import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { requireUser } from "@/lib/server-auth";
import { r2, bucket } from "@/lib/r2";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const { client, user, error } = await requireUser(req);
  if (error || !client || !user) return error!;
  try {
    const { file_id } = await req.json();
    const { data: file, error: dbError } = await client.from("files").select("*").eq("id", file_id).single();
    if (dbError || !file) return NextResponse.json({ error: "File not found." }, { status: 404 });
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: file.object_key }));
    const { error: deleteError } = await client.from("files").delete().eq("id", file_id);
    if (deleteError) throw deleteError;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Could not delete file." }, { status: 500 });
  }
}
