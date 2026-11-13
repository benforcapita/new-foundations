const npcs = {
  mia: { name: "Mia", role: "Civic Engineer", color: "#2C9D8F", initials: "M" },
  dana: { name: "Dana", role: "Merchant", color: "#D98669", initials: "D" },
  tom: { name: "Tom", role: "Station Manager", color: "#3B8392", initials: "T" },
  amir: { name: "Amir", role: "Gardener", color: "#5A9B79", initials: "A" },
} as const;
export type Npc = keyof typeof npcs;
export function NpcBadge({ npc }: { readonly npc: Npc }) {
  const person = npcs[npc];
  return <div className="npc-badge" data-testid={`npc-badge-${npc}`}>
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${person.name} initials`}>
      <circle cx="32" cy="32" r="32" fill={person.color} />
      <circle cx="32" cy="32" r="19" fill="#253D4A" />
      <text x="32" y="41" textAnchor="middle" fill="#F8EEDB" fontSize="28" fontWeight="bold">{person.initials}</text>
    </svg>
    <strong>{person.name}</strong><span>{person.role}</span><span className="npc-pill">NPC</span>
  </div>;
}
