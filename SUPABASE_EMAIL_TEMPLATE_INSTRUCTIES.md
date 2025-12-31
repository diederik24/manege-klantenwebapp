# Supabase Email Template Aanpassen voor OTP Code

Om de OTP email eruit te laten zien zoals in de screenshot (met grote code in plaats van link), moet je de email template aanpassen in Supabase.

## Stappen:

1. **Ga naar Supabase Dashboard**
   - Open je Supabase project
   - Ga naar: **Authentication** > **Email Templates**

2. **Pas de "Magic Link" template aan**
   - Klik op **"Magic Link"** template
   - Of maak een nieuwe template voor OTP

3. **Gebruik deze template:**

```html
<h2>Manege Duikse Hoef</h2>
<h1>Login code</h1>

<div style="font-size: 48px; font-weight: bold; letter-spacing: 8px; text-align: center; margin: 30px 0;">
  {{ .Token }}
</div>

<p style="text-align: center; color: #666;">
  Deze code verloopt over 20 minuten.
</p>

<div style="background-color: #fee; border-left: 4px solid #f00; padding: 15px; margin: 20px 0;">
  <p style="margin: 0; font-weight: bold; color: #c00;">
    ⚠️ Deel deze code NIET met anderen.
  </p>
  <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
    Voer deze code alleen in op de officiële Manege Duikse Hoef website. 
    Als iemand om deze code vraagt, kan dit een scam zijn.
  </p>
</div>

<p style="color: #666; font-size: 12px; margin-top: 30px;">
  Deze login werd aangevraagd op {{ .RequestedAt }}.
</p>

<p style="margin-top: 20px;">
  - Manege Duikse Hoef Team
</p>
```

## Variabelen die beschikbaar zijn:

- `{{ .Token }}` - De 6-cijferige OTP code
- `{{ .Email }}` - Het email adres
- `{{ .RequestedAt }}` - Tijdstip van aanvraag
- `{{ .SiteURL }}` - Je website URL

## Belangrijk:

- Zorg dat "Enable email signups" is ingeschakeld in Authentication > Settings
- Test de template door een OTP code te versturen
- De code wordt automatisch vervangen door `{{ .Token }}`



