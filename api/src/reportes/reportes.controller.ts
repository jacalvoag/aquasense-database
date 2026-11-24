import { Controller, Get, Param } from '@nestjs/common';
import { ReportesService } from './reportes.service.js';

@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get()
  listar() {
    return this.reportes.listar();
  }

  @Get(':reporteId/expediente')
  consultarExpediente(@Param('reporteId') reporteId: string) {
    return this.reportes.consultarExpediente(reporteId);
  }
}