/** The player's own role name. Used on the private card, never on the public rail. */
export function RoleBadge({ name }: { name: string }) {
  return <h1 className="ww-role-badge">{name}</h1>;
}
