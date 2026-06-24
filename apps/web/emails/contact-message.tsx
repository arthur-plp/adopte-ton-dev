import {
  Body,
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

interface ContactMessageEmailProps {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export function ContactMessageEmail({
  name,
  email,
  subject,
  message,
}: ContactMessageEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Nouveau message de contact — ${subject}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.logoSection}>
            <Text style={styles.logo}>{"</>"} Adopte Ton Dev</Text>
          </Section>

          <Section style={styles.card}>
            <Heading style={styles.heading}>Nouveau message de contact</Heading>

            <Text style={styles.text}>
              <strong>{name}</strong> ({email}) a envoyé un message via le
              formulaire de contact.
            </Text>

            <Section style={styles.subjectBox}>
              <Text style={styles.subjectLabel}>Sujet</Text>
              <Text style={styles.subjectValue}>{subject}</Text>
            </Section>

            <Hr style={styles.hr} />

            <Text style={styles.messageText}>{message}</Text>

            <Hr style={styles.hr} />

            <Text style={styles.textSmall}>
              Pour répondre, écris directement à{" "}
              <Link href={`mailto:${email}`} style={styles.link}>
                {email}
              </Link>
              .
            </Text>
          </Section>

          <Text style={styles.footer}>
            © {new Date().getFullYear()} Adopte Ton Dev · Notification
            automatique
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
    margin: "0 0 20px",
  },
  subjectBox: {
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    padding: "12px 16px",
    margin: "0 0 20px",
  },
  subjectLabel: {
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "600",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "0 0 4px",
  },
  subjectValue: {
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: "600",
    margin: "0",
  },
  messageText: {
    color: "#334155",
    fontSize: "15px",
    lineHeight: "26px",
    margin: "0",
    whiteSpace: "pre-wrap" as const,
  },
  textSmall: {
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "0",
  },
  hr: {
    borderColor: "#e2e8f0",
    margin: "20px 0",
  },
  link: {
    color: "#6366f1",
  },
  footer: {
    color: "#94a3b8",
    fontSize: "12px",
    textAlign: "center" as const,
    marginTop: "24px",
  },
} as const;
