import { AccountEditError, AccountNotPostableError } from '@domain/accounting/chart';
import { ModulePermissionError, PermissionDeniedError } from '@domain/identity/module-access';
import { InvalidCredentialsError, RegistrationError } from '@domain/identity/password-hasher.port';
import { BarcodeError } from '@domain/inventory/barcode';
import { InsufficientStockError, SpecificLayerRequiredError } from '@domain/inventory/costing';
import { DocumentError } from '@domain/inventory/document';
import { PriceError } from '@domain/inventory/price';
import { VoucherError } from '@domain/documents/voucher';
import { McpError } from '@domain/mcp/tool-catalog';
import { SpreadsheetError } from '@domain/inventory/spreadsheet';
import { ProductError } from '@domain/inventory/product';
import { LayoutError } from '@domain/workspace/layout';
import { CompanyIdentityError } from '@domain/tenancy/company';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

@Catch(
  CompanyIdentityError,
  RegistrationError,
  InvalidCredentialsError,
  AccountNotPostableError,
  AccountEditError,
  ProductError,
  BarcodeError,
  DocumentError,
  InsufficientStockError,
  SpecificLayerRequiredError,
  PriceError,
  SpreadsheetError,
  VoucherError,
  ModulePermissionError,
  PermissionDeniedError,
  McpError,
  LayoutError,
)
export class CompanyIdentityFilter implements ExceptionFilter {
  catch(
    error:
      | CompanyIdentityError
      | RegistrationError
      | InvalidCredentialsError
      | AccountNotPostableError
      | AccountEditError
      | ProductError
      | BarcodeError
      | DocumentError
      | InsufficientStockError
      | SpecificLayerRequiredError
      | PriceError
      | SpreadsheetError
      | VoucherError
      | ModulePermissionError
      | PermissionDeniedError
      | McpError
      | LayoutError,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = statusFor(error);
    response.status(status).json({ message: error.message });
  }
}

function statusFor(error: Error): number {
  if (error instanceof InvalidCredentialsError) {
    return 401;
  }
  if (error instanceof PermissionDeniedError) {
    return 403;
  }
  return 400;
}
