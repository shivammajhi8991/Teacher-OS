import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { NotesService } from './notes.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateDocumentShareDto } from './dto/create-document-share.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 "Notes / Assignments" (notes half). `note.manage` covers upload/share; `note.read`
// (broader, docs/06-style resource scoping in NotesService) covers list/get/download.
@Controller()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @RequirePermission('note.manage')
  @Post('documents/upload-url')
  createUploadUrl() {
    return this.notesService.createUploadUrl();
  }

  // Raw binary body — see main.ts's `express.raw()` registration for this exact path and
  // notes/storage/local-disk-storage.adapter.ts for what "uploadUrl" actually points to here.
  // Reads `req.body` directly (bypassing `@Body()`) so the global ValidationPipe never tries to
  // whitelist-strip an undecorated Buffer's properties.
  @RequirePermission('note.manage')
  @Post('documents/storage/upload/:objectKey')
  async uploadBytes(
    @Param('objectKey') objectKey: string,
    @Req() req: Request,
  ) {
    await this.notesService.writeUploadedBytes(objectKey, req.body as Buffer);
    return { objectKey };
  }

  @RequirePermission('note.manage')
  @Post('documents')
  createDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.notesService.createDocument(user, dto);
  }

  @RequirePermission('note.manage')
  @Post('documents/:id/share')
  createShare(
    @Param('id') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentShareDto,
  ) {
    return this.notesService.createShare(documentId, user, dto);
  }

  @RequirePermission('note.read')
  @Get('documents')
  listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
  ) {
    return this.notesService.listDocuments(user, { q });
  }

  @RequirePermission('note.read')
  @Get('documents/:id')
  getDocument(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notesService.getDocument(id, user);
  }

  // @Res() puts Nest into library-specific response mode — @Header()/automatic serialization
  // don't apply here, so the content-type and the redirect-vs-buffer branching are both handled
  // by hand.
  @RequirePermission('note.read')
  @Get('documents/:id/file')
  async getFile(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const content = await this.notesService.getFileContent(id, user);
    if (content.kind === 'redirect') {
      res.redirect(content.redirectUrl!);
      return;
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(content.buffer);
  }
}
