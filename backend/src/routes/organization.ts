import {
  organizationSchema,
  type Organization,
} from "@vizow/shared";
import { Router } from "express";

import { pool } from "../db/pool.js";
import { getOrganizationSlug } from "../organizationScope.js";

export const organizationRouter = Router();

organizationRouter.get("/", async (_request, response) => {
  try {
    const result = await pool.query<Organization>(
      `
        SELECT
          id,
          name,
          slug,
          email,
          phone,
          logo_url AS "logoUrl",
          brand_settings AS "brandSettings"
        FROM organizations
        WHERE slug = $1
      `,
      [getOrganizationSlug()],
    );

    const row = result.rows[0];

    if (!row) {
      response.status(500).json({
        ok: false,
        error: "Configured organization was not found.",
      });
      return;
    }

    const organization = organizationSchema.parse(row);

    response.json({
      ok: true,
      organization,
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      ok: false,
      error: "Unable to load organization.",
    });
  }
});
