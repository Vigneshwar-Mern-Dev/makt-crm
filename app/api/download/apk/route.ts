import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "downloads", "makt-tracker.apk");

  if (!fs.existsSync(filePath)) {
    return new Response("APK file not found.", { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const fileBuffer = fs.readFileSync(filePath);

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="makt-tracker.apk"',
      "Content-Length": stat.size.toString(),
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
