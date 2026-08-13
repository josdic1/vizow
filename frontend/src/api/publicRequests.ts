export type PublicRequestInput = {
  submittedName?: string;
  submittedEmail?: string;
  submittedPhone?: string;
  serviceAddressLine1?: string;
  serviceAddressLine2?: string;
  serviceCity?: string;
  serviceState?: string;
  servicePostalCode?: string;
  description: string;
  preferredTiming?: string;
  preferredContact?: string;
};

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === "string" ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

export async function sendPublicRequest(
  input: PublicRequestInput,
): Promise<{ id: string }> {
  const response = await fetch("/api/public/requests", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Unable to send request."));
  }

  const payload = (await response.json()) as { request: { id: string } };
  return payload.request;
}

export async function uploadPublicRequestPhoto(
  requestId: string,
  photo: File,
): Promise<void> {
  const formData = new FormData();
  formData.append("photo", photo);
  const response = await fetch(
    `/api/public/requests/${encodeURIComponent(requestId)}/photos`,
    { method: "POST", headers: { Accept: "application/json" }, body: formData },
  );

  if (!response.ok) {
    throw new Error(await readError(response, "Unable to upload photo."));
  }
}
