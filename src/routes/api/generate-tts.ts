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

          const roleLine =
            role === "host"
              ? "تحدث بنبرة مذيع بودكاست سعودي عفوي ومثقف، باللهجة السعودية العامية البسيطة المتداولة."
              : "تحدث بنبرة محصّل سعودي واقعي وعملي، باللهجة السعودية العامية البسيطة القريبة من لغة الشارع اليومية.";

          const promptPrefix = `🚨 تعليمات إلزامية - أي مخالفة = فشل كامل:
- يُمنع منعاً باتاً استخدام اللغة العربية الفصحى أو أي كلمة رسمية، ولو في كلمة واحدة.
- النطق بالكامل باللهجة السعودية العامية البسيطة من أول كلمة لآخر كلمة، وأي كلمة فصيحة حوّلها لمقابلها العامي السعودي بنفس المعنى.
- ممنوع خلط العامية بالفصحى أو الانتقال بينهما في أي موضع.
- نوّع النبرات (سؤال، تعجب، استغراب، تأثر، حماس، شرح، خاتمة) ولا تستخدم نبرة واحدة للنص كله.
- أضف وقفات طبيعية قصيرة ومتوسطة وطويلة، وتنفس وابتسامة وتفاعل حقيقي كأنك في استديو بودكاست لا ذكاء اصطناعي.
- ممنوع حذف أو اختصار أو إعادة ترتيب أو دمج أو إضافة أي كلمة. النص يُنطق كما هو حرفياً.
${roleLine}
انطق النص التالي مباشرة دون أي إضافات:`;

          const response = await client.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
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
