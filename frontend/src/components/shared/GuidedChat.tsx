import { LoaderCircle, MessageCircleMore, SendHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "../../lib/api";
import type { ChatMessage, SupportContent } from "../../types";

const initialAssistantMessage: ChatMessage = {
  id: "support-initial",
  role: "assistant",
  body: "Estoy disponible para dudas de acceso, compras, progreso, videos obligatorios y soporte fuera de horario."
};

const emptySupportContent: SupportContent = {
  faq: [],
  knowledge: []
};

export const GuidedChat = () => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([initialAssistantMessage]);
  const [loadingReply, setLoadingReply] = useState(false);
  const [supportContent, setSupportContent] = useState<SupportContent>(emptySupportContent);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    void (async () => {
      try {
        const response = await api.supportContent();
        if (active) {
          setSupportContent(response);
        }
      } catch {
        if (active) {
          setSupportContent(emptySupportContent);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [open]);

  const quickQuestions = useMemo(() => supportContent.faq.slice(0, 3), [supportContent.faq]);

  const sendMessage = async (body: string) => {
    const normalized = body.trim();
    if (!normalized) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      body: normalized
    };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setLoadingReply(true);

    try {
      const response = await api.supportChat({ message: normalized });
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        body: response.answer
      };
      setMessages((current) => [...current, assistantMessage]);
      if (response.suggestions.length) {
        setSupportContent((current) => ({ ...current, faq: response.suggestions }));
      }
    } catch (error) {
      const fallback: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        body: getErrorMessage(error, "No pude responder ahora. Intenta de nuevo en unos segundos.")
      };
      setMessages((current) => [...current, fallback]);
    } finally {
      setLoadingReply(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-30">
      {open && (
        <div className="mb-4 w-[340px] overflow-hidden rounded-[28px] border border-white/10 bg-abyss/95 shadow-glow backdrop-blur-xl">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="font-semibold text-sand">Soporte guiado 24/7</p>
            <p className="text-xs leading-6 text-steel">Resuelve dudas de cursos, pagos, progreso, sesiones y videos obligatorios cuando el soporte humano no esta disponible.</p>
          </div>

          {!!quickQuestions.length && (
            <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3">
              {quickQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={loadingReply}
                  onClick={() => void sendMessage(question)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white transition hover:border-aurora/35 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <div className="flex max-h-[320px] flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "assistant" ? "bg-white/[0.08] text-white" : "ml-auto bg-aurora text-abyss"
                }`}
              >
                {message.body}
              </div>
            ))}
            {loadingReply && (
              <div className="inline-flex max-w-[88%] items-center gap-2 rounded-2xl bg-white/[0.08] px-4 py-3 text-sm text-white">
                <LoaderCircle size={16} className="animate-spin text-aurora" />
                Pensando la mejor respuesta...
              </div>
            )}
          </div>

          <form
            className="flex gap-2 border-t border-white/10 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(draft);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Pregunta por pagos, secciones, progreso o soporte"
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none placeholder:text-steel"
            />
            <button type="submit" disabled={loadingReply || !draft.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-sand text-abyss disabled:opacity-60">
              <SendHorizontal size={16} />
            </button>
          </form>
        </div>
      )}

      <button onClick={() => setOpen((current) => !current)} className="grid h-14 w-14 place-items-center rounded-full bg-sand text-abyss shadow-glow">
        <MessageCircleMore size={22} />
      </button>
    </div>
  );
};
