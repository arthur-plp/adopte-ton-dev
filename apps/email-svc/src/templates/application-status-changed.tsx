import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const STATUS_LABELS: Record<string, string> = {
  SENT: "Envoyée",
  VIEWED: "Consultée",
  INTERVIEW: "Entretien",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
  WITHDRAWN: "Retirée",
};

interface ApplicationStatusChangedEmailProps {
  developerName: string;
  jobTitle: string;
  status: string;
  applicationUrl: string;
}

export function ApplicationStatusChangedEmail({
  developerName,
  jobTitle,
  status,
  applicationUrl,
}: ApplicationStatusChangedEmailProps) {
  const statusLabel = STATUS_LABELS[status] ?? status;

  return (
    <Html lang="fr">
      <Head />
      <Preview>
        Ta candidature pour « {jobTitle} » a évolué : {statusLabel}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.logoSection}>
            <Text style={styles.logo}>{"</>"} Adopte Ton Dev</Text>
          </Section>

          <Section style={styles.card}>
            <Heading style={styles.heading}>Mise à jour de candidature</Heading>

            <Text style={styles.text}>Bonjour {developerName},</Text>

            <Text style={styles.text}>
              Ta candidature pour <strong>« {jobTitle} »</strong> est passée au
              statut : <strong>{statusLabel}</strong>.
            </Text>

            <Section style={styles.buttonSection}>
              <Button href={applicationUrl} style={styles.button}>
                Voir ma candidature
              </Button>
            </Section>
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
  container: { margin: "0 auto", maxWidth: "560px", padding: "40px 20px" },
  logoSection: { textAlign: "center" as const, marginBottom: "24px" },
  logo: { fontSize: "20px", fontWeight: "700", color: "#6366f1", margin: "0" },
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
  text: { color: "#334155", fontSize: "15px", lineHeight: "24px", margin: "0 0 16px" },
  buttonSection: { textAlign: "center" as const, margin: "32px 0" },
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
  footer: {
    color: "#94a3b8",
    fontSize: "12px",
    textAlign: "center" as const,
    marginTop: "24px",
  },
} as const;
