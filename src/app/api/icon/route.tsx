import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = parseInt(searchParams.get("size") || "512", 10);

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: size * 0.55,
          background: "#0f172a",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 700,
          fontFamily: "sans-serif",
          borderRadius: size * 0.15,
        }}
      >
        QS
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}
