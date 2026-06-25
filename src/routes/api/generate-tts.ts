import { createFileRoute } from "@tanstack/react-router";
import { GoogleGenAI } from "@google/genai";

function encodeWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const buffer = Buffer.alloc(44 + pcm.length);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + pcm.length, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(pcm.length, 40);
  pcm.copy(buffer, 44);
  return buffer;
}

export const Route = createFileRoute("/api/generate-tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text, voice, role } = await request.json();
          if (!text || !String(text).trim()) {
            return Response.json({ error: "الرجاء إدخال النص أولاً" }, { status: 400 });
          }
          const key = process.env.GEMINI_API_KEY;
          if (!key) {
            return Response.json(
              { error: "مفتاح واجهة برمجة التطبيقات (GEMINI_API_KEY) مفقود." },
              { status: 500 },
            );
          }
          const client = new GoogleGenAI({ apiKey: key });

          const promptPrefix =
            role === "host"
              ? "تحدث بنبرة واضحة ومثقفة ومحترفة كالمذيع، بلهجة سعودية عامية خفيفة وبسيطة جداً. يُمنع منعاً باتاً استخدام اللغة العربية الفصحى أو الأسلوب الرسمي. انطق النص بأسلوب حواري طبيعي كالمكالمات اليومية، وانطق النص التالي مباشرة دون أي إضافات:"
              : "تحدث بنبرة عملية وواقعية كالمحصل، بلهجة سعودية عامية بسيطة ومحببة وقريبة من لغة الشارع السعودي اليومية المعتادة. يُمنع منعاً باتاً استخدام اللغة العربية الفصحى أو التحدث برسمية. انطق النص التالي مباشرة دون أي إضافات:";

          const response = await client.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [{ parts: [{ text: `${promptPrefix}\n\n${text}` }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || "Kore" } },
              },
            },
          } as any);

          const base64Audio =
            (response as any).candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (!base64Audio) {
            return Response.json(
              { error: "لم يتمكن نظام Gemini من توليد الصوت. يرجى المحاولة مرة أخرى." },
              { status: 500 },
            );
          }
          const wav = encodeWav(Buffer.from(base64Audio, "base64"));
          return new Response(new Uint8Array(wav), {
            headers: { "Content-Type": "audio/wav" },
          });
        } catch (error: any) {
          console.error("generate-tts error:", error);
          return Response.json(
            { error: error?.message || "حدث خطأ أثناء توليد الصوت." },
            { status: 500 },
          );
        }
      },
    },
  },
});
