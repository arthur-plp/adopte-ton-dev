import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface ResetPasswordEmailProps {
  userName: string;
  resetUrl: string;
  expiresInHours?: number;
}

export function ResetPasswordEmail({
  userName,
  resetUrl,
  expiresInHours = 1,
}: ResetPasswordEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Réinitialise ton mot de passe — Adopte Ton Dev</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Logo / Brand */}
          <Section style={styles.logoSection}>
            <Text style={styles.logo}>{"</>"} Adopte Ton Dev</Text>
          </Section>

          <Section style={styles.card}>
            <Heading style={styles.heading}>
              Réinitialisation de mot de passe
            </Heading>

            <Text style={styles.text}>Bonjour {userName},</Text>

            <Text style={styles.text}>
              Tu as demandé à réinitialiser ton mot de passe sur{" "}
              <strong>Adopte Ton Dev</strong>. Clique sur le bouton ci-dessous
              pour choisir un nouveau mot de passe.
            </Text>

            <Section style={styles.buttonSection}>
              <Button href={resetUrl} style={styles.button}>
                Réinitialiser mon mot de passe
              </Button>
            </Section>

            <Text style={styles.textSmall}>
              Ce lien expire dans <strong>{expiresInHours} heure{expiresInHours > 1 ? "s" : ""}</strong>.
              Si tu n&apos;as pas demandé cette réinitialisation, ignore cet email — ton
              compte reste sécurisé.
            </Text>

            <Hr style={styles.hr} />

            <Text style={styles.textMuted}>
              Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur
              :
            </Text>
            <Link href={resetUrl} style={styles.link}>
              {resetUrl}
            </Link>
          </Section>

          <Text style={styles.footer}>
            © {new Date().getFullYear()} Adopte Ton Dev · La plateforme des
            développeurs juniors
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: "#f8fafc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    margin: "0",
    padding: "0",
  },
  container: {
    margin: "0 auto",
    maxWidth: "560px",
    padding: "40px 20px",
  },
  logoSection: {
    textAlign: "center" as const,
    marginBottom: "24px",
  },
  logo: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#6366f1",
    margin: "0",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    padding: "40px",
  },
  heading: {
    color: "#0f172a",
    fontSize: "22px",
    fontWeight: "700",
    margin: "0 0 24px",
  },
  text: {
    color: "#334155",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px",
  },
  textSmall: {
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "16px 0 0",
  },
  textMuted: {
    color: "#94a3b8",
    fontSize: "12px",
    margin: "0 0 4px",
  },
  buttonSection: {
    textAlign: "center" as const,
    margin: "32px 0",
  },
  button: {
    backgroundColor: "#6366f1",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "600",
    padding: "12px 28px",
    textDecoration: "none",
    display: "inline-block",
  },
  hr: {
    borderColor: "#e2e8f0",
    margin: "24px 0 16px",
  },
  link: {
    color: "#6366f1",
    fontSize: "12px",
    wordBreak: "break-all" as const,
  },
  footer: {
    color: "#94a3b8",
    fontSize: "12px",
    textAlign: "center" as const,
    marginTop: "24px",
  },
} as const;
