import { Controller, Get, Param } from '@nestjs/common';
import { ComponentesService } from './componentes.service.js';

@Controller('red')
export class RedController {
  constructor(private readonly componentes: ComponentesService) {}

  @Get()
  snapshot() {
    return this.componentes.snapshotRed();
  }

  @Get('componentes/:componenteId/alcance')
  alcance(@Param('componenteId') componenteId: string) {
    return this.componentes.alcance(componenteId);
  }
}
