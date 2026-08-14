import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      model = "llama-3.3-70b-versatile",
      system_prompt = "",
      user_prompt = "",
      temperature = 0.7,
      max_tokens = 1000,
    } = body;

    if (!user_prompt || typeof user_prompt !== "string") {
      return NextResponse.json(
        {
          error: "user_prompt is required",
        },
        {
          status: 400,
        }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GROQ_API_KEY is not configured. Add GROQ_API_KEY to your .env.local file.",
        },
        {
          status: 500,
        }
      );
    }

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(system_prompt
              ? [
                  {
                    role: "system",
                    content: system_prompt,
                  },
                ]
              : []),
            {
              role: "user",
              content: user_prompt,
            },
          ],
          temperature: Number(temperature),
          max_tokens: Number(max_tokens),
        }),
      }
    );

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("Groq API error:", data);

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            data?.error ||
            "Groq API request failed",
        },
        {
          status: groqResponse.status,
        }
      );
    }

    const content =
      data?.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({
      success: true,
      content,
      model: data?.model ?? model,
      usage: data?.usage ?? null,
    });
  } catch (error: any) {
    console.error("Groq route error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Unexpected server error",
      },
      {
        status: 500,
      }
    );
  }
}