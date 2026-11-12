/** The player's own role name. Used on the private card, never on the public rail. */
export function RoleBadge({ name, id }: { name: string; id?: string }) {
  return (
    <h1 className="ww-role-badge" id={id}>
      {name}
    </h1>
  );
}
