import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../services/auth';
import { User } from '../types';

describe('AuthService normalization helpers', () => {
    it('normalizeUser converts snake-case company_id to companyId', () => {
        const raw: any = { id: 'u1', email: 'a@b.com', company_id: 'company-xyz' };
        const normalized: User = (AuthService as any).normalizeUser(raw);
        expect(normalized.companyId).toBe('company-xyz');
        // original value should still be accessible if needed
        expect((normalized as any).company_id).toBe('company-xyz');
    });

    it('normalizePayload handles user and users arrays', () => {
        const p: any = {
            user: { id: 'u2', company_id: 'c1' },
            users: [{ id: 'u3', company_id: 'c2' }],
        };
        const result: any = (AuthService as any).normalizePayload(p);
        expect(result.user.companyId).toBe('c1');
        expect(result.users[0].companyId).toBe('c2');
    });
});

describe('AuthService custom requests', () => {
    beforeEach(() => {
        // stub global fetch
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('requestCustomAuth returns normalized user from server', async () => {
        const fake = {
            ok: true,
            json: () => Promise.resolve({
                user: { id: 'u4', company_id: 'company-123' },
                accessToken: 'tok',
                refreshToken: 'ref',
            }),
        } as any;
        (global.fetch as unknown as vi.Mock).mockResolvedValue(fake);

        const resp: any = await (AuthService as any).requestCustomAuth('/foo', { hi: 'there' });
        expect(resp.user.companyId).toBe('company-123');
    });
});
