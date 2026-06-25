import { createFileRoute } from "@tanstack/react-router";
import App from "../App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "بودكاست من داخل القطاع - منصة الإنتاج الصوتي الاحترافية" },
      {
        name: "description",
        content:
          "منصة صوتية احترافية لإنتاج حلقات بودكاست تفاعلية باللغة العربية باللهجة السعودية العامية بين شخصيتي المذيع والمحصل.",
      },
    ],
  }),
  component: App,
  ssr: false,
});
