import { Controller, Get } from '@nestjs/common';
import { EspaciosService } from './espacios.service.js';

@Controller('espacios')
export class EspaciosController {
  constructor(private readonly espacios: EspaciosService) {}

  @Get()
  listar() {
    return this.espacios.listar();
  }
}