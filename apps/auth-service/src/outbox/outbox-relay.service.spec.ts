import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OutboxRelayService } from './outbox-relay.service';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockChannel = {
  assertExchange: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockReturnValue(true),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockConnection = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('amqplib', () => ({ connect: jest.fn() }));

import * as amqplib from 'amqplib';
const mockAmqp = amqplib as jest.Mocked<typeof amqplib>;

// Mock pg.Client pour ne pas faire de vraie connexion DB
const mockQuery = jest.fn();
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockEnd = jest.fn().mockResolvedValue(undefined);

jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    query: mockQuery,
    end: mockEnd,
  })),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('OutboxRelayService', () => {
  let service: OutboxRelayService;

  beforeEach(async () => {
    (mockAmqp.connect as jest.Mock).mockResolvedValue(mockConnection);
    mockChannel.assertExchange.mockResolvedValue(undefined);
    process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxRelayService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('amqp://localhost') },
        },
      ],
    }).compile();

    service = module.get<OutboxRelayService>(OutboxRelayService);
    jest.clearAllMocks();
    (mockAmqp.connect as jest.Mock).mockResolvedValue(mockConnection);
    mockChannel.assertExchange.mockResolvedValue(undefined);
    mockConnect.mockResolvedValue(undefined);
    mockEnd.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('flush', () => {
    it('ne fait rien si le channel n\'est pas connecté', async () => {
      // Sans onModuleInit(), le channel est null
      await service.flush();

      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('publie les events PENDING sur RabbitMQ et les marque SENT', async () => {
      await service.onModuleInit();

      const events = [
        { id: 'evt-1', type: 'developer.profile.updated', payload: { userId: 'u1' }, attempts: 0 },
        { id: 'evt-2', type: 'developer.profile.updated', payload: { userId: 'u2' }, attempts: 1 },
      ];
      // Premier appel = SELECT, puis UPDATE par event
      mockQuery
        .mockResolvedValueOnce({ rows: events })
        .mockResolvedValue({ rows: [] });

      await service.flush();

      expect(mockChannel.publish).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SENT'),
        expect.arrayContaining(['evt-1']),
      );
    });

    it('marque FAILED un event après MAX_ATTEMPTS (3) tentatives', async () => {
      await service.onModuleInit();

      const event = { id: 'evt-fail', type: 'x', payload: {}, attempts: 2 };
      mockQuery.mockResolvedValueOnce({ rows: [event] }).mockResolvedValue({ rows: [] });
      mockChannel.publish.mockImplementation(() => { throw new Error('RMQ error'); });

      await service.flush();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining(['FAILED', 'evt-fail']),
      );
    });

    it('ne traite pas les events si pas de channel (retour anticipé)', async () => {
      // channel null → retour immédiat
      await service.flush();

      expect(mockConnect).not.toHaveBeenCalled();
    });
  });
});
