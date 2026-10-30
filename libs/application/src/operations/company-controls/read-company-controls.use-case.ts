import { Inject, Injectable } from '@nestjs/common';
import { COMPANY_CONTROLS_PORT, type CompanyControlsPort } from '@domain/operations/company-controls/company-controls.port';

@Injectable()
export class ReadCompanyControlsUseCase {
  constructor(@Inject(COMPANY_CONTROLS_PORT) private readonly controls: CompanyControlsPort) {}
  execute(companyId: string) { return this.controls.read(companyId); }
}
