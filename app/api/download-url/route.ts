import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireUser } from "@/lib/server-auth";
import { r2, bucket } from "@/lib/r2";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const { client, user, error } = await requireUser(req);
  if (error || !client || !user) return error!;
  try {
    const { file_id } = await req.json();
    const { data: file, error: dbError } = await client.from("files").select("*").eq("id", file_id).eq("status", "complete").single();
    if (dbError || !file) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const command = new GetObjectCommand({ Bucket: bucket, Key: file.object_key, ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}` });
    const downloadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
    return NextResponse.json({ downloadUrl });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Could not create download link." }, { status: 500 });
  }
}
