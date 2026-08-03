import { Router } from "express";

import { env } from "../env.js";

export const addressAutocompleteRouter = Router();

type GeoapifyResult = {
  formatted?: unknown;
  address_line1?: unknown;
  housenumber?: unknown;
  street?: unknown;
  city?: unknown;
  county?: unknown;
  state?: unknown;
  state_code?: unknown;
  postcode?: unknown;
};

type GeoapifyResponse = {
  results?: GeoapifyResult[];
};

function stringValue(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

addressAutocompleteRouter.get(
  "/",
  async (request, response) => {
    const query =
      typeof request.query.q === "string"
        ? request.query.q.trim().slice(0, 120)
        : "";

    if (
      query.length < 3 ||
      !env.GEOAPIFY_API_KEY
    ) {
      response.json({
        ok: true,
        suggestions: [],
      });
      return;
    }

    const endpoint = new URL(
      "https://api.geoapify.com/v1/geocode/autocomplete",
    );

    endpoint.searchParams.set("text", query);
    endpoint.searchParams.set(
      "filter",
      "countrycode:us",
    );
    endpoint.searchParams.set(
      "bias",
      "proximity:-74.2613,40.7489",
    );
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("limit", "6");
    endpoint.searchParams.set(
      "apiKey",
      env.GEOAPIFY_API_KEY,
    );

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      5000,
    );

    try {
      const upstream = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!upstream.ok) {
        console.error(
          "Geoapify autocomplete status:",
          upstream.status,
        );

        response.json({
          ok: true,
          suggestions: [],
        });
        return;
      }

      const payload =
        (await upstream.json()) as GeoapifyResponse;

      const suggestions = (
        payload.results ?? []
      )
        .map((result) => {
          const addressLine1 =
            stringValue(result.address_line1) ||
            [
              stringValue(result.housenumber),
              stringValue(result.street),
            ]
              .filter(Boolean)
              .join(" ");

          const city =
            stringValue(result.city) ||
            stringValue(result.county);

          const state =
            stringValue(result.state_code) ||
            stringValue(result.state);

          const postalCode =
            stringValue(result.postcode);

          const label =
            stringValue(result.formatted) ||
            [
              addressLine1,
              city,
              state,
              postalCode,
            ]
              .filter(Boolean)
              .join(", ");

          return {
            label,
            addressLine1,
            city,
            state,
            postalCode,
          };
        })
        .filter(
          (suggestion) =>
            suggestion.label &&
            suggestion.addressLine1,
        )
        .filter(
          (suggestion, index, all) =>
            all.findIndex(
              (candidate) =>
                candidate.label ===
                suggestion.label,
            ) === index,
        )
        .slice(0, 6);

      response.json({
        ok: true,
        suggestions,
      });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.name !== "AbortError"
      ) {
        console.error(
          "Geoapify autocomplete failed:",
          error,
        );
      }

      response.json({
        ok: true,
        suggestions: [],
      });
    } finally {
      clearTimeout(timeout);
    }
  },
);
