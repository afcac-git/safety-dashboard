import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getAllCountryTargets } from "@/lib/data";

export async function GET() {
  const session = await getServerSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const all = await getAllCountryTargets();
  return NextResponse.json(all);
}
