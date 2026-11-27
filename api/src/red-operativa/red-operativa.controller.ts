import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { RedOperativaService } from './red-operativa.service.js';

@Controller()
export class RedOperativaController {
  constructor(private readonly red: RedOperativaService) {}
  @Post('espacios') crearEspacio(@Body() entrada: unknown) { return this.red.crearEspacio(entrada); }
  @Post('componentes') crearComponente(@Body() entrada: unknown) { return this.red.crearComponente(entrada); }
  @Get('conexiones') listar() { return this.red.listarConexiones(); }
  @Post('conexiones') crear(@Body() entrada: unknown) { return this.red.crearConexion(entrada); }
  @Post('conexiones/:id/actualizar') actualizar(@Param('id') id: string, @Body() entrada: unknown) {
    return this.red.actualizarConexion(id, entrada);
  }
  @Post('conexiones/:id/eliminar') @HttpCode(200) eliminar(@Param('id') id: string) { return this.red.eliminarConexion(id); }
  @Get('red/estado') estado() { return this.red.estado(); }
  @Get('red/eventos/:id') evento(@Param('id') id: string) { return this.red.evento(id); }
}
