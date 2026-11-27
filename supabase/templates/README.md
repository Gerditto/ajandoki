# E-mail-sablonok (Supabase → Authentication → Emails)

Mindkét sablonba ugyanez kerül: **Magic Link** és **Confirm signup**.
Tárgy: `Belépőkódod a Súgj! appba`

A link `token_hash`-t használ, így akkor is működik, ha a levelezőapp más
böngészőben nyitja meg. A `{{ .Token }}` a beírható számkód.
