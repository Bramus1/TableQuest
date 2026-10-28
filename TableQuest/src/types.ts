export type Profile = { id: string; display_name: string; avatar: string };
export type Campaign = {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
};
export type Member = {
  id: string;
  campaign_id: string;
  user_id: string;
  role: "dm" | "player";
};
export type Condition = { name: string; notes: string; duration: string };
export type Character = {
  id: string;
  campaign_id: string;
  user_id: string;
  name: string;
  species: string;
  classes: string;
  level: number;
  max_hp: number;
  current_hp: number;
  temporary_hp: number;
  armor_class: number;
  initiative_modifier: number;
  movement_speed: number;
  notes: string;
  portrait_url: string;
  concentration: string;
  conditions: Condition[];
  version: number;
};
export type Resource = {
  id: string;
  campaign_id: string;
  character_id: string;
  name: string;
  maximum_uses: number;
  remaining_uses: number;
  recovery_type: "manual" | "short" | "long";
  version: number;
};
export type Session = {
  id: string;
  campaign_id: string;
  session_number: number;
  title: string;
  status: "active" | "completed";
  started_at: string;
  ended_at: string | null;
  summary: string;
};
export type Encounter = {
  id: string;
  campaign_id: string;
  session_id: string;
  name: string;
  status: "preparing" | "active" | "completed";
  current_round: number;
  current_turn: number;
  version: number;
  created_at: string;
};
export type Combatant = {
  id: string;
  campaign_id: string;
  encounter_id: string;
  character_id: string | null;
  name: string;
  initiative: number;
  turn_order: number;
  public_hp: string;
  public_conditions: string;
};
export type Secret = {
  id: string;
  campaign_id: string;
  real_name: string;
  current_hp: number;
  max_hp: number;
  armor_class: number;
  notes: string;
  conditions: string;
};
export type RecordKind =
  "journal" | "quest" | "npc" | "location" | "note" | "announcement";
export type RecordRow = {
  id: string;
  campaign_id: string;
  author_id: string;
  kind: RecordKind;
  title: string;
  content: string;
  status: "active" | "completed" | "failed" | "on_hold";
  visibility: "shared" | "dm" | "personal";
  location: string;
  created_at: string;
  version: number;
};
export type Message = {
  id: string;
  campaign_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
};
export type Item = {
  id: string;
  campaign_id: string;
  character_id: string | null;
  name: string;
  description: string;
  quantity: number;
  item_type: string;
  weight: number | null;
  value: number | null;
  version: number;
};
export type Transaction = {
  id: string;
  campaign_id: string;
  item_name: string;
  actor_id: string;
  quantity: number;
  from_owner: string | null;
  to_owner: string | null;
  description: string;
  created_at: string;
};
export type Currency = {
  id: string;
  campaign_id: string;
  denomination: string;
  amount: number;
};
export type Invite = {
  id: string;
  campaign_id: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};
export type Availability = {
  id: string;
  campaign_id: string;
  user_id: string;
  day: string;
  status: "yes" | "maybe" | "no";
  starts_at: string;
  ends_at: string;
  note: string;
};
export type Monster = {
  id: string;
  campaign_id: string;
  name: string;
  public_name: string;
  max_hp: number;
  armor_class: number;
  notes: string;
  version: number;
};
export type Tables = {
  monsters: Monster;
  availability: Availability;
  profiles: Profile;
  campaigns: Campaign;
  campaign_members: Member;
  characters: Character;
  character_resources: Resource;
  sessions: Session;
  encounters: Encounter;
  combatants: Combatant;
  combatant_secrets: Secret;
  records: RecordRow;
  private_messages: Message;
  inventory_items: Item;
  inventory_transactions: Transaction;
  currency: Currency;
  campaign_invites: Invite;
};
type DbTable<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};
export type Database = {
  public: {
    Tables: { [K in keyof Tables]: DbTable<Tables[K]> };
    Views: Record<never, never>;
    Functions: {
      save_profile: {
        Args: { p_name: string; p_avatar: string };
        Returns: undefined;
      };
      create_campaign: {
        Args: { p_name: string; p_description: string };
        Returns: string;
      };
      join_campaign: { Args: { p_token: string }; Returns: string };
      command: {
        Args: {
          p_campaign: string;
          p_action: string;
          p_data: unknown;
          p_request: string;
        };
        Returns: { token?: string };
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
