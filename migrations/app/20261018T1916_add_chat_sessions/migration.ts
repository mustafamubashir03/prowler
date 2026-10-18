#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1c772b752f3b882283a9ce93e748354b8eb77c1c8f2837f5b632fd76c2aed86f/contract';
import endContract from '../../snapshots/1c772b752f3b882283a9ce93e748354b8eb77c1c8f2837f5b632fd76c2aed86f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ef1a849ead56ac72df2597c3014d8f2d096f02673966c08d08800666cb7abd95/contract';
import startContract from '../../snapshots/ef1a849ead56ac72df2597c3014d8f2d096f02673966c08d08800666cb7abd95/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ChatMessage',
        columns: [
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sessionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tokens', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ChatSession',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('githubRepositoryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('repositoryId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', {
            notNull: true,
            default: lit('New chat'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChatMessage',
        index: 'ChatMessage_sessionId_createdAt_idx_9c04f880',
        columns: ['sessionId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChatMessage',
        index: 'ChatMessage_sessionId_idx_29f415d4',
        columns: ['sessionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChatSession',
        index: 'ChatSession_githubRepositoryId_idx_d3526253',
        columns: ['githubRepositoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChatSession',
        index: 'ChatSession_repositoryId_idx_dce7a8ba',
        columns: ['repositoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChatSession',
        index: 'ChatSession_userId_updatedAt_idx_42f5280d',
        columns: ['userId', 'updatedAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ChatMessage',
        foreignKey: {
          name: 'ChatMessage_sessionId_fkey',
          columns: ['sessionId'],
          references: { schema: 'public', table: 'ChatSession', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ChatSession',
        foreignKey: {
          name: 'ChatSession_repositoryId_fkey',
          columns: ['repositoryId'],
          references: { schema: 'public', table: 'GitHubRepository', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
