import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import { render } from "@react-email/render";
import type { ReactElement } from "react";

const FROM =
  process.env["RESEND_FROM_EMAIL"] ?? "Adopte Ton Dev <onboarding@resend.dev>";

const DEV_MODE =
  process.env["NODE_ENV"] === "development" &&
  process.env["RESEND_FORCE_SEND"] !== "true";

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private _resend: Resend | undefined;

  private getResend(): Resend {
    if (!this._resend) this._resend = new Resend(process.env["RESEND_API_KEY"]);
    return this._resend;
  }

  async send(to: string, subject: string, element: ReactElement) {
    const html = await render(element);

    if (DEV_MODE) {
      this.logger.log(
        `📧 [DEV] Email simulé (non envoyé) → to=${to} subject="${subject}" ` +
          `(définir RESEND_FORCE_SEND=true pour envoyer réellement)`,
      );
      return;
    }

    await this.getResend().emails.send({ from: FROM, to, subject, html });
  }
}
