import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { FeesService } from './fees.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InitiateGatewayPaymentDto } from './dto/initiate-gateway-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 "Fees & Payments". `fee.manage` covers everything that touches money except
// reading your own invoices (`fee.read`, granted broadly, scoped per-resource in FeesService —
// same self/parent/teacher/admin rule as Students/Attendance/Classes).
@Controller()
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @RequirePermission('fee.manage')
  @Post('fee-structures')
  createFeeStructure(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFeeStructureDto,
  ) {
    return this.feesService.createFeeStructure(user, dto);
  }

  @RequirePermission('fee.manage')
  @Get('fee-structures')
  listFeeStructures(
    @Query('classId') classId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feesService.listFeeStructures(classId, user);
  }

  // Not in docs/04 §4.4's original endpoint list — docs/03 §3.7 `discounts` needs somewhere to
  // be created; grouped under fee.manage since granting one is a finance-adjacent action.
  @RequirePermission('fee.manage')
  @Post('discounts')
  createDiscount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDiscountDto,
  ) {
    return this.feesService.createDiscount(user, dto);
  }

  @RequirePermission('fee.manage')
  @Post('invoices/generate')
  generateInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateInvoicesDto,
  ) {
    return this.feesService.generateInvoices(user, dto);
  }

  @RequirePermission('fee.read')
  @Get('students/:id/invoices')
  getStudentInvoices(
    @Param('id') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feesService.getStudentInvoices(studentId, user);
  }

  @RequirePermission('fee.manage')
  @Post('invoices/:id/credit-notes')
  createCreditNote(
    @Param('id') invoiceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCreditNoteDto,
  ) {
    return this.feesService.createCreditNote(invoiceId, user, dto);
  }

  @RequirePermission('fee.manage')
  @Post('payments')
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.feesService.recordPayment(user, dto);
  }

  // fee.read (not fee.manage) — a student/parent initiates their own gateway payment; scoping is
  // enforced in the service (self/linked-guardian), not by requiring the manage-level permission.
  @RequirePermission('fee.read')
  @Post('payments/gateway/initiate')
  initiateGatewayPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiateGatewayPaymentDto,
  ) {
    return this.feesService.initiateGatewayPayment(user, dto);
  }

  // Public — the gateway calls this, not an authenticated app user. Signature verification
  // (FeesService.confirmGatewayWebhook -> PaymentGatewayAdapter) is what authenticates the call
  // instead of a JWT. Needs the raw request body for HMAC verification, hence `app.rawBody: true`
  // in main.ts and reading `req.rawBody` here rather than the JSON-parsed `req.body`.
  @Public()
  @Post('payments/gateway/webhook')
  async gatewayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-gateway-signature') signature?: string,
  ) {
    await this.feesService.confirmGatewayWebhook(
      req.rawBody?.toString('utf-8') ?? '',
      signature,
    );
    return { received: true };
  }

  @RequirePermission('fee.manage')
  @Post('payments/:id/refund')
  refundPayment(
    @Param('id') paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRefundDto,
  ) {
    return this.feesService.refundPayment(paymentId, user, dto);
  }

  @RequirePermission('fee.manage')
  @Get('institutes/:id/revenue-summary')
  getRevenueSummary(
    @Param('id') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feesService.getRevenueSummary(instituteId, user);
  }
}
