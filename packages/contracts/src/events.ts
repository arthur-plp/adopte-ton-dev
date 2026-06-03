/**
 * Noms des événements RabbitMQ centralisés.
 * Utiliser ces constantes partout (émetteurs ET consommateurs).
 */
export const Events = {
  // users-svc
  DEVELOPER_PROFILE_UPDATED: "developer.profile.updated",
  USER_DELETED: "user.deleted",

  // jobs-svc
  JOB_PUBLISHED: "job.published",
  JOB_ARCHIVED: "job.archived",

  // applications-svc
  APPLICATION_CREATED: "application.created",
  APPLICATION_STATUS_CHANGED: "application.status.changed",

  // messaging-svc
  MESSAGE_SENT: "message.sent",

  // payment-svc
  PAYMENT_SUBSCRIPTION_UPDATED: "payment.subscription.updated",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
