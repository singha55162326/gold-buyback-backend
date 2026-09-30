import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * The connection string is passed in explicitly rather than left to
   * PrismaClient's own .env discovery.
   *
   * That discovery resolves relative to where the client was GENERATED
   * (backend/prisma), not where it runs — so the API could silently connect to a
   * different database from the one its own .env named. Reading it through
   * ConfigService makes the source unambiguous and honours the root .env.
   */
  constructor(config: ConfigService) {
    super({
      datasources: { db: { url: config.getOrThrow<string>('DATABASE_URL') } },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
