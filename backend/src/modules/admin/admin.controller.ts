import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 "Admin". docs/02 §2.8's Admin Web Panel shares mobile's own providers/API
// client — this is the one real endpoint behind its "Audit log" destination
// (admin_panel_shell_screen.dart). Reported content and System config stay unbuilt: neither has
// a backing data model anywhere in this codebase (no flagging mechanism, no config table — see
// that screen's own doc comment), so there's nothing here for either yet.
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // docs/04 §4.1's own pagination guidance names audit logs explicitly as a "high-growth list"
  // that should use cursor pagination, not offset — `cursor` here is the previous page's last
  // entry's `changedAt` (ISO string), not an opaque token, which is enough given this endpoint
  // only ever sorts one way (newest first).
  @RequirePermission('audit_log.read')
  @Get('audit-logs')
  listAuditLog(
    @CurrentUser() user: AuthenticatedUser,
    @Query('source') source: 'attendance' | 'payment' | undefined,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
  ) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    return this.adminService.listAuditLog(user, {
      source,
      cursor,
      limit: parsedLimit,
    });
  }
}
