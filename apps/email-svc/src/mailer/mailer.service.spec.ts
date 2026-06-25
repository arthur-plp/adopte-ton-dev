const mockSend = jest.fn();
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

// @react-email/render utilise un import() dynamique en interne, incompatible
// avec Jest/CJS sans --experimental-vm-modules : on le mocke pour tester la
// logique de MailerService (DEV_MODE, construction du payload Resend) sans
// dépendre du rendu HTML réel.
jest.mock("@react-email/render", () => ({
  render: jest.fn().mockResolvedValue("<p>Hello</p>"),
}));

import { MailerService } from "./mailer.service";
import { render } from "@react-email/render";

describe("MailerService", () => {
  let service: MailerService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      RESEND_FORCE_SEND: "true",
    };
    service = new MailerService();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("rend le composant React en HTML et envoie via Resend", async () => {
    const element = { type: "p", props: { children: "Hello" } } as never;

    await service.send("user@test.com", "Sujet", element);

    expect(render).toHaveBeenCalledWith(element);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@test.com",
        subject: "Sujet",
        html: "<p>Hello</p>",
      }),
    );
  });
});
