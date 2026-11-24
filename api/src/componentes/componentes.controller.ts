import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ComponentesService } from './componentes.service.js';

@Controller('componentes')
export class ComponentesController {
  constructor(private readonly componentes: ComponentesService) {}

  @Get()
  listar() {
    return this.componentes.listar();
  }

  @Get(':componenteId/espacios-afectados')
  espaciosAfectados(@Param('componenteId') componenteId: string) {
    return this.componentes.espaciosAfectados(componenteId);
  }

  @Post('tuberias')
  crearTuberia(@Body() entrada: unknown) {
    return this.componentes.crearTuberia(entrada);
  }
}