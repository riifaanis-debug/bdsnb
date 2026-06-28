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

async function generateChunk(
  client: GoogleGenAI,
  text: string,
  hostVoice: string,
  collectorVoice: string,
): Promise<Buffer> {
  const prompt = `🚨 تعليمات إلزامية غير قابلة للتجاوز - أي مخالفة = فشل كامل وإعادة التوليد.

أولاً - اللهجة (إلزامي 100%):
- يُمنع منعاً باتاً استخدام اللغة العربية الفصحى في أي جزء من الحوار، ولا حتى في كلمة واحدة.
- يجب أن يكون الحوار بالكامل من أول كلمة إلى آخر كلمة باللهجة السعودية العامية البسيطة المتداولة في المجالس والمكالمات اليومية.
- أي كلمة فصيحة حوّلها تلقائياً إلى مقابلها العامي السعودي مع الحفاظ على نفس المعنى تماماً.
- ممنوع خلط العامية بالفصحى ولو في جملة واحدة، وممنوع الانتقال من العامية للفصحى في أي موضع.

ثانياً - الأداء:
- لا تقرأ النص كمقال أو خطاب أو نشرة أخبار.
- نوّع النبرات والسرعة، واجعل الأداء بودكاست سعودي حقيقي بين شخصين عفويين.

ثالثاً - الوقفات:
- أضف وقفات طبيعية: قصيرة ومتوسطة وطويلة، قبل الأسئلة وبعدها، وقبل الإجابات، وعند الانتقال من فكرة لفكرة.
- يُمنع سرد النص بلا تنفس أو توقف.

رابعاً - النبرات:
- لكل جملة نبرتها: سؤال، تعجب، استغراب، ضحك طبيعي، تأثر، حماس، تحليل هادئ، شرح، خاتمة مؤثرة.
- ممنوع نبرة واحدة للحوار كله.

خامساً - الواقعية:
- اجعل المستمع يشعر بتفاعل وتفكير وتردد وتنفس وابتسامة وضحك واندهاش وصمت قصير وتأكيد وحماس بحسب سياق كل جملة، وكأنه مسجّل في استديو حقيقي وليس بذكاء اصطناعي.

سادساً - المحافظة على النص:
- ممنوع حذف أي كلمة أو جملة أو فقرة، وممنوع الاختصار أو إعادة الترتيب أو التلخيص أو الدمج أو إضافة معلومات.

سابعاً - شرط إلزامي:
- إذا ظهرت أي كلمة فصيحة أو خرج الأداء عن اللهجة السعودية العامية البسيطة فاعتبر التوليد فاشلاً وأعد التوليد كاملاً حتى يصبح 100% باللهجة السعودية العامية دون أي استثناء.

الآن نفّذ الحوار التالي بصوت كل متحدث بدقة تامة:

${text}`;

  const response = await client.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speaker: "المذيع", voiceConfig: { prebuiltVoiceConfig: { voiceName: hostVoice } } },
            { speaker: "المحصل", voiceConfig: { prebuiltVoiceConfig: { voiceName: collectorVoice } } },
          ],
        },
      },
    },
  } as any);

  const base64Audio =
    (response as any).candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("لم يتمكن نظام Gemini من توليد الصوت.");
  return Buffer.from(base64Audio, "base64");
}

export const Route = createFileRoute("/api/generate-dialogue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { hostText, hostVoice, collectorText, collectorVoice, fullScript } =
            await request.json();

          if (
            !fullScript &&
            (!hostText || !String(hostText).trim() || !collectorText || !String(collectorText).trim())
          ) {
            return Response.json(
              { error: "الرجاء كتابة نص المذيع ونص المحصل لتوليد الحوار كامل." },
              { status: 400 },
            );
          }

          const key = process.env.GEMINI_API_KEY;
          if (!key) {
            return Response.json(
              { error: "مفتاح واجهة برمجة التطبيقات (GEMINI_API_KEY) مفقود." },
              { status: 500 },
            );
          }
          const client = new GoogleGenAI({ apiKey: key });
          const hv = hostVoice || "Charon";
          const cv = collectorVoice || "Fenrir";

          let combined: Buffer;

          if (fullScript) {
            const normalized = String(fullScript)
              .replace(/المحصّل:/g, "المحصل:")
              .replace(/المحصّل :/g, "المحصل:");
            const lines = normalized.split("\n");
            const chunks: string[] = [];
            let current: string[] = [];
            let turnCount = 0;
            const turnsPerChunk = 8;
            for (const line of lines) {
              const t = line.trim();
              const isNew = t.startsWith("المذيع:") || t.startsWith("المحصل:");
              if (isNew) {
                if (turnCount >= turnsPerChunk) {
                  chunks.push(current.join("\n"));
                  current = [];
                  turnCount = 0;
                }
                turnCount++;
              }
              current.push(line);
            }
            if (current.length) chunks.push(current.join("\n"));

            const pcmBuffers: Buffer[] = [];
            for (let i = 0; i < chunks.length; i += 2) {
              const batch = chunks.slice(i, i + 2);
              const results = await Promise.all(
                batch.map((c) => generateChunk(client, c, hv, cv)),
              );
              pcmBuffers.push(...results);
            }
            combined = Buffer.concat(pcmBuffers);
          } else {
            const text = `المذيع: ${hostText}\nالمحصل: ${collectorText}`;
            combined = await generateChunk(client, text, hv, cv);
          }

          const wav = encodeWav(combined);
          return new Response(new Uint8Array(wav), {
            headers: { "Content-Type": "audio/wav" },
          });
        } catch (error: any) {
          console.error("generate-dialogue error:", error);
          const msg = String(error?.message || error || "");
          const isQuota =
            msg.includes("429") ||
            msg.toLowerCase().includes("quota") ||
            msg.toLowerCase().includes("exhausted");
          return Response.json(
            { error: error?.message || "حدث خطأ أثناء توليد الحوار المشترك." },
            { status: isQuota ? 429 : 500 },
          );
        }
      },
    },
  },
});
