import { Controller, Get } from '@nestjs/common';
import { SystemService } from './system.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('system')
@ApiBearerAuth('bearer')
@Controller()
export class SystemController {
  constructor(private readonly system: SystemService) {}

  /**
   * Liveness for scripts and monitors — deliberately unauthenticated so a
   * start-up script can wait on it before opening a browser. It reveals only
   * whether the process and its database are up.
   */
  @Public()
  @Get('health')
  health() {
    return this.system.health();
  }

  /** The Admin setup checklist (TOR §3). */
  @Roles('ADMIN', 'MANAGER')
  @Get('system/readiness')
  readiness() {
    return this.system.readiness();
  }
}
