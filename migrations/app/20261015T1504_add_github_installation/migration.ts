#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2c1f30ab67baa8598f1ff960578389cbb46263aa60f2c3738719025bbf3a08a1/contract';
import startContract from '../../snapshots/2c1f30ab67baa8598f1ff960578389cbb46263aa60f2c3738719025bbf3a08a1/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/cab322b3b9b51bca5cc63d2a515abcebc18e5499ebdc054d9881164c6d59587c/contract';
import endContract from '../../snapshots/cab322b3b9b51bca5cc63d2a515abcebc18e5499ebdc054d9881164c6d59587c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'GithubInstallation',
        columns: [
          col('accountLogin', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('accountType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('installationId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Repository',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('defaultBranch', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fileCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('fullName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('githubId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('indexStatus', 'text', {
            notNull: true,
            default: lit('idle'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('indexedAt', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('installationId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('owner', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('pineconeNamespace', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('private', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'GithubInstallation',
        constraint: 'GithubInstallation_installationId_key',
        columns: ['installationId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Repository',
        constraint: 'Repository_githubId_key',
        columns: ['githubId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Repository',
        constraint: 'Repository_fullName_key',
        columns: ['fullName'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Repository',
        constraint: 'Repository_pineconeNamespace_key',
        columns: ['pineconeNamespace'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'GithubInstallation',
        index: 'GithubInstallation_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Repository',
        index: 'Repository_installationId_idx_17db6dbe',
        columns: ['installationId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'GithubInstallation',
        foreignKey: {
          name: 'GithubInstallation_userId_fkey',
          columns: ['userId'],
          references: { schema: 'auth', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Repository',
        foreignKey: {
          name: 'Repository_installationId_fkey',
          columns: ['installationId'],
          references: { schema: 'public', table: 'GithubInstallation', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
