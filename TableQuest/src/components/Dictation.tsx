import { useEffect, useRef, useState, type RefObject } from "react";
import { Mic, Square } from "lucide-react";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: {
        resultIndex: number;
        results: {
          length: number;
          [i: number]: { isFinal: boolean; 0: { transcript: string } };
        };
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
const getRecognition = () =>
  (window as VoiceWindow).SpeechRecognition ||
  (window as VoiceWindow).webkitSpeechRecognition;

export function Dictation({
  target,
  label,
}: {
  target: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  label: string;
}) {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const supported = !!getRecognition();
  useEffect(() => {
    const cancel = () => {
      const r = recognition.current;
      recognition.current = null;
      if (r) {
        r.onresult = null;
        r.onend = null;
        r.onerror = null;
        r.abort();
      }
      setActive(false);
    };
    const hidden = () => {
      if (document.hidden) cancel();
    };
    const form = target.current?.form;
    window.addEventListener("tablequest:dictation", cancel);
    window.addEventListener("offline", cancel);
    document.addEventListener("visibilitychange", hidden);
    form?.addEventListener("submit", cancel, true);
    return () => {
      cancel();
      window.removeEventListener("tablequest:dictation", cancel);
      window.removeEventListener("offline", cancel);
      document.removeEventListener("visibilitychange", hidden);
      form?.removeEventListener("submit", cancel, true);
    };
  }, [target]);
  function start() {
    if (recognition.current) {
      recognition.current.stop();
      return;
    }
    const Constructor = getRecognition();
    if (!Constructor) return;
    if (!navigator.onLine) {
      setMessage("Per dettare serve una connessione. Puoi usare la tastiera.");
      return;
    }
    window.dispatchEvent(new Event("tablequest:dictation"));
    const r = new Constructor();
    recognition.current = r;
    r.lang = "it-IT";
    r.continuous = true;
    r.interimResults = false;
    const received = new Set<number>();
    r.onresult = (e) => {
      const el = target.current;
      if (recognition.current !== r || !el) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal || received.has(i)) continue;
        received.add(i);
        const text = e.results[i][0].transcript.trim();
        if (!text) continue;
        const prefix = el.value && !/\s$/.test(el.value) ? " " : "";
        const combined = el.value + prefix + text;
        el.value =
          el.maxLength >= 0 ? combined.slice(0, el.maxLength) : combined;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        setMessage(
          combined.length > el.value.length
            ? "Limite del campo raggiunto. Controlla il testo."
            : "Testo aggiunto. Puoi correggerlo prima di salvare.",
        );
      }
    };
    r.onerror = (e) => {
      const errors: Record<string, string> = {
        "not-allowed":
          "Microfono non autorizzato. Consenti l’accesso nelle impostazioni del browser oppure usa la tastiera.",
        "service-not-allowed":
          "Dettatura non disponibile in questo browser. Usa la tastiera o il microfono della tastiera del telefono.",
        "audio-capture":
          "Microfono non disponibile. Controlla che sia collegato.",
        "no-speech": "Non ho sentito parole. Riprova oppure scrivi.",
        network:
          "Servizio vocale non raggiungibile. Riprova oppure usa la tastiera.",
        "language-not-supported":
          "Dettatura italiana non supportata da questo browser.",
      };
      setMessage(
        errors[e.error] ||
          "Dettatura interrotta. Il testo già inserito è conservato.",
      );
      recognition.current = null;
      r.onresult = null;
      r.onend = null;
      r.onerror = null;
      r.abort();
      setActive(false);
    };
    r.onend = () => {
      if (recognition.current === r) {
        recognition.current = null;
        setActive(false);
      }
    };
    setMessage(
      "Parla in italiano. Le parole riconosciute vengono aggiunte in fondo al campo.",
    );
    setActive(true);
    try {
      r.start();
    } catch {
      recognition.current = null;
      setActive(false);
      setMessage("Impossibile avviare il microfono. Puoi usare la tastiera.");
    }
  }
  return (
    <div className="dictation">
      {supported ? (
        <>
          <button
            type="button"
            className={`button secondary ${active ? "dictation-active" : ""}`}
            aria-label={`${active ? "Ferma dettatura" : "Detta"}: ${label}`}
            aria-pressed={active}
            onClick={start}
          >
            {active ? <Square size={15} /> : <Mic size={15} />}{" "}
            {active ? "Ferma dettatura" : "Detta"}
          </button>
          <small className="muted">
            Il browser può inviare l’audio al proprio servizio di trascrizione.
            TableQuest salva solo il testo quando confermi.
          </small>
        </>
      ) : (
        <small className="muted">
          Puoi scrivere o usare il microfono della tastiera del telefono. La
          dettatura diretta non è supportata da questo browser.
        </small>
      )}
      <span className="small" role="status">
        {active ? "Microfono attivo. " : ""}
        {message}
      </span>
    </div>
  );
}
