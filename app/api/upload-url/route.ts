import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireUser } from "@/lib/server-auth";
import { r2, bucket } from "@/lib/r2";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
const QUOTA = Number(process.env.STORAGE_QUOTA_BYTES || 107374182400);
const MAX_FILE = Number(process.env.MAX_FILE_SIZE_BYTES || 5368709120);

export async function POST(req: NextRequest) {
  const { client, user, error } = await requireUser(req);
  if (error || !client || !user) return error!;
  try {
    const { name, size_bytes, mime_type, folder_id } = await req.json();
    if (typeof name !== "string" || !name.trim() || name.length > 255) return NextResponse.json({ error: "Invalid file name." }, { status: 400 });
    const size = Number(size_bytes);
    if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE) return NextResponse.json({ error: "File size must be between 1 byte and 5 GiB." }, { status: 400 });
    if (folder_id) {
      const { data: folder } = await client.from("folders").select("id").eq("id", folder_id).single();
      if (!folder) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    }
    const { data: usageRows, error: usageError } = await client.from("files").select("size_bytes").in("status", ["complete", "pending"]);
    if (usageError) throw usageError;
    const used = (usageRows || []).reduce((n, row) => n + Number(row.size_bytes || 0), 0);
    if (used + size > QUOTA) return NextResponse.json({ error: "100 GiB storage quota exceeded." }, { status: 413 });
    const id = randomUUID();
    const key = `${user.id}/${id}`;
    const { error: insertError } = await client.from("files").insert({
      id, user_id: user.id, name: name.trim(), object_key: key, size_bytes: size,
      mime_type: typeof mime_type === "string" ? mime_type.slice(0, 160) : "application/octet-stream",
      folder_id: folder_id || null, status: "pending"
    });
    if (insertError) throw insertError;
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: typeof mime_type === "string" ? mime_type : "application/octet-stream" });
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 900 });
    return NextResponse.json({ file_id: id, uploadUrl });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Could not prepare upload. Check server configuration." }, { status: 500 });
  }
}
