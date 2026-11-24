import { Module } from '@nestjs/common';
import { Neo4jController } from './neo4j.controller.js';
import { Neo4jService } from './neo4j.service.js';

@Module({
  controllers: [Neo4jController],
  providers: [Neo4jService],
  exports: [Neo4jService],
})
export class Neo4jModule {}