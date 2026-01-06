# Test Klant Accounts - Leskaarten Weergave

Deze app is nu geconfigureerd om leskaarten te tonen via Supabase Auth accounts.

## Setup

### 1. Environment Variables

Zorg dat je een `.env.local` bestand hebt in de `nieuwe app - kopie` directory met:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. Database Setup

Zorg dat je de SQL uit `setup-klantapp-leskaarten-view.sql` hebt uitgevoerd in Supabase SQL Editor.

### 3. Account Koppelen

Na het aanmaken van een Supabase Auth account, moet je het koppelen aan een klant:

```sql
-- Vervang de UUIDs met echte waarden
SELECT klantappversie1.link_customer_account(
    'auth-user-uuid-here'::UUID,  -- Van auth.users.id
    'member-uuid-here'::UUID      -- Van public.members.id
);
```

**Hoe vind je de UUIDs?**

1. **Auth User ID**: 
   - Ga naar Supabase Dashboard > Authentication > Users
   - Of gebruik: `SELECT id, email FROM auth.users;`

2. **Member ID**:
   - Gebruik: `SELECT id, name, email FROM public.members;`

## Testen

### 1. Start de Development Server

```bash
cd "nieuwe app - kopie"
npm install
npm run dev
```

### 2. Ga naar Auth Login

Open: `http://localhost:3000/auth-login`

### 3. Maak een Test Account

- Email: `test@example.com`
- Password: `test123456` (minimaal 6 karakters)

### 4. Koppel Account aan Klant

Na het aanmaken, voer uit in Supabase SQL Editor:

```sql
-- Vind de auth user ID
SELECT id, email FROM auth.users WHERE email = 'test@example.com';

-- Vind een member ID (bijvoorbeeld de eerste)
SELECT id, name, email FROM public.members LIMIT 1;

-- Koppel ze
SELECT klantappversie1.link_customer_account(
    (SELECT id FROM auth.users WHERE email = 'test@example.com' LIMIT 1),
    (SELECT id FROM public.members LIMIT 1)
);
```

### 5. Bekijk Leskaarten

- Log in op `/auth-login`
- Ga naar `/leskaarten` (of klik op "Leskaarten" in de bottom nav)
- Je zou nu je leskaarten moeten zien!

## Troubleshooting

### "Je bent niet ingelogd"
- Zorg dat je bent ingelogd via `/auth-login`
- Check of de session bestaat: `supabaseClient.auth.getSession()`

### "Geen actieve leskaarten gevonden"
- Check of de klant leskaarten heeft: 
  ```sql
  SELECT * FROM public.leskaarten WHERE status = 'actief' AND klant_id = 'member-uuid';
  ```
- Check of het account is gekoppeld:
  ```sql
  SELECT * FROM klantappversie1.customer_accounts WHERE auth_user_id = 'auth-user-uuid';
  ```

### "Fout bij ophalen leskaarten"
- Check of de views bestaan:
  ```sql
  SELECT * FROM information_schema.views 
  WHERE table_schema = 'klantappversie1' 
  AND table_name IN ('my_leskaarten', 'my_leskaart_overzicht');
  ```
- Check of RLS policies correct zijn ingesteld
- Check of de functie `get_current_member_id()` werkt:
  ```sql
  SELECT klantappversie1.get_current_member_id();
  ```

## Nuttige Queries

### Check alle gekoppelde accounts
```sql
SELECT 
    ca.auth_user_id,
    au.email as auth_email,
    ca.member_id,
    m.name as member_name,
    m.email as member_email
FROM klantappversie1.customer_accounts ca
LEFT JOIN auth.users au ON au.id = ca.auth_user_id
LEFT JOIN public.members m ON m.id = ca.member_id;
```

### Check leskaarten voor een specifieke klant
```sql
SELECT * FROM public.leskaarten 
WHERE klant_id = 'member-uuid' 
AND status = 'actief';
```

### Test de view als een specifieke gebruiker (in Supabase SQL Editor)
```sql
-- Dit werkt alleen als je de service_role gebruikt
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO 'auth-user-uuid';
SELECT * FROM klantappversie1.my_leskaarten;
```

## Volgende Stappen

1. ✅ Leskaarten weergave werkt
2. ⬜ Voeg logout functionaliteit toe
3. ⬜ Voeg error handling toe voor niet-gekoppelde accounts
4. ⬜ Voeg automatische redirect toe als niet ingelogd






