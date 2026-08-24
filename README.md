# Vizow mobile Field Mode default

Makes the mobile product entry device-aware without changing desktop behavior.

- Phone `/app` defaults to `/app/field`.
- `/demo` Try/Back to Vizow goes directly to Field Mode on phone.
- Desktop `/app` remains the Site Mode Inbox.
- `/app/inbox` is the explicit Site Mode Inbox so Field Mode can deliberately open it without redirecting back to Field Mode.
- `/app?compose=request` remains Site Mode so Create Request still works on phone.
