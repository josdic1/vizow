import {
  type FormEvent,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router";

import {
  sendPublicRequest,
  uploadPublicRequestPhoto,
} from "../api/publicRequests";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import "../styles/public-intake.css";

function preferredDateLabel(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

type AddressDraft = {
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
};

const emptyAddressDraft: AddressDraft = {
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
};

export function PublicRequestPage() {
  const [searchParams] = useSearchParams();
  const preferredDate = preferredDateLabel(searchParams.get("preferredDate"));
  const [photos, setPhotos] = useState<File[]>([]);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(
    emptyAddressDraft,
  );
  const [status, setStatus] = useState<
    "idle" | "working" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  function updateAddressField(
    field: keyof AddressDraft,
    value: string,
  ): void {
    setAddressDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setStatus("working");
    setMessage("Sending your request…");

    try {
      const createdRequest = await sendPublicRequest({
        submittedName:
          String(formData.get("name") ?? "").trim(),
        submittedEmail:
          String(formData.get("email") ?? "").trim(),
        submittedPhone:
          String(formData.get("phone") ?? "").trim(),
        serviceAddressLine1:
          String(
            formData.get("addressLine1") ?? "",
          ).trim(),
        serviceAddressLine2:
          String(
            formData.get("addressLine2") ?? "",
          ).trim(),
        serviceCity:
          String(formData.get("city") ?? "").trim(),
        serviceState:
          String(formData.get("state") ?? "").trim(),
        servicePostalCode:
          String(
            formData.get("postalCode") ?? "",
          ).trim(),
        description:
          String(
            formData.get("description") ?? "",
          ).trim(),
        preferredTiming:
          String(
            formData.get("preferredTiming") ?? "",
          ).trim(),
        preferredContact:
          String(
            formData.get("preferredContact") ?? "",
          ).trim(),
      });

      let uploaded = 0;

      for (const photo of photos) {
        try {
          await uploadPublicRequestPhoto(
            createdRequest.id,
            photo,
          );
          uploaded += 1;
        } catch (error) {
          console.error(error);
        }
      }

      form.reset();
      setAddressDraft(emptyAddressDraft);
      setPhotos([]);
      setStatus("success");

      setMessage(
        photos.length === uploaded
          ? "Your request was received. The contractor will review it."
          : `Your request was received. ${uploaded} of ${photos.length} photo${
              photos.length === 1 ? "" : "s"
            } uploaded successfully.`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to send your request.",
      );
    }
  }

  return (
    <main className="public-intake-shell">
      <section className="public-intake-card">
        <header className="public-intake-header">
          <p className="eyebrow">Request Service</p>
          <h1>What can we help with?</h1>
          <p>
            Tell us what you need. Add photos if they help. The contractor will review everything and follow up before anything is scheduled.
          </p>
        </header>

        <aside className="public-intake-availability">
          <div>
            <p className="eyebrow">Before you request</p>
            <strong>Want to check availability first?</strong>
            <span>
              See the contractor&apos;s public availability without exposing their private schedule. Checking a date does not reserve a visit.
            </span>
          </div>
          <Link className="btn" to="/availability">View availability →</Link>
        </aside>

        <form
          className="public-request-form"
          onSubmit={handleSubmit}
        >
          <section className="public-request-section">
            <header className="public-request-section-heading">
              <span>01</span>
              <div>
                <h2>Your contact</h2>
                <p>Who should the contractor follow up with?</p>
              </div>
            </header>

            <div className="form-grid public-request-contact-grid">
              <label className="field">
                Name
                <input
                  className="input"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="field">
                Phone
                <input
                  className="input"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                />
              </label>

              <label className="field request-field-wide">
                Email
                <input
                  className="input"
                  name="email"
                  type="email"
                  autoComplete="email"
                />
              </label>
            </div>
          </section>

          <section className="public-request-section public-request-section-work">
            <header className="public-request-section-heading">
              <span>02</span>
              <div>
                <h2>The work</h2>
                <p>Describe the problem in your own words.</p>
              </div>
            </header>

            <label className="field">
              What do you need help with?
              <textarea
                className="textarea public-request-description"
                name="description"
                rows={5}
                required
                placeholder="What happened? What needs attention? Anything the contractor should know before following up?"
              />
            </label>
          </section>

          <section className="public-request-section">
            <header className="public-request-section-heading">
              <span>03</span>
              <div>
                <h2>Service location</h2>
                <p>Where is the work?</p>
              </div>
            </header>

            <div className="public-request-address-grid">
              <div className="field public-request-address-main">
                <label htmlFor="public-request-address-line1">
                  Service address
                </label>
                <AddressAutocomplete
                  id="public-request-address-line1"
                  name="addressLine1"
                  required
                  placeholder="Start typing your address"
                  value={addressDraft.addressLine1}
                  onValueChange={(value) => {
                    updateAddressField("addressLine1", value);

                    if (!value) {
                      setAddressDraft(emptyAddressDraft);
                    }
                  }}
                  onSelect={(suggestion) => {
                    setAddressDraft({
                      addressLine1: suggestion.addressLine1,
                      city: suggestion.city,
                      state: suggestion.state,
                      postalCode: suggestion.postalCode,
                    });
                  }}
                />
              </div>

              <label className="field">
                Apt / unit / suite
                <input
                  className="input"
                  name="addressLine2"
                  type="text"
                  autoComplete="address-line2"
                />
              </label>

              <label className="field public-request-city">
                City
                <input
                  className="input"
                  name="city"
                  type="text"
                  autoComplete="address-level2"
                  required
                  value={addressDraft.city}
                  onChange={(event) =>
                    updateAddressField("city", event.target.value)
                  }
                />
              </label>

              <label className="field">
                State
                <input
                  className="input"
                  name="state"
                  type="text"
                  autoComplete="address-level1"
                  required
                  value={addressDraft.state}
                  onChange={(event) =>
                    updateAddressField("state", event.target.value)
                  }
                />
              </label>

              <label className="field">
                ZIP / postal code
                <input
                  className="input"
                  name="postalCode"
                  type="text"
                  autoComplete="postal-code"
                  required
                  value={addressDraft.postalCode}
                  onChange={(event) =>
                    updateAddressField("postalCode", event.target.value)
                  }
                />
              </label>
            </div>
          </section>

          <section className="public-request-section">
            <header className="public-request-section-heading">
              <span>04</span>
              <div>
                <h2>Timing & follow-up</h2>
                <p>Helpful context, not a booking.</p>
              </div>
            </header>

            <div className="form-grid">
              <label className="field">
                Preferred timing
                <input
                  className="input"
                  name="preferredTiming"
                  type="text"
                  defaultValue={preferredDate}
                  placeholder="Tomorrow morning, this week, flexible…"
                />
              </label>

              <label className="field">
                Best way to reach you
                <input
                  className="input"
                  name="preferredContact"
                  type="text"
                  placeholder="Call, text, email…"
                />
              </label>
            </div>
          </section>

          <section className="public-request-section public-request-photo-section">
            <header className="public-request-section-heading">
              <span>05</span>
              <div>
                <h2>Photos</h2>
                <p>Optional. Add anything that helps explain the work.</p>
              </div>
            </header>

            <label className="field public-request-file-field">
              Add photos
              <input
                className="input"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) =>
                  setPhotos(
                    Array.from(
                      event.target.files ?? [],
                    ),
                  )
                }
              />
              <span className="request-field-note">
                {photos.length === 0
                  ? "No photos selected"
                  : `${photos.length} photo${
                      photos.length === 1 ? "" : "s"
                    } selected`}
              </span>
            </label>
          </section>

          {status === "success" && (
            <div
              className="notice notice-success"
              role="status"
            >
              {message}
            </div>
          )}

          {status === "error" && (
            <div
              className="notice notice-error"
              role="alert"
            >
              {message}
            </div>
          )}

          <footer className="public-request-submit-row">
            <div>
              <strong>Ready to send?</strong>
              <span>Nothing is scheduled until the contractor follows up.</span>
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={status === "working"}
            >
              {status === "working"
                ? "Sending…"
                : "Send Request →"}
            </button>
          </footer>
        </form>
      </section>
    </main>
  );
}
