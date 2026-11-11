import { Controller, Get, Param } from '@nestjs/common';
import type { RolePackSummary } from '@warewolf/contracts';
import { DEFAULT_CATALOG, ROLE_PACKS, getPack, validateConfiguration, type RoleDefinition, type RolePack } from '@warewolf/domain';
import { errors } from '../http/api-error.js';

/** Public reference data: the role catalog and the preset packs. No game secrets. */
const PACK_SUMMARIES: readonly RolePackSummary[] = ROLE_PACKS.map((pack) => {
  const validation = validateConfiguration(pack.config);
  return {
    id: pack.id,
    name: pack.name,
    status: pack.status,
    description: pack.description,
    mode: pack.config.mode,
    playerCount: pack.config.playerCount,
    blockedBy: [...pack.blockedBy],
    errorCodes: validation.errors.map((e) => e.code),
    warningCodes: validation.warnings.map((w) => w.code),
  };
});

@Controller()
export class CatalogController {
  @Get('role-catalog')
  catalog(): { hash: string; roles: readonly RoleDefinition[] } {
    return { hash: DEFAULT_CATALOG.hash, roles: DEFAULT_CATALOG.roles };
  }

  @Get('role-catalog/:roleId')
  role(@Param('roleId') roleId: string): RoleDefinition {
    const role = DEFAULT_CATALOG.byId.get(roleId);
    if (!role) throw errors.notFound();
    return role;
  }

  @Get('role-packs')
  packs(): readonly RolePackSummary[] {
    return PACK_SUMMARIES;
  }

  @Get('role-packs/:packId')
  pack(@Param('packId') packId: string): RolePack {
    const pack = getPack(packId);
    if (!pack) throw errors.notFound();
    return pack;
  }
}
