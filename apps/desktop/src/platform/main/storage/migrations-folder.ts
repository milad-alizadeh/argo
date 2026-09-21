import path from 'node:path'

export function databaseMigrationsFolder(): string {
  return process.resourcesPath
    ? path.join(process.resourcesPath, 'app.asar', 'drizzle')
    : path.resolve(process.cwd(), 'drizzle')
}
