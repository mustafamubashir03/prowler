#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/cab322b3b9b51bca5cc63d2a515abcebc18e5499ebdc054d9881164c6d59587c/contract';
import startContract from '../../snapshots/cab322b3b9b51bca5cc63d2a515abcebc18e5499ebdc054d9881164c6d59587c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d5b313e7dc42697c206f4e5f3ae677dc6c75051b95a2cedd4ad66f2266ad9cce/contract';
import endContract from '../../snapshots/d5b313e7dc42697c206f4e5f3ae677dc6c75051b95a2cedd4ad66f2266ad9cce/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';

// Built against the END contract so the storage hashes line up with the
// transforms below. `postgres()` connects lazily, so no socket is opened here.
const { sql: db, contract } = postgres<End>({ contractJson: endContract });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      ...this.renameTable({
        schema: 'public',
        table: 'GithubInstallation',
        to: 'GitHubInstallation',
      }),
      ...this.renameTable({ schema: 'public', table: 'Repository', to: 'GitHubRepository' }),
      ...this.renameColumn({
        schema: 'public',
        table: 'GitHubInstallation',
        column: 'accountLogin',
        to: 'targetLogin',
      }),
      ...this.renameColumn({
        schema: 'public',
        table: 'GitHubInstallation',
        column: 'accountType',
        to: 'targetType',
      }),
      ...this.renameColumn({
        schema: 'public',
        table: 'GitHubInstallation',
        column: 'installationId',
        to: 'githubInstallationId',
      }),
      ...this.renameColumn({
        schema: 'public',
        table: 'GitHubRepository',
        column: 'githubId',
        to: 'githubRepositoryId',
      }),
      this.dropDefault({ schema: 'public', table: 'GitHubInstallation', column: 'id' }),
      this.dropColumn({ schema: 'public', table: 'GitHubRepository', column: 'description' }),
      this.dropColumn({ schema: 'public', table: 'GitHubRepository', column: 'fileCount' }),
      this.dropDefault({ schema: 'public', table: 'GitHubRepository', column: 'id' }),
      this.dropDefault({ schema: 'public', table: 'GitHubRepository', column: 'private' }),
      this.dropConstraint({
        schema: 'public',
        table: 'GitHubRepository',
        constraint: 'Repository_fullName_key',
      }),
      this.dropConstraint({
        schema: 'public',
        table: 'GitHubRepository',
        constraint: 'Repository_pineconeNamespace_key',
      }),
      this.dropColumn({ schema: 'public', table: 'GitHubRepository', column: 'pineconeNamespace' }),
      this.createTable({
        schema: 'public',
        table: 'PullRequestReview',
        columns: [
          col('author', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('fullName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('githubPrNumber', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('githubRepositoryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('owner', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('prUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('repoName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('repositoryId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reviewBody', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'GitHubInstallation',
        column: col('status', 'text', {
          notNull: true,
          default: lit('ACTIVE'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'GitHubInstallation',
        column: col('repositorySelection', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(contract, 'backfill-GitHubInstallation-repositorySelection', {
        check: () =>
          db.public.GitHubInstallation
            .select('id')
            .where((f, fns) => fns.eq(f.repositorySelection, null))
            .limit(1),
        run: () =>
          db.public.GitHubInstallation
            .update({ repositorySelection: 'all' })
            .where((f, fns) => fns.eq(f.repositorySelection, null)),
      }),
      this.setNotNull({
        schema: 'public',
        table: 'GitHubInstallation',
        column: 'repositorySelection',
      }),
      this.addColumn({
        schema: 'public',
        table: 'GitHubInstallation',
        column: col('targetId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      // The old schema had no numeric account id, so legacy rows get "0"
        // (meaning "unknown") rather than a value that would look authoritative.
        this.dataTransform(contract, 'backfill-GitHubInstallation-targetId', {
          check: () =>
            db.public.GitHubInstallation
              .select('id')
              .where((f, fns) => fns.eq(f.targetId, null))
              .limit(1),
          run: () =>
            db.public.GitHubInstallation
              .update({ targetId: '0' })
              .where((f, fns) => fns.eq(f.targetId, null)),
        }),
      this.setNotNull({ schema: 'public', table: 'GitHubInstallation', column: 'targetId' }),
      this.addColumn({
        schema: 'public',
        table: 'GitHubRepository',
        column: col('nodeId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      // GitHub's node_id did not exist in the old schema; empty string keeps the
        // NOT NULL constraint satisfiable for legacy rows.
        this.dataTransform(contract, 'backfill-GitHubRepository-nodeId', {
          check: () =>
            db.public.GitHubRepository
              .select('id')
              .where((f, fns) => fns.eq(f.nodeId, null))
              .limit(1),
          run: () =>
            db.public.GitHubRepository
              .update({ nodeId: '' })
              .where((f, fns) => fns.eq(f.nodeId, null)),
        }),
      this.setNotNull({ schema: 'public', table: 'GitHubRepository', column: 'nodeId' }),
      // The four typechange transforms Postgres performs natively during
      // ALTER COLUMN ... TYPE (int4 -> text, date -> timestamptz). They need no
      // pre-transform, so only the alterColumnType step is kept.
      this.alterColumnType({
        schema: 'public',
        table: 'GitHubInstallation',
        column: 'githubInstallationId',
        options: {
          qualifiedTargetType: 'text',
          formatTypeExpected: 'text',
          rawTargetTypeForLabel: 'text',
        },
      }),
      this.alterColumnType({
        schema: 'public',
        table: 'GitHubInstallation',
        column: 'id',
        options: {
          qualifiedTargetType: 'text',
          formatTypeExpected: 'text',
          rawTargetTypeForLabel: 'text',
        },
      }),
      this.alterColumnType({
        schema: 'public',
        table: 'GitHubRepository',
        column: 'id',
        options: {
          qualifiedTargetType: 'text',
          formatTypeExpected: 'text',
          rawTargetTypeForLabel: 'text',
        },
      }),
      this.alterColumnType({
        schema: 'public',
        table: 'GitHubRepository',
        column: 'indexedAt',
        options: {
          qualifiedTargetType: 'timestamptz',
          formatTypeExpected: 'timestamp with time zone',
          rawTargetTypeForLabel: 'timestamptz',
        },
      }),
      this.dropNotNull({ schema: 'public', table: 'GitHubRepository', column: 'indexedAt' }),
      this.alterColumnType({
        schema: 'public',
        table: 'GitHubRepository',
        column: 'installationId',
        options: {
          qualifiedTargetType: 'text',
          formatTypeExpected: 'text',
          rawTargetTypeForLabel: 'text',
        },
      }),
      this.dataTransform(contract, 'handle-nulls-GitHubRepository-defaultBranch', {
        check: () =>
          db.public.GitHubRepository
            .select('id')
            .where((f, fns) => fns.eq(f.defaultBranch, null))
            .limit(1),
        run: () =>
          db.public.GitHubRepository
            .update({ defaultBranch: 'main' })
            .where((f, fns) => fns.eq(f.defaultBranch, null)),
      }),
      this.setNotNull({ schema: 'public', table: 'GitHubRepository', column: 'defaultBranch' }),
      this.dropNotNull({ schema: 'public', table: 'GitHubInstallation', column: 'userId' }),
      this.setDefault({
        schema: 'public',
        table: 'GitHubRepository',
        column: col('indexStatus', 'text', {
          default: lit('NOT_INDEXED'),
          codecRef: { codecId: 'pg/text@1' },
        }),
        operationClass: 'widening',
      }),
      this.addUnique({
        schema: 'public',
        table: 'PullRequestReview',
        constraint: 'PullRequestReview_githubRepositoryId_githubPrNumber_key',
        columns: ['githubRepositoryId', 'githubPrNumber'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PullRequestReview',
        index: 'PullRequestReview_repositoryId_idx_dce7a8ba',
        columns: ['repositoryId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PullRequestReview',
        foreignKey: {
          name: 'PullRequestReview_repositoryId_fkey',
          columns: ['repositoryId'],
          references: { schema: 'public', table: 'GitHubRepository', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
