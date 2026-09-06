import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

// Used ONLY by the TypeORM CLI (npm run migration:*, package.json). The running app builds its
// own connection via TypeOrmModule.forRootAsync in app.module.ts — kept separate so the CLI
// doesn't need to boot the whole Nest DI graph just to run a migration.
export const AppDataSource = new DataSource({
  type: 'postgres',
  // Port 5433, not Postgres's usual 5432 — see infra/docker-compose.yml's comment (a
  // locally-installed native Postgres service is a common 5432 collision on a dev machine).
  url:
    process.env.DATABASE_URL ??
    'postgres://teacheros:teacheros@localhost:5433/teacheros',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
