import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  @Post()
  crear(@Body() entrada: unknown) {
    return this.reportes.crear(entrada);
  }

  @Post(':reporteId/atenciones')
  registrarAtencion(
    @Param('reporteId') reporteId: string,
    @Body() entrada: unknown,
  ) {
    return this.reportes.registrarAtencion(reporteId, entrada);
  }
}