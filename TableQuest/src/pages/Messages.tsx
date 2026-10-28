import { useState } from "react";
import { LockKeyhole, Send, CheckCheck } from "lucide-react";
import { useApp, useRows } from "../lib/data";
import {
  Action,
  Area,
  Button,
  Empty,
  Form,
  Heading,
  Loading,
  Modal,
} from "../components/ui";
export default function MessagesPage() {
  const { user, campaignId, run } = useApp();
  const { data: campaigns = [] } = useRows("campaigns", false);
  const { data: members = [] } = useRows("campaign_members");
  const { data: profiles = [] } = useRows("profiles", false);
  const q = useRows("private_messages");
  const [compose, setCompose] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const dm = campaigns.find((c) => c.id === campaignId)?.owner_id === user.id;
  const name = (id: string) =>
    profiles.find((p) => p.id === id)?.display_name || "Avventuriero";
  if (!campaignId) return <Empty title="Scegli prima una campagna" />;
  return (
    <>
      <Heading eyebrow="SOLO PER I TUOI OCCHI" title="Sussurri dal DM">
        {dm && (
          <Button onClick={() => setCompose(true)}>
            <Send size={17} /> Nuovo messaggio
          </Button>
        )}
      </Heading>
      <div className="reminder">
        <LockKeyhole size={18} /> Ogni messaggio è visibile soltanto al DM che
        lo invia e al suo destinatario.
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <p role="alert" className="error">
          {q.error.message}
        </p>
      ) : q.data?.length ? (
        <div className="message-list">
          {[...q.data]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((m) => (
              <article
                className={`panel message ${!m.is_read ? "unread" : ""}`}
                key={m.id}
              >
                <div className="section-heading">
                  <span className="badge">
                    {m.sender_id === user.id
                      ? `A ${name(m.recipient_id)}`
                      : `DA ${name(m.sender_id)}`}
                  </span>
                  <small className="muted">
                    {new Date(m.created_at).toLocaleString("it-IT")}
                  </small>
                </div>
                <p className="preserve">{m.content}</p>
                {m.recipient_id === user.id && !m.is_read ? (
                  <Action action="message_read" data={{ id: m.id }}>
                    <CheckCheck size={17} /> Segna come letto
                  </Action>
                ) : (
                  <small className="muted">
                    {m.is_read ? "✓ Letto" : "Consegnato · non ancora letto"}
                  </small>
                )}
              </article>
            ))}
        </div>
      ) : (
        <section className="panel">
          <Empty title="Il silenzio custodisce i segreti">
            I messaggi privati del DM appariranno qui, anche nelle prossime
            sessioni.
          </Empty>
        </section>
      )}
      {compose && (
        <Modal
          title="Un sussurro alla compagnia"
          onClose={() => setCompose(false)}
        >
          <Form
            submit="Invia messaggio privato"
            onSave={async (d) => {
              if (!recipients.length)
                throw new Error("Seleziona almeno un destinatario");
              await run("message_send", { recipients, content: d.content });
              setCompose(false);
              setRecipients([]);
            }}
          >
            <fieldset>
              <legend>Destinatari</legend>
              {members
                .filter((m) => m.user_id !== user.id)
                .map((m) => (
                  <label className="check" key={m.id}>
                    <input
                      type="checkbox"
                      checked={recipients.includes(m.user_id)}
                      onChange={(e) =>
                        setRecipients(
                          e.target.checked
                            ? [...recipients, m.user_id]
                            : recipients.filter((id) => id !== m.user_id),
                        )
                      }
                    />
                    {name(m.user_id)}
                  </label>
                ))}
            </fieldset>
            <Area label="Il messaggio" name="content" required />
          </Form>
        </Modal>
      )}
    </>
  );
}
