import { NextResponse } from "next/server";

import { getHealthStatus } from "@/server/application/getHealthStatus";

export async function GET() {
  return NextResponse.json(getHealthStatus());
}
