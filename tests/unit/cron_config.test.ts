import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Vercel Hobby Compliance & Auto-Release Cron Configuration', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const vercelJsonPath = path.join(rootDir, 'vercel.json');
  const workflowPath = path.join(rootDir, '.github', 'workflows', 'auto-release-cron.yml');
  const runbookPath = path.join(rootDir, '09-PRODUCTION-RUNBOOK.md');

  describe('vercel.json Configuration', () => {
    it('should exist and parse as valid JSON', () => {
      expect(fs.existsSync(vercelJsonPath)).toBe(true);
      const content = fs.readFileSync(vercelJsonPath, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should configure /api/cron/auto-release with 0 16 * * * for Vercel Hobby 1-cron/day compliance', () => {
      const content = fs.readFileSync(vercelJsonPath, 'utf8');
      const vercelConfig = JSON.parse(content);

      expect(Array.isArray(vercelConfig.crons)).toBe(true);
      expect(vercelConfig.crons.length).toBe(1);

      const cron = vercelConfig.crons[0];
      expect(cron.path).toBe('/api/cron/auto-release');
      // Must be once daily at 16:00 UTC (00:00 Philippine Time) to avoid Vercel Hobby deployment rejection
      expect(cron.schedule).toBe('0 16 * * *');
      // Verify it does NOT use hourly schedule that causes Hobby deployment rejection
      expect(cron.schedule).not.toBe('0 * * * *');
    });
  });

  describe('GitHub Actions Scheduled Workflow (.github/workflows/auto-release-cron.yml)', () => {
    it('should exist and define valid 30-minute schedule and workflow_dispatch', () => {
      expect(fs.existsSync(workflowPath)).toBe(true);
      const content = fs.readFileSync(workflowPath, 'utf8');

      // Check cron schedule: runs every 30 minutes
      expect(content).toMatch(/cron:\s*['"]\*\s*\/30\s*\*\s*\*\s*\*['"]|cron:\s*['"]\*\s*\/30\s*\*\s*\*\s*\*['"]|cron:\s*['"]\*\/30 \* \* \* \*['"]/);
      // Check manual dispatch trigger
      expect(content).toContain('workflow_dispatch:');
    });

    it('should authenticate with Bearer CRON_SECRET and target PRODUCTION_DOMAIN', () => {
      const content = fs.readFileSync(workflowPath, 'utf8');

      // Validates presence of secrets
      expect(content).toContain('secrets.PRODUCTION_DOMAIN');
      expect(content).toContain('secrets.CRON_SECRET');

      // Checks curl request targeting endpoint with Bearer auth header
      expect(content).toContain('/api/cron/auto-release');
      expect(content).toContain('Authorization: Bearer ${{ secrets.CRON_SECRET }}');
      // Verifies response checking on non-200 HTTP status
      expect(content).toMatch(/HTTP_STATUS.*-ne 200/);
    });

    it('should include robust domain sanitization, trap cleanup, and non-zero curl fallback', () => {
      const content = fs.readFileSync(workflowPath, 'utf8');

      // Whitespace, carriage return and newline stripping
      expect(content).toContain("tr -d '[:space:]\\r\\n'");
      // Protocol and subpath stripping
      expect(content).toContain('DOMAIN="${DOMAIN#https://}"');
      expect(content).toContain('DOMAIN="${DOMAIN#http://}"');
      expect(content).toContain('DOMAIN="${DOMAIN%%/*}"');

      // Safe tempfile cleanup trap on exit
      expect(content).toContain("trap 'rm -f \"$RESPONSE_FILE\"' EXIT");

      // Curl failure fallback to ensure HTTP_STATUS is always a numeric string
      expect(content).toContain('|| echo "000"');
    });

    it('should correctly sanitize edge-case domain formats', () => {
      const sanitizeDomain = (raw: string): string => {
        let domain = raw.replace(/[\s\r\n]+/g, '');
        domain = domain.replace(/^https?:\/\//, '');
        domain = domain.replace(/\/.*$/, '');
        return domain;
      };

      expect(sanitizeDomain('  subukan.vercel.app  ')).toBe('subukan.vercel.app');
      expect(sanitizeDomain('https://subukan.vercel.app/')).toBe('subukan.vercel.app');
      expect(sanitizeDomain('https://subukan.vercel.app/api/cron/auto-release')).toBe('subukan.vercel.app');
      expect(sanitizeDomain('http://subukan.ph/dashboard/')).toBe('subukan.ph');
      expect(sanitizeDomain("subukan.vercel.app\r\n")).toBe('subukan.vercel.app');
    });
  });

  describe('Operations Runbook Documentation (09-PRODUCTION-RUNBOOK.md)', () => {
    it('should document Vercel Hobby 1-cron/day limit and GitHub Actions runner', () => {
      expect(fs.existsSync(runbookPath)).toBe(true);
      const content = fs.readFileSync(runbookPath, 'utf8');

      // Documents Vercel Hobby limit
      expect(content).toContain('Vercel Hobby 1-Cron/Day Limit');
      // Documents 0 16 * * *
      expect(content).toContain('0 16 * * *');
      // Documents 30-minute GitHub Actions schedule
      expect(content).toContain('*/30 * * * *');
      // Documents required GitHub repository secrets
      expect(content).toContain('PRODUCTION_DOMAIN');
      expect(content).toContain('CRON_SECRET');
    });

    it('should document complete sequence of database migrations including 00015 and 00016', () => {
      const content = fs.readFileSync(runbookPath, 'utf8');

      expect(content).toContain('00015_add_dual_rail_payments.sql');
      expect(content).toContain('00016_enterprise_security_hardening.sql');
    });
  });
});
