export type JobAlertSubscriptionLike = {
  technologies: string[];
  remoteOk: boolean | null;
  location: string | null;
};

export type JobOfferLike = {
  requiredTechnologies: string[];
  remoteOk: boolean;
  location: string | null;
};

/**
 * Détermine si une offre publiée correspond à une alerte opportunité.
 * Critère technologies = intersection non vide (au moins une techno commune).
 * remoteOk/location ne filtrent que s'ils sont explicitement renseignés sur
 * l'abonnement (sinon ils n'excluent rien).
 */
export function matchesJobAlert(
  subscription: JobAlertSubscriptionLike,
  offer: JobOfferLike,
): boolean {
  if (subscription.technologies.length === 0) return false;

  const offerTechSet = new Set(
    offer.requiredTechnologies.map((t) => t.toLowerCase()),
  );
  const hasMatchingTech = subscription.technologies.some((t) =>
    offerTechSet.has(t.toLowerCase()),
  );
  if (!hasMatchingTech) return false;

  if (subscription.remoteOk === true && !offer.remoteOk) return false;

  if (
    subscription.location &&
    !offer.location?.toLowerCase().includes(subscription.location.toLowerCase())
  ) {
    return false;
  }

  return true;
}
