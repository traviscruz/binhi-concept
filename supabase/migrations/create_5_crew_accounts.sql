-- ==============================================================================
-- Migration: Create 5 Crew Accounts
-- Description: Inserts 5 technician accounts into auth.users, auth.identities, and public.profiles
-- Default Password for all 5: 123Travis
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Insert into auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES
  (
    'a1f0ed01-0001-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alfred.bartolome99@gmail.com',
    crypt('123Travis', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Alfred","last_name":"Bartolome","full_name":"Alfred Bartolome","role":"crew"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ),
  (
    'b2f0ed02-0002-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'romel.cruz88@gmail.com',
    crypt('123Travis', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Romel","last_name":"Cruz","full_name":"Romel Cruz","role":"crew"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ),
  (
    'c3f0ed03-0003-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'babylin.sevilla77@gmail.com',
    crypt('123Travis', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Babylin","last_name":"Sevilla","full_name":"Babylin Sevilla","role":"crew"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ),
  (
    'd4f0ed04-0004-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'myrol.carpio66@gmail.com',
    crypt('123Travis', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Myrol","last_name":"Carpio","full_name":"Myrol Carpio","role":"crew"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ),
  (
    'e5f0ed05-0005-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'jeff.capili55@gmail.com',
    crypt('123Travis', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Jeff","last_name":"Capili","full_name":"Jeff Capili","role":"crew"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = NOW();

-- 2. Insert into auth.identities
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES
  (
    'a1f0ed01-0001-4000-8000-000000000001',
    'a1f0ed01-0001-4000-8000-000000000001',
    jsonb_build_object('sub', 'a1f0ed01-0001-4000-8000-000000000001', 'email', 'alfred.bartolome99@gmail.com'),
    'email',
    'alfred.bartolome99@gmail.com',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    'b2f0ed02-0002-4000-8000-000000000002',
    'b2f0ed02-0002-4000-8000-000000000002',
    jsonb_build_object('sub', 'b2f0ed02-0002-4000-8000-000000000002', 'email', 'romel.cruz88@gmail.com'),
    'email',
    'romel.cruz88@gmail.com',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    'c3f0ed03-0003-4000-8000-000000000003',
    'c3f0ed03-0003-4000-8000-000000000003',
    jsonb_build_object('sub', 'c3f0ed03-0003-4000-8000-000000000003', 'email', 'babylin.sevilla77@gmail.com'),
    'email',
    'babylin.sevilla77@gmail.com',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    'd4f0ed04-0004-4000-8000-000000000004',
    'd4f0ed04-0004-4000-8000-000000000004',
    jsonb_build_object('sub', 'd4f0ed04-0004-4000-8000-000000000004', 'email', 'myrol.carpio66@gmail.com'),
    'email',
    'myrol.carpio66@gmail.com',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    'e5f0ed05-0005-4000-8000-000000000005',
    'e5f0ed05-0005-4000-8000-000000000005',
    jsonb_build_object('sub', 'e5f0ed05-0005-4000-8000-000000000005', 'email', 'jeff.capili55@gmail.com'),
    'email',
    'jeff.capili55@gmail.com',
    NOW(),
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Insert into public.profiles
INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  full_name,
  phone,
  is_phone_verified,
  role,
  avatar_url,
  created_at,
  updated_at,
  requires_password_change,
  loyalty_points
)
VALUES
  (
    'a1f0ed01-0001-4000-8000-000000000001',
    'alfred.bartolome99@gmail.com',
    'Alfred',
    'Bartolome',
    'Alfred Bartolome',
    '09171112233',
    false,
    'crew',
    NULL,
    NOW(),
    NOW(),
    false,
    0
  ),
  (
    'b2f0ed02-0002-4000-8000-000000000002',
    'romel.cruz88@gmail.com',
    'Romel',
    'Cruz',
    'Romel Cruz',
    '09182223344',
    false,
    'crew',
    NULL,
    NOW(),
    NOW(),
    false,
    0
  ),
  (
    'c3f0ed03-0003-4000-8000-000000000003',
    'babylin.sevilla77@gmail.com',
    'Babylin',
    'Sevilla',
    'Babylin Sevilla',
    '09193334455',
    false,
    'crew',
    NULL,
    NOW(),
    NOW(),
    false,
    0
  ),
  (
    'd4f0ed04-0004-4000-8000-000000000004',
    'myrol.carpio66@gmail.com',
    'Myrol',
    'Carpio',
    'Myrol Carpio',
    '09204445566',
    false,
    'crew',
    NULL,
    NOW(),
    NOW(),
    false,
    0
  ),
  (
    'e5f0ed05-0005-4000-8000-000000000005',
    'jeff.capili55@gmail.com',
    'Jeff',
    'Capili',
    'Jeff Capili',
    '09215556677',
    false,
    'crew',
    NULL,
    NOW(),
    NOW(),
    false,
    0
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  full_name = EXCLUDED.full_name,
  role = 'crew',
  requires_password_change = false,
  updated_at = NOW();
