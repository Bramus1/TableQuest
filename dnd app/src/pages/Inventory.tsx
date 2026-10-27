import { useState } from "react";
import { Backpack, Plus, Minus, ArrowRightLeft, Trash2 } from "lucide-react";
import { useApp, useRows } from "../lib/data";
import {
  Action,
  Area,
  Button,
  Empty,
  Field,
  Form,
  Heading,
  Loading,
  Modal,
  Select,
} from "../components/ui";
import type { Item } from "../types";
export default function InventoryPage() {
  const { user, campaignId, run } = useApp();
  const q = useRows("inventory_items");
  const { data: characters = [] } = useRows("characters");
  const { data: campaigns = [] } = useRows("campaigns", false);
  const { data: currency = [] } = useRows("currency");
  const { data: transactions = [] } = useRows("inventory_transactions");
  const [modal, setModal] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const [tab, setTab] = useState("party");
  const ch = characters.find((c) => c.user_id === user.id);
  const dm = campaigns.find((c) => c.id === campaignId)?.owner_id === user.id;
  const owner = (id: string | null) =>
    id
      ? characters.find((c) => c.id === id)?.name ||
        "Personaggio della compagnia"
      : "Gruppo";
  const rows = (q.data || []).filter(
    (i) =>
      tab === "all" ||
      (tab === "party" ? !i.character_id : i.character_id === ch?.id),
  );
  if (!campaignId) return <Empty title="Scegli prima una campagna" />;
  return (
    <>
      <Heading
        eyebrow="IL BOTTINO DELLE VOSTRE IMPRESE"
        title="Ogni oggetto ha una storia."
      >
        <Button onClick={() => setModal("add")}>
          <Plus size={18} /> Aggiungi oggetto
        </Button>
      </Heading>
      <section className="panel currency-panel">
        <div>
          <span className="eyebrow">TESORO DELLA COMPAGNIA</span>
          <h2>La cassa comune</h2>
        </div>
        <div className="coins">
          {["CP", "SP", "EP", "GP", "PP"].map((d) => (
            <div key={d}>
              <span>{d}</span>
              <strong>
                {currency.find((c) => c.denomination === d)?.amount || 0}
              </strong>
            </div>
          ))}
        </div>
        <Button secondary onClick={() => setModal("currency")}>
          Registra movimento
        </Button>
      </section>
      <div className="tabs">
        <button
          className={tab === "party" ? "selected" : ""}
          onClick={() => setTab("party")}
        >
          Del gruppo
        </button>
        <button
          className={tab === "mine" ? "selected" : ""}
          onClick={() => setTab("mine")}
        >
          Il mio zaino
        </button>
        <button
          className={tab === "all" ? "selected" : ""}
          onClick={() => setTab("all")}
        >
          Tutti
        </button>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <p role="alert" className="error">
          {q.error.message}
        </p>
      ) : rows.length ? (
        <div className="inventory-grid">
          {rows.map((i) => {
            const can = !i.character_id || i.character_id === ch?.id || dm;
            return (
              <article className="panel item" key={i.id}>
                <div className="section-heading">
                  <span className="quick-icon">
                    <Backpack size={24} />
                  </span>
                  <span className="badge">{i.item_type}</span>
                </div>
                <h2>{i.name}</h2>
                <p className="muted">{i.description}</p>
                <p className="small gold">
                  {owner(i.character_id)}
                  {i.weight !== null ? ` · ${i.weight} kg` : ""}
                  {i.value !== null ? ` · ${i.value} GP` : ""}
                </p>
                <div className="item-controls">
                  <Action
                    action="item_quantity"
                    disabled={!can || i.quantity === 0}
                    data={{
                      id: i.id,
                      version: i.version,
                      quantity: i.quantity - 1,
                    }}
                  >
                    <Minus size={16} />
                    <span className="sr-only">Diminuisci {i.name}</span>
                  </Action>
                  <strong>{i.quantity}</strong>
                  <Action
                    action="item_quantity"
                    disabled={!can}
                    data={{
                      id: i.id,
                      version: i.version,
                      quantity: i.quantity + 1,
                    }}
                  >
                    <Plus size={16} />
                    <span className="sr-only">Aumenta {i.name}</span>
                  </Action>
                  <Button
                    secondary
                    disabled={!can || i.quantity === 0}
                    onClick={() => {
                      setItem(i);
                      setModal("transfer");
                    }}
                  >
                    <ArrowRightLeft size={16} />
                    <span className="sr-only">Trasferisci {i.name}</span>
                  </Button>
                  <Action
                    action="item_delete"
                    disabled={!can}
                    data={{ id: i.id, version: i.version }}
                    confirm={`Rimuovere ${i.name} dall’inventario?`}
                  >
                    <Trash2 size={16} />
                    <span className="sr-only">Rimuovi {i.name}</span>
                  </Action>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <Empty title="Lo zaino aspetta le vostre scoperte">
            Aggiungi pozioni, provviste o quel misterioso oggetto trovato lungo
            il cammino.
          </Empty>
        </section>
      )}
      <section className="panel">
        <div className="section-heading">
          <h2>Movimenti recenti</h2>
          <span className="muted small">Ultimi 30</span>
        </div>
        {transactions.length ? (
          <div className="transaction-list">
            {[...transactions]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 30)
              .map((t) => (
                <div key={t.id}>
                  <div>
                    <strong>{t.item_name}</strong>
                    <small>
                      {t.description}
                      {t.description === "Trasferimento"
                        ? ` · ${owner(t.from_owner)} → ${owner(t.to_owner)}`
                        : ""}{" "}
                      · {new Date(t.created_at).toLocaleString("it-IT")}
                    </small>
                  </div>
                  <b className="gold">
                    {t.quantity > 0 ? "+" : ""}
                    {t.quantity}
                  </b>
                </div>
              ))}
          </div>
        ) : (
          <p className="muted">Nessun movimento registrato.</p>
        )}
      </section>
      {modal && (
        <Modal
          title={
            {
              add: "Un nuovo oggetto",
              transfer: "Trasferisci oggetto",
              currency: "Movimento di valuta",
            }[modal] || ""
          }
          onClose={() => setModal("")}
        >
          {modal === "add" ? (
            <Form
              onSave={async (d) => {
                await run("item_add", d);
                setModal("");
              }}
            >
              <Field label="Nome" name="name" required />
              <Area label="Descrizione" name="description" />
              <div className="form-grid">
                <Field
                  label="Quantità"
                  name="quantity"
                  type="number"
                  value={1}
                  min={0}
                  required
                />
                <Field label="Tipo" name="item_type" value="Oggetto" required />
                <Field
                  label="Peso unitario (kg, facoltativo)"
                  step="any"
                  name="weight"
                  type="number"
                  min={0}
                />
                <Field
                  label="Valore unitario (GP, facoltativo)"
                  step="any"
                  name="value"
                  type="number"
                  min={0}
                />
              </div>
              <Select label="Proprietario" name="character_id">
                <option value="">Gruppo</option>
                {characters
                  .filter((c) => dm || c.user_id === user.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </Form>
          ) : modal === "transfer" && item ? (
            <Form
              onSave={async (d) => {
                await run("item_transfer", {
                  id: item.id,
                  version: item.version,
                  ...d,
                });
                setModal("");
              }}
            >
              <p>
                {item.name} · da {owner(item.character_id)}
              </p>
              <Field
                label="Quantità da trasferire"
                name="quantity"
                type="number"
                min={1}
                max={item.quantity}
                value={1}
                required
              />
              <Select label="Nuovo proprietario" name="character_id">
                <option value="">Gruppo</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <p className="muted small">
                Puoi prendere oggetti dal gruppo o restituirli. Il DM può
                assegnarli a tutti i personaggi.
              </p>
            </Form>
          ) : (
            <Form
              onSave={async (d) => {
                await run("currency", d);
                setModal("");
              }}
            >
              <Select label="Valuta" name="denomination" value="GP">
                {["CP", "SP", "EP", "GP", "PP"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Field
                label="Variazione (negativa per spendere)"
                name="delta"
                type="number"
                value={0}
                required
              />
              <p className="muted small">
                Il saldo non può scendere sotto zero. Ogni movimento viene
                registrato.
              </p>
            </Form>
          )}
        </Modal>
      )}
    </>
  );
}
