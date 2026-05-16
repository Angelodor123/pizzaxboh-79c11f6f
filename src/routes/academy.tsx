import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/academy")({
  component: AcademyPage,
});

const textures = [
  { name: "Silky", he: "סילקי", body: "מרקם משיי, אחיד וזורם — ללא גושים. נכון לרטבי שמנת מוכנים." },
  { name: "Jammy", he: "ג׳אמי", body: "מרקם ריבה דחוס, מבריק. צמצום מים מספק, הסוכר התקרמל מעט." },
  { name: "Velvet", he: "ולווט", body: "עטיפה חיכוכית עדינה — כמו פולנטה לזילוף." },
  { name: "Snap", he: "סנאפ", body: "פריך וקפיצי — תיאור לציפוי קרוטונים ולאצבעות פולנטה לאחר טיגון." },
];

const techniques = [
  { title: "Low & Slow", body: "בישול בטמפ׳ נמוכה לאורך זמן — ריבות בצל/בייקון 8–14 שעות. בקרת תחתית קריטית." },
  { title: "Slow Stream", body: "זילוף נוזלים בזרם דק תוך טחינה — לאמולסיות יציבות (פסטו, איולי נענע)." },
  { title: "Double Coat", body: "ציפוי כפול קמח-ביצה-פירורים לאצבעות פולנטה לאחר קיפאון עמוק." },
  { title: "Confit Method", body: "בישול ב-110°C עד בעבוע, הורדה ל-90°C לשעתיים, סינון וטחינה לקרם." },
];

function AcademyPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="text-[10px] uppercase tracking-[0.3em] text-amber-brand font-bold">
        Pizza X Academy
      </div>
      <h1 className="font-display text-4xl font-bold mt-1">
        השפה של <span className="text-neon text-glow-neon">המטבח</span>
      </h1>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-bold mb-3">מרקמים</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {textures.map((t) => (
            <div key={t.name} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-xl font-bold text-neon">{t.name}</h3>
                <span className="text-sm text-muted-foreground">{t.he}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold mb-3">טכניקות</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {techniques.map((t) => (
            <div key={t.title} className="rounded-xl border border-jungle/40 bg-jungle/5 p-4">
              <h3 className="font-display text-lg font-bold text-jungle">{t.title}</h3>
              <p className="mt-2 text-sm leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
