import { ExecutionContext, HttpException } from '@nestjs/common';
import { RedisRateLimitGuard } from './redis-rate-limit.guard';

const mockRedisClient = {
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
};

jest.mock('ioredis', () => jest.fn(() => mockRedisClient));

function makeContext(ip: string, path: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip, path, method: 'GET' }),
      getResponse: () => ({ setHeader: jest.fn() }),
    }),
  } as unknown as ExecutionContext;
}

describe('RedisRateLimitGuard', () => {
  let guard: RedisRateLimitGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RedisRateLimitGuard();
    guard.onModuleInit();
  });

  it('autorise la requête si le compteur est sous la limite', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(1);
    mockRedisClient.expire.mockResolvedValueOnce(1);

    const result = await guard.canActivate(
      makeContext('1.2.3.4', '/api/v1/job-offers'),
    );

    expect(result).toBe(true);
    expect(mockRedisClient.incr).toHaveBeenCalledWith(
      'ratelimit:1.2.3.4:/api/v1/job-offers',
    );
  });

  it("pose l'expiration uniquement au premier incrément de la fenêtre", async () => {
    mockRedisClient.incr.mockResolvedValueOnce(1);
    mockRedisClient.expire.mockResolvedValueOnce(1);

    await guard.canActivate(makeContext('1.2.3.4', '/api/v1/job-offers'));

    expect(mockRedisClient.expire).toHaveBeenCalledWith(
      'ratelimit:1.2.3.4:/api/v1/job-offers',
      60,
    );
  });

  it("ne repose pas l'expiration si le compteur n'est pas le premier de la fenêtre", async () => {
    mockRedisClient.incr.mockResolvedValueOnce(5);

    await guard.canActivate(makeContext('1.2.3.4', '/api/v1/job-offers'));

    expect(mockRedisClient.expire).not.toHaveBeenCalled();
  });

  it('rejette avec 429 si le compteur dépasse la limite', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(101);
    mockRedisClient.ttl.mockResolvedValueOnce(30);

    await expect(
      guard.canActivate(makeContext('1.2.3.4', '/api/v1/job-offers')),
    ).rejects.toThrow(HttpException);
  });

  it('autorise la requête (fail-open) si Redis est injoignable', async () => {
    mockRedisClient.incr.mockRejectedValueOnce(new Error('redis down'));

    const result = await guard.canActivate(
      makeContext('1.2.3.4', '/api/v1/job-offers'),
    );

    expect(result).toBe(true);
  });
});
