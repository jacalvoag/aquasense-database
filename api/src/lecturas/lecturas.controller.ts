import { Controller, Get } from '@nestjs/common';
import { LecturasService } from './lecturas.service.js';

@Controller('lecturas')
export class LecturasController {
  constructor(private readonly lecturas: LecturasService) {}

  @Get()
  listar() {
    return this.lecturas.listar();
  }
}