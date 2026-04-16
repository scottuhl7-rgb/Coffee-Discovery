import { NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(req) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { query, coffees } = await req.json();

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `You are a world-class specialty coffee sommelier. A customer described what they want:

"${query}"

Here is your curated menu of ${coffees.length} single-origin coffees:
${JSON.stringify(coffees, null, 1)}

Rank the TOP 5 best matches. Consider flavor preferences, body/acidity balance, brew method hints, mood cues, and occasion. Be creative in matching — if someone says "something for a rainy morning" think cozy/full-bodied; "fruity and light" think high acidity/floral.

Return ONLY a JSON array, no markdown, no backticks, no explanation:
[{"id": number, "rank": 1, "reason": "one sentence explaining the match"}]`,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("Anthropic API error:", err);
      return NextResponse.json(
        { error: "Recommendation engine unavailable" },
        { status: 502 }
      );
    }

    const data = await resp.json();
    const text = data.content.map((b) => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const results = JSON.parse(clean);

    return NextResponse.json({ results });
  } catch (e) {
    console.error("Recommend API error:", e);
    return NextResponse.json(
      { error: "Failed to process recommendation" },
      { status: 500 }
    );
  }
}
