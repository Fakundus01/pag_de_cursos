import { MessageCircleMore, SendHorizontal } from "lucide-react";
import { useState } from "react";
import { useAppContext } from "../../store/AppContext";

export const GuidedChat = () => {
  const { chatMessages, addChatMessage } = useAppContext();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <div className="fixed bottom-6 left-6 z-30">
      {open && (
        <div className="mb-4 w-[320px] overflow-hidden rounded-[28px] border border-white/10 bg-abyss/95 shadow-glow backdrop-blur-xl">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="font-semibold text-sand">Asistente guiado</p>
            <p className="text-xs text-steel">Resuelve dudas cuando el soporte no esta disponible.</p>
          </div>

          <div className="flex max-h-[320px] flex-col gap-3 overflow-y-auto px-4 py-4">
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  message.role === "assistant" ? "bg-white/[0.08] text-white" : "ml-auto bg-aurora text-abyss"
                }`}
              >
                {message.body}
              </div>
            ))}
          </div>

          <form
            className="flex gap-2 border-t border-white/10 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.trim()) return;
              addChatMessage(draft);
              setDraft("");
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Pregunta por pagos, cursos o soporte"
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none placeholder:text-steel"
            />
            <button type="submit" className="grid h-10 w-10 place-items-center rounded-full bg-sand text-abyss">
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

