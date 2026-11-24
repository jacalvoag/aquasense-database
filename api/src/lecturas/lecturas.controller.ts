import { Body, Controller, Get, Post } from '@nestjs/common';
import { LecturasService } from './lecturas.service.js';

@Controller('lecturas')
export class LecturasController {
  constructor(private readonly lecturas: LecturasService) {}

  @Get()
  listar() {
    return this.lecturas.listar();
  }

  @Post()
  registrar(@Body() cuerpo: unknown) {
    return this.lecturas.registrar(cuerpo);
  }
}