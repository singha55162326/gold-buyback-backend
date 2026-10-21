import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import {
  CreateCabinetDto,
  CreateGoldItemDto,
  CreateGoldTypeDto,
  CreatePartnerDto,
  UpdateCabinetDto,
  UpdateGoldItemDto,
  UpdateGoldTypeDto,
  UpdatePartnerDto,
} from './dto/catalog.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HistoryRangeDto } from '../../common/dto/history-range.dto';
import { HistoryRangeService } from '../../common/services/history-range.service';

@ApiTags('catalog')
@ApiBearerAuth('bearer')
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly range: HistoryRangeService,
  ) {}

  @Get('gold-types')
  goldTypes(@Query('stockOnly') stockOnly?: string) {
    return this.catalog.listGoldTypes(stockOnly === 'true');
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('gold-types')
  createGoldType(@Body() dto: CreateGoldTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.catalog.createGoldType(dto, user.id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch('gold-types/:id')
  updateGoldType(
    @Param('id') id: string,
    @Body() dto: UpdateGoldTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalog.updateGoldType(id, dto, user.id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete('gold-types/:id')
  deleteGoldType(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.catalog.deleteGoldType(id, user.id);
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

  @Roles('ADMIN', 'MANAGER')
  @Patch('gold-items/:id')
  updateGoldItem(
    @Param('id') id: string,
    @Body() dto: UpdateGoldItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalog.updateGoldItem(id, dto, user.id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete('gold-items/:id')
  deleteGoldItem(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.catalog.deleteGoldItem(id, user.id);
  }

  @Get('cabinets')
  cabinets() {
    return this.catalog.listCabinets();
  }

  // ບໍ່ສົ່ງວັນທີມາ = ເຫັນຄຳທັງໝົດໃນຕູ້ (ຕູ້ເປັນຍອດຄົງຄ້າງ ບໍ່ແມ່ນປະຫວັດ);
  // ສົ່ງ from_date / to_date ມາ = ເບິ່ງສະເພາະຄຳທີ່ເຂົ້າຕູ້ໃນຊ່ວງນັ້ນ.
  @Get('cabinets/:id')
  cabinet(
    @Param('id') id: string,
    @Query() query: HistoryRangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const asked = query.from_date ?? query.fromDate ?? query.to_date ?? query.toDate;
    if (!asked) return this.catalog.cabinetContents(id);
    const range = this.range.resolve(query, user);
    return this.catalog.cabinetContents(id, HistoryRangeService.window(range));
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('cabinets')
  createCabinet(@Body() dto: CreateCabinetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.catalog.createCabinet(dto, user.id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch('cabinets/:id')
  updateCabinet(
    @Param('id') id: string,
    @Body() dto: UpdateCabinetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalog.updateCabinet(id, dto, user.id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete('cabinets/:id')
  deleteCabinet(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.catalog.deleteCabinet(id, user.id);
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

  @Roles('ADMIN', 'MANAGER')
  @Patch('partners/:id')
  updatePartner(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalog.updatePartner(id, dto, user.id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete('partners/:id')
  deletePartner(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.catalog.deletePartner(id, user.id);
  }

  @Get('bank-accounts')
  bankAccounts() {
    return this.catalog.listBankAccounts();
  }
}
