import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SkusService } from './skus.service';
import { CreateSkuDto, UpdateSkuDto } from './dto/sku.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('skus')
@ApiBearerAuth('bearer')
@Controller('skus')
export class SkusController {
  constructor(private readonly skus: SkusService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.skus.list(includeInactive === 'true');
  }

  /** Real-time SKU-name preview as the user types (TOR §3.6). */
  @Get('preview')
  preview(@Query('nameLo') nameLo: string, @Query('weightG') weightG: string) {
    return this.skus.preview(nameLo ?? '', weightG ?? '0');
  }

  @Roles('ADMIN', 'MANAGER')
  @Post()
  create(@Body() dto: CreateSkuDto, @CurrentUser() user: AuthenticatedUser) {
    return this.skus.create(dto, user.id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSkuDto, @CurrentUser() user: AuthenticatedUser) {
    return this.skus.update(id, dto, user.id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.skus.remove(id, user.id);
  }
}
