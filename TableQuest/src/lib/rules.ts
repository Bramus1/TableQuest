// Manual tracking only. No automated 2014 or 2024 class mechanics.
export const conditions = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
];
export const referenceUrl = "https://www.dndbeyond.com/sources/dnd/free-rules";
export function ordered<
  T extends { initiative: number; turn_order: number; id: string },
>(rows: T[], preparing: boolean): T[] {
  return [...rows].sort(
    (a, b) =>
      (preparing ? b.initiative - a.initiative : 0) ||
      a.turn_order - b.turn_order ||
      a.id.localeCompare(b.id),
  );
}
export function nextTurn(
  round: number,
  turn: number,
  count: number,
  direction: number,
) {
  if (count < 1) throw new Error("No combatants");
  const position = Math.max(0, (round - 1) * count + turn + direction);
  return { round: Math.floor(position / count) + 1, turn: position % count };
}
export function hpPercent(hp: number, max: number) {
  return Math.max(0, Math.min(100, max > 0 ? (hp / max) * 100 : 0));
}
