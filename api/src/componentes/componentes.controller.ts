import { Controller, Get } from '@nestjs/common';
import { ComponentesService } from './componentes.service.js';

@Controller('componentes')
export class ComponentesController {
  constructor(private readonly componentes: ComponentesService) {}

  @Get()
  listar() {
    return this.componentes.listar();
  }
}