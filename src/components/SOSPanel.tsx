import { useState } from "react";

const sosOptions = [
  { title: "רוטב נשרף", body: "הסר מהאש מיד. אל תערבב — הריח יעבור. העבר לכלי חדש מבלי לגרד את התחתית." },
  { title: "אמולסיה נחתכה", body: "התחל מחדש: חלמון/מיונז טרי בקערה נפרדת, הוסף לאט את התערובת הקרושה בזרם דק." },
  { title: "תנור לא עובד", body: "בדוק שעון בטיחות. אם מסחרי — כבה ראשי 30 שניות והפעל. דווח לאחראי משמרת." },
  { title: "חוסר במצרך קריטי", body: "בדוק מקפיא רזרבי ושכן. עדכן את האחראי כדי לעצור הזמנות תלויות לפני אסון." },
];

export function SOSPanel() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-40 w-16 h-16 rounded-full bg-neon text-primary-foreground font-black text-xl glow-neon animate-pulse"
        aria-label="SOS"
      >
        SOS
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-w-md w-full bg-card border border-neon glow-neon rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-2xl font-bold text-neon">מצב חירום</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground">✕</button>
            </div>
            {active === null ? (
              <div className="grid grid-cols-1 gap-2">
                {sosOptions.map((o, i) => (
                  <button
                    key={o.title}
                    onClick={() => setActive(i)}
                    className="text-right p-3 rounded-md border border-border hover:border-neon hover:bg-neon/10 transition font-bold"
                  >
                    {o.title}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div className="text-amber-brand font-bold mb-2">{sosOptions[active].title}</div>
                <p className="text-sm leading-relaxed">{sosOptions[active].body}</p>
                <button
                  onClick={() => setActive(null)}
                  className="mt-4 px-4 py-2 rounded-md border border-border text-sm"
                >
                  חזרה
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
