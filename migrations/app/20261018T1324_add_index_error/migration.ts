#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/d5b313e7dc42697c206f4e5f3ae677dc6c75051b95a2cedd4ad66f2266ad9cce/contract';
import startContract from '../../snapshots/d5b313e7dc42697c206f4e5f3ae677dc6c75051b95a2cedd4ad66f2266ad9cce/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ef1a849ead56ac72df2597c3014d8f2d096f02673966c08d08800666cb7abd95/contract';
import endContract from '../../snapshots/ef1a849ead56ac72df2597c3014d8f2d096f02673966c08d08800666cb7abd95/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'GitHubRepository',
        column: col('indexError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
