import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/admin.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** User Setting, Deleted List, Audit Log and the day-rollover job (§3.7, §10). */
@Roles('ADMIN', 'MANAGER')
@ApiTags('admin')
@ApiBearerAuth('bearer')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  listUsers() {
    return this.admin.listUsers();
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.createUser(dto, user);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.updateUser(id, dto, user);
  }

  @Post('users/:id/password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.resetPassword(id, dto, user);
  }

  @Get('deleted')
  deletedList() {
    return this.admin.deletedList();
  }

  @Get('audit-log')
  auditLog(@Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit: number) {
    return this.admin.auditLog(limit);
  }

  /**
   * Audit trail for one entity — backs the VIEW (Action, Change Details)
   * buttons the TOR asks for in §3.2 and §3.4.
   */
  @Get('audit-log/:entity')
  auditForEntity(
    @Param('entity') entity: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.admin.auditForEntity(entity, entityId);
  }

  /** ປິດມື້ ແລະ ຍົກຍອດ — §7.1, §7.2, §9.2. */
  @Post('rollover')
  rollover(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.rolloverDay(user);
  }
}
