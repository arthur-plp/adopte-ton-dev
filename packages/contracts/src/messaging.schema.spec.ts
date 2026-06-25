import {
  CreateConversationSchema,
  SendMessageSchema,
  SendMessageBodySchema,
} from './messaging.schema';

const validCuid = 'clxxxxxxxxxxxxxxxxxxxxxxxx';

describe('CreateConversationSchema', () => {
  it('valide une conversation entre recruteur et dev', () => {
    expect(() =>
      CreateConversationSchema.parse({ recruiterId: validCuid, developerId: validCuid }),
    ).not.toThrow();
  });

  it('accepte un jobOfferId optionnel', () => {
    const result = CreateConversationSchema.parse({
      recruiterId: validCuid,
      developerId: validCuid,
      jobOfferId: validCuid,
    });
    expect(result.jobOfferId).toBe(validCuid);
  });

  it('rejette un recruiterId vide', () => {
    expect(() =>
      CreateConversationSchema.parse({ recruiterId: '', developerId: validCuid }),
    ).toThrow();
  });

  it('rejette un recruiterId au format invalide (non-cuid)', () => {
    expect(() =>
      CreateConversationSchema.parse({ recruiterId: 'pas-un-cuid', developerId: validCuid }),
    ).toThrow();
  });

  it('rejette un developerId manquant', () => {
    expect(() =>
      CreateConversationSchema.parse({ recruiterId: validCuid }),
    ).toThrow();
  });
});

describe('SendMessageSchema', () => {
  it('valide un message correct', () => {
    const result = SendMessageSchema.parse({ conversationId: validCuid, content: 'Bonjour !' });
    expect(result.content).toBe('Bonjour !');
  });

  it('rejette un contenu vide', () => {
    expect(() =>
      SendMessageSchema.parse({ conversationId: validCuid, content: '' }),
    ).toThrow();
  });

  it('rejette un contenu > 5000 caractères', () => {
    expect(() =>
      SendMessageSchema.parse({ conversationId: validCuid, content: 'a'.repeat(5001) }),
    ).toThrow();
  });

  it('rejette un conversationId vide', () => {
    expect(() =>
      SendMessageSchema.parse({ conversationId: '', content: 'Texte' }),
    ).toThrow();
  });

  it('rejette un conversationId au format invalide (non-cuid)', () => {
    expect(() =>
      SendMessageSchema.parse({ conversationId: 'pas-un-cuid', content: 'Texte' }),
    ).toThrow();
  });

  it('supprime les balises HTML du contenu (sanitization XSS)', () => {
    const result = SendMessageSchema.parse({
      conversationId: validCuid,
      content: '<script>alert(1)</script>Salut',
    });
    expect(result.content).toBe('alert(1)Salut');
  });
});

describe('SendMessageBodySchema', () => {
  it('valide un contenu seul (sans conversationId)', () => {
    const result = SendMessageBodySchema.parse({ content: 'Bonjour !' });
    expect(result.content).toBe('Bonjour !');
  });

  it('rejette un contenu vide', () => {
    expect(() => SendMessageBodySchema.parse({ content: '' })).toThrow();
  });

  it('sanitize le contenu (XSS)', () => {
    const result = SendMessageBodySchema.parse({
      content: '<b>Salut</b>',
    });
    expect(result.content).toBe('Salut');
  });
});
