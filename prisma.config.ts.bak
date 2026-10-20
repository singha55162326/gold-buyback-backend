import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// The connection string lives in the ROOT .env so the CLI and the API cannot
// end up on different databases. Loading it explicitly here, rather than
// relying on dotenv's cwd default, is what makes that guarantee hold.
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'),
});

/**
 * Prisma 6.19 configuration. Replaces the deprecated `package.json#prisma`
 * block so that `prisma migrate reset` still runs the seed automatically.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
