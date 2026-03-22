import { vi } from 'vitest';
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' }, loading: false, isInitialized: true }),
}));
