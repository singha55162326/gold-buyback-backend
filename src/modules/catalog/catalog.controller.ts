import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import {
  CreateCabinetDto,
  CreateGoldItemDto,
  CreateGoldTypeDto,
  CreatePartnerDto,
} from './dto/catalog.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('catalog')
@ApiBearerAuth('bearer')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('gold-types')
  goldTypes(@Query('stockOnly') stockOnly?: string) {
    return this.catalog.listGoldTypes(stockOnly === 'true');
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('gold-types')
  createGoldType(@Body() dto: CreateGoldTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.catalog.createGoldType(dto, user.id);
  }

  @Get('gold-items')
  goldItems() {
    return this.catalog.listGoldItems();
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('gold-items')
  createGoldItem(@Body() dto: CreateGoldItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.catalog.createGoldItem(dto, user.id);
  }

  @Get('cabinets')
  cabinets() {
    return this.catalog.listCabinets();
  }

  @Get('cabinets/:id')
  cabinet(@Param('id') id: string) {
    return this.catalog.cabinetContents(id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('cabinets')
  createCabinet(@Body() dto: CreateCabinetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.catalog.createCabinet(dto, user.id);
  }

  @Get('partners')
  partners(@Query('direction') direction?: 'IN' | 'OUT') {
    return this.catalog.listPartners(direction);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('partners')
  createPartner(@Body() dto: CreatePartnerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.catalog.createPartner(dto, user.id);
  }

  @Get('bank-accounts')
  bankAccounts() {
    return this.catalog.listBankAccounts();
  }
}
