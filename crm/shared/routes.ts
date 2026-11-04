import { z } from "zod";
import {
  insertClientSchema,
  insertChildSchema,
  insertDocumentSchema,
  insertActivitySchema,
  insertProductSchema,
  insertMeetingSchema,
  insertFinancialPlanSchema,
  insertStaffSchema,
  insertAdvisorAssignmentSchema,
  clients,
  children,
  documents,
  activities,
  products,
  meetings,
  financialPlans,
  staff,
  advisorAssignments,
} from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  staff: {
    list: {
      method: "GET" as const,
      path: "/api/staff" as const,
      responses: {
        200: z.array(z.custom<typeof staff.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/staff/:id" as const,
      responses: {
        200: z.custom<typeof staff.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/staff" as const,
      input: insertStaffSchema,
      responses: {
        201: z.custom<typeof staff.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PUT" as const,
      path: "/api/staff/:id" as const,
      input: insertStaffSchema.partial(),
      responses: {
        200: z.custom<typeof staff.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/staff/:id" as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    me: {
      method: "GET" as const,
      path: "/api/staff/me" as const,
      responses: {
        200: z.custom<typeof staff.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  advisorAssignments: {
    list: {
      method: "GET" as const,
      path: "/api/advisor-assignments" as const,
      responses: {
        200: z.array(z.custom<typeof advisorAssignments.$inferSelect>()),
      },
    },
    byAdmin: {
      method: "GET" as const,
      path: "/api/staff/:adminId/advisors" as const,
      responses: {
        200: z.array(z.custom<typeof staff.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/advisor-assignments" as const,
      input: insertAdvisorAssignmentSchema,
      responses: {
        201: z.custom<typeof advisorAssignments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/advisor-assignments/:id" as const,
      responses: {
        204: z.void(),
      },
    },
  },
  clients: {
    list: {
      method: "GET" as const,
      path: "/api/clients" as const,
      responses: {
        200: z.array(z.custom<typeof clients.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/clients/:id" as const,
      responses: {
        200: z.custom<typeof clients.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/clients" as const,
      input: insertClientSchema,
      responses: {
        201: z.custom<typeof clients.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PUT" as const,
      path: "/api/clients/:id" as const,
      input: insertClientSchema.partial(),
      responses: {
        200: z.custom<typeof clients.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
  children: {
    list: {
      method: "GET" as const,
      path: "/api/clients/:clientId/children" as const,
      responses: {
        200: z.array(z.custom<typeof children.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/clients/:clientId/children" as const,
      input: insertChildSchema.omit({ clientId: true }),
      responses: {
        201: z.custom<typeof children.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PUT" as const,
      path: "/api/children/:id" as const,
      input: insertChildSchema.partial(),
      responses: {
        200: z.custom<typeof children.$inferSelect>(),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/children/:id" as const,
      responses: {
        204: z.void(),
      },
    },
  },
  documents: {
    list: {
      method: "GET" as const,
      path: "/api/clients/:clientId/documents" as const,
      responses: {
        200: z.array(z.custom<typeof documents.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/clients/:clientId/documents" as const,
      input: insertDocumentSchema.omit({ clientId: true }),
      responses: {
        201: z.custom<typeof documents.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PUT" as const,
      path: "/api/documents/:id" as const,
      input: insertDocumentSchema.partial(),
      responses: {
        200: z.custom<typeof documents.$inferSelect>(),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/documents/:id" as const,
      responses: {
        204: z.void(),
      },
    },
  },
  activities: {
    list: {
      method: "GET" as const,
      path: "/api/clients/:clientId/activities" as const,
      responses: {
        200: z.array(z.custom<typeof activities.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/clients/:clientId/activities" as const,
      input: insertActivitySchema.omit({ clientId: true }),
      responses: {
        201: z.custom<typeof activities.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/activities/:id" as const,
      responses: {
        204: z.void(),
      },
    },
  },
  products: {
    list: {
      method: "GET" as const,
      path: "/api/clients/:clientId/products" as const,
      responses: {
        200: z.array(z.custom<typeof products.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/clients/:clientId/products" as const,
      input: insertProductSchema.omit({ clientId: true }),
      responses: {
        201: z.custom<typeof products.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  meetings: {
    list: {
      method: "GET" as const,
      path: "/api/clients/:clientId/meetings" as const,
      responses: {
        200: z.array(z.custom<typeof meetings.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/clients/:clientId/meetings" as const,
      input: insertMeetingSchema.omit({ clientId: true }),
      responses: {
        201: z.custom<typeof meetings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    summarize: {
      method: "POST" as const,
      path: "/api/meetings/:id/summarize" as const,
      responses: {
        200: z.custom<typeof meetings.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  plans: {
    list: {
      method: "GET" as const,
      path: "/api/clients/:clientId/plans" as const,
      responses: {
        200: z.array(z.custom<typeof financialPlans.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/clients/:clientId/plans" as const,
      input: insertFinancialPlanSchema.omit({ clientId: true }),
      responses: {
        201: z.custom<typeof financialPlans.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  audio: {
    upload: {
      method: "POST" as const,
      path: "/api/meetings/:id/audio" as const,
      input: z.object({ audio: z.string() }),
      responses: {
        200: z.custom<typeof meetings.$inferSelect>(),
      },
    },
  },
};

export function buildUrl(
  path: string,
  params?: Record<string, string | number>,
): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
