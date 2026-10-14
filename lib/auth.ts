import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { PostgresDialect } from "kysely";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}

// Prisma ORM 8 has no PrismaClient, so `@better-auth/prisma-adapter` cannot be
// used (it peers on prisma ^5 || ^6 || ^7 and calls prisma.user.findMany(...)).
// Better Auth's built-in Kysely adapter talks to PostgreSQL directly, so it
// works alongside Prisma 8 against the same database. Auth tables live in their
// own `auth` schema so Prisma 8 keeps sole ownership of `public`.
const pool = new Pool({
    connectionString,
    // Neon requires TLS; the connection string already carries sslmode.
    max: 10,
});

export const auth = betterAuth({
    database: {
        dialect: new PostgresDialect({ pool }),
        type: "postgres",
        schemaName: "auth",
    },
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,

        }
    },
    advanced: {
        database: {
            joins: true,
        },
    },
    plugins: [nextCookies()],
});