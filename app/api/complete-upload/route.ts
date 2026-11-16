import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { requireUser } from "@/lib/server-auth";
import { r2, bucket } from "@/lib/r2";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const { client, user, error } = await requireUser(req);
  if (error || !client || !user) return error!;
  try {
    const { file_id } = await req.json();
    const { data: file, error: findError } = await client.from("files").select("*").eq("id", file_id).single();
    if (findError || !file) return NextResponse.json({ error: "File record not found." }, { status: 404 });
    const head = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: file.object_key }));
    if (Number(head.ContentLength) !== Number(file.size_bytes)) return NextResponse.json({ error: "Uploaded file size does not match." }, { status: 400 });
    const { error: updateError } = await client.from("files").update({ status: "complete" }).eq("id", file_id);
    if (updateError) throw updateError;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Could not verify uploaded file." }, { status: 500 });
  }
}
