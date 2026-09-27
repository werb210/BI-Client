// BI_CLIENT_BLOCK_v608 - applicant conversation with the Boreal team.
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/api/client";
import BackBar from "@/components/BackBar";

type Message = {
  id: string;
  body: string;
  createdAt: string;
  sender?: "applicant" | "staff";
  fromApplicant?: boolean;
  attachments?: Array<{ id?: string; name: string; url?: string }>;
};

type ThreadResponse = { messages?: Message[]; unreadCount?: number };

const secondary: React.CSSProperties = {
  minHeight: 44, padding: "0 14px", borderRadius: 8,
  border: "1px solid #E4EAF2", background: "#fff", color: "#0B1F3A",
  fontWeight: 600, cursor: "pointer",
};

function displayedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, {
    dateStyle: "medium", timeStyle: "short",
  });
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await apiRequest<ThreadResponse>("/applicants/messages");
      setMessages(result.messages ?? []);
      // Opening the thread is also the applicant's read receipt. A server that
      // does not need an explicit receipt may safely return 404 here.
      void apiRequest("/applicants/messages/read", { method: "POST" }).catch(() => undefined);
    } catch {
      setError("We could not load your messages. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() && files.length === 0) return;
    setSending(true);
    setError(null);
    const form = new FormData();
    form.append("message", body.trim());
    files.forEach((file) => form.append("files", file, file.name));
    try {
      const result = await apiRequest<Message | ThreadResponse>("/applicants/messages", {
        method: "POST", body: form,
      });
      setBody("");
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      if ("messages" in result) setMessages(result.messages ?? []);
      else if ("id" in result) setMessages((current) => [...current, result]);
      else await load();
    } catch {
      setError("Your reply was not sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bi-page">
      <div className="bi-page__inner">
        <BackBar to="/home" />
        <h1>Messages</h1>
        <p className="bi-page__lede">Ask a question or reply to the Boreal team about your application.</p>
        {error && <div role="alert" style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</div>}
        <section className="bi-card" aria-label="Message thread" style={{ marginBottom: 16 }}>
          {loading ? <p>Loading messages…</p> : messages.length === 0 ? (
            <p style={{ color: "#51617D", margin: 0 }}>No messages yet. Send us a note below.</p>
          ) : messages.map((message) => {
            const mine = message.sender === "applicant" || message.fromApplicant === true;
            return (
              <article key={message.id} style={{ margin: "0 0 16px", marginLeft: mine ? "12%" : 0, marginRight: mine ? 0 : "12%", padding: 14, borderRadius: 10, background: mine ? "#FFF8E7" : "#F5F8FC", border: "1px solid #E4EAF2" }}>
                <strong style={{ fontSize: 13 }}>{mine ? "You" : "Boreal"}</strong>
                <p style={{ whiteSpace: "pre-wrap", margin: "6px 0" }}>{message.body}</p>
                {message.attachments?.map((attachment, index) => attachment.url ? (
                  <a key={attachment.id ?? index} href={attachment.url} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 14 }}>{attachment.name}</a>
                ) : <span key={attachment.id ?? index} style={{ display: "block", fontSize: 14 }}>{attachment.name}</span>)}
                <time dateTime={message.createdAt} style={{ color: "#8593aa", fontSize: 12 }}>{displayedDate(message.createdAt)}</time>
              </article>
            );
          })}
        </section>
        <form className="bi-card" onSubmit={(event) => void send(event)}>
          <label className="bi-label" htmlFor="message-reply">Reply</label>
          <textarea id="message-reply" className="bi-field" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message…" />
          <input ref={fileInput} id="message-files" type="file" multiple hidden onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" style={secondary} onClick={() => fileInput.current?.click()}>Attach files</button>
            <button className="bi-cta bi-cta--inline" type="submit" disabled={sending || (!body.trim() && files.length === 0)}>{sending ? "Sending…" : "Send reply"}</button>
          </div>
          {files.length > 0 && <div aria-live="polite" style={{ marginTop: 10, fontSize: 13, color: "#51617D" }}>{files.map((file) => file.name).join(", ")}</div>}
        </form>
      </div>
    </div>
  );
}
