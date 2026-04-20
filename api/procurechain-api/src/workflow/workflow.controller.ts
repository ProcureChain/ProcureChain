import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../common/tenant.guard';
import { WorkflowService } from './workflow.service';

@Controller('workflow')
@UseGuards(TenantGuard)
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  @Get('threads/pr/:prId')
  async getThread(@Req() req: any, @Param('prId') prId: string) {
    return this.workflow.getThread(req.ctx, prId);
  }

  @Post('threads/pr/:prId/messages')
  async addMessage(
    @Req() req: any,
    @Param('prId') prId: string,
    @Body() body: { message?: string; authorLabel?: string },
  ) {
    return this.workflow.addMessage(req.ctx, prId, {
      message: body.message ?? '',
      authorLabel: body.authorLabel,
    });
  }
}
