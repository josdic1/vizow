import { idSchema } from "@vizow/shared";
import { Router } from "express";

import { getOperation } from "../operations/operationTracker.js";

export const operationsRouter = Router();

operationsRouter.get("/:operationId", (request, response) => {
  const idResult = idSchema.safeParse(request.params.operationId);

  if (!idResult.success) {
    response.status(400).json({
      ok: false,
      error: "Invalid operation ID.",
    });
    return;
  }

  const operation = getOperation(idResult.data);

  if (!operation) {
    response.status(404).json({
      ok: false,
      error: "Operation was not found.",
    });
    return;
  }

  response.json({
    ok: true,
    operation,
  });
});
