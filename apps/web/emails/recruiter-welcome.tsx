import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from "@react-email/components";

interface RecruiterWelcomeEmailProps {
  firstName: string;
  companyName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}

export function RecruiterWelcomeEmail({
  firstName,
  companyName,
  email,
  temporaryPassword,
  loginUrl,
}: RecruiterWelcomeEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Votre accès recruteur Adopte Ton Dev est prêt — {companyName}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Logo */}
          <Section style={styles.logoSection}>
            <Text style={styles.logo}>{"</>"} Adopte Ton Dev</Text>
          </Section>

          <Section style={styles.card}>
            <Heading style={styles.heading}>Bienvenue sur Adopte Ton Dev 🎉</Heading>

            <Text style={styles.text}>
              Bonjour {firstName},
            </Text>
            <Text style={styles.text}>
              Votre accès recruteur pour <strong>{companyName}</strong> vient d&apos;être créé.
              Vous pouvez dès maintenant publier des offres, rechercher des profils et entrer en
              contact avec des développeurs juniors motivés.
            </Text>

            {/* Identifiants */}
            <Section style={styles.credentialsBox}>
              <Text style={styles.credentialsTitle}>Vos identifiants de connexion</Text>
              <Row style={styles.credentialRow}>
                <Column style={styles.credentialLabel}>Email</Column>
                <Column style={styles.credentialValue}>{email}</Column>
              </Row>
              <Row style={styles.credentialRow}>
                <Column style={styles.credentialLabel}>Mot de passe temporaire *</Column>
                <Column>
                  <Text style={styles.passwordBadge}>{temporaryPassword}</Text>
                </Column>
              </Row>
            </Section>

            <Section style={styles.buttonSection}>
              <Button href={loginUrl} style={styles.button}>
                Me connecter
              </Button>
            </Section>

            <Section style={styles.warningBox}>
              <Text style={styles.warningText}>
                🔒 * Ce mot de passe est <strong>temporaire</strong> et a été généré par l&apos;équipe Adopte Ton Dev.
                Changez-le dès votre première connexion via &quot;Mot de passe oublié&quot; sur la page de connexion.
              </Text>
            </Section>

            <Hr style={styles.hr} />

            <Text style={styles.textSmall}>
              En tant que recruteur, vous pouvez :
            </Text>
            <Text style={styles.feature}>✓ Publier des offres de stage, alternance et premier emploi</Text>
            <Text style={styles.feature}>✓ Accéder aux profils de développeurs juniors qualifiés</Text>
            <Text style={styles.feature}>✓ Bénéficier du matching automatique par stack technologique</Text>
            <Text style={styles.feature}>✓ Contacter directement les candidats via la messagerie</Text>
          </Section>

          <Text style={styles.footer}>
            © {new Date().getFullYear()} Adopte Ton Dev · La plateforme des développeurs juniors
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: "#f8fafc",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    margin: "0",
    padding: "0",
  },
  container: {
    margin: "0 auto",
    maxWidth: "560px",
    padding: "40px 20px",
  },
  logoSection: { textAlign: "center" as const, marginBottom: "24px" },
  logo: { fontSize: "20px", fontWeight: "700", color: "#6366f1", margin: "0" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    padding: "40px",
  },
  heading: { color: "#0f172a", fontSize: "22px", fontWeight: "700", margin: "0 0 24px" },
  text: { color: "#334155", fontSize: "15px", lineHeight: "24px", margin: "0 0 16px" },
  credentialsBox: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "20px",
    margin: "24px 0",
  },
  credentialsTitle: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "0 0 12px",
  },
  credentialRow: { margin: "0 0 8px" },
  credentialLabel: {
    color: "#64748b",
    fontSize: "13px",
    width: "180px",
    paddingRight: "12px",
  },
  credentialValue: { color: "#0f172a", fontSize: "14px", fontWeight: "500" },
  passwordBadge: {
    backgroundColor: "#ede9fe",
    color: "#4c1d95",
    fontFamily: "monospace",
    fontSize: "15px",
    fontWeight: "600",
    padding: "4px 10px",
    borderRadius: "6px",
    display: "inline-block",
    margin: "0",
    letterSpacing: "0.05em",
  },
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
  warningBox: {
    backgroundColor: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: "8px",
    padding: "12px 16px",
    margin: "0 0 24px",
  },
  warningText: { color: "#92400e", fontSize: "13px", margin: "0" },
  hr: { borderColor: "#e2e8f0", margin: "24px 0" },
  textSmall: { color: "#64748b", fontSize: "13px", margin: "0 0 8px" },
  feature: { color: "#334155", fontSize: "13px", lineHeight: "20px", margin: "0 0 4px" },
  footer: {
    color: "#94a3b8",
    fontSize: "12px",
    textAlign: "center" as const,
    marginTop: "24px",
  },
} as const;
