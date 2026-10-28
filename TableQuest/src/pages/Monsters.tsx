import { useState } from "react";
import { useApp, useRows } from "../lib/data";
import {
  Action,
  Area,
  Button,
  Empty,
  Field,
  Form,
  Loading,
  Modal,
} from "../components/ui";
import type { Monster } from "../types";
export default function Monsters() {
  const q = useRows("monsters");
  const { run } = useApp();
  const [edit, setEdit] = useState<Monster | null | undefined>();
  if (q.isLoading) return <Loading />;
  if (q.error) return <p role="alert">{q.error.message}</p>;
  return (
    <>
      <div className="section-heading">
        <h2>Mostri della campagna</h2>
        <Button onClick={() => setEdit(null)}>Aggiungi mostro</Button>
      </div>
      <p className="muted">
        Solo il DM vede il bestiario. Aggiungi questi mostri a uno scontro da
        “Aggiungi partecipante”. Ogni copia ha HP indipendenti.
      </p>
      <div className="record-grid">
        {q.data?.map((m) => (
          <article className="panel" key={m.id}>
            <h3>{m.name}</h3>
            <p>
              {m.max_hp} HP · AC {m.armor_class}
            </p>
            <p>Nome pubblico: {m.public_name}</p>
            <p className="preserve">{m.notes}</p>
            <div className="button-row">
              <Button secondary onClick={() => setEdit(m)}>
                Modifica mostro
              </Button>
              <Action
                action="monster_delete"
                data={{ id: m.id }}
                confirm="Eliminare il modello? Le copie già in combattimento resteranno disponibili."
              >
                Elimina mostro
              </Action>
            </div>
          </article>
        ))}
      </div>
      {!q.data?.length && <Empty title="Prepara i tuoi nemici" />}
      {edit !== undefined && (
        <Modal
          title={edit ? "Modifica mostro" : "Aggiungi mostro"}
          onClose={() => setEdit(undefined)}
        >
          <Form
            onSave={async (d) => {
              await run("monster_save", {
                ...d,
                id: edit?.id,
                version: edit?.version,
              });
              setEdit(undefined);
            }}
          >
            <Field
              label="Nome del mostro (solo DM)"
              name="name"
              value={edit?.name}
              required
            />
            <Field
              label="Nome visibile ai giocatori"
              name="public_name"
              value={edit?.public_name || "Creatura sconosciuta"}
              required
            />
            <Field
              label="HP massimi"
              name="max_hp"
              type="number"
              value={edit?.max_hp || 10}
              min={1}
              required
            />
            <Field
              label="Armor Class"
              name="armor_class"
              type="number"
              value={edit?.armor_class ?? 10}
              min={0}
              required
            />
            <Area
              label="Attacchi, capacità e note (solo DM)"
              name="notes"
              value={edit?.notes}
            />
          </Form>
        </Modal>
      )}
    </>
  );
}
