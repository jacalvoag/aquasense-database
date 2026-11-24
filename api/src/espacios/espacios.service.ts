import { Injectable } from '@nestjs/common';
import { EspaciosRepository } from './espacios.repository.js';

@Injectable()
export class EspaciosService {
  constructor(private readonly espacios: EspaciosRepository) {}

  listar() {
    return this.espacios.listar();
  }
}