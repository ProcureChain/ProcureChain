import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantGuard } from '../common/tenant.guard';
import { PRService } from './pr.service';
import { CreatePRDocumentDto, CreatePRDto, UpdatePRDto, UpdatePRStatusDto, WithdrawPRDto } from './pr.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

type UploadedBinary = {
  originalname: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
};

@Controller('pr')
@UseGuards(TenantGuard)
export class PRController {
  constructor(private readonly prs: PRService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreatePRDto) {
    return this.prs.createDraft(req.ctx, dto);
  }

  @Get()
  async list(@Req() req: any, @Query('limit') limit?: string) {
    return this.prs.list(req.ctx, limit ? Number(limit) : 50);
  }

  @Get(':id')
  async get(@Req() req: any, @Param('id') id: string) {
    return this.prs.get(req.ctx, id);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePRDto) {
    return this.prs.updateDraft(req.ctx, id, dto);
  }

  @Post(':id/submit')
  async submit(@Req() req: any, @Param('id') id: string) {
    return this.prs.submit(req.ctx, id);
  }

  @Post(':id/withdraw')
  async withdraw(@Req() req: any, @Param('id') id: string, @Body() dto: WithdrawPRDto) {
    return this.prs.withdraw(req.ctx, id, dto.reason);
  }

  @Post(':id/status')
  async updateStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePRStatusDto) {
    return this.prs.transitionStatus(req.ctx, id, dto.status, dto.reason);
  }

  @Get(':id/documents')
  async listDocuments(@Req() req: any, @Param('id') id: string) {
    return this.prs.listDocuments(req.ctx, id);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreatePRDocumentDto,
    @UploadedFile() file?: UploadedBinary,
  ) {
    return this.prs.uploadDocument(req.ctx, id, dto, file);
  }

  @Get('documents/:documentId/download')
  async downloadDocument(@Req() req: any, @Param('documentId') documentId: string, @Res() res: Response) {
    return this.prs.downloadDocument(req.ctx, documentId, res);
  }
}
