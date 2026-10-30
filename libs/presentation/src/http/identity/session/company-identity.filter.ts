import { AccountEditError, AccountNotPostableError } from '@domain/accounting/account/chart';
import { JournalEntryError } from '@domain/accounting/journal-entry/journal-entry';
import { ModulePermissionError, PermissionDeniedError } from '@domain/identity/membership/module-access';
import { InvalidCredentialsError, RegistrationError } from '@domain/identity/session/password-hasher.port';
import { BarcodeError } from '@domain/inventory/catalog/barcode-sheet/barcode';
import { CostingMethodChangeError, InsufficientStockError, SpecificLayerRequiredError } from '@domain/inventory/catalog/costing/costing';
import { DocumentError } from '@domain/inventory/stock/document/document';
import { PriceError } from '@domain/inventory/catalog/product/price';
import { PriceWorkflowError } from '@domain/inventory/catalog/pricing/price-workflow.port';
import { VoucherError } from '@domain/documents/voucher/voucher';
import { VoucherVoidApprovalError } from '@domain/documents/voucher/voucher-void-approval.port';
import { McpError } from '@domain/mcp/tool-catalog/tool-catalog';
import { SpreadsheetError } from '@domain/inventory/catalog/import/spreadsheet';
import { ProductError } from '@domain/inventory/catalog/product/product';
import { LayoutError } from '@domain/workspace/layout/layout';
import { PaymentSettingsError } from '@domain/accounting/payment-settings/payment-settings';
import { CompanyControlsError } from '@domain/operations/company-controls/company-controls';
import { CompanyIdentityError } from '@domain/tenancy/company/company';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

@Catch(
  CompanyIdentityError,
  RegistrationError,
  InvalidCredentialsError,
  AccountNotPostableError,
  AccountEditError,
  JournalEntryError,
  ProductError,
  BarcodeError,
  DocumentError,
  InsufficientStockError,
  SpecificLayerRequiredError,
  CostingMethodChangeError,
  PriceError,
  PriceWorkflowError,
  SpreadsheetError,
  VoucherError,
  VoucherVoidApprovalError,
  ModulePermissionError,
  PermissionDeniedError,
  McpError,
  LayoutError,
  PaymentSettingsError,
  CompanyControlsError,
)
export class CompanyIdentityFilter implements ExceptionFilter {
  catch(
    error:
      | CompanyIdentityError
      | RegistrationError
      | InvalidCredentialsError
      | AccountNotPostableError
      | AccountEditError
      | JournalEntryError
      | ProductError
      | BarcodeError
      | DocumentError
      | InsufficientStockError
      | SpecificLayerRequiredError
      | CostingMethodChangeError
      | PriceError
      | PriceWorkflowError
      | SpreadsheetError
      | VoucherError
      | VoucherVoidApprovalError
      | ModulePermissionError
      | PermissionDeniedError
      | McpError
      | LayoutError
      | PaymentSettingsError
      | CompanyControlsError,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = statusFor(error);
    response.status(status).json({ message: error.message });
  }
}

function statusFor(error: Error): number {
  if (error instanceof PriceWorkflowError && error.kind === 'forbidden') {
    return 403;
  }
  if (error instanceof PriceWorkflowError && error.kind === 'conflict') {
    return 409;
  }
  if (error instanceof VoucherVoidApprovalError && error.code === 'forbidden') {
    return 403;
  }
  if (error instanceof VoucherVoidApprovalError && (error.code === 'conflict' || error.code === 'not-found')) {
    return error.code === 'conflict' ? 409 : 404;
  }
  if (error instanceof InvalidCredentialsError) {
    return 401;
  }
  if (error instanceof PermissionDeniedError) {
    return 403;
  }
  return 400;
}
